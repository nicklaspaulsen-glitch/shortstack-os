import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { anthropic, MODEL_HAIKU, getResponseText } from "@/lib/ai/claude-helpers";
import {
  THUMBNAIL_STYLES,
  getStylesByCategory,
  type StyleCategory,
} from "@/lib/thumbnail-styles";
import type Anthropic from "@anthropic-ai/sdk";
import { getStripe } from "@/lib/stripe/client";

// Trinity can fire up to 4 Claude calls + a synthesis call in one request.
// Default 10s Hobby limit is too tight; bump to 60s (max for Pro).
export const maxDuration = 60;

/**
 * Trinity AI Assistant — the centerpiece agent.
 *
 *  POST { message, conversation_id?, client_id? }
 *    → loads full user context (clients, leads, deals, revenue, tokens),
 *      runs Claude with tool-use (max 4 hops), persists the exchange,
 *      returns { conversation_id, reply, actions, stats }.
 *
 *  Client role users are auto-scoped to their own client record so the
 *  same endpoint powers the client portal version.
 */

// ──────────────────────────────────────────────────────────────────────────
// Tool definitions — Claude can call any of these to take action.
// Each tool maps to a handler below that runs with the caller's ownerId.
// ──────────────────────────────────────────────────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_my_data",
    description:
      "Get the user's current KPIs: active clients, total leads, leads today, monthly revenue (MRR), deals won, and AI token balance. Call this when the user asks 'how am I doing', asks about numbers, or when you need live context before making a recommendation.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_lead",
    description:
      "Create a new lead in the user's pipeline. Use this when the user says something like 'add a lead for Acme Corp' or 'I just got a referral — Bob at Acme'. All fields besides business_name are optional.",
    input_schema: {
      type: "object",
      properties: {
        business_name: { type: "string", description: "Company or business name." },
        owner_name: { type: "string", description: "Primary contact name." },
        email: { type: "string" },
        phone: { type: "string" },
        website: { type: "string" },
        industry: { type: "string" },
        source: {
          type: "string",
          description: "Where this lead came from (referral, manual, scrape, etc.). Defaults to 'manual'.",
        },
      },
      required: ["business_name"],
    },
  },
  {
    name: "create_task",
    description:
      "Create a task on the user's project board. If no board_id is provided, it will use the user's first/default board (or create one named 'Trinity Inbox').",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
        },
        due_date: { type: "string", description: "ISO date (YYYY-MM-DD)." },
        board_id: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "draft_outreach_message",
    description:
      "Draft a personalised DM, email, or SMS to a specific lead. Returns the drafted message text — Trinity does NOT auto-send, the user reviews first.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        channel: { type: "string", enum: ["email", "dm", "sms"] },
        angle: {
          type: "string",
          description: "Optional hook or angle for the message (e.g. 'congratulate on recent funding').",
        },
      },
      required: ["lead_id", "channel"],
    },
  },
  {
    name: "search_clients",
    description:
      "Fuzzy search the user's clients by business name. Returns up to 10 matches with id, business_name, mrr, package_tier, health_score.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search string — partial match on business_name." },
      },
      required: ["query"],
    },
  },
  {
    name: "create_payment_link",
    description:
      "Create a Stripe Payment Link for a specific client on the agency's connected Stripe account. Use when the user says 'send Acme a $500 payment link' or similar. Requires the agency to have Stripe Connect set up — returns a helpful error if not. Agency-only (not available to client-role users).",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "The client's UUID. Call search_clients first if you don't have it." },
        amount_cents: { type: "number", description: "Amount in cents (e.g. 50000 for $500)." },
        product_name: { type: "string", description: "Short product/service name shown on the Stripe page." },
        description: { type: "string", description: "Optional longer description." },
      },
      required: ["client_id", "amount_cents", "product_name"],
    },
  },
  {
    name: "send_invoice",
    description:
      "Create and email a Stripe invoice to a client on the agency's connected Stripe. Use when the user says 'invoice Acme $500 for last month's work'. Returns the hosted_invoice_url. Agency-only. Requires Stripe Connect.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        line_items: {
          type: "array",
          description: "One or more { amount_cents, description } line items.",
          items: {
            type: "object",
            properties: {
              amount_cents: { type: "number" },
              description: { type: "string" },
            },
            required: ["amount_cents", "description"],
          },
        },
        due_days: { type: "number", description: "Days until due (default 14)." },
        memo: { type: "string", description: "Optional memo shown in the invoice footer." },
      },
      required: ["client_id", "line_items"],
    },
  },
  {
    name: "schedule_social_post",
    description:
      "Schedule a social post by inserting into the content_calendar. Use when the user says 'post on Instagram tomorrow at 9am' or 'schedule a TikTok for Friday'. If no scheduled_at is provided, defaults to 24h from now.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "Optional — omit for personal/agency posts. Clients are auto-scoped." },
        title: { type: "string" },
        caption: { type: "string", description: "Post body / caption." },
        platform: {
          type: "string",
          enum: ["instagram_reels", "tiktok", "youtube_shorts", "linkedin", "facebook", "twitter"],
        },
        scheduled_at: {
          type: "string",
          description: "ISO datetime string. Defaults to 24h from now if omitted.",
        },
      },
      required: ["title", "platform"],
    },
  },
  {
    name: "search_leads",
    description:
      "Fuzzy search the user's leads by business name, industry, or city. Returns up to 10 matches with id, business_name, industry, city, status. Scoped to the caller's own leads.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search string — matches business_name, industry, or city." },
        status: {
          type: "string",
          enum: ["pending", "contacted", "replied", "won", "lost"],
          description: "Optional filter by lead status.",
        },
        limit: { type: "number", description: "Max results to return (default 10)." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_recent_conversations",
    description:
      "Read the most recent inbox messages / outreach replies across the user's leads and clients. Use when the user asks 'what are my latest replies?' or 'any new messages?'.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many recent entries to return (default 5)." },
      },
      required: [],
    },
  },
  {
    name: "generate_content_plan",
    description:
      "Kick off a content plan generation for a client — spreads posts across platforms over the given number of days and saves them to content_calendar. Agency-only. Use when user says 'generate a 30-day content plan for Acme'.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        days: { type: "number", description: "Number of days to plan (default 30)." },
        platforms: {
          type: "array",
          items: { type: "string" },
          description: "Platforms to target — e.g. ['instagram_reels','tiktok']. Defaults to IG Reels + TikTok.",
        },
      },
      required: ["client_id"],
    },
  },
  // ── Content creation ──
  {
    name: "create_ai_script",
    description:
      "Create a script in Script Lab (saved to content_scripts). Use when the user says 'write me a TikTok script about X' or 'draft a YouTube script for Acme'. Short-form by default; pass platform to target a channel.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short working title for the script." },
        content: { type: "string", description: "Full script body — hook, beats, CTA." },
        platform: {
          type: "string",
          enum: ["youtube", "tiktok", "instagram", "linkedin"],
          description: "Target platform. Maps to the publish_platform enum (instagram→instagram_reels, linkedin→linkedin_video).",
        },
        client_id: { type: "string", description: "Optional — attach the script to a specific client. Clients are auto-scoped." },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "create_email_draft",
    description:
      "Draft an email (saved, NOT sent) for the Email Composer. Use when the user says 'draft an email to X about Y' or 'write a follow-up email to Acme'. The user reviews before sending.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Email subject line." },
        body: { type: "string", description: "Email body (plain text or markdown)." },
        to: { type: "string", description: "Optional recipient email." },
        client_id: { type: "string", description: "Optional — associate with a client." },
        tone: { type: "string", description: "Optional tone hint (professional, friendly, urgent, etc.)." },
      },
      required: ["subject", "body"],
    },
  },
  {
    name: "create_blog_post",
    description:
      "Create a long-form blog post via Copywriter (saved to content_scripts as long_form). Use when the user says 'write a blog post about X' or 'draft a post for Acme on Y'. Defaults to draft status.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Blog post title / SEO headline." },
        content: { type: "string", description: "Full blog body in markdown." },
        excerpt: { type: "string", description: "Optional short summary / meta description." },
        client_id: { type: "string", description: "Optional — attach to a client." },
        status: { type: "string", enum: ["draft", "published"], description: "Defaults to 'draft'." },
      },
      required: ["title", "content"],
    },
  },
  // ── Media / creative ──
  {
    name: "generate_thumbnail",
    description:
      "Kick off an AI thumbnail generation on RunPod FLUX. Use when the user says 'make me a YouTube thumbnail for X' or 'generate a cover image'. Returns a thumbnail_id and a RunPod job_id — the image finishes async, the user polls /api/thumbnail/status. If the image service isn't configured, enqueues the row anyway so a worker can pick it up later.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "What should be in the thumbnail — subject, scene, vibe. Keep it a sentence or two." },
        style: {
          type: "string",
          description: "Optional style preset: 'youtube_classic', 'cinematic', 'minimal', 'bold_text', 'dark_moody', 'news_breaking', 'tutorial', 'listicle'. Defaults to 'youtube_classic'.",
        },
        client_id: { type: "string", description: "Optional — attach to a specific client. Clients are auto-scoped." },
        aspect: { type: "string", enum: ["16:9", "9:16", "1:1"], description: "Aspect ratio. Defaults to 16:9." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "face_swap_thumbnail",
    description:
      "Swap the user's face into a generated thumbnail via the RunPod FLUX InstantID pipeline. Use when the user says 'put my face in that thumbnail' or 'swap my face into a thumbnail of X'. The caller must have already uploaded a face image (public URL) via /api/thumbnail/face-upload. Accepts either an existing thumbnail_id OR a fresh prompt. Returns { thumbnail_id, job_id }. If the FLUX worker lacks InstantID nodes, returns a clear error.",
    input_schema: {
      type: "object",
      properties: {
        face_image_url: { type: "string", description: "Public URL of the user's face image (from the faces bucket)." },
        thumbnail_id: { type: "string", description: "Optional — an existing generated_images.id whose prompt should be reused." },
        prompt: { type: "string", description: "Optional — a fresh scene prompt (used when no thumbnail_id is provided)." },
        style: { type: "string", description: "Optional style preset. Defaults to 'youtube_classic'." },
        aspect: { type: "string", enum: ["16:9", "9:16", "1:1"], description: "Aspect ratio. Defaults to 16:9." },
        client_id: { type: "string", description: "Optional — attach to a client." },
      },
      required: ["face_image_url"],
    },
  },
  {
    name: "recreate_thumbnail_from_url",
    description:
      "Recreate a fresh version of a YouTube video's thumbnail by pasting its video URL. Fetches the video's public maxresdefault.jpg from ytimg, then runs FLUX img2img to generate a reimagined version. Use when the user says 'recreate this thumbnail <youtube url>' or 'remix the thumbnail from this video'. Supports watch URLs, Shorts, and youtu.be links. Returns { thumbnail_id, job_id, video_id }.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "YouTube video URL (watch, Shorts, or youtu.be)." },
        style_modifier: { type: "string", description: "Optional free-text style twist, e.g. 'cinematic', 'neon cyberpunk', 'MrBeast-style'." },
        aspect: { type: "string", enum: ["16:9", "9:16", "1:1"], description: "Aspect ratio. Defaults to 16:9." },
        client_id: { type: "string", description: "Optional — attach to a client." },
      },
      required: ["url"],
    },
  },
  {
    name: "generate_thumbnail_with_title",
    description:
      "One-shot: takes a topic, calls Claude Haiku to generate a punchy YouTube title + a short overlay hook + a detailed FLUX image prompt, then kicks off the FLUX job. Use when the user says 'generate me a title AND thumbnail for X' or 'give me a YouTube title and cover for X'. Returns { title, thumbnail_text_overlay, prompt, thumbnail_id, job_id }.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "What the video is about. A sentence or short phrase is enough." },
        style: { type: "string", description: "Optional style preset. Defaults to 'youtube_classic'." },
        aspect: { type: "string", enum: ["16:9", "9:16", "1:1"], description: "Aspect ratio. Defaults to 16:9." },
        variants: { type: "number", description: "Number of image variants (1-4). Default 1." },
        client_id: { type: "string", description: "Optional — attach to a client." },
      },
      required: ["topic"],
    },
  },
  {
    name: "generate_carousel",
    description:
      "Create a multi-slide Instagram/LinkedIn/TikTok carousel draft. Use when the user says 'make a carousel about X' or '7 slides on Y'. Claude will be called async via the carousel pipeline; this tool creates the tracking record scoped to the caller and returns the carousel_id.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "What the carousel is about — a headline or angle." },
        num_slides: { type: "number", description: "Slide count. Default 7. Clamped to 3–10." },
        platform: { type: "string", enum: ["instagram", "linkedin", "tiktok"], description: "Target platform. Defaults to 'instagram'." },
        client_id: { type: "string", description: "Optional — attach to a specific client." },
        tone: {
          type: "string",
          description: "Tone/style hint: 'minimalist', 'bold', 'corporate', 'playful', 'dark', 'gradient'. Defaults to 'bold'.",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "render_video",
    description:
      "Kick off a video render via the ShortStack video pipeline (Remotion template or Mochi text-to-video on RunPod). Use when the user says 'render a video for X' or 'turn this script into a reel'. Returns a video_id and queued status — the render finishes async. Agency + team_member only; clients can't spend GPU budget.",
    input_schema: {
      type: "object",
      properties: {
        script: { type: "string", description: "Video script or topic. Required." },
        style: {
          type: "string",
          description: "Style preset: 'modern-dark', 'clean-white', 'bold-gradient', 'neon', 'minimal', 'corporate', 'retro', 'cinematic'. Defaults to 'modern-dark'.",
        },
        client_id: { type: "string", description: "Optional — attach the video to a client." },
        platform: {
          type: "string",
          enum: ["youtube", "tiktok", "reel"],
          description: "Platform — controls aspect ratio. youtube=16:9, tiktok/reel=9:16. Defaults to 'reel'.",
        },
      },
      required: ["script"],
    },
  },
  // ── Automation / marketing ──
  {
    name: "scrape_lead_niche",
    description:
      "Kick off a Lead Finder scrape for a specific niche and location. Uses Google Maps to find businesses matching the niche in the city/state, writes them as leads scoped to the user, and returns how many were saved. Use when the user says 'find me plumbers in Austin' or 'scrape 50 dentists in Miami FL'. Agency-only.",
    input_schema: {
      type: "object",
      properties: {
        niche: { type: "string", description: "Business type to search for (e.g. 'dentist', 'roofer', 'med spa')." },
        city: { type: "string", description: "Optional city (e.g. 'Austin')." },
        state: { type: "string", description: "Optional state code or name (e.g. 'TX' or 'Texas')." },
        limit: { type: "number", description: "Max leads to save (default 50, capped at 100)." },
      },
      required: ["niche"],
    },
  },
  {
    name: "create_workflow",
    description:
      "Create a new automation workflow in the Workflow Builder. Stores the workflow under the user with an initial trigger node. Use when the user says 'build a workflow that emails new leads' or 'create an automation for won deals'. Agency-only.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short, unique workflow name." },
        description: { type: "string" },
        trigger_type: {
          type: "string",
          description: "What kicks the workflow off — e.g. 'new_lead', 'deal_won', 'schedule', 'webhook', 'manual'.",
        },
        steps: {
          type: "array",
          description: "Optional array of step objects ({ type, config }). Becomes workflow nodes.",
          items: { type: "object" },
        },
        client_id: { type: "string", description: "Optional — scope this workflow to a specific client." },
      },
      required: ["name", "trigger_type"],
    },
  },
  {
    name: "create_ad_campaign",
    description:
      "Create a new ad campaign record in the Ads Manager. Does NOT push to Meta/Google/TikTok APIs — it creates the campaign shell the user can launch from the Ads Manager UI. Use when the user says 'set up a Meta campaign for $50/day' or 'create a Google Ads campaign for Acme'. Agency-only.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        platform: { type: "string", enum: ["meta", "google", "tiktok", "linkedin"] },
        budget: { type: "number", description: "Daily budget in whole dollars (e.g. 50 for $50/day)." },
        goal: { type: "string", description: "Campaign objective — e.g. 'leads', 'traffic', 'conversions', 'awareness'." },
        client_id: { type: "string", description: "Optional — the client this campaign is running for." },
      },
      required: ["name", "platform"],
    },
  },
  {
    name: "publish_social_post",
    description:
      "Publish a social post RIGHT NOW (distinct from schedule_social_post which queues it for later). Fans out to every platform in `platforms` via the connected social provider (Zernio/Ayrshare). Use when the user says 'post this to Instagram and Twitter now' or 'publish immediately'.",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The post body / caption." },
        platforms: {
          type: "array",
          items: { type: "string" },
          description: "Platforms to publish to — e.g. ['instagram','facebook','twitter','linkedin','tiktok'].",
        },
        media_urls: {
          type: "array",
          items: { type: "string" },
          description: "Optional public URLs for images/video attached to the post.",
        },
        client_id: { type: "string", description: "Client whose connected social accounts to post from. Required unless caller is a client (auto-scoped)." },
      },
      required: ["content", "platforms"],
    },
  },
  // ── Ops / utility ──
  {
    name: "create_invoice",
    description:
      "Create a DRAFT Stripe invoice on the agency's connected Stripe account for a specific client. Use when the user wants to prepare an invoice without sending it yet (e.g. 'draft an invoice for Acme for $500'). Distinct from send_invoice, which finalizes and emails. Agency-only. Requires Stripe Connect.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "The client's UUID. Call search_clients first if needed." },
        amount: { type: "number", description: "Invoice amount in the target currency's major unit (e.g. 500 for $500.00)." },
        currency: { type: "string", description: "ISO currency code. Defaults to 'usd'." },
        description: { type: "string", description: "Optional line description / memo." },
        due_in_days: { type: "number", description: "Days until due (default 14, 1-365)." },
      },
      required: ["client_id", "amount"],
    },
  },
  {
    name: "create_content_calendar_item",
    description:
      "Add a planning entry to the content calendar. Use for CALENDAR PLANNING (an idea penciled in for a date), not scheduled publishing — use schedule_social_post for anything that should actually be posted. Good for 'add a YouTube video idea to my calendar for next Friday'.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title shown on the calendar." },
        scheduled_for: { type: "string", description: "ISO date or datetime this item is planned for." },
        platform: { type: "string", description: "Optional platform label (instagram_reels, tiktok, youtube_shorts, linkedin, facebook, twitter, etc.)." },
        content: { type: "string", description: "Optional notes / draft copy / outline." },
        client_id: { type: "string", description: "Optional client this item belongs to." },
        category: { type: "string", description: "Optional category tag (e.g. 'educational', 'promo', 'ugc')." },
      },
      required: ["title", "scheduled_for"],
    },
  },
  {
    name: "navigate_to_page",
    description:
      "Return a deep-link URL the user can click to jump to a specific page in the dashboard, optionally with prefilled query params. Trinity can't redirect the user on its own, so use this to hand them a link when they ask 'take me to my leads' or 'open the campaigns page'.",
    input_schema: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: [
            "leads", "pipeline", "content-plan", "campaigns", "invoices", "clients",
            "analytics", "script-lab", "thumbnail-generator", "email-composer",
            "copywriter", "ads-manager", "workflows", "content-calendar",
            "lead-finder", "video-editor", "carousel-generator",
          ],
          description: "Which dashboard page to link to.",
        },
        query: {
          type: "object",
          description: "Optional key/value pairs to encode as query-string params (prefilters, selected ids, etc.).",
          additionalProperties: { type: "string" },
        },
      },
      required: ["page"],
    },
  },
  // ── Ads Video Pack tools (video-editor/ads) ──────────────────────────
  {
    name: "generate_ad_from_description",
    description:
      "Generate a full IG Reels / TikTok ad project from a product or offer description. Writes a 30-second ad script (hook + benefits + CTA), picks B-roll moments, matches music, and creates a video_projects row with the Ads preset pre-loaded. Returns a video_id + edit_url the user can click to open in the video editor.",
    input_schema: {
      type: "object",
      properties: {
        product_description: {
          type: "string",
          description: "Plain-English description of the product, offer, or service to advertise.",
        },
        duration: {
          type: "number",
          description: "Ad length in seconds (15-60). Defaults to 30.",
        },
        client_id: { type: "string", description: "Optional client UUID to scope the project to." },
      },
      required: ["product_description"],
    },
  },
  {
    name: "generate_video_captions",
    description:
      "Generate word-level kinetic captions (TikTok / MrBeast style) from a video URL using Whisper. Stores the caption track on the video_captions table scoped to the caller. Styles: 'kinetic' (word-by-word highlight), 'classic' (standard subtitles), 'highlight' (single-word emphasis).",
    input_schema: {
      type: "object",
      properties: {
        video_url: { type: "string", description: "Publicly reachable URL to the video/audio." },
        style: {
          type: "string",
          enum: ["kinetic", "classic", "highlight"],
          description: "Caption style preset. Defaults to kinetic.",
        },
        language: { type: "string", description: "Two-letter language hint (default 'en')." },
        video_project_id: {
          type: "string",
          description: "Optional UUID of the video_projects row to attach captions to.",
        },
        client_id: { type: "string", description: "Optional client UUID." },
      },
      required: ["video_url"],
    },
  },
  {
    name: "suggest_broll_for_script",
    description:
      "Given a narration script, return 3-5 timed B-roll suggestions (time_range, description, search_terms, priority). If PEXELS_API_KEY is configured, also attaches a preview video URL. Use this when the user asks 'what B-roll should I add' or 'suggest cutaways for my script'.",
    input_schema: {
      type: "object",
      properties: {
        script: { type: "string", description: "The narration / ad script text." },
        count: { type: "number", description: "Number of suggestions (3-6, default 5)." },
        client_id: { type: "string", description: "Optional client UUID." },
      },
      required: ["script"],
    },
  },
  {
    name: "match_music_for_script",
    description:
      "Pick a royalty-free music track from the 20-track Ads music library based on mood, duration, and script. Returns a single track + 3 alternatives. Use this when the user asks 'find music for my ad' or 'what song fits this video'.",
    input_schema: {
      type: "object",
      properties: {
        script_mood: {
          type: "string",
          description: "Mood hint: 'upbeat', 'energetic', 'hype', or 'motivational'.",
        },
        duration: { type: "number", description: "Target video duration in seconds (default 30)." },
        preset: { type: "string", description: "Preset name (e.g. 'ads')." },
        script: { type: "string", description: "Optional script text for mood inference." },
        client_id: { type: "string", description: "Optional client UUID." },
      },
      required: [],
    },
  },
  // ── Thumbnail style library + edit-with-notes ──
  {
    name: "browse_thumbnail_styles",
    description:
      "Browse the 50-style thumbnail preset library. Use when the user is unsure which style to pick, or asks for recommendations (e.g. 'what's a good style for a finance video?'). Returns a list of presets with { id, name, category, description } so the assistant can recommend one. Pass the `id` to generate_thumbnail via its `style` param.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "Optional category filter: youtube_viral | tech | finance | gaming | food | fitness | business | education | entertainment | lifestyle | news | cinematic | minimal | experimental.",
        },
        search: {
          type: "string",
          description: "Optional free-text search (matches name, description, or category).",
        },
      },
      required: [],
    },
  },
  {
    name: "edit_thumbnail_with_notes",
    description:
      "Edit an existing thumbnail with a plain-English instruction. Use when the user says 'make the title bigger', 'change the background to a basketball court', or 'remove the watermark'. Re-runs FLUX img2img at moderate denoise so the composition survives but the change lands. Requires an existing thumbnail_id and an instruction string. Returns a new thumbnail_id + job_id to poll.",
    input_schema: {
      type: "object",
      properties: {
        thumbnail_id: { type: "string", description: "ID of the source thumbnail to edit." },
        instruction: { type: "string", description: "Plain-English change description." },
        denoise: {
          type: "number",
          description: "0.3 (subtle edit) to 0.8 (heavy rework). Default 0.5.",
        },
        aspect: { type: "string", enum: ["16:9", "9:16", "1:1"], description: "Optional. Defaults to 16:9." },
        client_id: { type: "string", description: "Optional client UUID." },
      },
      required: ["thumbnail_id", "instruction"],
    },
  },
  // ── AI footage auto-detect (Claude Vision) ─────────────────────────────
  {
    name: "classify_footage",
    description:
      "Auto-detect what TYPE of content a video clip is (webcam talking head, vlog, b-roll, screen recording, gameplay, product shot, interview, drone, animation, dance, slide, action) using Claude Sonnet Vision. Returns { footage_type, confidence, detected_subjects, lighting, motion_level, color_palette, recommended_creator_pack_id, suggested_edits } so the video editor can suggest a preset pack. Use when the user asks 'what kind of footage is this' or 'which preset pack should I use for this clip'. Requires a public URL to either the clip or a still frame.",
    input_schema: {
      type: "object",
      properties: {
        video_url: {
          type: "string",
          description:
            "Publicly reachable URL to the video clip OR a still frame/thumbnail of it. Claude Vision currently needs an image — if you have a video URL, extract a thumbnail first.",
        },
        client_id: { type: "string", description: "Optional client UUID." },
        frame_sample_count: {
          type: "number",
          description: "How many frames to sample from the clip (1-5, default 3). Forward-compat; today only the first frame is sent.",
        },
      },
      required: ["video_url"],
    },
  },
  // ── AI Auto-Edit Engine (detect-scenes → suggest → apply) ─────────────
  {
    name: "auto_edit_video",
    description:
      "Run the full Auto-Edit Engine pipeline on an uploaded clip: detect scenes via Claude Vision, generate timed SFX/caption/transition/colour-grade/B-roll/zoom suggestions, transcribe captions via Whisper, and find Pexels B-roll candidates. When auto_accept is true, every suggestion is written into the project's timeline. Personalises suggestions based on the user's past accept/reject history. Use when the user says things like 'Trinity, auto-edit this in MrBeast style', 'make this clip pop', or 'apply the full AI edit pass'. Requires a video_url (public) and a project_id that belongs to the user.",
    input_schema: {
      type: "object",
      properties: {
        video_url: {
          type: "string",
          description:
            "Publicly reachable URL to the clip OR a still frame. Whisper needs audio (mp3/mp4/wav) and scene detection needs image stills — pass a mp4 URL and the pipeline will do its best.",
        },
        project_id: {
          type: "string",
          description: "UUID of the video_projects row to attach the timeline to.",
        },
        creator_pack_id: {
          type: "string",
          description:
            "Optional creator pack ID (e.g. 'creator_mrbeast_challenge', 'creator_mkbhd_tech_review') to bias style.",
        },
        client_id: { type: "string", description: "Optional client UUID." },
        auto_accept: {
          type: "boolean",
          description:
            "When true, every generated suggestion is immediately applied to the project. Default false — user reviews suggestions in the UI.",
        },
      },
      required: ["video_url", "project_id"],
    },
  },
  {
    name: "suggest_edits",
    description:
      "Run detect-scenes + suggest (no apply, no auto-accept) and return the list of timed edit suggestions for the UI to render as accept/reject cards. Prefer this over auto_edit_video when the user wants to REVIEW suggestions before committing. Personalises based on past preferences.",
    input_schema: {
      type: "object",
      properties: {
        video_url: {
          type: "string",
          description: "Publicly reachable URL to the clip or a still frame.",
        },
        project_id: {
          type: "string",
          description: "UUID of the video_projects row (required for feedback logging + context).",
        },
        creator_pack_id: {
          type: "string",
          description: "Optional creator pack ID to bias style.",
        },
        client_id: { type: "string", description: "Optional client UUID." },
      },
      required: ["video_url", "project_id"],
    },
  },
  {
    name: "analyze_viral_video",
    description:
      "Reverse-engineer a viral YouTube or Shorts video. Fetches the public thumbnail, runs Claude Sonnet Vision against it with a curated few-shot exemplar library, and returns a structured pattern: thumbnail composition, dominant colors, text style, subject emotion, hook element, estimated pacing + cut frequency + probable SFX + caption use + color grade, a recommended creator_pack_id, and 3-6 key elements to replicate. Optionally stores the pattern as a reusable viral_template the user can apply later. Use when the user says 'analyze this viral video', 'what makes this thumbnail work', 'reverse-engineer this MrBeast video', or pastes a URL asking how to replicate it. Costs 3 tokens.",
    input_schema: {
      type: "object",
      properties: {
        source_url: {
          type: "string",
          description: "YouTube / Shorts / youtu.be URL to analyze. TikTok currently returns a graceful 'not yet' error.",
        },
        store_as_template: {
          type: "boolean",
          description: "When true, saves the extracted pattern to viral_templates scoped to the caller.",
        },
        niche_hint: {
          type: "string",
          description: "Optional niche hint ('finance', 'tech_review', 'challenge', etc.) — biases few-shot exemplar selection.",
        },
        client_id: { type: "string", description: "Optional client UUID to scope the template." },
      },
      required: ["source_url"],
    },
  },
  {
    name: "smart_thumbnail_variants",
    description:
      "Generate N thumbnail variants, each using a different style preset Claude picks for the given prompt. Kicks off parallel renders and returns the variant plan with job IDs the UI can poll. After all jobs land, the UI ranks them via /api/thumbnail/generate-variants/rank. Use when the user says 'give me a few thumbnail takes', 'try different styles', or 'which thumbnail would get the most clicks'. Costs ~3 tokens.",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The creator's brief for what the thumbnail should convey.",
        },
        count: {
          type: "number",
          description: "How many variants (2-6, default 4).",
        },
        platform: {
          type: "string",
          description: "youtube|instagram|tiktok|twitter|facebook|linkedin (default youtube).",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "analyze_thumbnail",
    description:
      "Analyse any thumbnail image and return composition, dominant colors, text overlay assessment, subject emotion, predicted 0-100 CTR, and concrete improvement suggestions. Works on the user's own thumbnails OR a viral reference they want to replicate. Use when the user says 'what's good about this thumbnail', 'predict my CTR', or 'why is this thumbnail viral'. Costs ~2 tokens.",
    input_schema: {
      type: "object",
      properties: {
        image_url: {
          type: "string",
          description: "Publicly reachable URL to the thumbnail image (or a data URL).",
        },
      },
      required: ["image_url"],
    },
  },
  {
    name: "smart_crop_thumbnail",
    description:
      "Smart-crop an image from its source aspect ratio to a target (16:9 → 9:16, 1:1, etc.). Uses Claude Sonnet Vision to locate the subject, then computes the largest centered crop that preserves them. Returns coords and, when the server has Sharp available, the cropped image as a data URL. Use when the user says 'crop this for Shorts', 'make a square version', 'repurpose this for Stories'. Costs ~1 token.",
    input_schema: {
      type: "object",
      properties: {
        image_url: { type: "string" },
        target_aspect: {
          type: "string",
          description: "Target aspect ratio as 'W:H' e.g. '9:16', '1:1', '16:9'.",
        },
      },
      required: ["image_url", "target_aspect"],
    },
  },
];

interface ToolCtx {
  ownerId: string;
  userId: string;
  role: string;
  clientScope: string | null; // when the caller is a client, actions are limited to this client_id
  /** Populated on the inbound POST handler — the auto-edit Trinity tools need these
   *  to call the sub-routes as the signed-in user. */
  origin?: string;
  cookieHeader?: string;
}

interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Tool handlers
// ──────────────────────────────────────────────────────────────────────────

async function runTool(name: string, input: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  const db = createServiceClient();
  // Lazy-init Stripe — used by create_payment_link, send_invoice, create_invoice tools.
  // Constructed inside the handler so build-time env-collection doesn't trip on
  // a missing STRIPE_SECRET_KEY. Tools that need it will surface the error.
  const stripe = getStripe();

  try {
    switch (name) {
      // ── get_my_data ──────────────────────────────────────────────────
      case "get_my_data": {
        const [
          { count: totalLeads },
          { count: leadsToday },
          { count: activeClients },
          { data: clientsRow },
          { count: dealsWon },
          { data: dealsRow },
          { data: profileRow },
        ] = await Promise.all([
          db.from("leads").select("*", { count: "exact", head: true }).eq("user_id", ctx.ownerId),
          db
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("user_id", ctx.ownerId)
            .gte("scraped_at", new Date().toISOString().split("T")[0]),
          db
            .from("clients")
            .select("*", { count: "exact", head: true })
            .eq("profile_id", ctx.ownerId)
            .eq("is_active", true),
          db.from("clients").select("mrr").eq("profile_id", ctx.ownerId).eq("is_active", true),
          db
            .from("deals")
            .select("*", { count: "exact", head: true })
            .eq("user_id", ctx.ownerId)
            .eq("status", "won"),
          db.from("deals").select("amount").eq("user_id", ctx.ownerId).eq("status", "won"),
          db.from("profiles").select("tokens_balance, plan_tier").eq("id", ctx.ownerId).maybeSingle(),
        ]);

        const totalMRR = (clientsRow || []).reduce(
          (s, c) => s + ((c as { mrr: number | null }).mrr || 0),
          0
        );
        const totalRevenue = (dealsRow || []).reduce(
          (s, d) => s + ((d as { amount: number | null }).amount || 0),
          0
        );

        return {
          ok: true,
          data: {
            total_leads: totalLeads || 0,
            leads_today: leadsToday || 0,
            active_clients: activeClients || 0,
            monthly_recurring_revenue: totalMRR,
            deals_won: dealsWon || 0,
            total_revenue: totalRevenue,
            tokens_balance: (profileRow as { tokens_balance?: number } | null)?.tokens_balance ?? null,
            plan_tier: (profileRow as { plan_tier?: string } | null)?.plan_tier ?? null,
          },
        };
      }

      // ── create_lead ──────────────────────────────────────────────────
      case "create_lead": {
        if (ctx.role === "client") return { ok: false, error: "Clients cannot create leads." };
        const business_name = typeof input.business_name === "string" ? input.business_name.trim() : "";
        if (!business_name) return { ok: false, error: "business_name required." };
        const { data, error } = await db
          .from("leads")
          .insert({
            user_id: ctx.ownerId,
            business_name,
            owner_name: (input.owner_name as string) || null,
            email: (input.email as string) || null,
            phone: (input.phone as string) || null,
            website: (input.website as string) || null,
            industry: (input.industry as string) || null,
            source: (input.source as string) || "manual",
            status: "new",
          })
          .select("id, business_name")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }

      // ── create_task ──────────────────────────────────────────────────
      case "create_task": {
        const title = typeof input.title === "string" ? input.title.trim() : "";
        if (!title) return { ok: false, error: "title required." };

        let boardId = typeof input.board_id === "string" ? input.board_id : "";

        // Resolve default board if none was passed.
        if (!boardId) {
          const { data: boards } = await db
            .from("project_boards")
            .select("id")
            .eq("user_id", ctx.ownerId)
            .order("created_at", { ascending: true })
            .limit(1);
          if (boards && boards.length > 0) {
            boardId = boards[0].id as string;
          } else {
            const { data: newBoard, error } = await db
              .from("project_boards")
              .insert({
                user_id: ctx.ownerId,
                name: "Trinity Inbox",
                icon: "sparkles",
                color: "#c8a855",
              })
              .select("id")
              .single();
            if (error || !newBoard) return { ok: false, error: error?.message || "Could not create board." };
            boardId = newBoard.id as string;
          }
        } else {
          // Verify board belongs to owner.
          const { data: b } = await db
            .from("project_boards")
            .select("id, user_id")
            .eq("id", boardId)
            .maybeSingle();
          if (!b || (b as { user_id: string }).user_id !== ctx.ownerId) {
            return { ok: false, error: "Board not found or access denied." };
          }
        }

        // Next position in 'backlog'.
        const { data: last } = await db
          .from("project_tasks")
          .select("position")
          .eq("board_id", boardId)
          .eq("status", "backlog")
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextPosition = ((last as { position?: number } | null)?.position ?? -1) + 1;

        const priority =
          typeof input.priority === "string" && ["low", "medium", "high", "urgent"].includes(input.priority)
            ? (input.priority as string)
            : "medium";

        const { data: task, error } = await db
          .from("project_tasks")
          .insert({
            board_id: boardId,
            title,
            description: (input.description as string) || null,
            status: "backlog",
            priority,
            due_date: (input.due_date as string) || null,
            position: nextPosition,
            created_by: ctx.userId,
          })
          .select("id, title, board_id")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: task };
      }

      // ── draft_outreach_message ──────────────────────────────────────
      case "draft_outreach_message": {
        const leadId = typeof input.lead_id === "string" ? input.lead_id : "";
        const channel = typeof input.channel === "string" ? input.channel : "email";
        if (!leadId) return { ok: false, error: "lead_id required." };

        const { data: lead } = await db
          .from("leads")
          .select("id, business_name, owner_name, industry, city, website, user_id")
          .eq("id", leadId)
          .maybeSingle();
        if (!lead) return { ok: false, error: "Lead not found." };
        if ((lead as { user_id: string }).user_id !== ctx.ownerId) {
          return { ok: false, error: "Access denied." };
        }

        const angle = typeof input.angle === "string" ? input.angle : "";
        const prompt = `Write a short ${channel === "email" ? "cold email" : channel.toUpperCase()} to ${
          (lead as { owner_name?: string }).owner_name || "the owner"
        } at ${(lead as { business_name: string }).business_name} (${
          (lead as { industry?: string }).industry || "business"
        }). ${angle ? `Angle: ${angle}.` : ""} Keep it under 80 words, warm but professional, one clear CTA. No markdown.`;

        const draft = await anthropic.messages.create({
          model: MODEL_HAIKU,
          max_tokens: 400,
          messages: [{ role: "user", content: prompt }],
        });

        return {
          ok: true,
          data: {
            lead_id: leadId,
            channel,
            message: getResponseText(draft),
          },
        };
      }

      // ── search_clients ──────────────────────────────────────────────
      case "search_clients": {
        const query = typeof input.query === "string" ? input.query.trim() : "";
        if (!query) return { ok: false, error: "query required." };
        let q = db
          .from("clients")
          .select("id, business_name, mrr, package_tier, health_score")
          .eq("profile_id", ctx.ownerId)
          .ilike("business_name", `%${query}%`)
          .limit(10);
        if (ctx.clientScope) q = q.eq("id", ctx.clientScope);
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: data || [] };
      }

      // ── create_payment_link ─────────────────────────────────────────
      case "create_payment_link": {
        if (ctx.role === "client") {
          return { ok: false, error: "Only the agency can create payment links." };
        }
        const clientId = typeof input.client_id === "string" ? input.client_id : "";
        const amount = Math.round(Number(input.amount_cents || 0));
        const productName = typeof input.product_name === "string" ? input.product_name.trim() : "";
        const description = typeof input.description === "string" ? input.description : "";
        if (!clientId) return { ok: false, error: "client_id required." };
        if (!amount || amount < 50) return { ok: false, error: "amount_cents must be at least 50." };
        if (!productName) return { ok: false, error: "product_name required." };

        // Ownership check — client must belong to this agency.
        const { data: client } = await db
          .from("clients")
          .select("id, business_name, profile_id")
          .eq("id", clientId)
          .maybeSingle();
        if (!client || (client as { profile_id: string }).profile_id !== ctx.ownerId) {
          return { ok: false, error: "Client not found or access denied." };
        }

        // Stripe Connect account must be live.
        const { data: account } = await db
          .from("agency_stripe_accounts")
          .select("stripe_account_id, charges_enabled")
          .eq("user_id", ctx.ownerId)
          .maybeSingle();
        const acct = account as { stripe_account_id?: string; charges_enabled?: boolean } | null;
        if (!acct?.stripe_account_id) {
          return {
            ok: false,
            error: "Stripe Connect isn't set up yet. Head to Settings → Payments to connect Stripe first.",
          };
        }
        if (!acct.charges_enabled) {
          return {
            ok: false,
            error: "Your Stripe account isn't ready to accept charges yet — finish Stripe onboarding first.",
          };
        }

        const connectOpts = { stripeAccount: acct.stripe_account_id };
        try {
          const product = await stripe.products.create(
            {
              name: productName,
              description: description || undefined,
              metadata: {
                shortstack_client_id: clientId,
                shortstack_agency_user_id: ctx.ownerId,
                shortstack_client_name: (client as { business_name?: string }).business_name || "",
              },
            },
            connectOpts,
          );
          const price = await stripe.prices.create(
            { product: product.id, unit_amount: amount, currency: "usd" },
            connectOpts,
          );
          const link = await stripe.paymentLinks.create(
            {
              line_items: [{ price: price.id, quantity: 1 }],
              metadata: {
                shortstack_client_id: clientId,
                shortstack_agency_user_id: ctx.ownerId,
              },
            },
            connectOpts,
          );

          const { data: inserted } = await db
            .from("client_payment_links")
            .insert({
              agency_user_id: ctx.ownerId,
              client_id: clientId,
              stripe_payment_link_id: link.id,
              url: link.url,
              amount_cents: amount,
              currency: "usd",
              product_name: productName,
              active: link.active,
            })
            .select("id, url")
            .single();

          return {
            ok: true,
            data: {
              url: link.url,
              amount_cents: amount,
              product_name: productName,
              payment_link_id: (inserted as { id?: string } | null)?.id || null,
            },
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Stripe refused the payment link.",
          };
        }
      }

      // ── send_invoice ────────────────────────────────────────────────
      case "send_invoice": {
        if (ctx.role === "client") {
          return { ok: false, error: "Only the agency can send invoices." };
        }
        const clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (!clientId) return { ok: false, error: "client_id required." };

        const rawItems = Array.isArray(input.line_items) ? (input.line_items as unknown[]) : [];
        const items = rawItems
          .map((i) => {
            const obj = (i && typeof i === "object" ? i : {}) as Record<string, unknown>;
            return {
              amount_cents: Math.round(Number(obj.amount_cents || 0)),
              description: String(obj.description || "").trim(),
            };
          })
          .filter((i) => i.amount_cents > 0 && i.description);
        if (items.length === 0) {
          return { ok: false, error: "line_items must have at least one { amount_cents, description }." };
        }
        const total = items.reduce((s, i) => s + i.amount_cents, 0);
        if (total < 50) return { ok: false, error: "Invoice total must be at least 50 cents." };

        const dueDays = Math.max(1, Math.min(365, Number(input.due_days || 14)));
        const memo = typeof input.memo === "string" ? input.memo : "";

        // Ownership check.
        const { data: client } = await db
          .from("clients")
          .select("id, business_name, email, contact_name, profile_id, agency_stripe_customer_id")
          .eq("id", clientId)
          .maybeSingle();
        if (!client || (client as { profile_id: string }).profile_id !== ctx.ownerId) {
          return { ok: false, error: "Client not found or access denied." };
        }
        const c = client as {
          id: string;
          business_name?: string;
          email?: string;
          contact_name?: string;
          agency_stripe_customer_id?: string | null;
        };
        if (!c.email) return { ok: false, error: "Client has no email on file — can't send invoice." };

        const { data: account } = await db
          .from("agency_stripe_accounts")
          .select("stripe_account_id, charges_enabled")
          .eq("user_id", ctx.ownerId)
          .maybeSingle();
        const acct = account as { stripe_account_id?: string; charges_enabled?: boolean } | null;
        if (!acct?.stripe_account_id) {
          return {
            ok: false,
            error: "Stripe Connect isn't set up. Connect Stripe in Settings → Payments first.",
          };
        }
        if (!acct.charges_enabled) {
          return {
            ok: false,
            error: "Your Stripe account isn't ready to accept charges yet — finish onboarding first.",
          };
        }

        const connectOpts = { stripeAccount: acct.stripe_account_id };
        try {
          let customerId = c.agency_stripe_customer_id || null;
          if (!customerId) {
            const customer = await stripe.customers.create(
              {
                email: c.email,
                name: c.business_name || c.contact_name || undefined,
                metadata: {
                  shortstack_client_id: c.id,
                  shortstack_agency_user_id: ctx.ownerId,
                },
              },
              connectOpts,
            );
            customerId = customer.id;
            await db
              .from("clients")
              .update({ agency_stripe_customer_id: customerId })
              .eq("id", c.id);
          }

          const invoice = await stripe.invoices.create(
            {
              customer: customerId,
              collection_method: "send_invoice",
              days_until_due: dueDays,
              currency: "usd",
              description: memo || undefined,
              metadata: {
                shortstack_client_id: c.id,
                shortstack_agency_user_id: ctx.ownerId,
              },
            },
            connectOpts,
          );
          if (!invoice.id) return { ok: false, error: "Stripe did not return an invoice ID." };

          for (const item of items) {
            await stripe.invoiceItems.create(
              {
                customer: customerId,
                invoice: invoice.id,
                amount: item.amount_cents,
                currency: "usd",
                description: item.description,
              },
              connectOpts,
            );
          }

          const finalized = await stripe.invoices.finalizeInvoice(invoice.id, {}, connectOpts);
          try {
            if (finalized.id) {
              await stripe.invoices.sendInvoice(finalized.id, {}, connectOpts);
            }
          } catch {
            // Non-fatal — hosted URL is already live.
          }

          const dueDate = finalized.due_date
            ? new Date(finalized.due_date * 1000).toISOString()
            : new Date(Date.now() + dueDays * 86_400_000).toISOString();

          await db.from("client_invoices").insert({
            agency_user_id: ctx.ownerId,
            client_id: c.id,
            agency_stripe_invoice_id: finalized.id || invoice.id,
            amount_cents: finalized.amount_due || total,
            currency: "usd",
            status: finalized.status || "open",
            hosted_invoice_url: finalized.hosted_invoice_url || null,
            due_date: dueDate,
          });

          return {
            ok: true,
            data: {
              hosted_invoice_url: finalized.hosted_invoice_url,
              amount_cents: finalized.amount_due || total,
              due_date: dueDate,
            },
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Stripe refused the invoice.",
          };
        }
      }

      // ── schedule_social_post ────────────────────────────────────────
      case "schedule_social_post": {
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const caption = typeof input.caption === "string" ? input.caption : "";
        const platformRaw = typeof input.platform === "string" ? input.platform : "";
        const allowedPlatforms = [
          "instagram_reels",
          "tiktok",
          "youtube_shorts",
          "linkedin",
          "facebook",
          "twitter",
        ];
        if (!title) return { ok: false, error: "title required." };
        if (!allowedPlatforms.includes(platformRaw)) {
          return { ok: false, error: `platform must be one of: ${allowedPlatforms.join(", ")}` };
        }

        // Scope: clients can only schedule for their own client row.
        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: c } = await db
            .from("clients")
            .select("id, profile_id")
            .eq("id", clientId)
            .maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        // Default to 24h from now if the caller didn't pass a date.
        let scheduledAt: string;
        if (typeof input.scheduled_at === "string" && input.scheduled_at) {
          const dt = new Date(input.scheduled_at);
          if (isNaN(dt.getTime())) return { ok: false, error: "scheduled_at is not a valid ISO datetime." };
          scheduledAt = dt.toISOString();
        } else {
          scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }

        const { data, error } = await db
          .from("content_calendar")
          .insert({
            client_id: clientId || null,
            user_id: ctx.ownerId,
            title,
            platform: platformRaw,
            scheduled_at: scheduledAt,
            status: "scheduled",
            notes: caption || null,
            metadata: { source: "trinity_assistant" },
          })
          .select("id, title, platform, scheduled_at")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }

      // ── search_leads ────────────────────────────────────────────────
      case "search_leads": {
        const query = typeof input.query === "string" ? input.query.trim() : "";
        if (!query) return { ok: false, error: "query required." };
        const limit = Math.max(1, Math.min(50, Number(input.limit || 10)));
        const status = typeof input.status === "string" ? input.status : "";
        let q = db
          .from("leads")
          .select("id, business_name, industry, city, status")
          .eq("user_id", ctx.ownerId)
          .or(
            `business_name.ilike.%${query}%,industry.ilike.%${query}%,city.ilike.%${query}%`,
          )
          .limit(limit);
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: data || [] };
      }

      // ── get_recent_conversations ────────────────────────────────────
      case "get_recent_conversations": {
        const limit = Math.max(1, Math.min(25, Number(input.limit || 5)));
        // outreach_log has no user_id — ownership flows through the joined
        // lead or client, so resolve owned ids first.
        const [{ data: ownedLeads }, { data: ownedClients }] = await Promise.all([
          db.from("leads").select("id").eq("user_id", ctx.ownerId),
          db.from("clients").select("id").eq("profile_id", ctx.ownerId),
        ]);
        const leadIds = (ownedLeads || []).map((l) => (l as { id: string }).id);
        const clientIds = (ownedClients || []).map((c) => (c as { id: string }).id);
        if (leadIds.length === 0 && clientIds.length === 0) {
          return { ok: true, data: [] };
        }
        const filters: string[] = [];
        if (leadIds.length > 0) filters.push(`lead_id.in.(${leadIds.join(",")})`);
        if (clientIds.length > 0) filters.push(`client_id.in.(${clientIds.join(",")})`);

        let q = db
          .from("outreach_log")
          .select("id, platform, business_name, status, message_text, reply_text, replied_at, sent_at, created_at")
          .or(filters.join(","))
          .order("created_at", { ascending: false })
          .limit(limit);
        if (ctx.role === "client" && ctx.clientScope) {
          q = q.eq("client_id", ctx.clientScope);
        }
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        // Trim message bodies so the tool result stays compact for Claude.
        const trimmed = (data || []).map((r) => {
          const row = r as Record<string, unknown>;
          const msg = typeof row.message_text === "string" ? row.message_text : "";
          const reply = typeof row.reply_text === "string" ? row.reply_text : "";
          return {
            ...row,
            message_text: msg.length > 200 ? msg.slice(0, 200) + "…" : msg,
            reply_text: reply.length > 200 ? reply.slice(0, 200) + "…" : reply,
          };
        });
        return { ok: true, data: trimmed };
      }

      // ── generate_content_plan ───────────────────────────────────────
      case "generate_content_plan": {
        if (ctx.role === "client") {
          return { ok: false, error: "Only the agency can generate content plans." };
        }
        const clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (!clientId) return { ok: false, error: "client_id required." };
        const days = Math.max(1, Math.min(365, Number(input.days || 30)));
        const platforms = Array.isArray(input.platforms) && input.platforms.length > 0
          ? (input.platforms as unknown[]).map((p) => String(p))
          : ["instagram_reels", "tiktok"];

        // Ownership check before we kick off any AI work.
        const { data: client } = await db
          .from("clients")
          .select("id, business_name, profile_id")
          .eq("id", clientId)
          .maybeSingle();
        if (!client || (client as { profile_id: string }).profile_id !== ctx.ownerId) {
          return { ok: false, error: "Client not found or access denied." };
        }

        // Pull any existing assets for this client so the generator has
        // something to work with. If none, generate_content_plan still
        // works in fill_gap mode (auto-generate creates ideas).
        const { data: assets } = await db
          .from("content_library")
          .select("id, file_url, file_name, file_type, mime_type, ai_package")
          .eq("client_id", clientId)
          .limit(200);

        const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
        const baseUrl = origin
          ? origin.startsWith("http")
            ? origin
            : `https://${origin}`
          : "";

        try {
          const res = await fetch(
            `${baseUrl}/api/content-plan/auto-generate`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                assets: assets || [],
                platforms,
                days,
                client_id: clientId,
                fill_gap: true,
              }),
            },
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            return { ok: false, error: data?.error || `content-plan/auto-generate returned ${res.status}` };
          }
          return {
            ok: true,
            data: {
              saved: Number(data?.saved || 0),
              days,
              platforms,
              link: `/dashboard/clients/${clientId}#content-plan`,
              warning: data?.warning || null,
            },
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to call content-plan/auto-generate.",
          };
        }
      }

      // ── create_ai_script ────────────────────────────────────────────
      case "create_ai_script": {
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const content = typeof input.content === "string" ? input.content : "";
        if (!title) return { ok: false, error: "title required." };
        if (!content) return { ok: false, error: "content required." };

        const platformMap: Record<string, string> = {
          youtube: "youtube",
          tiktok: "tiktok",
          instagram: "instagram_reels",
          linkedin: "linkedin_video",
        };
        const rawPlatform = typeof input.platform === "string" ? input.platform : "";
        const targetPlatform = platformMap[rawPlatform] || null;

        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        const { data, error } = await db
          .from("content_scripts")
          .insert({
            client_id: clientId || null,
            title,
            script_type: "short_form",
            script_body: content,
            target_platform: targetPlatform,
            status: "idea",
          })
          .select("id, title")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { script_id: (data as { id: string }).id, title: (data as { title: string }).title } };
      }

      // ── create_email_draft ──────────────────────────────────────────
      case "create_email_draft": {
        const subject = typeof input.subject === "string" ? input.subject.trim() : "";
        const body = typeof input.body === "string" ? input.body : "";
        if (!subject) return { ok: false, error: "subject required." };
        if (!body) return { ok: false, error: "body required." };
        const to = typeof input.to === "string" ? input.to : null;
        const tone = typeof input.tone === "string" ? input.tone : null;

        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        const { data, error } = await db
          .from("trinity_log")
          .insert({
            action_type: "custom",
            description: `Email draft: ${subject.slice(0, 100)}`,
            client_id: clientId || null,
            user_id: ctx.ownerId,
            status: "completed",
            agent: "email_composer",
            result: { source: "trinity_assistant", kind: "email_draft", subject, body, to, tone, drafted_at: new Date().toISOString() },
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { draft_id: (data as { id: string }).id, subject } };
      }

      // ── create_blog_post ────────────────────────────────────────────
      case "create_blog_post": {
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const content = typeof input.content === "string" ? input.content : "";
        if (!title) return { ok: false, error: "title required." };
        if (!content) return { ok: false, error: "content required." };
        const excerpt = typeof input.excerpt === "string" ? input.excerpt : null;
        const requestedStatus = typeof input.status === "string" ? input.status : "draft";
        const status = requestedStatus === "published" ? "published" : "scripted";

        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        const { data, error } = await db
          .from("content_scripts")
          .insert({
            client_id: clientId || null,
            title,
            script_type: "long_form",
            script_body: content,
            seo_title: title,
            description: excerpt,
            status,
          })
          .select("id, title, status")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { blog_post_id: (data as { id: string }).id, title: (data as { title: string }).title, status: (data as { status: string }).status } };
      }

      // ── generate_thumbnail ──────────────────────────────────────────
      case "generate_thumbnail": {
        const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
        if (!prompt) return { ok: false, error: "prompt required." };
        const style = typeof input.style === "string" ? input.style : "youtube_classic";
        const aspect = typeof input.aspect === "string" ? input.aspect : "16:9";
        const dims = aspect === "9:16" ? { width: 1080, height: 1920 } : aspect === "1:1" ? { width: 1080, height: 1080 } : { width: 1280, height: 720 };

        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        const fluxUrl = process.env.RUNPOD_FLUX_URL;
        const runpodKey = process.env.RUNPOD_API_KEY;
        let jobId: string | null = null;
        let initialStatus: "pending" | "processing" = "pending";

        if (fluxUrl && runpodKey) {
          try {
            const seed = Math.floor(Math.random() * 2147483647);
            const res = await fetch(`${fluxUrl}/run`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${runpodKey}` },
              body: JSON.stringify({
                input: {
                  workflow: {
                    "6": { inputs: { text: prompt, clip: ["30", 1] }, class_type: "CLIPTextEncode" },
                    "8": { inputs: { samples: ["31", 0], vae: ["30", 2] }, class_type: "VAEDecode" },
                    "9": { inputs: { filename_prefix: "ComfyUI", images: ["8", 0] }, class_type: "SaveImage" },
                    "27": { inputs: { width: Math.min(dims.width, 1024), height: Math.min(dims.height, 1024), batch_size: 1 }, class_type: "EmptySD3LatentImage" },
                    "30": { inputs: { ckpt_name: "flux1-dev-fp8.safetensors" }, class_type: "CheckpointLoaderSimple" },
                    "31": { inputs: { seed, steps: 12, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1, model: ["30", 0], positive: ["35", 0], negative: ["33", 0], latent_image: ["27", 0] }, class_type: "KSampler" },
                    "33": { inputs: { text: "blurry, low quality, watermark, text", clip: ["30", 1] }, class_type: "CLIPTextEncode" },
                    "35": { inputs: { guidance: 3.5, conditioning: ["6", 0] }, class_type: "FluxGuidance" },
                  },
                },
              }),
            });
            const job = await res.json();
            jobId = (job?.id as string) || null;
            if (jobId) initialStatus = "processing";
          } catch {
            // Non-fatal — row still queued for retry.
          }
        }

        const { data, error } = await db
          .from("generated_images")
          .insert({
            profile_id: ctx.ownerId,
            client_id: clientId || null,
            prompt,
            model: "flux1-dev-fp8",
            width: dims.width,
            height: dims.height,
            status: initialStatus,
            job_id: jobId,
            metadata: { source: "trinity_assistant", tool: "generate_thumbnail", style, aspect },
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };

        await db.from("generations").insert({
          user_id: ctx.ownerId,
          category: "thumbnail",
          title: prompt.slice(0, 80),
          source_tool: "Trinity Assistant",
          content_preview: prompt.slice(0, 200),
          metadata: { generated_image_id: (data as { id: string }).id, job_id: jobId, style, aspect },
        });

        return {
          ok: true,
          data: {
            thumbnail_id: (data as { id: string }).id,
            status: jobId ? "generating" : "queued",
            job_id: jobId,
            poll_url: jobId ? `/api/thumbnail/status?job_id=${jobId}` : null,
          },
        };
      }

      // ── face_swap_thumbnail ─────────────────────────────────────────
      case "face_swap_thumbnail": {
        const faceImageUrl = typeof input.face_image_url === "string" ? input.face_image_url.trim() : "";
        if (!faceImageUrl) return { ok: false, error: "face_image_url required (upload via /api/thumbnail/face-upload first)." };
        const thumbnailId = typeof input.thumbnail_id === "string" ? input.thumbnail_id : "";
        let sourcePrompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
        const style = typeof input.style === "string" ? input.style : "youtube_classic";
        const aspect = typeof input.aspect === "string" ? input.aspect : "16:9";
        const dims = aspect === "9:16" ? { width: 720, height: 1280 } : aspect === "1:1" ? { width: 1024, height: 1024 } : { width: 1280, height: 720 };

        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        if (thumbnailId && !sourcePrompt) {
          const { data: existing } = await db.from("generated_images").select("prompt, profile_id").eq("id", thumbnailId).maybeSingle();
          if (!existing) return { ok: false, error: "Thumbnail not found." };
          if ((existing as { profile_id: string }).profile_id !== ctx.ownerId) return { ok: false, error: "Thumbnail access denied." };
          sourcePrompt = (existing as { prompt: string | null }).prompt || "";
        }
        if (!sourcePrompt) return { ok: false, error: "Provide either thumbnail_id of an existing generation or a prompt." };

        const fluxUrl = process.env.RUNPOD_FLUX_URL;
        const runpodKey = process.env.RUNPOD_API_KEY;
        if (!fluxUrl || !runpodKey) return { ok: false, error: "RUNPOD_FLUX_URL / RUNPOD_API_KEY not configured." };

        const seed = Math.floor(Math.random() * 2147483647);
        const negativePrompt = "blurry, deformed, uncanny valley, plastic skin, dead eyes, face swap artifacts, different person";
        const workflow = {
          "1": { inputs: { ckpt_name: "flux1-dev-fp8.safetensors" }, class_type: "CheckpointLoaderSimple" },
          "2": { inputs: { url: faceImageUrl }, class_type: "LoadImageFromUrl" },
          "3": { inputs: { provider: "CPU" }, class_type: "InstantIDFaceAnalysis" },
          "4": { inputs: { instantid_file: "instantid-ip-adapter.bin" }, class_type: "InstantIDModelLoader" },
          "5": { inputs: { control_net_name: "instantid-controlnet.safetensors" }, class_type: "ControlNetLoader" },
          "6": { inputs: { text: sourcePrompt, clip: ["1", 1] }, class_type: "CLIPTextEncode" },
          "7": { inputs: { text: negativePrompt, clip: ["1", 1] }, class_type: "CLIPTextEncode" },
          "8": { inputs: { weight: 0.8, start_at: 0, end_at: 1, instantid: ["4", 0], insightface: ["3", 0], control_net: ["5", 0], image: ["2", 0], model: ["1", 0], positive: ["6", 0], negative: ["7", 0] }, class_type: "ApplyInstantID" },
          "9": { inputs: { width: Math.min(dims.width, 1024), height: Math.min(dims.height, 1024), batch_size: 1 }, class_type: "EmptySD3LatentImage" },
          "10": { inputs: { seed, steps: 14, cfg: 1.2, sampler_name: "euler", scheduler: "simple", denoise: 1, model: ["8", 0], positive: ["8", 1], negative: ["8", 2], latent_image: ["9", 0] }, class_type: "KSampler" },
          "11": { inputs: { samples: ["10", 0], vae: ["1", 2] }, class_type: "VAEDecode" },
          "12": { inputs: { filename_prefix: "FaceSwap", images: ["11", 0] }, class_type: "SaveImage" },
        };

        let jobId: string | null = null;
        let workerError: string | null = null;
        let instantIdMissing = false;
        try {
          const res = await fetch(`${fluxUrl}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${runpodKey}` },
            body: JSON.stringify({ input: { workflow } }),
          });
          const job = (await res.json()) as Record<string, unknown>;
          const errText = typeof job?.error === "string" ? job.error : typeof job?.message === "string" ? (job.message as string) : "";
          if (errText && /InstantID|LoadImageFromUrl|ApplyInstantID|InstantIDModelLoader|unknown class_type/i.test(errText)) {
            instantIdMissing = true;
            workerError = errText;
          } else if (typeof job?.id === "string") {
            jobId = job.id;
          } else if (errText) {
            workerError = errText;
          }
        } catch (e) {
          workerError = e instanceof Error ? e.message : "RunPod request failed";
        }
        if (instantIdMissing) {
          return { ok: false, error: "FaceSwap requires InstantID nodes — deploy the faceswap worker." };
        }
        if (!jobId) {
          return { ok: false, error: workerError || "RunPod did not return a job id." };
        }

        const { data, error } = await db
          .from("generated_images")
          .insert({
            profile_id: ctx.ownerId,
            client_id: clientId || null,
            prompt: sourcePrompt,
            model: "flux1-dev-fp8-instantid",
            width: dims.width,
            height: dims.height,
            status: "processing",
            job_id: jobId,
            metadata: { source: "face_swap", face_image_url: faceImageUrl, parent_thumbnail_id: thumbnailId || null, style, aspect, tool: "face_swap_thumbnail" },
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };

        return {
          ok: true,
          data: {
            thumbnail_id: (data as { id: string }).id,
            status: "processing",
            job_id: jobId,
            poll_url: `/api/thumbnail/status?job_id=${jobId}`,
          },
        };
      }

      // ── recreate_thumbnail_from_url ─────────────────────────────────
      case "recreate_thumbnail_from_url": {
        const rawUrl = typeof input.url === "string" ? input.url.trim() : "";
        if (!rawUrl) return { ok: false, error: "url required." };
        const styleModifier = typeof input.style_modifier === "string" ? input.style_modifier.trim() : "";
        const aspect = typeof input.aspect === "string" ? input.aspect : "16:9";
        const dims = aspect === "9:16" ? { width: 720, height: 1280 } : aspect === "1:1" ? { width: 1024, height: 1024 } : { width: 1280, height: 720 };

        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        // Parse video ID.
        let videoId: string | null = null;
        try {
          const url = new URL(rawUrl);
          const host = url.hostname.replace(/^www\./, "");
          if (host === "youtu.be") {
            const seg = url.pathname.replace(/^\//, "").split("/")[0];
            if (seg && /^[A-Za-z0-9_-]{6,}$/.test(seg)) videoId = seg;
          } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
            const v = url.searchParams.get("v");
            if (v && /^[A-Za-z0-9_-]{6,}$/.test(v)) videoId = v;
            else {
              const m = url.pathname.match(/\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,})/);
              if (m) videoId = m[1];
            }
          }
        } catch {
          return { ok: false, error: "Invalid URL." };
        }
        if (!videoId) return { ok: false, error: "Could not parse a YouTube video id from the URL." };

        // Fetch thumbnail from ytimg.
        let thumbBuf: Buffer | null = null;
        let thumbType = "image/jpeg";
        for (const res of ["maxresdefault", "hqdefault", "mqdefault"]) {
          try {
            const r = await fetch(`https://i.ytimg.com/vi/${videoId}/${res}.jpg`);
            if (r.ok) {
              const b = Buffer.from(await r.arrayBuffer());
              if (b.byteLength > 1000) {
                thumbBuf = b;
                thumbType = r.headers.get("content-type") || "image/jpeg";
                break;
              }
            }
          } catch {}
        }
        if (!thumbBuf) return { ok: false, error: `Could not fetch thumbnail for video ${videoId}.` };

        const refKey = `recreate-refs/${ctx.userId}/${videoId}-${Date.now()}.jpg`;
        const { error: upErr } = await db.storage.from("content-assets").upload(refKey, thumbBuf, { contentType: thumbType, upsert: true });
        if (upErr) return { ok: false, error: `Reference upload failed: ${upErr.message}` };
        const refPublic = db.storage.from("content-assets").getPublicUrl(refKey).data.publicUrl;

        const fluxUrl = process.env.RUNPOD_FLUX_URL;
        const runpodKey = process.env.RUNPOD_API_KEY;
        if (!fluxUrl || !runpodKey) return { ok: false, error: "RUNPOD_FLUX_URL / RUNPOD_API_KEY not configured." };

        const basePrompt = "recreate this YouTube thumbnail composition with fresh art direction, preserve the layout and subject placement but produce a brand new image, high-CTR viral thumbnail quality, sharp focus, vivid colors";
        const prompt = styleModifier ? `${basePrompt}, ${styleModifier}` : basePrompt;
        const seed = Math.floor(Math.random() * 2147483647);
        const workflow = {
          "1": { inputs: { ckpt_name: "flux1-dev-fp8.safetensors" }, class_type: "CheckpointLoaderSimple" },
          "2": { inputs: { url: refPublic }, class_type: "LoadImageFromUrl" },
          "3": { inputs: { pixels: ["2", 0], vae: ["1", 2] }, class_type: "VAEEncode" },
          "4": { inputs: { text: prompt, clip: ["1", 1] }, class_type: "CLIPTextEncode" },
          "5": { inputs: { text: "blurry, watermark, duplicate, identical image", clip: ["1", 1] }, class_type: "CLIPTextEncode" },
          "6": { inputs: { guidance: 3.5, conditioning: ["4", 0] }, class_type: "FluxGuidance" },
          "7": { inputs: { seed, steps: 14, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 0.65, model: ["1", 0], positive: ["6", 0], negative: ["5", 0], latent_image: ["3", 0] }, class_type: "KSampler" },
          "8": { inputs: { samples: ["7", 0], vae: ["1", 2] }, class_type: "VAEDecode" },
          "9": { inputs: { filename_prefix: "Recreate", images: ["8", 0] }, class_type: "SaveImage" },
        };

        let jobId: string | null = null;
        let runpodError: string | null = null;
        try {
          const res = await fetch(`${fluxUrl}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${runpodKey}` },
            body: JSON.stringify({ input: { workflow } }),
          });
          const job = (await res.json()) as Record<string, unknown>;
          if (typeof job?.id === "string") jobId = job.id;
          else runpodError = (job?.error as string) || (job?.message as string) || `RunPod ${res.status}`;
        } catch (e) {
          runpodError = e instanceof Error ? e.message : "RunPod request failed";
        }
        if (!jobId) return { ok: false, error: runpodError || "RunPod did not return a job id." };

        const { data, error } = await db
          .from("generated_images")
          .insert({
            profile_id: ctx.ownerId,
            client_id: clientId || null,
            prompt,
            model: "flux1-dev-fp8-img2img",
            width: dims.width,
            height: dims.height,
            status: "processing",
            job_id: jobId,
            metadata: { source: "recreate", youtube_video_id: videoId, reference_url: refPublic, style_modifier: styleModifier || null, aspect, tool: "recreate_thumbnail_from_url" },
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };

        return {
          ok: true,
          data: {
            thumbnail_id: (data as { id: string }).id,
            job_id: jobId,
            video_id: videoId,
            reference_url: refPublic,
            poll_url: `/api/thumbnail/status?job_id=${jobId}`,
          },
        };
      }

      // ── generate_thumbnail_with_title ───────────────────────────────
      case "generate_thumbnail_with_title": {
        const topic = typeof input.topic === "string" ? input.topic.trim() : "";
        if (!topic) return { ok: false, error: "topic required." };
        const style = typeof input.style === "string" ? input.style : "youtube_classic";
        const aspect = typeof input.aspect === "string" ? input.aspect : "16:9";
        const variantCount = Math.max(1, Math.min(4, Number(input.variants) || 1));
        const dims = aspect === "9:16" ? { width: 720, height: 1280 } : aspect === "1:1" ? { width: 1024, height: 1024 } : { width: 1280, height: 720 };

        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        // Step A — Claude Haiku produces title + overlay + FLUX prompt
        let ai: { title: string; thumbnail_text_overlay: string; flux_prompt: string } | null = null;
        try {
          const resp = await anthropic.messages.create({
            model: MODEL_HAIKU,
            max_tokens: 400,
            temperature: 0.8,
            system: "You are a viral YouTube creative director. Output JSON only — no preamble, no markdown fences.",
            messages: [{
              role: "user",
              content:
                `Topic: "${topic}"\nStyle: "${style}"\n\nOutput exactly this JSON and nothing else:\n{\n  "title": string (under 60 chars),\n  "thumbnail_text_overlay": string (1-6 words, ALL CAPS OK),\n  "flux_prompt": string (60-120 words describing the image; do NOT describe text)\n}`,
            }],
          });
          let raw = "";
          for (const block of resp.content) if (block.type === "text") raw = block.text;
          const stripped = raw.replace(/^```(?:json|JSON)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
          const parsed = JSON.parse(stripped);
          if (parsed?.title && parsed?.flux_prompt) {
            ai = {
              title: String(parsed.title).slice(0, 120),
              thumbnail_text_overlay: String(parsed.thumbnail_text_overlay || "").slice(0, 60),
              flux_prompt: String(parsed.flux_prompt),
            };
          }
        } catch {
          // fall through
        }
        if (!ai) return { ok: false, error: "Title AI failed — could not parse JSON." };
        const aiPayload = ai; // narrow once so the closures below don't lose the non-null type

        const fluxUrl = process.env.RUNPOD_FLUX_URL;
        const runpodKey = process.env.RUNPOD_API_KEY;
        if (!fluxUrl || !runpodKey) return { ok: false, error: "RUNPOD_FLUX_URL / RUNPOD_API_KEY not configured." };

        const negativePrompt = "blurry, low quality, text in image, words, letters, watermark, cropped";
        const seeds = Array.from({ length: variantCount }, (_, i) => Math.floor(Math.random() * 2147483647) + i * 1000);
        const jobs = await Promise.all(seeds.map(async (seed) => {
          const workflow = {
            "6": { inputs: { text: aiPayload.flux_prompt, clip: ["30", 1] }, class_type: "CLIPTextEncode" },
            "8": { inputs: { samples: ["31", 0], vae: ["30", 2] }, class_type: "VAEDecode" },
            "9": { inputs: { filename_prefix: "WithTitle", images: ["8", 0] }, class_type: "SaveImage" },
            "27": { inputs: { width: Math.min(dims.width, 1024), height: Math.min(dims.height, 1024), batch_size: 1 }, class_type: "EmptySD3LatentImage" },
            "30": { inputs: { ckpt_name: "flux1-dev-fp8.safetensors" }, class_type: "CheckpointLoaderSimple" },
            "31": { inputs: { seed, steps: 12, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1, model: ["30", 0], positive: ["35", 0], negative: ["33", 0], latent_image: ["27", 0] }, class_type: "KSampler" },
            "33": { inputs: { text: negativePrompt, clip: ["30", 1] }, class_type: "CLIPTextEncode" },
            "35": { inputs: { guidance: 3.5, conditioning: ["6", 0] }, class_type: "FluxGuidance" },
          };
          try {
            const res = await fetch(`${fluxUrl}/run`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${runpodKey}` },
              body: JSON.stringify({ input: { workflow } }),
            });
            const job = (await res.json()) as Record<string, unknown>;
            return { seed, jobId: typeof job?.id === "string" ? job.id : null };
          } catch {
            return { seed, jobId: null };
          }
        }));
        const successes = jobs.filter((j) => j.jobId);
        if (successes.length === 0) return { ok: false, error: "All FLUX jobs failed to queue." };

        const rows = successes.map((j) => ({
          profile_id: ctx.ownerId,
          client_id: clientId || null,
          prompt: aiPayload.flux_prompt,
          model: "flux1-dev-fp8",
          width: dims.width,
          height: dims.height,
          status: "processing" as const,
          job_id: j.jobId,
          metadata: { source: "with_title", topic, title: aiPayload.title, thumbnail_text_overlay: aiPayload.thumbnail_text_overlay, style, aspect, seed: j.seed, tool: "generate_thumbnail_with_title" },
        }));
        const { data: inserted, error } = await db.from("generated_images").insert(rows).select("id, job_id");
        if (error || !inserted) return { ok: false, error: error?.message || "Insert failed." };
        const first = inserted[0] as { id: string; job_id: string };

        return {
          ok: true,
          data: {
            title: aiPayload.title,
            thumbnail_text_overlay: aiPayload.thumbnail_text_overlay,
            prompt: aiPayload.flux_prompt,
            thumbnail_id: first.id,
            job_id: first.job_id,
            poll_url: `/api/thumbnail/status?job_id=${first.job_id}`,
            variants: inserted.length > 1 ? (inserted as Array<{ id: string; job_id: string }>).map((r) => ({ thumbnail_id: r.id, job_id: r.job_id })) : undefined,
          },
        };
      }

      // ── generate_carousel ───────────────────────────────────────────
      case "generate_carousel": {
        const topic = typeof input.topic === "string" ? input.topic.trim() : "";
        if (!topic) return { ok: false, error: "topic required." };
        const rawCount = Number(input.num_slides || 7);
        const numSlides = Math.max(3, Math.min(10, Math.round(rawCount)));
        const platform = typeof input.platform === "string" && ["instagram", "linkedin", "tiktok"].includes(input.platform) ? (input.platform as string) : "instagram";
        const tone = typeof input.tone === "string" ? input.tone : "bold";

        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        const { data, error } = await db
          .from("generations")
          .insert({
            user_id: ctx.ownerId,
            category: "social_post",
            title: `Carousel: ${topic.slice(0, 60)}`,
            source_tool: "Carousel Generator",
            content_preview: topic.slice(0, 200),
            metadata: { source: "trinity_assistant", tool: "generate_carousel", topic, num_slides: numSlides, platform, tone, client_id: clientId || null, status: "queued" },
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };
        return {
          ok: true,
          data: {
            carousel_id: (data as { id: string }).id,
            num_slides: numSlides,
            platform,
            link: `/dashboard/carousel-generator?topic=${encodeURIComponent(topic)}&slides=${numSlides}&style=${tone}`,
          },
        };
      }

      // ── render_video ────────────────────────────────────────────────
      case "render_video": {
        if (ctx.role === "client") return { ok: false, error: "Only the agency can render videos." };
        const script = typeof input.script === "string" ? input.script.trim() : "";
        if (!script) return { ok: false, error: "script required." };
        const style = typeof input.style === "string" ? input.style : "modern-dark";
        const platform = typeof input.platform === "string" && ["youtube", "tiktok", "reel"].includes(input.platform) ? (input.platform as string) : "reel";
        const aspectRatio = platform === "youtube" ? "16:9" : "9:16";

        const clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        const hasRender = !!(process.env.REMOTION_RENDER_URL || process.env.RUNPOD_SVD_URL || process.env.HIGGSFIELD_URL);
        if (!hasRender) {
          return { ok: false, error: "Video service not configured — set RUNPOD_SVD_URL or REMOTION_RENDER_URL" };
        }

        const title = script.slice(0, 60);
        const { data, error } = await db
          .from("video_projects")
          .insert({
            profile_id: ctx.ownerId,
            client_id: clientId || null,
            topic: title,
            title,
            duration: 30,
            style_preset: style,
            script: { raw: script },
            render_status: "draft",
            status: "active",
            editor_settings: { source: "trinity_assistant", platform, aspect_ratio: aspectRatio, queued_at: new Date().toISOString() },
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };

        await db.from("generations").insert({
          user_id: ctx.ownerId,
          category: "video",
          title: `Video: ${title}`,
          source_tool: "Trinity Assistant",
          content_preview: script.slice(0, 200),
          metadata: { video_project_id: (data as { id: string }).id, style, platform },
        });

        return {
          ok: true,
          data: {
            video_id: (data as { id: string }).id,
            status: "queued",
            platform,
            aspect_ratio: aspectRatio,
            render_url: `/dashboard/video-editor/${(data as { id: string }).id}`,
          },
        };
      }

      // ── scrape_lead_niche ───────────────────────────────────────────
      case "scrape_lead_niche": {
        if (ctx.role === "client") return { ok: false, error: "Only the agency can scrape leads." };
        const niche = typeof input.niche === "string" ? input.niche.trim() : "";
        if (!niche) return { ok: false, error: "niche required." };
        const city = typeof input.city === "string" ? input.city.trim() : "";
        const state = typeof input.state === "string" ? input.state.trim() : "";
        const limit = Math.max(1, Math.min(100, Number(input.limit || 50)));
        const location = [city, state].filter(Boolean).join(", ") || "United States";

        const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
        const baseUrl = origin ? (origin.startsWith("http") ? origin : `https://${origin}`) : "";

        try {
          const res = await fetch(`${baseUrl}/api/scraper/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platforms: ["google_maps"],
              niches: [niche],
              locations: [location],
              max_results_per_search: limit,
              filters: {},
              tags: [],
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { ok: false, error: data?.error || `scraper/run returned ${res.status}` };
          return {
            ok: true,
            data: {
              scrape_job_id: `scrape_${Date.now()}`,
              status: "completed",
              estimated_leads: Number(data?.totalScraped || 0),
              skipped: Number(data?.totalSkipped || 0),
              niche,
              location,
              link: "/dashboard/leads",
            },
          };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Failed to call scraper/run." };
        }
      }

      // ── create_workflow ─────────────────────────────────────────────
      case "create_workflow": {
        if (ctx.role === "client") return { ok: false, error: "Only the agency can create workflows." };
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (!name) return { ok: false, error: "name required." };
        const triggerType = typeof input.trigger_type === "string" ? input.trigger_type.trim() : "";
        if (!triggerType) return { ok: false, error: "trigger_type required." };
        const description = typeof input.description === "string" ? input.description : null;
        const clientId = typeof input.client_id === "string" ? input.client_id : "";

        if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        const rawSteps = Array.isArray(input.steps) ? (input.steps as unknown[]) : [];
        const triggerNode = { id: "trigger", type: "trigger", data: { trigger_type: triggerType, client_id: clientId || null } };
        const stepNodes = rawSteps.map((s, i) => ({ id: `step_${i + 1}`, type: "action", data: s }));
        const nodes = [triggerNode, ...stepNodes];
        const edges = stepNodes.map((_, i) => ({ id: `edge_${i}`, source: i === 0 ? "trigger" : `step_${i}`, target: `step_${i + 1}` }));

        const { data, error } = await db
          .from("workflows")
          .upsert({ user_id: ctx.ownerId, name, description, nodes, edges, active: true }, { onConflict: "user_id,name" })
          .select("id, name")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { workflow_id: (data as { id: string }).id, name: (data as { name: string }).name, link: "/dashboard/workflows" } };
      }

      // ── create_ad_campaign ──────────────────────────────────────────
      case "create_ad_campaign": {
        if (ctx.role === "client") return { ok: false, error: "Only the agency can create ad campaigns." };
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (!name) return { ok: false, error: "name required." };
        const platform = typeof input.platform === "string" ? input.platform : "";
        if (!["meta", "google", "tiktok", "linkedin"].includes(platform)) {
          return { ok: false, error: "platform must be one of: meta, google, tiktok, linkedin." };
        }
        const budget = Number(input.budget || 0);
        const goal = typeof input.goal === "string" ? input.goal : "leads";
        const clientId = typeof input.client_id === "string" ? input.client_id : "";

        if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        const campaignId = `cmp_${Date.now()}`;
        const { data, error } = await db
          .from("ad_campaigns")
          .insert({
            id: campaignId,
            user_id: ctx.ownerId,
            client_id: clientId || null,
            name,
            platform,
            status: "draft",
            objective: goal,
            daily_budget: budget,
            total_spend: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            conversions: 0,
            cpa: 0,
            roas: 0,
            ai_optimized: false,
            start_date: new Date().toISOString(),
            end_date: null,
            created_at: new Date().toISOString(),
          })
          .select("id, name, platform")
          .single();

        if (error) {
          if ((error as { code?: string }).code === "42P01") {
            return { ok: false, error: "Ads feature is not set up — the ad_campaigns table does not exist in this environment." };
          }
          return { ok: false, error: error.message };
        }
        return { ok: true, data: { campaign_id: (data as { id: string }).id, name: (data as { name: string }).name, platform: (data as { platform: string }).platform, link: "/dashboard/ads-manager" } };
      }

      // ── publish_social_post ─────────────────────────────────────────
      case "publish_social_post": {
        const content = typeof input.content === "string" ? input.content.trim() : "";
        if (!content) return { ok: false, error: "content required." };
        const platforms = Array.isArray(input.platforms) ? (input.platforms as unknown[]).map((p) => String(p)).filter(Boolean) : [];
        if (platforms.length === 0) return { ok: false, error: "platforms must be a non-empty array." };
        const mediaUrls = Array.isArray(input.media_urls) ? (input.media_urls as unknown[]).map((u) => String(u)).filter(Boolean) : [];

        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        } else {
          return { ok: false, error: "client_id required — social accounts are connected per-client." };
        }

        const { data: accts } = await db.from("social_accounts").select("platform, is_active").eq("client_id", clientId).eq("is_active", true);
        const connected = new Set(((accts || []) as Array<{ platform: string }>).map((a) => a.platform));
        const missing = platforms.filter((p) => !connected.has(p));
        if (connected.size === 0) {
          return { ok: false, error: "No social accounts connected for this client. Connect an account in Settings → Social first." };
        }
        const eligible = platforms.filter((p) => connected.has(p));
        if (eligible.length === 0) {
          return { ok: false, error: `None of the requested platforms are connected (${platforms.join(", ")}). Connect them first.` };
        }

        try {
          const { publish } = await import("@/lib/services/social-publisher");
          const result = await publish({ text: content, platforms: eligible, mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined });
          if (!result.success) return { ok: false, error: result.error || "Social provider refused the post." };

          const { data: logged } = await db
            .from("content_calendar")
            .insert({
              client_id: clientId,
              user_id: ctx.ownerId,
              title: content.slice(0, 100),
              platform: eligible[0],
              scheduled_at: new Date().toISOString(),
              status: "published",
              notes: content,
              metadata: { source: "trinity_assistant", provider: result.provider, provider_post_id: result.postId, platforms: eligible, media_urls: mediaUrls },
            })
            .select("id")
            .single();

          return {
            ok: true,
            data: {
              post_id: (logged as { id?: string } | null)?.id || result.postId || null,
              published_to: eligible,
              failed_platforms: missing.length > 0 ? missing : undefined,
              provider: result.provider,
            },
          };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Failed to publish social post." };
        }
      }

      // ── create_invoice ──────────────────────────────────────────────
      case "create_invoice": {
        if (ctx.role === "client") return { ok: false, error: "Only the agency can create invoices." };
        const clientId = typeof input.client_id === "string" ? input.client_id : "";
        const amountNum = Number(input.amount);
        if (!clientId) return { ok: false, error: "client_id required." };
        if (!Number.isFinite(amountNum) || amountNum <= 0) return { ok: false, error: "amount must be a positive number." };
        if (amountNum > 1_000_000) return { ok: false, error: "amount too large." };
        const currency = typeof input.currency === "string" && input.currency.trim() ? input.currency.trim().toLowerCase() : "usd";
        const description = typeof input.description === "string" ? input.description : "";
        const dueDays = Math.max(1, Math.min(365, Number(input.due_in_days || 14)));
        const amountCents = Math.round(amountNum * 100);
        if (amountCents < 50) return { ok: false, error: "amount must be at least 0.50." };

        const { data: client } = await db.from("clients").select("id, business_name, email, contact_name, profile_id, agency_stripe_customer_id").eq("id", clientId).maybeSingle();
        if (!client || (client as { profile_id: string }).profile_id !== ctx.ownerId) {
          return { ok: false, error: "Client not found or access denied." };
        }
        const c = client as { id: string; business_name?: string; email?: string; contact_name?: string; agency_stripe_customer_id?: string | null };

        const { data: account } = await db.from("agency_stripe_accounts").select("stripe_account_id, charges_enabled").eq("user_id", ctx.ownerId).maybeSingle();
        const acct = account as { stripe_account_id?: string; charges_enabled?: boolean } | null;
        if (!acct?.stripe_account_id) return { ok: false, error: "Stripe Connect isn't set up. Connect Stripe in Settings → Payments first." };
        if (!acct.charges_enabled) return { ok: false, error: "Your Stripe account isn't ready to accept charges yet — finish onboarding first." };

        const connectOpts = { stripeAccount: acct.stripe_account_id };
        try {
          let customerId = c.agency_stripe_customer_id || null;
          if (!customerId) {
            if (!c.email) return { ok: false, error: "Client has no email on file — can't create Stripe customer." };
            const customer = await stripe.customers.create({ email: c.email, name: c.business_name || c.contact_name || undefined, metadata: { shortstack_client_id: c.id, shortstack_agency_user_id: ctx.ownerId } }, connectOpts);
            customerId = customer.id;
            await db.from("clients").update({ agency_stripe_customer_id: customerId }).eq("id", c.id);
          }

          const invoice = await stripe.invoices.create(
            {
              customer: customerId,
              collection_method: "send_invoice",
              days_until_due: dueDays,
              currency,
              description: description || undefined,
              auto_advance: false,
              metadata: { shortstack_client_id: c.id, shortstack_agency_user_id: ctx.ownerId, shortstack_source: "trinity_create_invoice" },
            },
            connectOpts,
          );
          if (!invoice.id) return { ok: false, error: "Stripe did not return an invoice ID." };

          await stripe.invoiceItems.create(
            { customer: customerId, invoice: invoice.id, amount: amountCents, currency, description: description || `Draft invoice for ${c.business_name || "client"}` },
            connectOpts,
          );

          const dueDate = new Date(Date.now() + dueDays * 86_400_000).toISOString().split("T")[0];
          const { data: inserted, error: dbErr } = await db
            .from("invoices")
            .insert({
              client_id: c.id,
              stripe_invoice_id: invoice.id,
              amount: amountNum,
              currency: currency.toUpperCase(),
              status: "draft",
              due_date: dueDate,
              description: description || null,
            })
            .select("id")
            .single();
          if (dbErr) return { ok: false, error: dbErr.message };

          return { ok: true, data: { invoice_id: (inserted as { id: string }).id, stripe_invoice_id: invoice.id, amount: amountNum, status: "draft" } };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Stripe refused the draft invoice." };
        }
      }

      // ── create_content_calendar_item ────────────────────────────────
      case "create_content_calendar_item": {
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const scheduledForRaw = typeof input.scheduled_for === "string" ? input.scheduled_for.trim() : "";
        if (!title) return { ok: false, error: "title required." };
        if (!scheduledForRaw) return { ok: false, error: "scheduled_for required." };
        const dt = new Date(scheduledForRaw);
        if (isNaN(dt.getTime())) return { ok: false, error: "scheduled_for is not a valid ISO date/datetime." };
        const scheduledAt = dt.toISOString();

        const platform = typeof input.platform === "string" && input.platform.trim() ? input.platform.trim() : "instagram_reels";
        const contentNotes = typeof input.content === "string" ? input.content : "";
        const category = typeof input.category === "string" ? input.category : "";

        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: owned } = await db.from("clients").select("id, profile_id").eq("id", clientId).maybeSingle();
          if (!owned || (owned as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        const { data, error } = await db
          .from("content_calendar")
          .insert({
            client_id: clientId || null,
            user_id: ctx.ownerId,
            title,
            platform,
            scheduled_at: scheduledAt,
            status: "idea",
            notes: contentNotes || null,
            metadata: { source: "trinity_create_calendar_item", category: category || null },
          })
          .select("id, title, scheduled_at")
          .single();
        if (error) return { ok: false, error: error.message };
        const row = data as { id: string; title: string; scheduled_at: string };
        return { ok: true, data: { calendar_item_id: row.id, title: row.title, scheduled_for: row.scheduled_at } };
      }

      // ── navigate_to_page ────────────────────────────────────────────
      case "navigate_to_page": {
        const allowedPages = [
          "leads", "pipeline", "content-plan", "campaigns", "invoices", "clients",
          "analytics", "script-lab", "thumbnail-generator", "email-composer",
          "copywriter", "ads-manager", "workflows", "content-calendar",
          "lead-finder", "video-editor", "carousel-generator",
        ];
        const page = typeof input.page === "string" ? input.page : "";
        if (!allowedPages.includes(page)) {
          return { ok: false, error: `page must be one of: ${allowedPages.join(", ")}` };
        }
        const queryRaw = input.query && typeof input.query === "object" && !Array.isArray(input.query) ? (input.query as Record<string, unknown>) : {};
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(queryRaw)) {
          if (v === null || v === undefined) continue;
          params.append(String(k), String(v));
        }
        const qs = params.toString();
        const url = qs ? `/dashboard/${page}?${qs}` : `/dashboard/${page}`;
        return { ok: true, data: { url, page, hint: "Trinity can't navigate the user on its own — share this URL and ask them to click it to open the page." } };
      }

      // ── Ads Video Pack handlers ─────────────────────────────────────
      case "generate_ad_from_description": {
        const productDescription =
          typeof input.product_description === "string" ? input.product_description.trim() : "";
        if (!productDescription) return { ok: false, error: "product_description required." };
        const duration = typeof input.duration === "number" ? input.duration : 30;
        const clientIdArg =
          typeof input.client_id === "string"
            ? input.client_id
            : ctx.clientScope || null;

        try {
          // Import lazily to avoid circular; use direct library helpers.
          const { anthropic: ant, MODEL_HAIKU: haiku, safeJsonParse, getResponseText } =
            await import("@/lib/ai/claude-helpers");
          const { ADS_PRESET, ADS_MUSIC_LIBRARY, filterMusicByMood } =
            await import("@/lib/video-presets/ads");

          // Step A: script
          const scriptResp = await ant.messages.create({
            model: haiku,
            max_tokens: 700,
            system: [
              {
                type: "text",
                text: "You are a direct-response copywriter for IG Reels / TikTok ads. Output ONLY JSON: {\"hook\": string, \"benefits\": string[], \"cta\": string, \"full_script\": string, \"suggested_mood\": \"upbeat\"|\"energetic\"|\"hype\"|\"motivational\"}.",
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [
              {
                role: "user",
                content: `Write a ${duration}s ad for: ${productDescription}`,
              },
            ],
          });
          type AdScriptOut = {
            hook: string;
            benefits: string[];
            cta: string;
            full_script: string;
            suggested_mood: "upbeat" | "energetic" | "hype" | "motivational";
          };
          const script = safeJsonParse<AdScriptOut>(getResponseText(scriptResp));
          if (!script || !script.full_script) {
            return { ok: false, error: "Failed to generate ad script." };
          }

          // Step B: B-roll suggestions via Claude (inline to avoid internal fetch)
          const brollResp = await ant.messages.create({
            model: haiku,
            max_tokens: 900,
            messages: [
              {
                role: "user",
                content:
                  `Return JSON {"suggestions":[{"time_range":[s,e],"description":str,"search_terms":[str],"priority":"high"|"medium"|"low"}]} — 3-5 B-roll cutaways for this script:\n${script.full_script}`,
              },
            ],
          });
          type BrollOut = {
            suggestions: Array<{
              time_range: [number, number];
              description: string;
              search_terms: string[];
              priority: "high" | "medium" | "low";
            }>;
          };
          const broll = safeJsonParse<BrollOut>(getResponseText(brollResp));
          const brollSuggestions = broll?.suggestions || [];

          // Step C: music (deterministic — Claude not strictly needed for small library)
          const filtered = filterMusicByMood([script.suggested_mood]);
          const track = filtered[0] || ADS_MUSIC_LIBRARY[0];
          const alternatives = filtered.slice(1, 4);

          // Step D: persist
          const { data: proj, error: projErr } = await db
            .from("video_projects")
            .insert({
              profile_id: ctx.ownerId,
              client_id: clientIdArg,
              topic: productDescription.slice(0, 200),
              duration,
              style_preset: "ads",
              title: `Ad: ${productDescription.slice(0, 60)}`,
              script,
              editor_settings: {
                preset: "ads",
                preset_patch: ADS_PRESET.editor_settings_patch,
                broll_suggestions: brollSuggestions,
                music_track: track,
                music_alternatives: alternatives,
                aspect_ratio: ADS_PRESET.aspect_ratio,
                caption_style: ADS_PRESET.caption_style,
              },
              call_to_action: script.cta,
              status: "active",
              render_status: "draft",
            })
            .select("id")
            .single();

          if (projErr || !proj) {
            return { ok: false, error: `Persist failed: ${projErr?.message || "unknown"}` };
          }

          return {
            ok: true,
            data: {
              video_id: proj.id,
              script,
              broll: brollSuggestions,
              music: track,
              music_alternatives: alternatives,
              preset: "ads",
              edit_url: `/dashboard/video-editor?project=${proj.id}`,
            },
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Ad generation failed",
          };
        }
      }

      case "generate_video_captions": {
        const videoUrl = typeof input.video_url === "string" ? input.video_url.trim() : "";
        if (!videoUrl) return { ok: false, error: "video_url required." };
        const style = ["kinetic", "classic", "highlight"].includes(input.style as string)
          ? (input.style as "kinetic" | "classic" | "highlight")
          : "kinetic";
        const language =
          typeof input.language === "string" ? input.language.slice(0, 8).toLowerCase() : "en";
        const videoProjectId =
          typeof input.video_project_id === "string" ? input.video_project_id : null;
        const clientIdArg =
          typeof input.client_id === "string" ? input.client_id : ctx.clientScope || null;

        if (!process.env.RUNPOD_WHISPER_URL || !process.env.RUNPOD_API_KEY) {
          return { ok: false, error: "Whisper not configured on server." };
        }

        try {
          const base = process.env.RUNPOD_WHISPER_URL!;
          const endpoint = base.endsWith("/runsync")
            ? base
            : `${base.replace(/\/+$/, "")}/runsync`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
            },
            body: JSON.stringify({
              input: {
                audio: videoUrl,
                audio_url: videoUrl,
                url: videoUrl,
                word_timestamps: true,
                word_level_timestamps: true,
                language,
                model: "large-v3",
              },
            }),
          });
          if (!res.ok) {
            const t = await res.text().catch(() => "");
            return { ok: false, error: `Whisper HTTP ${res.status}: ${t.slice(0, 200)}` };
          }
          const raw = await res.json();
          const data = raw.output || raw;
          type WhisperWord = { word?: string; text?: string; start?: number; end?: number };
          type WhisperSeg = { start?: number; end?: number; text?: string; words?: WhisperWord[] };
          type Caption = { text: string; start_ms: number; end_ms: number; emphasis?: boolean };
          const flat: Caption[] = [];
          if (Array.isArray(data.words)) {
            for (const w of data.words as WhisperWord[]) {
              const t = (w.word || w.text || "").trim();
              if (!t) continue;
              flat.push({
                text: t,
                start_ms: Math.round((w.start || 0) * 1000),
                end_ms: Math.round((w.end || 0) * 1000),
              });
            }
          }
          if (!flat.length && Array.isArray(data.segments)) {
            for (const seg of data.segments as WhisperSeg[]) {
              if (Array.isArray(seg.words)) {
                for (const w of seg.words) {
                  const t = (w.word || w.text || "").trim();
                  if (!t) continue;
                  flat.push({
                    text: t,
                    start_ms: Math.round((w.start || 0) * 1000),
                    end_ms: Math.round((w.end || 0) * 1000),
                  });
                }
              }
            }
          }
          if (!flat.length) return { ok: false, error: "No words in Whisper output." };

          // emphasis by style
          const STOP = new Set(["the", "and", "of", "a", "to", "in", "is", "it", "for", "on", "with", "that", "this", "an"]);
          let withEmph: Caption[];
          if (style === "classic") {
            withEmph = flat.map((w) => ({ ...w, emphasis: false }));
          } else if (style === "kinetic") {
            withEmph = flat.map((w) => {
              const c = w.text.toLowerCase().replace(/[^a-z0-9]/g, "");
              return { ...w, emphasis: c.length > 3 && !STOP.has(c) };
            });
          } else {
            withEmph = flat.map((w) => ({ ...w, emphasis: false }));
            let windowStart = 0, bestIdx = -1, bestScore = -1;
            const flush = () => { if (bestIdx >= 0) withEmph[bestIdx].emphasis = true; bestIdx = -1; bestScore = -1; };
            for (let i = 0; i < withEmph.length; i++) {
              const w = withEmph[i];
              if (w.start_ms - windowStart > 1000) { flush(); windowStart = w.start_ms; }
              const c = w.text.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (STOP.has(c)) continue;
              if (c.length > bestScore) { bestScore = c.length; bestIdx = i; }
            }
            flush();
          }

          const durationMs = withEmph[withEmph.length - 1]?.end_ms || 0;
          const { data: row, error: insErr } = await db
            .from("video_captions")
            .insert({
              profile_id: ctx.ownerId,
              client_id: clientIdArg,
              video_project_id: videoProjectId,
              video_url: videoUrl,
              words: withEmph,
              style,
              language,
              duration_ms: durationMs,
            })
            .select("id")
            .single();
          if (insErr || !row) return { ok: false, error: `Persist failed: ${insErr?.message}` };
          return {
            ok: true,
            data: {
              caption_id: row.id,
              style,
              words: withEmph,
              duration_ms: durationMs,
              language,
            },
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Caption generation failed",
          };
        }
      }

      case "suggest_broll_for_script": {
        const script = typeof input.script === "string" ? input.script.trim() : "";
        if (!script) return { ok: false, error: "script required." };
        const count = Math.max(3, Math.min(6, typeof input.count === "number" ? input.count : 5));

        try {
          const { anthropic: ant, MODEL_HAIKU: haiku, safeJsonParse, getResponseText } =
            await import("@/lib/ai/claude-helpers");
          const resp = await ant.messages.create({
            model: haiku,
            max_tokens: 1000,
            messages: [
              {
                role: "user",
                content:
                  `Return JSON {"suggestions":[{"time_range":[s,e],"description":str,"search_terms":[str],"priority":"high"|"medium"|"low"}]} — ${count} B-roll cutaways for:\n${script}`,
              },
            ],
          });
          type BrollOut = {
            suggestions: Array<{
              time_range: [number, number];
              description: string;
              search_terms: string[];
              priority: "high" | "medium" | "low";
            }>;
          };
          const parsed = safeJsonParse<BrollOut>(getResponseText(resp));
          return {
            ok: true,
            data: { suggestions: parsed?.suggestions || [], count: parsed?.suggestions?.length || 0 },
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "B-roll suggestion failed",
          };
        }
      }

      case "match_music_for_script": {
        const mood =
          typeof input.script_mood === "string" ? input.script_mood.toLowerCase() : undefined;
        const duration =
          typeof input.duration === "number" ? input.duration : 30;
        try {
          const { ADS_MUSIC_LIBRARY, filterMusicByMood } = await import("@/lib/video-presets/ads");
          const pool = mood ? filterMusicByMood([mood]) : ADS_MUSIC_LIBRARY;
          const ranked = [...(pool.length ? pool : ADS_MUSIC_LIBRARY)].sort((a, b) => {
            const aFits = a.duration_sec >= duration ? 1 : 0;
            const bFits = b.duration_sec >= duration ? 1 : 0;
            if (aFits !== bFits) return bFits - aFits;
            return b.bpm - a.bpm;
          });
          return {
            ok: true,
            data: { track: ranked[0], alternatives: ranked.slice(1, 4), source: "library" },
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Music match failed",
          };
        }
      }

      // ── browse_thumbnail_styles ────────────────────────────────────
      case "browse_thumbnail_styles": {
        const category = typeof input.category === "string" ? input.category.trim() : "";
        const search = typeof input.search === "string" ? input.search.trim().toLowerCase() : "";

        let styles = THUMBNAIL_STYLES;
        if (category) {
          styles = getStylesByCategory(category as StyleCategory);
        }
        if (search) {
          styles = styles.filter(
            (s) =>
              s.name.toLowerCase().includes(search) ||
              s.description.toLowerCase().includes(search) ||
              s.category.toLowerCase().includes(search),
          );
        }

        // Trim the payload — Claude doesn't need gradient or reference URL.
        const slim = styles.slice(0, 30).map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          description: s.description,
        }));
        return {
          ok: true,
          data: {
            total: styles.length,
            returned: slim.length,
            styles: slim,
            hint: "Pass the `id` of your choice to generate_thumbnail via its `style` param.",
          },
        };
      }

      // ── edit_thumbnail_with_notes ──────────────────────────────────
      case "edit_thumbnail_with_notes": {
        const thumbnailId = typeof input.thumbnail_id === "string" ? input.thumbnail_id.trim() : "";
        const instruction = typeof input.instruction === "string" ? input.instruction.trim() : "";
        if (!thumbnailId) return { ok: false, error: "thumbnail_id required." };
        if (!instruction) return { ok: false, error: "instruction required." };

        const denoise = Math.max(
          0.3,
          Math.min(0.8, typeof input.denoise === "number" ? input.denoise : 0.5),
        );
        const aspect = typeof input.aspect === "string" ? input.aspect : "16:9";
        const dims =
          aspect === "9:16"
            ? { width: 720, height: 1280 }
            : aspect === "1:1"
              ? { width: 1024, height: 1024 }
              : { width: 1280, height: 720 };

        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          if (!ctx.clientScope) return { ok: false, error: "No client scope resolved." };
          clientId = ctx.clientScope;
        } else if (clientId) {
          const { data: c } = await db
            .from("clients")
            .select("id, profile_id")
            .eq("id", clientId)
            .maybeSingle();
          if (!c || (c as { profile_id: string }).profile_id !== ctx.ownerId) {
            return { ok: false, error: "Client not found or access denied." };
          }
        }

        const { data: existing } = await db
          .from("generated_images")
          .select("prompt, profile_id, image_url")
          .eq("id", thumbnailId)
          .maybeSingle();
        if (!existing) return { ok: false, error: "Thumbnail not found." };
        if ((existing as { profile_id: string }).profile_id !== ctx.ownerId) {
          return { ok: false, error: "Thumbnail access denied." };
        }
        const sourceUrl = (existing as { image_url: string | null }).image_url;
        const sourcePrompt = (existing as { prompt: string | null }).prompt || "";
        if (!sourceUrl) {
          return { ok: false, error: "Source thumbnail has no image_url yet (still rendering?)." };
        }

        const fluxUrl = process.env.RUNPOD_FLUX_URL;
        const runpodKey = process.env.RUNPOD_API_KEY;
        if (!fluxUrl || !runpodKey) {
          return { ok: false, error: "RUNPOD_FLUX_URL / RUNPOD_API_KEY not configured." };
        }

        const editPrompt =
          (sourcePrompt ? `${sourcePrompt}. ` : "") +
          `EDIT: ${instruction}. ` +
          "Preserve the overall composition, subject placement, and aspect. " +
          "Only apply the requested change. Maintain viral YouTube thumbnail quality.";
        const negativePrompt =
          "blurry, low quality, deformed, ugly, watermark, signature, cropped, worst quality, " +
          "duplicate subjects, garbled text, different composition, different subject, different layout";
        const seed = Math.floor(Math.random() * 2147483647);
        const workflow = {
          "1": { inputs: { ckpt_name: "flux1-dev-fp8.safetensors" }, class_type: "CheckpointLoaderSimple" },
          "2": { inputs: { url: sourceUrl }, class_type: "LoadImageFromUrl" },
          "3": { inputs: { pixels: ["2", 0], vae: ["1", 2] }, class_type: "VAEEncode" },
          "4": { inputs: { text: editPrompt, clip: ["1", 1] }, class_type: "CLIPTextEncode" },
          "5": { inputs: { text: negativePrompt, clip: ["1", 1] }, class_type: "CLIPTextEncode" },
          "6": {
            inputs: {
              seed,
              steps: 20,
              cfg: 1.5,
              sampler_name: "euler",
              scheduler: "simple",
              denoise,
              model: ["1", 0],
              positive: ["4", 0],
              negative: ["5", 0],
              latent_image: ["3", 0],
            },
            class_type: "KSampler",
          },
          "7": { inputs: { samples: ["6", 0], vae: ["1", 2] }, class_type: "VAEDecode" },
          "8": { inputs: { filename_prefix: "EditNotes", images: ["7", 0] }, class_type: "SaveImage" },
        };

        let jobId: string | null = null;
        let runpodError: string | null = null;
        try {
          const res = await fetch(`${fluxUrl}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${runpodKey}` },
            body: JSON.stringify({ input: { workflow } }),
          });
          const job = (await res.json()) as Record<string, unknown>;
          if (typeof job?.id === "string") jobId = job.id;
          else runpodError = (job?.error as string) || (job?.message as string) || `RunPod ${res.status}`;
        } catch (e) {
          runpodError = e instanceof Error ? e.message : "RunPod request failed";
        }
        if (!jobId) return { ok: false, error: runpodError || "RunPod did not return a job id." };

        const { data, error } = await db
          .from("generated_images")
          .insert({
            profile_id: ctx.ownerId,
            client_id: clientId || null,
            prompt: editPrompt,
            model: "flux1-dev-fp8-img2img",
            width: dims.width,
            height: dims.height,
            status: "processing",
            job_id: jobId,
            metadata: {
              source: "edit_with_notes",
              parent_thumbnail_id: thumbnailId,
              instruction,
              denoise,
              aspect,
              tool: "edit_thumbnail_with_notes",
            },
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };

        return {
          ok: true,
          data: {
            thumbnail_id: (data as { id: string }).id,
            parent_thumbnail_id: thumbnailId,
            instruction,
            job_id: jobId,
            poll_url: `/api/thumbnail/status?job_id=${jobId}`,
          },
        };
      }

      // ── classify_footage ───────────────────────────────────────────
      case "classify_footage": {
        const videoUrl = typeof input.video_url === "string" ? input.video_url.trim() : "";
        if (!videoUrl) return { ok: false, error: "video_url required." };

        // Reuse the classify-footage route logic by forwarding through it —
        // but we already have ownerId in ctx so call the underlying helpers
        // directly to avoid an internal HTTP hop on Vercel.
        const { checkLimit, recordUsage } = await import("@/lib/usage-limits");
        const metered = await checkLimit(ctx.ownerId, "tokens", 1);
        if (!metered.allowed) {
          return {
            ok: false,
            error: metered.reason || "Monthly token limit reached — upgrade to continue.",
          };
        }

        try {
          const res = await fetch(videoUrl);
          if (!res.ok) {
            return { ok: false, error: `Failed to fetch frame (${res.status})` };
          }
          const contentType = res.headers.get("content-type") || "image/jpeg";
          if (contentType.startsWith("video/")) {
            return {
              ok: false,
              error:
                "video/* MIME received — Claude Vision needs an image still; extract a frame first or pass a thumbnail URL.",
            };
          }
          const buf = Buffer.from(await res.arrayBuffer());
          const mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" =
            contentType.includes("png")
              ? "image/png"
              : contentType.includes("gif")
                ? "image/gif"
                : contentType.includes("webp")
                  ? "image/webp"
                  : "image/jpeg";

          const { anthropic: ant, MODEL_SONNET, safeJsonParse, getResponseText } =
            await import("@/lib/ai/claude-helpers");

          const systemPrompt = `You are a video editor classifying raw clips in one glance. Pick exactly one footage_type from: webcam_talking_head, vlog, screen_recording, gameplay, b_roll, interview_seated, product_close_up, action_handheld, drone_aerial, animation_motion_graphics, dance_performance, text_only_slide, unknown. Pick a recommended_creator_pack_id from: creator_ali_abdaal, creator_casey_neistat, creator_mrbeast, creator_mkbhd, creator_emma_chamberlain, creator_valuetainment, creator_corridor_digital, creator_fstoppers, creator_dude_perfect, creator_vox, creator_tiktok_dance, creator_generic_minimal. Respond with ONLY JSON: {"footage_type":"...","confidence":0..1,"detected_subjects":[...],"lighting":"...","motion_level":"none|low|medium|high|very-high","color_palette":[...],"recommended_creator_pack_id":"...","suggested_edits":["...","...","..."]}. No markdown.`;

          const resp = await ant.messages.create({
            model: MODEL_SONNET,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: { type: "base64", media_type: mediaType, data: buf.toString("base64") },
                  },
                  { type: "text", text: "Classify this footage frame. JSON only." },
                ],
              },
            ],
          });

          interface ClassifyShape {
            footage_type?: string;
            confidence?: number;
            detected_subjects?: string[];
            lighting?: string;
            motion_level?: string;
            color_palette?: string[];
            recommended_creator_pack_id?: string;
            suggested_edits?: string[];
          }
          const parsed = safeJsonParse<ClassifyShape>(getResponseText(resp));
          if (!parsed) {
            return { ok: false, error: "Claude returned an unparseable response." };
          }

          // Track tokens best-effort.
          const total =
            (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0);
          void recordUsage(ctx.ownerId, "tokens", total || 1500, {
            source: "trinity_classify_footage",
            footage_type: parsed.footage_type,
          });

          return {
            ok: true,
            data: {
              footage_type: parsed.footage_type || "unknown",
              confidence:
                typeof parsed.confidence === "number"
                  ? Math.max(0, Math.min(1, parsed.confidence))
                  : 0.5,
              detected_subjects: Array.isArray(parsed.detected_subjects) ? parsed.detected_subjects.slice(0, 8) : [],
              lighting: parsed.lighting || "unknown",
              motion_level: parsed.motion_level || "medium",
              color_palette: Array.isArray(parsed.color_palette) ? parsed.color_palette.slice(0, 8) : [],
              recommended_creator_pack_id: parsed.recommended_creator_pack_id || "creator_generic_minimal",
              suggested_edits: Array.isArray(parsed.suggested_edits) ? parsed.suggested_edits.slice(0, 5) : [],
            },
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Classification failed",
          };
        }
      }

      // ── analyze_viral_video ─────────────────────────────────────────
      case "analyze_viral_video": {
        const sourceUrl = typeof input.source_url === "string" ? input.source_url.trim() : "";
        if (!sourceUrl) return { ok: false, error: "source_url required." };
        if (!ctx.origin) return { ok: false, error: "Trinity needs a resolvable origin to call /api/video/analyze-viral." };

        const storeAsTemplate = input.store_as_template === true;
        const nicheHint = typeof input.niche_hint === "string" ? input.niche_hint.trim() : "";
        let clientId = typeof input.client_id === "string" ? input.client_id : "";
        if (ctx.role === "client") {
          clientId = ctx.clientScope || "";
        }

        try {
          const res = await fetch(`${ctx.origin}/api/video/analyze-viral`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(ctx.cookieHeader ? { cookie: ctx.cookieHeader } : {}),
            },
            body: JSON.stringify({
              source_url: sourceUrl,
              store_as_template: storeAsTemplate,
              niche_hint: nicheHint || undefined,
              client_id: clientId || undefined,
            }),
          });
          const json = (await res.json()) as Record<string, unknown>;
          if (!res.ok || json.ok === false) {
            return {
              ok: false,
              error: (json.error as string) || `analyze-viral returned ${res.status}`,
            };
          }
          return { ok: true, data: json };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "analyze-viral call failed" };
        }
      }

      // ── auto_edit_video / suggest_edits ────────────────────────────
      case "auto_edit_video":
      case "suggest_edits": {
        if (ctx.role === "client") {
          return { ok: false, error: "Clients cannot trigger the auto-edit engine." };
        }
        if (!ctx.origin) {
          return {
            ok: false,
            error: "Auto-edit tools need a resolvable origin — internal error.",
          };
        }
        const videoUrl = typeof input.video_url === "string" ? input.video_url.trim() : "";
        const projectId = typeof input.project_id === "string" ? input.project_id.trim() : "";
        if (!videoUrl || !projectId) {
          return { ok: false, error: "video_url and project_id are required." };
        }

        const creatorPackId =
          typeof input.creator_pack_id === "string" && input.creator_pack_id.trim()
            ? input.creator_pack_id.trim()
            : undefined;
        const autoAccept = name === "auto_edit_video" && !!input.auto_accept;

        // Load recent preferences once here so the reply mentions how much
        // personalisation the engine is applying. The sub-routes do their
        // own few-shot formatting — we don't need to pass it in.
        const { getRecentPreferences } = await import("@/lib/ai-edit-preferences");
        const examples = await getRecentPreferences({ user_id: ctx.userId, limit: 20 });

        try {
          const { runFullPass } = await import("@/lib/auto-edit-pipeline");
          const result = await runFullPass({
            origin: ctx.origin,
            cookieHeader: ctx.cookieHeader,
            video_url: videoUrl,
            project_id: projectId,
            creator_pack_id: creatorPackId,
            client_id: ctx.clientScope || undefined,
            auto_accept: autoAccept,
          });

          return {
            ok: result.ok,
            data: {
              mode: name,
              auto_accept: autoAccept,
              project_id: projectId,
              personalised_from: examples.length,
              steps: result.steps,
              errors: result.errors,
            },
            error: result.ok
              ? undefined
              : result.errors.map((e) => `${e.step}: ${e.error}`).join("; "),
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Auto-edit pipeline failed",
          };
        }
      }

      // ── smart_thumbnail_variants ─────────────────────────────────────
      case "smart_thumbnail_variants": {
        if (!ctx.origin) {
          return { ok: false, error: "smart_thumbnail_variants needs a resolvable origin." };
        }
        const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
        if (!prompt) return { ok: false, error: "prompt is required." };
        const count =
          typeof input.count === "number" && Number.isFinite(input.count)
            ? Math.max(2, Math.min(6, Math.round(input.count)))
            : 4;
        const platform =
          typeof input.platform === "string" ? input.platform : "youtube";
        try {
          const res = await fetch(`${ctx.origin}/api/thumbnail/smart-variants`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(ctx.cookieHeader ? { Cookie: ctx.cookieHeader } : {}),
            },
            body: JSON.stringify({ prompt, count, platform }),
          });
          const j = (await res.json()) as Record<string, unknown>;
          if (!res.ok || !j.ok) {
            return {
              ok: false,
              error: (j.error as string) || `smart-variants returned ${res.status}`,
            };
          }
          return { ok: true, data: j };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "smart-variants call failed",
          };
        }
      }

      // ── analyze_thumbnail ────────────────────────────────────────────
      case "analyze_thumbnail": {
        if (!ctx.origin) {
          return { ok: false, error: "analyze_thumbnail needs a resolvable origin." };
        }
        const imageUrl =
          typeof input.image_url === "string" ? input.image_url.trim() : "";
        if (!imageUrl) return { ok: false, error: "image_url is required." };
        try {
          const res = await fetch(`${ctx.origin}/api/thumbnail/analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(ctx.cookieHeader ? { Cookie: ctx.cookieHeader } : {}),
            },
            body: JSON.stringify({ image_url: imageUrl }),
          });
          const j = (await res.json()) as Record<string, unknown>;
          if (!res.ok || !j.ok) {
            return {
              ok: false,
              error: (j.error as string) || `analyze returned ${res.status}`,
            };
          }
          return { ok: true, data: j };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "analyze call failed",
          };
        }
      }

      // ── smart_crop_thumbnail ─────────────────────────────────────────
      case "smart_crop_thumbnail": {
        if (!ctx.origin) {
          return { ok: false, error: "smart_crop_thumbnail needs a resolvable origin." };
        }
        const imageUrl =
          typeof input.image_url === "string" ? input.image_url.trim() : "";
        const targetAspect =
          typeof input.target_aspect === "string"
            ? input.target_aspect.trim()
            : "";
        if (!imageUrl || !targetAspect) {
          return { ok: false, error: "image_url and target_aspect are required." };
        }
        try {
          const res = await fetch(`${ctx.origin}/api/thumbnail/smart-crop`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(ctx.cookieHeader ? { Cookie: ctx.cookieHeader } : {}),
            },
            body: JSON.stringify({
              image_url: imageUrl,
              target_aspect: targetAspect,
            }),
          });
          const j = (await res.json()) as Record<string, unknown>;
          if (!res.ok || !j.ok) {
            return {
              ok: false,
              error: (j.error as string) || `smart-crop returned ${res.status}`,
            };
          }
          // Drop the heavy data URL from the assistant reply payload — the UI
          // can re-fetch if it wants the preview.
          if (j.cropped_image_url) {
            const dataUrl = j.cropped_image_url as string;
            j.cropped_image_url_size = dataUrl.length;
            delete j.cropped_image_url;
          }
          return { ok: true, data: j };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "smart-crop call failed",
          };
        }
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Main POST handler — multi-hop tool-use loop
// ──────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured (missing ANTHROPIC_API_KEY)." }, { status: 500 });
  }

  let body: {
    message?: unknown;
    conversation_id?: unknown;
    client_id?: unknown;
    current_page?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "message required." }, { status: 400 });
  const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : null;
  const clientIdInput = typeof body.client_id === "string" ? body.client_id : null;
  // Optional: the page slug the caller is currently on (e.g. "script-lab",
  // "thumbnail-generator", "ads-manager"). Gets injected into the system
  // prompt so Trinity can bias tool choice toward that page's features.
  const currentPage = typeof body.current_page === "string" ? body.current_page.slice(0, 60) : null;

  // Resolve role + scope
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, parent_agency_id, full_name, nickname")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const role = (profile as { role: string }).role;
  const ownerId =
    role === "team_member" && (profile as { parent_agency_id?: string }).parent_agency_id
      ? (profile as { parent_agency_id: string }).parent_agency_id
      : user.id;

  // Clients are scoped to their own client row
  let clientScope: string | null = null;
  if (role === "client") {
    const { data: ownClient } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    clientScope = (ownClient as { id?: string } | null)?.id ?? null;
  } else if (clientIdInput) {
    clientScope = clientIdInput;
  }

  // Compute origin + cookie header so tool handlers that need to call sibling
  // routes (e.g. auto_edit_video → /api/video/auto-edit/*) can do so as the
  // signed-in user without re-running the auth flow manually.
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const cookieHeader = request.headers.get("cookie") || undefined;

  const ctx: ToolCtx = {
    ownerId,
    userId: user.id,
    role,
    clientScope,
    origin,
    cookieHeader,
  };

  // ── Load or create the conversation ──────────────────────────────────
  const db = createServiceClient();
  let convId = conversationId;
  let priorMessages: Array<{ role: string; content: string }> = [];

  if (convId) {
    const { data: conv } = await db
      .from("trinity_conversations")
      .select("id, user_id")
      .eq("id", convId)
      .maybeSingle();
    if (!conv || (conv as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    const { data: msgs } = await db
      .from("trinity_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(40);
    priorMessages = (msgs || []).map((m) => ({
      role: (m as { role: string }).role,
      content: (m as { content: string }).content,
    }));
  } else {
    const title = message.slice(0, 60);
    const { data: newConv, error: convErr } = await db
      .from("trinity_conversations")
      .insert({
        user_id: user.id,
        client_id: clientScope,
        title,
        messages: [],
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (convErr || !newConv) {
      return NextResponse.json({ error: convErr?.message || "Could not start conversation." }, { status: 500 });
    }
    convId = (newConv as { id: string }).id;
  }

  // Persist the user turn
  await db
    .from("trinity_messages")
    .insert({ conversation_id: convId, role: "user", content: message });

  // ── Build system prompt with live context ────────────────────────────
  const firstName =
    (profile as { nickname?: string; full_name?: string }).nickname?.split(" ")[0] ||
    (profile as { full_name?: string }).full_name?.split(" ")[0] ||
    "there";

  // Current time / date so Trinity can answer "what day is it" etc. without
  // having to call a tool. Copenhagen is the user's home timezone.
  const nowIso = new Date().toISOString();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Copenhagen",
  });
  const clockNow = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    timeZone: "Europe/Copenhagen",
  });

  const systemPrompt = `You are Trinity, the AI operating system for this ShortStack agency dashboard. You can see all of the user's data (clients, leads, deals, revenue, tasks, tokens) and perform actions on their behalf using the tools provided.

USER: ${firstName} (role: ${role})
${clientScope ? `SCOPE: Limited to client ${clientScope}` : "SCOPE: Full agency access"}
${currentPage ? `CURRENT PAGE: /dashboard/${currentPage} — if the user's request maps naturally to this page's primary tool, prefer it (e.g. on /dashboard/script-lab default to create_ai_script; on /dashboard/thumbnail-generator default to generate_thumbnail).` : ""}

TIME: Today is ${today}. Current time ${clockNow} (Copenhagen). ISO: ${nowIso}. You always know the current date and time — never say you don't.

INTERNET: You have web_search — USE IT for any real-world current info (weather, news, current events, app recommendations, pricing, "what's the best X", competitor research). Don't hallucinate; search when in doubt. Cite the source briefly in your reply.

WHAT YOU CAN DO:
- Read live business data: get_my_data returns KPIs, MRR, leads today, tokens.
- Prospecting: search_leads (fuzzy search), create_lead (add to pipeline), scrape_lead_niche (run a Lead Finder scrape for a niche + city).
- Outreach: draft_outreach_message (personalised DM/email/SMS — user reviews before send), get_recent_conversations (inbox replies), create_email_draft (save an email to Email Composer, NOT send).
- Clients: search_clients.
- Project management: create_task.
- Content creation: create_ai_script (Script Lab), create_blog_post (Copywriter), generate_thumbnail (AI FLUX thumbnail), face_swap_thumbnail (put the user's selfie into a thumbnail — requires a pre-uploaded face URL), recreate_thumbnail_from_url (remix a YouTube video's thumbnail via img2img), generate_thumbnail_with_title (one-shot title + thumbnail from a topic), generate_carousel (Instagram/LinkedIn carousel), render_video (video pipeline — agency-only).
- Video auto-edit: classify_footage (what kind of clip is this?), suggest_edits (detect scenes + return timed edit suggestions for UI review), auto_edit_video (full detect → suggest → captions → B-roll pipeline; set auto_accept=true to immediately write all suggestions into the project timeline). Both auto-edit tools personalise over time based on the user's accept/reject history — no model training, just few-shot.
- Social: schedule_social_post (queues), publish_social_post (publishes NOW), create_content_calendar_item (planning only, not publishing), generate_content_plan (auto-generator for a client across platforms).
- Ads: create_ad_campaign (creates campaign shell in Ads Manager; does NOT launch to Meta/Google/TikTok — user launches from UI).
- Automations: create_workflow (Workflow Builder node-based automation).
- Money (agency-only, requires Stripe Connect): create_payment_link, create_invoice (draft invoice, not sent), send_invoice (finalizes and emails).
- Navigation: navigate_to_page returns a deep link the user can click to jump to any dashboard page (with optional prefilled query params).

HOW YOU WORK:
- When the user asks about numbers, status, or "how am I doing", CALL get_my_data first — never guess.
- When the user asks you to DO something, USE THE RIGHT TOOL. Don't describe what you would do — do it.
- If the user says "write a script and paste it in Script Lab" → generate the script in your head, then call create_ai_script with the finished content. Same pattern for create_blog_post, create_email_draft, generate_carousel — YOU produce the actual content, then pass it to the tool.
- When acting on a specific client, call search_clients first to get the real client_id. Same for leads.
- For publish_social_post, check the user really means "publish now" vs "schedule" — default to schedule_social_post when unsure.
- After a tool returns, synthesise a short, friendly confirmation telling the user what happened and where to find it. If the tool returned a link, share the link.
- If a tool returns ok=false, read the error and tell the user plainly — don't pretend it worked.

STYLE:
- Plain conversational text. No markdown, no bullet dashes, no bold. If you need a list, use sentences separated by line breaks.
- Warm, direct, confident. Treat the user as a capable founder.
- Keep responses short unless they ask for depth.

LIMITS:
- You cannot auto-send cold outreach — you draft, the user reviews.
- You cannot spend the user's money or move funds from their bank. Payment links and invoices are billed to the user's clients on the user's own connected Stripe.
- Stripe tools (create_payment_link, send_invoice) require the agency to have connected Stripe first — if they haven't, surface that error clearly.
- If a client-role user asks to do something outside their own account, refuse politely.`;

  // ── Tool-use loop (max 4 hops) ──────────────────────────────────────
  const conversation: Anthropic.MessageParam[] = [
    ...priorMessages.map<Anthropic.MessageParam>((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  const actions: Array<{ tool: string; input: unknown; result: ToolResult }> = [];
  let finalText = "";
  let stopped = false;
  const MAX_HOPS = 4;

  // Anthropic server-side web_search tool. Claude calls it directly, Anthropic
  // runs the search on their infra, and results come back inline — no handler
  // needed on our end. `max_uses: 3` caps per-request cost.
  const webSearchTool = {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 3,
  } as unknown as Anthropic.Tool;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 2000,
      system: systemPrompt,
      tools: [...TOOLS, webSearchTool],
      messages: conversation,
    });

    // Collect text from this hop (overwrites earlier hops — we want the most
    // recent synthesis Claude produced).
    let hopText = "";
    for (const block of resp.content) {
      if (block.type === "text") hopText = block.text;
    }
    if (hopText) finalText = hopText;

    if (resp.stop_reason !== "tool_use") {
      conversation.push({ role: "assistant", content: resp.content });
      stopped = true;
      break;
    }

    // Push assistant turn so the tool_result ids line up
    conversation.push({ role: "assistant", content: resp.content });

    // Execute every tool_use block in this turn, collect tool_result blocks
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of resp.content) {
      if (block.type !== "tool_use") continue;
      // Guard against malformed tool input — must be an object.
      const rawInput = block.input;
      const input: Record<string, unknown> =
        rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
          ? (rawInput as Record<string, unknown>)
          : {};
      const result = await runTool(block.name, input, ctx);
      actions.push({ tool: block.name, input, result });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
        is_error: !result.ok,
      });
    }
    conversation.push({ role: "user", content: toolResults });
  }

  // If we exhausted MAX_HOPS without Claude stopping, force a final
  // tool-free synthesis so the user gets a real reply instead of stale text.
  if (!stopped) {
    try {
      const synth = await anthropic.messages.create({
        model: MODEL_HAIKU,
        max_tokens: 600,
        system: systemPrompt +
          "\n\nYou've already done the research — now give the user a short, friendly synthesis of what you found and did. Do not call any more tools.",
        messages: conversation,
      });
      const synthText = synth.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (synthText) finalText = synthText;
    } catch {
      // If synthesis fails, fall through to the existing "Done." fallback.
    }
  }

  if (!finalText) {
    finalText = "Done.";
  }

  // Persist assistant turn + update conversation timestamp
  await db
    .from("trinity_messages")
    .insert({
      conversation_id: convId,
      role: "assistant",
      content: finalText,
      actions_json: actions,
    });
  await db
    .from("trinity_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", convId);

  // Audit log for the existing trinity_log stream
  await db.from("trinity_log").insert({
    action_type: "custom",
    description: `Trinity: ${message.slice(0, 100)}`,
    command: message,
    status: "completed",
    user_id: ownerId,
    result: { actions: actions.map((a) => a.tool), reply_length: finalText.length },
  });

  return NextResponse.json({
    conversation_id: convId,
    reply: finalText,
    actions: actions.map((a) => ({
      tool: a.tool,
      ok: a.result.ok,
      data: a.result.data,
      error: a.result.error,
    })),
  });
}

// ──────────────────────────────────────────────────────────────────────────
// GET — list or load conversation
// GET /api/trinity-assistant?id=xxx → messages for that conversation
// GET /api/trinity-assistant        → recent conversations
// ──────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  void ownerId;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const { data: conv } = await supabase
      .from("trinity_conversations")
      .select("id, title, client_id, last_message_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: msgs } = await supabase
      .from("trinity_messages")
      .select("id, role, content, actions_json, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    return NextResponse.json({ conversation: conv, messages: msgs || [] });
  }

  const { data: convs } = await supabase
    .from("trinity_conversations")
    .select("id, title, client_id, last_message_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ conversations: convs || [] });
}
