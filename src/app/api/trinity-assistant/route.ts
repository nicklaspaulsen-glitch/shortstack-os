import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { anthropic, MODEL_HAIKU, getResponseText } from "@/lib/ai/claude-helpers";
import type Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";

// Stripe client — used by create_payment_link + send_invoice tools. All
// operations go through { stripeAccount } so they live on the agency's
// connected Stripe, never Trinity's platform.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

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
];

interface ToolCtx {
  ownerId: string;
  userId: string;
  role: string;
  clientScope: string | null; // when the caller is a client, actions are limited to this client_id
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

  let body: { message?: unknown; conversation_id?: unknown; client_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "message required." }, { status: 400 });
  const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : null;
  const clientIdInput = typeof body.client_id === "string" ? body.client_id : null;

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

  const ctx: ToolCtx = { ownerId, userId: user.id, role, clientScope };

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

  const systemPrompt = `You are Trinity, the AI operating system for this ShortStack agency dashboard. You can see all of the user's data (clients, leads, deals, revenue, tasks, tokens) and perform actions on their behalf using the tools provided.

USER: ${firstName} (role: ${role})
${clientScope ? `SCOPE: Limited to client ${clientScope}` : "SCOPE: Full agency access"}

WHAT YOU CAN DO:
- Read live business data: get_my_data returns KPIs, MRR, leads today, tokens.
- Prospecting: search_leads (fuzzy search by name/industry/city), create_lead (add a new lead to the pipeline).
- Outreach: draft_outreach_message (generate a personalised DM/email/SMS — user reviews before sending), get_recent_conversations (read the latest inbox replies).
- Clients: search_clients to find one by name.
- Project management: create_task adds work to the user's board.
- Money (agency-only, requires Stripe Connect): create_payment_link generates a Stripe Payment Link for a client; send_invoice creates and emails a hosted Stripe invoice.
- Content: schedule_social_post inserts a post into the content calendar; generate_content_plan runs the full auto-generator across a client's platforms.

HOW YOU WORK:
- When the user asks about numbers, status, or "how am I doing", CALL get_my_data first — never guess.
- When the user asks you to DO something (add a lead, draft a message, create a task, find a client, create a payment link, send an invoice, schedule a post, generate a plan), USE THE RIGHT TOOL. Don't just describe what you would do.
- When acting on a specific client, call search_clients first to get the real id. Same for leads — use search_leads.
- When drafting outreach, actually draft the message — don't just describe the approach.
- After a tool returns, synthesise a short, friendly confirmation and tell the user what happened and where they can see it in the OS.

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

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 2000,
      system: systemPrompt,
      tools: TOOLS,
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
