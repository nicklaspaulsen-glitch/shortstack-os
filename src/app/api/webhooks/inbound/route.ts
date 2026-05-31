import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { secureCompare } from "@/lib/security/ssrf-guard";

// Inbound Webhook — receives data from Zapier, Make.com, or any external system
// POST /api/webhooks/inbound?key=WEBHOOK_SECRET
// Accepts: { event: string, data: Record<string, unknown> }
// Events: lead.create, contact.update, deal.create, note.add, task.create, custom

const ALLOWED_EVENTS = [
  "lead.create",
  "lead.update",
  "contact.update",
  "deal.create",
  "deal.update",
  "note.add",
  "task.create",
  "invoice.paid",
  "form.submitted",
  "custom",
] as const;

// Allowlist of columns that external callers may update via lead.update.
// Server-controlled columns (user_id, created_at, id, lead_score, etc.) are
// intentionally excluded to prevent arbitrary column writes.
const ALLOWED_LEAD_UPDATE_COLUMNS = new Set([
  "business_name",
  "email",
  "phone",
  "industry",
  "city",
  "country",
  "website",
  "notes",
  "status",
  "stage",
  "owner_name",
  "source",
]);

function filterLeadUpdateFields(fields: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  const rejected: string[] = [];
  for (const key of Object.keys(fields)) {
    if (ALLOWED_LEAD_UPDATE_COLUMNS.has(key)) {
      filtered[key] = fields[key];
    } else {
      rejected.push(key);
    }
  }
  if (rejected.length > 0) {
    console.warn("[webhooks/inbound] lead.update rejected disallowed columns:", rejected);
  }
  return filtered;
}

export async function POST(request: NextRequest) {
  // Auth via x-webhook-key header ONLY. Query param (?key=) was removed because
  // query params appear in server access logs, CDN logs, and Referrer headers,
  // leaking the secret in plaintext. Header-only auth closes this gap.
  const key = request.headers.get("x-webhook-key");
  const expectedKey = process.env.WEBHOOK_SECRET;

  if (!expectedKey) {
    console.error("[webhooks/inbound] WEBHOOK_SECRET unset — rejecting request");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!key || !secureCompare(key, expectedKey)) {
    return NextResponse.json({ error: "Invalid webhook key" }, { status: 401 });
  }

  const body = await request.json();
  const { event, data } = body;

  if (!event || typeof event !== "string") {
    return NextResponse.json({ error: "event field required" }, { status: 400 });
  }

  // Enforce the allowlist before the switch so unknown events can't reach
  // the default branch and write arbitrary strings to the DB log.
  type AllowedEvent = typeof ALLOWED_EVENTS[number];
  const isKnownEvent = (ALLOWED_EVENTS as readonly string[]).includes(event);
  if (!isKnownEvent) {
    return NextResponse.json(
      { error: `Unknown event "${event}". Allowed: ${ALLOWED_EVENTS.join(", ")}` },
      { status: 400 },
    );
  }
  const safeEvent = event as AllowedEvent;

  const supabase = createServiceClient();
  const results: string[] = [];

  // ── Cross-tenant write protection ──
  // WEBHOOK_OWNER_USER_ID binds this shared key to a single agency. All writes
  // are scoped to that user_id so rows never leak across tenants. When unset,
  // tenant-scoped events (deal/note/task/invoice) are blocked outright because
  // they would produce orphaned rows invisible to every dashboard.
  //
  // Long-term: replace with a webhook_keys DB table mapping per-tenant keys →
  // user_id, plus an admin UI for key rotation. That removes the env-var
  // single-tenant limitation.
  const webhookOwnerId = process.env.WEBHOOK_OWNER_USER_ID ?? null;
  const CLIENT_ID_EVENTS = new Set(["deal.create", "note.add", "task.create", "invoice.paid"]);

  // Block tenant-scoped events entirely when owner is unknown — prevents orphan rows
  if (!webhookOwnerId && CLIENT_ID_EVENTS.has(safeEvent)) {
    console.error("[webhooks/inbound] WEBHOOK_OWNER_USER_ID unset — blocking tenant-scoped event:", safeEvent);
    return NextResponse.json(
      { error: `${safeEvent} requires WEBHOOK_OWNER_USER_ID to be configured` },
      { status: 503 },
    );
  }

  if (webhookOwnerId && CLIENT_ID_EVENTS.has(safeEvent) && data.client_id) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("id")
      .eq("id", data.client_id)
      .eq("profile_id", webhookOwnerId)
      .maybeSingle();
    if (!clientRow) {
      console.error("[webhooks/inbound] cross-tenant block: client_id not owned by WEBHOOK_OWNER_USER_ID", {
        event: safeEvent,
        client_id: data.client_id,
      });
      return NextResponse.json({ error: "Forbidden: invalid client_id" }, { status: 403 });
    }
  }

  try {
    switch (safeEvent) {
      case "lead.create": {
        const { error } = await supabase.from("leads").insert({
          business_name: data.business_name || data.name || "Unknown",
          owner_name: data.owner_name || data.contact_name || null,
          email: data.email || null,
          phone: data.phone || null,
          website: data.website || null,
          source: data.source || "webhook",
          industry: data.industry || null,
          city: data.city || data.location || null,
          status: "new",
          // Clamp lead_score to 0-100 — reject out-of-range or non-numeric values
          lead_score: Math.min(Math.max(Number(data.lead_score) || 50, 0), 100),
          // Attribute to the webhook owner so the lead appears in their dashboard.
          // Without user_id the row is orphaned — no user's leads page will show it.
          user_id: webhookOwnerId,
        });
        if (error) throw error;
        results.push("Lead created");
        break;
      }

      case "lead.update": {
        if (!data.id && !data.email) {
          return NextResponse.json({ error: "id or email required for lead.update" }, { status: 400 });
        }
        // Filter to allowlisted columns only — prevents external callers from
        // overwriting server-controlled fields (user_id, created_at, etc.)
        const rawFields = (data.fields ?? data) as Record<string, unknown>;
        const safeFields = filterLeadUpdateFields(rawFields);
        if (Object.keys(safeFields).length === 0) {
          return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
        }
        let leadUpdateQuery;
        if (data.id) {
          leadUpdateQuery = supabase.from("leads").update(safeFields).eq("id", data.id);
          // Scope by owner when known so callers can't update other tenants' rows by ID.
          if (webhookOwnerId) leadUpdateQuery = leadUpdateQuery.eq("user_id", webhookOwnerId);
        } else {
          // Email-based update — MUST scope by user_id or the same email address
          // across multiple tenants would be updated simultaneously (cross-tenant write).
          if (!webhookOwnerId) {
            console.error("[webhooks/inbound] lead.update by email refused: WEBHOOK_OWNER_USER_ID is not set. Set it to prevent cross-tenant writes.");
            return NextResponse.json(
              { error: "lead.update by email requires WEBHOOK_OWNER_USER_ID to be configured" },
              { status: 503 },
            );
          }
          leadUpdateQuery = supabase
            .from("leads")
            .update(safeFields)
            .eq("email", data.email)
            .eq("user_id", webhookOwnerId);
        }
        const { error } = await leadUpdateQuery;
        if (error) throw error;
        results.push("Lead updated");
        break;
      }

      case "contact.update": {
        if (!data.email) {
          return NextResponse.json({ error: "email required for contact.update" }, { status: 400 });
        }
        // Email-based update — MUST scope by user_id or the same email address
        // across multiple tenants would be updated simultaneously (cross-tenant write).
        // Same constraint as lead.update by email.
        if (!webhookOwnerId) {
          console.error("[webhooks/inbound] contact.update by email refused: WEBHOOK_OWNER_USER_ID is not set. Set it to prevent cross-tenant writes.");
          return NextResponse.json(
            { error: "contact.update requires WEBHOOK_OWNER_USER_ID to be configured" },
            { status: 503 },
          );
        }
        const { error } = await supabase
          .from("leads")
          .update({
            owner_name: data.name || undefined,
            phone: data.phone || undefined,
            notes: data.notes || undefined,
          })
          .eq("email", data.email)
          .eq("user_id", webhookOwnerId);
        if (error) throw error;
        results.push("Contact updated");
        break;
      }

      case "deal.create": {
        const { error } = await supabase.from("deals").insert({
          client_id: data.client_id || null,
          lead_id: data.lead_id || null,
          title: String(data.title || data.name || "Webhook Deal").slice(0, 500),
          // Clamp value to a sane range — reject absurd or non-numeric inputs
          value: Math.min(Math.max(Number(data.value ?? data.amount) || 0, 0), 1_000_000_000),
          stage: data.stage || "discovery",
          status: "open",
          source: "webhook",
          notes: data.notes ? String(data.notes).slice(0, 2000) : null,
          // Attribute to webhook owner — without user_id the deal is orphaned.
          user_id: webhookOwnerId,
        });
        if (error) throw error;
        results.push("Deal created");
        break;
      }

      case "deal.update": {
        if (!data.id) {
          return NextResponse.json({ error: "id required for deal.update" }, { status: 400 });
        }
        // SECURITY: deal.update by ID requires WEBHOOK_OWNER_USER_ID to be set so
        // we can scope the update to the owning tenant. Without it, any holder of
        // WEBHOOK_SECRET could overwrite any deal row across ALL tenants by UUID —
        // a cross-tenant write vulnerability identical to the lead.update-by-email
        // case that was blocked in the same way.
        if (!webhookOwnerId) {
          console.error("[webhooks/inbound] deal.update refused: WEBHOOK_OWNER_USER_ID is not set. Set it to prevent cross-tenant writes.");
          return NextResponse.json(
            { error: "deal.update requires WEBHOOK_OWNER_USER_ID to be configured" },
            { status: 503 },
          );
        }
        // Ownership pre-flight: validate the deal belongs to this tenant before
        // mutating, then scope the UPDATE itself by user_id for defence in depth.
        const { data: dealRow } = await supabase
          .from("deals")
          .select("client_id")
          .eq("id", data.id)
          .maybeSingle();
        if (!dealRow) {
          return NextResponse.json({ error: "Deal not found" }, { status: 404 });
        }
        if (dealRow.client_id) {
          const { data: ownerCheck } = await supabase
            .from("clients")
            .select("id")
            .eq("id", dealRow.client_id)
            .eq("profile_id", webhookOwnerId)
            .maybeSingle();
          if (!ownerCheck) {
            console.error("[webhooks/inbound] cross-tenant block: deal.update rejected — deal not owned by WEBHOOK_OWNER_USER_ID", {
              deal_id: data.id,
            });
            return NextResponse.json({ error: "Forbidden: deal belongs to different tenant" }, { status: 403 });
          }
        }
        // The update is now scoped by user_id directly so even if the client_id
        // check is bypassed (e.g. deal has no client_id), the write is tenant-safe.
        const { error } = await supabase
          .from("deals")
          .update({
            stage: data.stage || undefined,
            status: data.status || undefined,
            value: data.value || undefined,
            notes: data.notes || undefined,
          })
          .eq("id", data.id)
          .eq("user_id", webhookOwnerId);
        if (error) throw error;
        results.push("Deal updated");
        break;
      }

      case "note.add": {
        // Add note to trinity_log as a general note entry
        const { error } = await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: data.note || data.text || data.message || "Webhook note",
          client_id: data.client_id || null,
          status: "completed",
          result: { source: "webhook", data },
          // Attribute to webhook owner — without user_id the log entry is orphaned.
          user_id: webhookOwnerId,
        });
        if (error) throw error;
        results.push("Note added");
        break;
      }

      case "task.create": {
        const { error } = await supabase.from("trinity_log").insert({
          action_type: "automation",
          description: data.title || data.task || "Webhook task",
          client_id: data.client_id || null,
          status: "pending",
          result: {
            source: "webhook",
            due_date: data.due_date || null,
            assigned_to: data.assigned_to || null,
            priority: data.priority || "normal",
            data,
          },
          // Attribute to webhook owner — without user_id the log entry is orphaned.
          user_id: webhookOwnerId,
        });
        if (error) throw error;
        results.push("Task created");
        break;
      }

      case "invoice.paid": {
        // Log payment received
        const { error } = await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Payment received: ${data.amount ? "$" + data.amount : "unknown amount"} from ${data.client_name || data.email || "unknown"}`,
          client_id: data.client_id || null,
          status: "completed",
          result: { source: "webhook", type: "payment", data },
          // Attribute to webhook owner — without user_id the log entry is orphaned.
          user_id: webhookOwnerId,
        });
        if (error) throw error;
        results.push("Payment logged");
        break;
      }

      case "form.submitted": {
        // Create a lead from form submission
        const { error } = await supabase.from("leads").insert({
          business_name: data.business_name || data.company || data.name || "Form Submission",
          owner_name: data.name || data.full_name || null,
          email: data.email || null,
          phone: data.phone || null,
          website: data.website || null,
          source: data.form_name || "form_webhook",
          notes: data.message || data.notes || null,
          status: "new",
          lead_score: 60,
          // Attribute to webhook owner — without user_id the row is orphaned and
          // invisible to all dashboard queries that filter by user_id.
          user_id: webhookOwnerId,
        });
        if (error) throw error;
        results.push("Form lead created");
        break;
      }

      case "custom":
      default: {
        // Log any custom event
        const { error } = await supabase.from("trinity_log").insert({
          action_type: "automation",
          description: `Webhook event: ${event} — ${data.description || JSON.stringify(data).substring(0, 150)}`,
          status: "completed",
          result: { source: "webhook", event, data },
          // Attribute to webhook owner — without user_id the log entry is orphaned.
          user_id: webhookOwnerId,
        });
        if (error) throw error;
        results.push(`Custom event "${event}" logged`);
        break;
      }
    }

    // Notify on Telegram for important events
    const importantEvents = ["lead.create", "deal.create", "invoice.paid", "form.submitted"];
    if (importantEvents.includes(event)) {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (chatId && botToken) {
        const msg = `📥 Webhook: ${event}\n${data.business_name || data.name || data.email || "—"}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: msg }),
        }).catch((telegramErr) => {
          console.error("[webhooks/inbound] Telegram notify failed:", telegramErr);
        });
      }
    }

    return NextResponse.json({
      success: true,
      event,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Log error — scope to webhook owner so the error is visible in their activity log.
    await supabase.from("trinity_log").insert({
      action_type: "automation",
      description: `Webhook error: ${event} — ${String(err)}`,
      status: "failed",
      result: { source: "webhook", event, error: String(err) },
      user_id: webhookOwnerId,
    });

    console.error("[webhooks/inbound] processing error for event:", event, err);
    // Do not echo internal error details — the caller (Zapier/Make) only needs
    // to know it failed so it can retry. Internal details stay server-side.
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}

// GET — returns available events and webhook documentation
export async function GET(request: NextRequest) {
  const key = request.headers.get("x-webhook-key");
  const expectedKey = process.env.WEBHOOK_SECRET;

  if (!expectedKey) {
    console.error("[webhooks/inbound] WEBHOOK_SECRET unset — rejecting request");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!key || !secureCompare(key, expectedKey)) {
    return NextResponse.json({ error: "Invalid webhook key" }, { status: 401 });
  }

  return NextResponse.json({
    name: "ShortStack OS Inbound Webhook",
    version: "1.0",
    events: ALLOWED_EVENTS,
    endpoint: "/api/webhooks/inbound?key=YOUR_WEBHOOK_KEY",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    example: {
      event: "lead.create",
      data: {
        business_name: "Acme Corp",
        owner_name: "John Doe",
        email: "john@acme.com",
        phone: "555-1234",
        source: "zapier",
      },
    },
  });
}
