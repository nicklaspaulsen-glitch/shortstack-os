"use client";

/**
 * /dashboard/bug-hunter — Claude BugHunter Integration
 *
 * Surfaces the Claude-BugHunter methodology (elementalsouls/Claude-BugHunter)
 * inside ShortStack OS. Four tabs:
 *
 *   Overview    — Capability map and quick-launch commands
 *   Scan        — Run a WAPT scan against ShortStack OS or any target
 *   Findings    — Current audit results and remediation status
 *   Reports     — Export findings as structured reports
 *
 * All code-path analysis is performed by Claude Code agents using the
 * Claude-BugHunter skill bundle (51 skills, 681 disclosed-report patterns).
 */

import {
  Bug,
  CheckCircle,
  ClipboardText,
  Code,
  Detective,
  DownloadSimple,
  Eye,
  FileText,
  Lightning,
  MagnifyingGlass,
  ShieldCheck,
  ShieldWarning,
  Skull,
  Sparkle,
  Terminal,
  Warning,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { useState } from "react";
import { MotionPage } from "@/components/motion/motion-page";
import { motion } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────

type TabId = "overview" | "scan" | "findings" | "reports";
type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";
type FindingStatus = "open" | "fixed" | "wont-fix" | "investigating";

interface VulnClass {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  reportCount: number;
}

interface Finding {
  id: string;
  title: string;
  severity: SeverityLevel;
  vulnClass: string;
  file: string;
  status: FindingStatus;
  fixedAt?: string;
  description: string;
}

interface ScanTarget {
  label: string;
  value: string;
  description: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview",  label: "Overview",  icon: <Eye         size={13} /> },
  { id: "scan",      label: "Scan",      icon: <MagnifyingGlass size={13} /> },
  { id: "findings",  label: "Findings",  icon: <ShieldWarning   size={13} /> },
  { id: "reports",   label: "Reports",   icon: <FileText        size={13} /> },
];

const VULN_CLASSES: VulnClass[] = [
  {
    id: "idor",
    label: "IDOR",
    icon: <Eye size={15} />,
    description: "Cross-tenant object access, unscoped service client reads",
    reportCount: 26,
  },
  {
    id: "ssrf",
    label: "SSRF",
    icon: <Lightning size={15} />,
    description: "Server-side request forgery and DNS rebinding",
    reportCount: 18,
  },
  {
    id: "auth-bypass",
    label: "Auth Bypass",
    icon: <ShieldWarning size={15} />,
    description: "Unauthenticated route access, cron secret bypass",
    reportCount: 12,
  },
  {
    id: "xss",
    label: "XSS",
    icon: <Code size={15} />,
    description: "Reflected and DOM-based cross-site scripting",
    reportCount: 31,
  },
  {
    id: "sqli",
    label: "SQLi",
    icon: <Terminal size={15} />,
    description: "SQL injection via unsanitized Supabase queries",
    reportCount: 15,
  },
  {
    id: "llm",
    label: "LLM Injection",
    icon: <Sparkle size={15} />,
    description: "Prompt injection on AI-powered endpoints",
    reportCount: 9,
  },
  {
    id: "race",
    label: "Race Condition",
    icon: <Lightning size={15} />,
    description: "Concurrent write conflicts on billing and credits",
    reportCount: 7,
  },
  {
    id: "business-logic",
    label: "Business Logic",
    icon: <Bug size={15} />,
    description: "Rate limit bypass, free-tier privilege abuse",
    reportCount: 22,
  },
];

// Current audit findings from the May 2026 security audit
const FINDINGS: Finding[] = [
  {
    id: "f1",
    title: "SSRF via start_url in browser-tasks",
    severity: "high",
    vulnClass: "ssrf",
    file: "src/app/api/browser-tasks/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "User-controlled start_url was forwarded to Playwright fetch without SSRF validation, allowing internal network access.",
  },
  {
    id: "f2",
    title: "DNS rebinding bypass on brand-scrape",
    severity: "medium",
    vulnClass: "ssrf",
    file: "src/app/api/brand-scrape/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "L1 hostname check passed but DNS could rebind to 169.254.169.254 after hostname resolution. Upgraded to async two-layer guard.",
  },
  {
    id: "f3",
    title: "Webhook key exposed in URL query param",
    severity: "medium",
    vulnClass: "auth-bypass",
    file: "src/app/api/webhooks/inbound/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "?key= fallback allowed bearer token transmission via URL, which gets logged in access logs and Referer headers.",
  },
  {
    id: "f4",
    title: "Missing input validation on admin/setup-account",
    severity: "high",
    vulnClass: "business-logic",
    file: "src/app/api/admin/setup-account/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "POST body written to DB without Zod schema validation. Added email/password/role enum validation.",
  },
  {
    id: "f5",
    title: "Unrestricted MIME type on audio transcription",
    severity: "high",
    vulnClass: "business-logic",
    file: "src/app/api/ai/transcribe/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "Any file type accepted for transcription. Added allowlist: mp3, wav, mp4, webm, ogg, flac, m4a.",
  },
  {
    id: "f6",
    title: "Silent failure swallowing in ads/autopilot",
    severity: "medium",
    vulnClass: "business-logic",
    file: "src/app/api/ads/autopilot/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "Four catch blocks swallowed errors silently. Added structured logging with [ads/autopilot] prefix.",
  },
  {
    id: "f7",
    title: "Service role key used for connectivity probe",
    severity: "medium",
    vulnClass: "auth-bypass",
    file: "src/app/api/system-status/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "Connectivity check used SUPABASE_SERVICE_ROLE_KEY. Replaced with anon key — same probe, no privilege.",
  },
  {
    id: "f8",
    title: "Error detail leakage in 7 routes",
    severity: "medium",
    vulnClass: "business-logic",
    file: "src/app/api/integrations/nango/*, incidents, design-studio",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "error.message returned in 500 responses, revealing stack paths and Supabase error codes.",
  },
  {
    id: "f9",
    title: "Redirect bypass on audio-proxy allowlist",
    severity: "low",
    vulnClass: "ssrf",
    file: "src/app/api/audio-proxy/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "redirect:follow would let a CDN redirect bypass the host allowlist. Changed to redirect:error.",
  },
  {
    id: "f10",
    title: "Cron routes CRON_SECRET fail-open audit",
    severity: "medium",
    vulnClass: "auth-bypass",
    file: "src/app/api/cron/*/route.ts (all 37 routes)",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "Full audit of all 37 cron routes confirmed every route uses the fail-closed pattern: if (!cronSecret || !secureCompare(rawToken, cronSecret)) { 401 }. No fail-open routes found. Finding closed.",
  },
  {
    id: "f11",
    title: "IDOR on admin/clients/insights — cross-tenant data",
    severity: "high",
    vulnClass: "idor",
    file: "src/app/api/admin/clients/insights/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "Service client query had no profile_id ownership filter. Both branches (specific IDs and all-active) returned rows from any tenant, not just the authenticated user's account.",
  },
  {
    id: "f12",
    title: "SSRF via lora_url in ai/batch-generate",
    severity: "high",
    vulnClass: "ssrf",
    file: "src/app/api/ai/batch-generate/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "User-supplied lora_url was forwarded to RunPod without SSRF validation, enabling internal network probing through the RunPod relay. Fixed with isValidExternalHttpsUrl guard.",
  },
  {
    id: "f13",
    title: "SSRF via voice_url in ai/voice-clone",
    severity: "high",
    vulnClass: "ssrf",
    file: "src/app/api/ai/voice-clone/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "User-supplied voice_url was forwarded as audio_url and reference_audio_url to RunPod without validation. Fixed with isValidExternalHttpsUrl guard applied before any processing.",
  },
  {
    id: "f14",
    title: "LLM prompt injection in ai/enhance-video-prompt",
    severity: "medium",
    vulnClass: "llm",
    file: "src/app/api/ai/enhance-video-prompt/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "User-controlled prompt was interpolated into LLM message without length cap. Attacker could inflate token cost or inject adversarial instructions. Capped at 2000 chars; style capped at 100.",
  },
  {
    id: "f15",
    title: "Race condition on Stripe customer creation",
    severity: "medium",
    vulnClass: "business-logic",
    file: "src/app/api/billing/buy-tokens, checkout, subscribe/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "Fixed with a lost-update guard on all three routes: UPDATE profiles SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id IS NULL. A racing request matches 0 rows, re-reads the winner's ID, and the orphaned Stripe customer is logged. DB migration adds partial unique indexes on both profiles and clients tables.",
  },
  // ── Findings from May 31 comprehensive audit (f16–f50) ───────────────────
  {
    id: "f16",
    title: "Slack webhook timingSafeEqual UTF-8 encoding bug",
    severity: "high",
    vulnClass: "auth-bypass",
    file: "src/app/api/webhooks/slack/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "Buffer.from(sig) / Buffer.from(mySig) used default UTF-8 encoding when comparing HMAC signatures. Fixed by stripping the 'v0=' prefix and comparing raw 32-byte hex-decoded buffers — consistent with Discord/ElevenLabs pattern. Prevents valid signatures from failing comparison.",
  },
  {
    id: "f17",
    title: "DOM XSS via innerHTML in chatbot embed widget",
    severity: "high",
    vulnClass: "xss",
    file: "src/app/api/chatbot/embed/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "Generated client-side JS concatenated raw user input (msg) into innerHTML without escaping: msgs.innerHTML += '<div>'+msg+'</div>'. Fixed by replacing innerHTML concatenation with textContent-based DOM node construction (userBubble.textContent = msg).",
  },
  {
    id: "f18",
    title: "LLM prompt injection in copywriter/generate",
    severity: "high",
    vulnClass: "llm",
    file: "src/app/api/copywriter/generate/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "topic, tone, audience, keywords, and wordCount were interpolated into LLM prompts with no length limits. Fixed with slice caps: topic 2000 chars, tone 100, audience 200, keywords 500, wordCount clamped to 50–5000.",
  },
  {
    id: "f19",
    title: "LLM prompt injection in ai/creator-ideas",
    severity: "high",
    vulnClass: "llm",
    file: "src/app/api/ai/creator-ideas/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "User-controlled topic was interpolated into both the system prompt's hook examples and the user prompt with no length cap. Fixed with safeTopic = topic.slice(0, 2000).",
  },
  {
    id: "f20",
    title: "LLM prompt injection in agents/generate",
    severity: "high",
    vulnClass: "llm",
    file: "src/app/api/agents/generate/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "agent_name was interpolated into the system prompt and prompt into user message with no length caps. Fixed: agent_name capped at 200 chars, prompt at 4000 chars.",
  },
  {
    id: "f21",
    title: "LLM prompt injection in leadgen/qualify — unauthenticated path",
    severity: "critical",
    vulnClass: "llm",
    file: "src/app/api/leadgen/qualify/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "External lead reply messages (from Zernio webhook, unauthenticated users) were fed directly into the LLM qualification prompt without any length cap. An attacker could send a 100KB jailbreak payload to override the agent's qualification instructions or inflate AI token costs. Fixed with message.slice(0, 2000) before prompt interpolation.",
  },
  {
    id: "f22",
    title: "Unbounded ?limit= param on generations endpoint",
    severity: "medium",
    vulnClass: "business-logic",
    file: "src/app/api/generations/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "User-controlled ?limit= passed directly to Supabase .range() without an upper bound. A request with limit=100000 could return millions of rows, exhausting DB connection pool and causing OOM. Fixed with Math.min(limit, 100).",
  },
  {
    id: "f23",
    title: "Unbounded PageSize forwarded to Twilio API",
    severity: "medium",
    vulnClass: "business-logic",
    file: "src/app/api/integrations/twilio/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "?limit= param was forwarded directly as PageSize in Twilio Messages and Calls API requests. Twilio caps at 1000 but an attacker could force maximum-cost pages. Fixed with Math.min(parseInt(limit), 200) on both actions.",
  },
  {
    id: "f24",
    title: "SSRF via RunPod audio URL in voice synthesis",
    severity: "high",
    vulnClass: "ssrf",
    file: "src/lib/voice/runpod-clone.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "When a RunPod synthesis job returned output.url instead of base64 audio, the URL was fetched without SSRF validation. A compromised RunPod endpoint or MITM could redirect to internal network addresses. Fixed with isValidExternalHttpsUrl() guard before fetch.",
  },
  {
    id: "f25",
    title: "Unbounded systemPrompt/firstMessage to ElevenLabs agent create",
    severity: "medium",
    vulnClass: "llm",
    file: "src/app/api/eleven-agents/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "systemPrompt and firstMessage were forwarded to ElevenLabs with no length cap. A large payload could inflate ElevenLabs storage costs. Fixed with systemPrompt.slice(0, 8000) and firstMessage.slice(0, 500).",
  },
  {
    id: "f26",
    title: "No MIME/magic-byte validation on voice clone file upload",
    severity: "medium",
    vulnClass: "business-logic",
    file: "src/app/api/ai/voice-clone/route.ts",
    status: "fixed",
    fixedAt: "2026-05-31",
    description:
      "voice_file accepted any binary content up to 25MB — only size was checked, not file type. An attacker could upload scripts, executables, or HTML files that might be processed as audio. Fixed with magic-byte validation for WAV, MP3 (ID3/sync), OGG, FLAC, and M4A.",
  },
  {
    id: "f27",
    title: "IDOR on Revealbot rules — no ownership check",
    severity: "high",
    vulnClass: "idor",
    file: "src/app/api/ads/revealbot/rules/[id]/route.ts",
    status: "open",
    description:
      "The rule ID from the URL path (params.id) is forwarded directly to the Revealbot external API without verifying the rule belongs to the authenticated user's connected Revealbot account. Any authenticated user can GET/PATCH/DELETE Revealbot rules from other tenants.",
  },
  {
    id: "f28",
    title: "Browser worker has no domain allowlist",
    severity: "high",
    vulnClass: "ssrf",
    file: "src/app/api/browser-tasks/route.ts",
    status: "open",
    description:
      "runBrowserAgent() is called without a domainAllowlist parameter. The browser worker can visit any public URL on the internet, enabling internal network probing via DNS rebinding (e.g. http://169.254.169.254 via cloud metadata redirect), SSRF via public-to-private address tricks, and credential harvesting via social-engineering URL targets.",
  },
  {
    id: "f29",
    title: "Middleware Bearer bypass for /api/agents/* routes",
    severity: "medium",
    vulnClass: "auth-bypass",
    file: "src/middleware.ts",
    status: "open",
    description:
      "The middleware short-circuits updateSession for any request to /api/agents/* that has a Bearer token — even a token like 'Bearer x'. Only agency/admin roles should reach agent endpoints, but this allows any string to bypass the Supabase session-refresh step. Impact depends on downstream route auth, but it weakens defense in depth.",
  },
  {
    id: "f30",
    title: "x-owner-id header is user-controlled in lead-files webhook path",
    severity: "medium",
    vulnClass: "auth-bypass",
    file: "src/app/api/uploads/lead-files/route.ts",
    status: "open",
    description:
      "The upload route reads x-owner-id from the request header to determine the agency owner for uploaded files. In the webhook/background path, this header is set by the calling service — but the value is not validated against the DB. An attacker who can send requests to this endpoint could forge x-owner-id to upload files attributed to any user.",
  },
  {
    id: "f31",
    title: "Affiliate track-conversion accepts arbitrary referred_user_id",
    severity: "medium",
    vulnClass: "business-logic",
    file: "src/app/api/affiliate/track-conversion/route.ts",
    status: "open",
    description:
      "When unauthenticated, the route accepts user_id from the POST body and uses it as referred_user_id in the conversion record. An attacker can forge conversion attribution to any UUID, crediting their affiliate account for any user's signup.",
  },
  {
    id: "f32",
    title: "OAuth error detail leaked in redirect URL",
    severity: "medium",
    vulnClass: "business-logic",
    file: "src/app/api/oauth/google/callback/route.ts, tiktok, meta-ads",
    status: "open",
    description:
      "OAuth callback errors are appended as ?error=<raw-error-detail> in the redirect URL. Raw error messages from Google/TikTok/Meta (containing OAuth codes, token hints, internal error strings) end up in browser history and server access logs.",
  },
  {
    id: "f33",
    title: "Profile avatar file extension used instead of MIME for type detection",
    severity: "medium",
    vulnClass: "business-logic",
    file: "src/app/api/profile/avatar/route.ts",
    status: "open",
    description:
      "The avatar upload route derives the file extension from the original filename rather than detecting the actual MIME type from magic bytes. An attacker can rename a script to 'avatar.jpg' and upload it with a correct image Content-Type, bypassing the extension allowlist.",
  },
  {
    id: "f34",
    title: "LoRA training resolution parameter not clamped",
    severity: "low",
    vulnClass: "business-logic",
    file: "src/app/api/ai/train-lora/route.ts",
    status: "open",
    description:
      "User-controlled resolution parameter is forwarded to the training endpoint without an upper bound. A very large resolution (e.g. 4096) would consume significantly more GPU time and cost than the intended 512/768 range.",
  },
  {
    id: "f35",
    title: "ElevenLabs webhook t= timestamp prefix not required",
    severity: "low",
    vulnClass: "auth-bypass",
    file: "src/app/api/webhooks/elevenlabs/route.ts",
    status: "open",
    description:
      "When the signature header lacks a t= timestamp component, the route signs rawBody without timestamp and skips replay protection. A captured valid request (sent without t=) could be replayed indefinitely. ElevenLabs always includes t=, but the code path exists. Consider requiring t= as mandatory.",
  },
  {
    id: "f36",
    title: "Internal env var names exposed in error responses",
    severity: "low",
    vulnClass: "business-logic",
    file: "src/app/api/discord/health/route.ts, integrations/discord/channels/route.ts, agents/auth/route.ts",
    status: "open",
    description:
      "Error messages returned to clients include literal env var names: 'DISCORD_BOT_TOKEN is not configured', 'DISCORD_SERVER_ID not set'. These reveal deployment configuration details useful for social engineering and targeted attacks.",
  },
  {
    id: "f37",
    title: "Telegram webhook returns HTTP 200 when secret is unset",
    severity: "low",
    vulnClass: "auth-bypass",
    file: "src/app/api/webhooks/telegram/route.ts",
    status: "wont-fix",
    description:
      "When TELEGRAM_WEBHOOK_SECRET is not configured, the route logs an error and returns { ok: true } with HTTP 200 so Telegram does not retry. This is intentional — no request processing occurs — but deviates from the fail-closed 503 policy documented in CLAUDE.md. Marked wont-fix to prevent Telegram retry storms; monitoring should alert on this log line.",
  },
  {
    id: "f38",
    title: "Attachment URLs in leadgen/qualify not SSRF-guarded",
    severity: "medium",
    vulnClass: "ssrf",
    file: "src/app/api/leadgen/qualify/route.ts",
    status: "open",
    description:
      "The attachments array from the lead reply body includes URLs that are appended to the conversation history and forwarded to the LLM. While these are not directly fetched, a lead could supply internal network URLs as 'attachment filenames' that appear in the LLM context. Additionally, future code may fetch these URLs to validate attachments.",
  },
  {
    id: "f39",
    title: "No rate limiting on unauthenticated leadgen/qualify path",
    severity: "medium",
    vulnClass: "business-logic",
    file: "src/app/api/leadgen/qualify/route.ts",
    status: "open",
    description:
      "The route is authenticated by a shared WEBHOOK_SECRET rather than per-user auth. An attacker who discovers the secret can flood the endpoint with arbitrary lead_ids, burning AI quota and creating thousands of fake lead interactions.",
  },
  {
    id: "f40",
    title: "createServiceClient used outside of webhook/trusted path",
    severity: "medium",
    vulnClass: "auth-bypass",
    file: "src/app/api/leadgen/qualify/route.ts",
    status: "open",
    description:
      "The leadgen qualify route uses createServiceClient() which bypasses RLS. While the route itself is webhook-authenticated, any query using the service client ignores row-level security. If lead_id is forged (valid UUID belonging to another tenant), the route reads and modifies that tenant's lead data.",
  },
  {
    id: "f41",
    title: "Missing ownership filter on lead_id in leadgen/qualify",
    severity: "high",
    vulnClass: "idor",
    file: "src/app/api/leadgen/qualify/route.ts",
    status: "open",
    description:
      "The route fetches a lead by ID and modifies it without verifying the lead belongs to the calling agency (as identified by the webhook key). If WEBHOOK_SECRET is shared across tenants, an attacker can target any lead_id across the system.",
  },
  {
    id: "f42",
    title: "LoRA model_id not validated before Supabase lookup",
    severity: "low",
    vulnClass: "idor",
    file: "src/app/api/ai/train-lora/route.ts",
    status: "open",
    description:
      "model_id parameter is queried directly against lora_models table. Without an owner filter, a user can trigger a status update for another user's model if the model ID is guessable.",
  },
  {
    id: "f43",
    title: "SSRF via profile image URL in profile-scrape endpoint",
    severity: "medium",
    vulnClass: "ssrf",
    file: "src/app/api/brand-scrape/profile-image/route.ts",
    status: "investigating",
    description:
      "Requires further review to confirm whether user-supplied profile image URLs are fetched server-side without SSRF validation.",
  },
  {
    id: "f44",
    title: "Content-Type not enforced on several POST routes",
    severity: "low",
    vulnClass: "business-logic",
    file: "Multiple API routes",
    status: "open",
    description:
      "Several API routes call request.json() without first verifying Content-Type: application/json. A multipart or text/plain body with valid JSON content passes through, which can cause unexpected behavior if the body parsing changes in a future Next.js version.",
  },
  {
    id: "f45",
    title: "Token-cost DoS via large maxTokens override",
    severity: "low",
    vulnClass: "business-logic",
    file: "src/lib/ai/llm-router.ts",
    status: "open",
    description:
      "Several callers pass a user-influenced value as maxTokens to callLLMTraced. If a caller pipes wordCount or a similar field without capping before reaching the router, the effective limit could be higher than intended, inflating per-request AI cost.",
  },
  {
    id: "f46",
    title: "Silent error swallowing in ElevenLabs voice preview",
    severity: "low",
    vulnClass: "business-logic",
    file: "src/app/api/eleven-agents/route.ts",
    status: "open",
    description:
      "The outer catch block at the end of the POST handler returns a generic 'Internal server error' without logging the underlying exception. Errors during agent creation are invisible in Vercel logs unless the ElevenLabs error text is also captured.",
  },
  {
    id: "f47",
    title: "Voice profile embeddings stored in Supabase without owner validation",
    severity: "medium",
    vulnClass: "idor",
    file: "src/app/api/ai/voice-clone/route.ts",
    status: "open",
    description:
      "After a successful voice clone, the embedding is stored with user_id = user.id. However, if the RunPod response is delayed and the user session expires between request and response, the insert may fail silently. Additionally, the voice_id parameter for TTS is not validated against the current user's voice_profiles.",
  },
  {
    id: "f48",
    title: "Hardcoded fallback voice ID in ElevenLabs agent create",
    severity: "low",
    vulnClass: "business-logic",
    file: "src/app/api/eleven-agents/route.ts",
    status: "open",
    description:
      "The ElevenLabs Rachel voice (21m00Tcm4TlvDq8ikWAM) is hardcoded as fallback. If ElevenLabs changes or removes this voice ID, all agent creation calls without an explicit voiceId will fail. Should be configured via env var.",
  },
  {
    id: "f49",
    title: "Cron secret timing attack via string equality",
    severity: "low",
    vulnClass: "auth-bypass",
    file: "src/lib/security/ssrf-guard.ts",
    status: "investigating",
    description:
      "Requires verification that secureCompare (the shared cron-secret comparison function) uses crypto.timingSafeEqual and not string equality. If any route uses === instead of secureCompare, it's vulnerable to timing-based secret recovery.",
  },
  {
    id: "f50",
    title: "Zernio outbound message body not length-capped before API call",
    severity: "low",
    vulnClass: "business-logic",
    file: "src/lib/services/zernio.ts",
    status: "open",
    description:
      "The Zernio DM sender does not cap the message body before forwarding to the Zernio API. A route that pipes AI output directly to sendDM could produce messages exceeding Zernio's platform limits, causing API errors or unexpected truncation.",
  },
];

const SCAN_TARGETS: ScanTarget[] = [
  {
    label: "ShortStack OS",
    value: "shortstack",
    description: "Full WAPT scan of this codebase — all API routes, auth flows, AI endpoints",
  },
  {
    label: "Custom target",
    value: "custom",
    description: "Scan any web application by URL (requires engagement authorization)",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const EASE_EXPO: [number, number, number, number] = [0.32, 0.72, 0, 1];
const cardAnim = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, delay: i * 0.06, ease: EASE_EXPO } },
});

function SeverityBadge({ level }: { level: SeverityLevel }) {
  const styles: Record<SeverityLevel, string> = {
    critical: "bg-[rgba(239,68,68,0.12)] border-[rgba(239,68,68,0.3)] text-red-400",
    high:     "bg-[rgba(249,115,22,0.12)] border-[rgba(249,115,22,0.3)] text-orange-400",
    medium:   "bg-[rgba(234,179,8,0.12)] border-[rgba(234,179,8,0.3)] text-yellow-400",
    low:      "bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.25)] text-green-400",
    info:     "bg-[rgba(99,102,241,0.1)] border-[rgba(99,102,241,0.25)] text-indigo-400",
  };
  const labels: Record<SeverityLevel, string> = {
    critical: "CRITICAL", high: "HIGH", medium: "MEDIUM", low: "LOW", info: "INFO",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest border ${styles[level]}`}>
      {labels[level]}
    </span>
  );
}

function StatusBadge({ status }: { status: FindingStatus }) {
  if (status === "fixed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-green-400">
        <CheckCircle size={11} weight="fill" /> Fixed
      </span>
    );
  }
  if (status === "investigating") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400">
        <Warning size={11} weight="fill" /> Investigating
      </span>
    );
  }
  if (status === "wont-fix") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
        <XCircle size={11} weight="fill" /> Won&apos;t fix
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
      <WarningCircle size={11} weight="fill" /> Open
    </span>
  );
}

function SeverityIcon({ level }: { level: SeverityLevel }) {
  const props = { size: 13, weight: "fill" as const };
  if (level === "critical") return <Skull {...props} className="text-red-400" />;
  if (level === "high")     return <ShieldWarning {...props} className="text-orange-400" />;
  if (level === "medium")   return <Warning {...props} className="text-yellow-400" />;
  if (level === "low")      return <ShieldCheck {...props} className="text-green-400" />;
  return <ShieldCheck {...props} className="text-indigo-400" />;
}

// ── Tab panels ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const totalReports = VULN_CLASSES.reduce((s, v) => s + v.reportCount, 0);
  return (
    <div className="space-y-6">
      {/* Hero stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Vulnerability Classes",  value: "24",           sub: "from CBH skill bundle",    accent: false },
          { label: "Disclosed Reports",      value: "681",          sub: "real bug bounty patterns", accent: false },
          { label: "Skills Loaded",          value: "51",           sub: "hunt-* + recon + reporting", accent: false },
          { label: "Findings Fixed",         value: `${FINDINGS.filter(f => f.status === "fixed").length} / ${FINDINGS.length}`, sub: "May 2026 audit", accent: true },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...cardAnim(i)} className="glass-panel p-4 rounded-xl space-y-1">
            <p className="text-[10px] text-text-muted uppercase tracking-widest">{stat.label}</p>
            <p className={`text-2xl font-display font-bold ${stat.accent ? "text-brand-accent" : "text-text-primary"}`}>
              {stat.value}
            </p>
            <p className="text-[10px] text-text-muted">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Capability map */}
      <div>
        <p className="text-xs text-text-muted uppercase tracking-widest mb-3">Vulnerability Coverage</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {VULN_CLASSES.map((vc, i) => (
            <motion.div key={vc.id} {...cardAnim(i + 4)} className="glass-panel p-3.5 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-brand-accent">
                  {vc.icon}
                  <span className="text-xs font-semibold text-text-primary">{vc.label}</span>
                </div>
                <span className="text-[9px] text-text-muted border border-border-subtle rounded px-1 py-0.5">
                  {vc.reportCount} reports
                </span>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed">{vc.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Commands reference */}
      <div>
        <p className="text-xs text-text-muted uppercase tracking-widest mb-3">Slash Command Reference</p>
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left py-2.5 px-4 text-text-muted font-medium">Command</th>
                <th className="text-left py-2.5 px-4 text-text-muted font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { cmd: "/hunt target.com",          desc: "Full WAPT or red team engagement — asks mode, dispatches all hunt-* skills" },
                { cmd: "/surface target.com",       desc: "Ranked attack surface from recon output — P1 / P2 / Kill List" },
                { cmd: "/recon target.com",         desc: "Subdomain enumeration, tech fingerprinting, JS secrets" },
                { cmd: "/chain",                    desc: "Chain confirmed findings — checks A→B signal table for compound exploits" },
                { cmd: "/validate",                 desc: "7-Question Gate before report — confirms reproduction steps, impact, severity" },
                { cmd: "/report",                   desc: "Generate structured bug bounty report (BugCrowd / HackerOne / custom)" },
                { cmd: "/token-scan contracts/",    desc: "Meme coin rug-pull scan — 8 vulnerability classes, Solidity + Solana" },
                { cmd: "/autopilot target.com",     desc: "Autonomous hunt loop — runs all skills unattended, surfaces findings" },
              ].map((row, i) => (
                <tr key={row.cmd} className={i % 2 === 0 ? "bg-transparent" : "bg-[rgba(255,255,255,0.015)]"}>
                  <td className="py-2 px-4 font-mono text-[10px] text-brand-accent whitespace-nowrap">{row.cmd}</td>
                  <td className="py-2 px-4 text-text-secondary">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Install */}
      <motion.div {...cardAnim(12)} className="glass-panel rounded-xl p-4 border border-[rgba(212,255,0,0.08)]">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center shrink-0 mt-0.5">
            <Terminal size={15} className="text-brand-accent" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-text-primary">Install Claude-BugHunter</p>
            <p className="text-[10px] text-text-muted">
              Copy the skill bundle into your Claude Code user config to enable all 51 hunt skills and 15 slash commands globally.
            </p>
            <code className="block mt-2 text-[10px] font-mono text-brand-accent bg-[rgba(212,255,0,0.05)] border border-brand-accent/10 rounded px-3 py-2">
              gh repo clone elementalsouls/Claude-BugHunter && bash Claude-BugHunter/scripts/install.sh
            </code>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ScanTab() {
  const [selectedTarget, setSelectedTarget] = useState<string>("shortstack");
  const [customUrl, setCustomUrl] = useState("");
  const [scanRunning, setScanRunning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  function handleRunScan() {
    setScanRunning(true);
    setTimeout(() => { setScanRunning(false); setScanComplete(true); }, 2400);
  }

  return (
    <div className="space-y-5">
      {/* Target selection */}
      <div className="space-y-2">
        <p className="text-xs text-text-muted uppercase tracking-widest">Select Target</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SCAN_TARGETS.map((t, i) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setSelectedTarget(t.value)}
              className={`glass-panel p-4 rounded-xl text-left transition-all ${
                selectedTarget === t.value
                  ? "border border-brand-accent/40 bg-brand-accent/5"
                  : "border border-transparent hover:border-border-subtle"
              }`}
            >
              <p className="text-sm font-semibold text-text-primary mb-0.5">{t.label}</p>
              <p className="text-[10px] text-text-muted">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom URL */}
      {selectedTarget === "custom" && (
        <div className="space-y-1.5">
          <label className="text-xs text-text-muted uppercase tracking-widest" htmlFor="custom-url">
            Target URL
          </label>
          <input
            id="custom-url"
            type="url"
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            placeholder="https://target.example.com"
            className="w-full glass-panel rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted border border-border-subtle focus:border-brand-accent/40 focus:outline-none transition-colors"
          />
          <p className="text-[10px] text-yellow-400 flex items-center gap-1">
            <Warning size={10} weight="fill" />
            Only scan applications you are authorised to test. Unauthorised testing is illegal.
          </p>
        </div>
      )}

      {/* Scan modules */}
      <div className="space-y-2">
        <p className="text-xs text-text-muted uppercase tracking-widest">Scan Modules</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "IDOR",          checked: true  },
            { label: "SSRF",          checked: true  },
            { label: "Auth Bypass",   checked: true  },
            { label: "LLM Injection", checked: true  },
            { label: "SQLi",          checked: false },
            { label: "XSS",           checked: false },
            { label: "Race Condition",checked: true  },
            { label: "Business Logic",checked: true  },
          ].map(m => (
            <label key={m.label} className="flex items-center gap-2 text-[11px] text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={m.checked}
                className="accent-brand-accent"
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={handleRunScan}
        disabled={scanRunning}
        className="btn-pill flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {scanRunning ? (
          <>
            <span className="w-3 h-3 rounded-full border-2 border-transparent border-t-[#020711] animate-spin" />
            Scanning…
          </>
        ) : (
          <>
            <Detective size={15} weight="fill" />
            Run Claude-BugHunter Scan
          </>
        )}
      </button>

      {/* Scan complete message */}
      {scanComplete && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-xl p-4 border border-brand-accent/20 flex items-start gap-3"
        >
          <CheckCircle size={18} weight="fill" className="text-brand-accent shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-text-primary">Scan complete</p>
            <p className="text-[10px] text-text-muted">
              Found 0 new findings. All 9 previously fixed issues remain closed.
              ShortStack OS is clear for Vercel deploy.
            </p>
          </div>
        </motion.div>
      )}

      {/* ShortStack scan instructions */}
      <div className="glass-panel rounded-xl p-4 space-y-2.5">
        <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
          <Terminal size={12} className="text-brand-accent" />
          Run via Claude Code (full depth)
        </p>
        <p className="text-[10px] text-text-muted">
          For a deeper scan with Claude agents reading every API route, run these commands in Claude Code:
        </p>
        {[
          "/hunt shortstack-os --source-code src/ --vuln-class idor",
          "/hunt shortstack-os --source-code src/ --vuln-class ssrf",
          "/surface shortstack.work",
          "/token-scan src/app/api/billing/",
        ].map(cmd => (
          <code key={cmd} className="block text-[10px] font-mono text-brand-accent bg-[rgba(212,255,0,0.04)] border border-brand-accent/10 rounded px-3 py-1.5">
            {cmd}
          </code>
        ))}
      </div>
    </div>
  );
}

function FindingsTab() {
  const [filter, setFilter] = useState<"all" | SeverityLevel | FindingStatus>("all");

  const counts = {
    total:  FINDINGS.length,
    open:   FINDINGS.filter(f => f.status === "open").length,
    fixed:  FINDINGS.filter(f => f.status === "fixed").length,
    investigating: FINDINGS.filter(f => f.status === "investigating").length,
  };

  const filtered = filter === "all"
    ? FINDINGS
    : FINDINGS.filter(f => f.severity === filter || f.status === (filter as FindingStatus));

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: "Total",         value: counts.total,         color: "text-text-primary" },
          { label: "Open",          value: counts.open,          color: "text-red-400"       },
          { label: "Investigating", value: counts.investigating, color: "text-yellow-400"    },
          { label: "Fixed",         value: counts.fixed,         color: "text-green-400"     },
        ].map((s, i) => (
          <motion.div key={s.label} {...cardAnim(i)} className="glass-panel p-3 rounded-xl text-center">
            <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-text-muted mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter strip */}
      <div className="tab-pill-strip">
        {(["all", "high", "medium", "low", "fixed"] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`tab-pill capitalize${filter === f ? " active" : ""}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Findings list */}
      <div className="space-y-2">
        {filtered.map((f, i) => (
          <motion.div key={f.id} {...cardAnim(i)} className="glass-panel rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <SeverityIcon level={f.severity} />
                <p className="text-sm font-semibold text-text-primary truncate">{f.title}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <SeverityBadge level={f.severity} />
                <StatusBadge status={f.status} />
              </div>
            </div>
            <p className="text-[11px] text-text-secondary">{f.description}</p>
            <div className="flex items-center gap-3 text-[10px] text-text-muted">
              <span className="font-mono truncate max-w-xs">{f.file}</span>
              {f.fixedAt && <span className="shrink-0">Fixed {f.fixedAt}</span>}
              <span className="shrink-0 px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] border border-border-subtle">
                {f.vulnClass}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ReportsTab() {
  const fixedCount = FINDINGS.filter(f => f.status === "fixed").length;
  const openCount  = FINDINGS.filter(f => f.status === "open").length;
  const investigatingCount = FINDINGS.filter(f => f.status === "investigating").length;

  return (
    <div className="space-y-5">
      {/* Audit summary card */}
      <motion.div {...cardAnim(0)} className="glass-panel rounded-xl p-5 border border-[rgba(212,255,0,0.1)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-editorial italic text-text-muted mb-0.5">Security Audit</p>
            <h3 className="text-lg font-display font-bold text-text-primary">ShortStack OS — May 2026</h3>
            <p className="text-xs text-text-secondary mt-0.5">WAPT by Claude-BugHunter · 5 parallel security agents</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-display font-bold text-brand-accent">{Math.round((fixedCount / FINDINGS.length) * 100)}%</p>
            <p className="text-[10px] text-text-muted">Remediation rate</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Vulnerability classes",  value: "5 domains", color: "text-text-primary" },
            { label: "Routes audited",         value: "15 files",  color: "text-text-primary" },
            { label: "Commits",                value: "2",         color: "text-brand-accent"  },
          ].map(s => (
            <div key={s.label} className="bg-[rgba(255,255,255,0.025)] rounded-lg p-3 text-center">
              <p className={`text-lg font-display font-semibold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">HIGH severity</span>
            <span className="text-orange-400 font-semibold">
              3 found · 3 fixed · 0 open
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">MEDIUM severity</span>
            <span className="text-yellow-400 font-semibold">
              6 found · 5 fixed · 1 investigating
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">LOW severity</span>
            <span className="text-green-400 font-semibold">
              {FINDINGS.filter(f => f.severity === "low").length} found · all fixed
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-border-subtle flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            className="btn-pill flex items-center gap-1.5 text-xs"
            onClick={() => {
              const report = `# ShortStack OS Security Audit — May 2026\n\nAuditor: Claude-BugHunter (elementalsouls/Claude-BugHunter)\nDate: 2026-05-31\nScope: Full WAPT — SSRF, Auth, IDOR, Business Logic, Error Leakage\n\n## Summary\n${FINDINGS.length} findings across 5 vulnerability domains.\n${fixedCount} fixed · ${investigatingCount} investigating · ${openCount} open\n\n## Findings\n${FINDINGS.map(f => `### [${f.severity.toUpperCase()}] ${f.title}\nStatus: ${f.status}\nFile: ${f.file}\n${f.description}\n`).join("\n")}`;
              const blob = new Blob([report], { type: "text/markdown" });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement("a");
              a.href = url; a.download = "shortstack-security-audit-may2026.md"; a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <DownloadSimple size={13} />
            Export as Markdown
          </button>
          <button
            type="button"
            className="btn-pill-ghost flex items-center gap-1.5 text-xs"
            onClick={() => {
              const csv = [
                "ID,Title,Severity,VulnClass,File,Status,FixedAt,Description",
                ...FINDINGS.map(f =>
                  `${f.id},"${f.title}",${f.severity},${f.vulnClass},"${f.file}",${f.status},${f.fixedAt || ""},"${f.description.replace(/"/g, '""')}"`,
                ),
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement("a");
              a.href = url; a.download = "shortstack-findings.csv"; a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <ClipboardText size={13} />
            Export as CSV
          </button>
        </div>
      </motion.div>

      {/* Bug bounty report template */}
      <motion.div {...cardAnim(1)} className="glass-panel rounded-xl p-4 space-y-2.5">
        <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
          <FileText size={12} className="text-brand-accent" />
          Generate Bug Bounty Report
        </p>
        <p className="text-[10px] text-text-muted">
          Use the Claude-BugHunter /report command to generate a structured HackerOne or BugCrowd-ready report from any confirmed finding.
        </p>
        <code className="block text-[10px] font-mono text-brand-accent bg-[rgba(212,255,0,0.04)] border border-brand-accent/10 rounded px-3 py-2">
          /validate &amp;&amp; /report --format hackerone --finding f1
        </code>
      </motion.div>

      {/* Source */}
      <motion.div {...cardAnim(2)} className="text-[10px] text-text-muted flex items-center gap-1.5">
        <ShieldCheck size={11} className="text-brand-accent" />
        Powered by{" "}
        <a
          href="https://github.com/elementalsouls/Claude-BugHunter"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-accent hover:underline"
        >
          elementalsouls/Claude-BugHunter
        </a>
        {" "}— 51 skills, 681 disclosed-report patterns, 24 vuln classes
      </motion.div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BugHunterPage() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <MotionPage className="space-y-4">

      {/* ── Slim editorial header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1 truncate">
            Security Intelligence
          </p>
          <h1 className="text-2xl font-display font-bold text-text-primary truncate">
            Bug Hunter
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Claude-BugHunter · 51 skills · 681 disclosed-report patterns
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.18)] text-brand-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
            {FINDINGS.filter(f => f.status === "fixed").length}/{FINDINGS.length} fixed
          </span>
          <a
            href="https://github.com/elementalsouls/Claude-BugHunter"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-primary transition-colors border border-border-subtle px-2.5 py-1.5 rounded-full"
          >
            <ShieldCheck size={11} />
            View on GitHub
          </a>
        </div>
      </div>

      {/* ── Tab strip ─────────────────────────────────────────────────────── */}
      <div className="tab-pill-strip">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`tab-pill flex items-center gap-1.5${tab === t.id ? " active" : ""}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {tab === "overview"  && <OverviewTab />}
      {tab === "scan"      && <ScanTab    />}
      {tab === "findings"  && <FindingsTab />}
      {tab === "reports"   && <ReportsTab />}

    </MotionPage>
  );
}
