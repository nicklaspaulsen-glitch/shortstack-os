import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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
  // Auth via query param or header
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || request.headers.get("x-webhook-key");
  const expectedKey = process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;

  if (!key || key !== expectedKey) {
    return NextResponse.json({ error: "Invalid webhook key" }, { status: 401 });
  }

  const body = await request.json();
  const { event, data } = body;

  if (!event) {
    return NextResponse.json({ error: "event field required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const results: string[] = [];

  try {
    switch (event) {
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
          lead_score: data.lead_score || 50,
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
        const rawFields = (data.fields || data) as Record<string, unknown>;
        const safeFields = filterLeadUpdateFields(rawFields);
        if (Object.keys(safeFields).length === 0) {
          return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
        }
        const query = data.id
          ? supabase.from("leads").update(safeFields).eq("id", data.id)
          : supabase.from("leads").update(safeFields).eq("email", data.email);
        const { error } = await query;
        if (error) throw error;
        results.push("Lead updated");
        break;
      }

      case "contact.update": {
        if (!data.email) {
          return NextResponse.json({ error: "email required for contact.update" }, { status: 400 });
        }
        const { error } = await supabase
          .from("leads")
          .update({
            owner_name: data.name || undefined,
            phone: data.phone || undefined,
            notes: data.notes || undefined,
          })
          .eq("email", data.email);
        if (error) throw error;
        results.push("Contact updated");
        break;
      }

      case "deal.create": {
        const { error } = await supabase.from("deals").insert({
          client_id: data.client_id || null,
          lead_id: data.lead_id || null,
          title: data.title || data.name || "Webhook Deal",
          value: data.value || data.amount || 0,
          stage: data.stage || "discovery",
          status: "open",
          source: "webhook",
          notes: data.notes || null,
        });
        if (error) throw error;
        results.push("Deal created");
        break;
      }

      case "deal.update": {
        if (!data.id) {
          return NextResponse.json({ error: "id required for deal.update" }, { status: 400 });
        }
        const { error } = await supabase
          .from("deals")
          .update({
            stage: data.stage || undefined,
            status: data.status || undefined,
            value: data.value || undefined,
            notes: data.notes || undefined,
          })
          .eq("id", data.id);
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
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      event,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Log error
    await supabase.from("trinity_log").insert({
      action_type: "automation",
      description: `Webhook error: ${event} — ${String(err)}`,
      status: "failed",
      result: { source: "webhook", event, error: String(err) },
    });

    return NextResponse.json(
      { error: "Processing failed", details: String(err) },
      { status: 500 }
    );
  }
}

// GET — returns available events and webhook documentation
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || request.headers.get("x-webhook-key");
  const expectedKey = process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;

  if (!key || key !== expectedKey) {
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
