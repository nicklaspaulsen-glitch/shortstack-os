/**
 * CRM Automation dispatch — mirror of trigger-dispatch.ts for the simpler
 * `crm_automations` table. The existing `fireTrigger()` path in
 * `src/lib/workflows/trigger-dispatch.ts` targets `workflow_triggers` rows,
 * which reference full `workflows` (nodes+edges). CRM automations are lighter:
 *   trigger JSON like { type: "tag_added", filters: { tag: "hot-lead" } }
 *   actions JSON like [{ type: "send_sms", message: "Hi {{name}}" }]
 *
 * Call this from the same code paths that call `fireTrigger()` — anywhere an
 * event happens (tag added, email opened, reply received, booking made, etc.).
 * The function walks every active `crm_automations` row for the owner, matches
 * the trigger filter against the payload, and kicks off the action list.
 *
 * Like the workflow dispatcher, this is fire-and-forget. Errors are logged
 * but never thrown.
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

export type CrmAutomationEvent =
  | "new_lead"
  | "no_reply_2d"
  | "no_reply_5d"
  | "after_reply"
  | "after_booking"
  | "tag_added"
  | "tag_removed"
  | "email_opened"
  | "email_clicked"
  | "email_replied"
  | "pipeline_stage_changed"
  | "appointment_booked"
  | "appointment_completed";

export interface CrmAutomationAction {
  type: string;
  [key: string]: unknown;
}

interface CrmAutomationRow {
  id: string;
  profile_id: string;
  name: string;
  trigger: { type?: string; filters?: Record<string, unknown> } & Record<string, unknown>;
  actions: CrmAutomationAction[] | CrmAutomationAction | null;
  is_active: boolean;
}

export interface FireCrmAutomationOptions {
  supabase: SupabaseClient;
  ownerId: string;
  event: CrmAutomationEvent | string;
  payload: Record<string, unknown>;
}

function filtersMatch(
  filters: Record<string, unknown> | undefined,
  payload: Record<string, unknown>,
): boolean {
  if (!filters || Object.keys(filters).length === 0) return true;
  for (const [key, expected] of Object.entries(filters)) {
    if (expected === null || expected === undefined || expected === "") continue;
    const actual = payload[key];
    if (typeof expected === "string" && typeof actual === "string") {
      if (expected.toLowerCase() !== actual.toLowerCase()) return false;
    } else if (Array.isArray(expected)) {
      if (!expected.some((v) => String(v).toLowerCase() === String(actual).toLowerCase())) {
        return false;
      }
    } else if (expected !== actual) {
      return false;
    }
  }
  return true;
}

/**
 * Scan crm_automations for the given owner + event and run any matching rules.
 * Fire-and-forget — returns once matching rows are loaded and their actions
 * have been queued; action execution (SMS/email/etc.) can take longer.
 */
export async function fireCrmAutomations(
  opts: FireCrmAutomationOptions,
): Promise<{ matched: number; automation_ids: string[] }> {
  const { supabase, ownerId, event, payload } = opts;

  const { data: rows, error } = await supabase
    .from("crm_automations")
    .select("id, profile_id, name, trigger, actions, is_active")
    .eq("profile_id", ownerId)
    .eq("is_active", true);

  if (error) {
    console.error("[crm-automation-dispatch] load failed:", error.message);
    return { matched: 0, automation_ids: [] };
  }

  const matched: CrmAutomationRow[] = [];
  for (const row of (rows || []) as CrmAutomationRow[]) {
    const trig = row.trigger || {};
    if (trig.type && trig.type !== event) continue;
    if (!filtersMatch(trig.filters, payload)) continue;
    matched.push(row);
  }

  if (matched.length === 0) return { matched: 0, automation_ids: [] };

  // Log to trinity_log for auditability, mirroring existing patterns.
  try {
    await supabase.from("trinity_log").insert(
      matched.map((m) => ({
        user_id: ownerId,
        action: "crm_automation_fired",
        details: {
          automation_id: m.id,
          automation_name: m.name,
          event,
          payload,
        },
      })),
    );
  } catch (err) {
    // trinity_log might not be writable in every env; don't fail.
    console.error("[crm-automation-dispatch] trinity_log insert failed:", err);
  }

  // Execute actions async (fire-and-forget).
  for (const row of matched) {
    const actions = Array.isArray(row.actions)
      ? row.actions
      : row.actions
      ? [row.actions]
      : [];
    void executeActions(supabase, ownerId, row, actions, payload).catch((err) => {
      console.error("[crm-automation-dispatch] execute failed:", err);
    });
  }

  return { matched: matched.length, automation_ids: matched.map((m) => m.id) };
}

/**
 * Replace `{{first_name}}`, `{{review_url}}`, `{{business_name}}`, etc. tokens
 * in a string with values from the event payload (and a few canonical
 * fallbacks). Tokens not present in payload are left as the empty string,
 * which is closer to user expectation than leaving the literal `{{x}}` mark.
 */
function renderTemplate(
  template: string,
  payload: Record<string, unknown>,
  extra: Record<string, string | undefined> = {},
): string {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v != null) merged[k] = String(v);
  }
  // Common aliases. The trigger-dispatch payload uses `guest_name` etc., but
  // automation authors expect first_name + email + phone — wire both spellings.
  const guestName = (payload.guest_name as string | undefined) ?? "";
  if (guestName && !merged.first_name) {
    const [first, ...rest] = guestName.split(" ");
    merged.first_name = first || "";
    merged.last_name = rest.join(" ");
  }
  if (!merged.email && payload.guest_email) merged.email = String(payload.guest_email);
  if (!merged.phone && payload.guest_phone) merged.phone = String(payload.guest_phone);
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && v !== "") merged[k] = v;
  }
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => merged[key] ?? "");
}

async function executeActions(
  supabase: SupabaseClient,
  ownerId: string,
  automation: CrmAutomationRow,
  actions: CrmAutomationAction[],
  payload: Record<string, unknown>,
): Promise<void> {
  const leadId = (payload.lead_id as string | undefined) ?? null;
  const bookingId = (payload.booking_id as string | undefined) ?? null;

  // Resolve owner business_name once for templating.
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, full_name")
    .eq("id", ownerId)
    .maybeSingle();
  const businessName = profile?.business_name || profile?.full_name || "us";

  for (const action of actions) {
    try {
      switch (action.type) {
        case "add_tag": {
          if (!leadId || !action.tag) break;
          await supabase
            .from("lead_tags")
            .insert({ profile_id: ownerId, lead_id: leadId, tag: String(action.tag) });
          break;
        }
        case "update_status": {
          if (!leadId || !action.status) break;
          await supabase
            .from("leads")
            .update({ status: String(action.status) })
            .eq("id", leadId)
            .eq("user_id", ownerId);
          break;
        }
        case "notify": {
          // Write to notifications table if it exists; swallow errors.
          await supabase.from("notifications").insert({
            user_id: ownerId,
            title: automation.name,
            body: `Automation fired for lead ${leadId ?? "—"}`,
            type: "automation",
          });
          break;
        }
        case "create_note": {
          // Note attaches to a lead via lead_notes (matches /api/crm/notes shape).
          // If there's no lead_id but a booking_id, log into trinity_log instead
          // so the audit trail still picks up the note.
          const noteBody = renderTemplate(
            String(action.body || action.text || ""),
            payload,
            { business_name: businessName },
          ) || `Auto-note from "${automation.name}"`;
          if (leadId) {
            await supabase.from("lead_notes").insert({
              profile_id: ownerId,
              lead_id: leadId,
              body: noteBody,
            });
          } else {
            await supabase.from("trinity_log").insert({
              user_id: ownerId,
              action: "automation_note",
              details: {
                automation_id: automation.id,
                automation_name: automation.name,
                booking_id: bookingId,
                body: noteBody,
              },
            });
          }
          break;
        }
        case "send_review_request":
        case "send_email":
        case "send_followup_email": {
          const to = (action.to as string | undefined)
            || (payload.guest_email as string | undefined)
            || (payload.email as string | undefined);
          if (!to) {
            console.warn(`[crm-automation-dispatch] ${action.type}: no recipient`);
            break;
          }
          const reviewUrl = action.review_url
            || action.url
            || `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/review`;
          const subject = renderTemplate(
            String(action.subject || (action.type === "send_review_request"
              ? `Thanks for your visit to ${businessName} — leave us a review!`
              : `A note from ${businessName}`)),
            payload,
            { business_name: businessName, review_url: String(reviewUrl) },
          );
          const bodyTemplate = String(action.body || action.message || (action.type === "send_review_request"
            ? `Hi {{first_name}},\n\nThanks again for choosing ${businessName}. If you have a moment, we'd love a quick review:\n\n{{review_url}}\n\nIt makes a real difference for us.`
            : `Hi {{first_name}},\n\nWe wanted to follow up on your recent appointment with ${businessName}.`));
          const body = renderTemplate(bodyTemplate, payload, {
            business_name: businessName,
            review_url: String(reviewUrl),
          });
          const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#222;">
            <p style="font-size:15px;line-height:1.6;">${body.replace(/\n/g, "<br/>")}</p>
            ${action.type === "send_review_request"
              ? `<p style="margin-top:20px;"><a href="${reviewUrl}" style="background:#c8a855;color:#000;padding:10px 22px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px;">Leave a Review</a></p>`
              : ""}
          </div>`;
          const ok = await sendEmail({ to, subject, html, text: body });
          await supabase.from("trinity_log").insert({
            user_id: ownerId,
            action: "automation_email_sent",
            details: {
              automation_id: automation.id,
              automation_name: automation.name,
              kind: action.type,
              to,
              subject,
              ok,
            },
          });
          break;
        }
        case "send_sms": {
          const to = (action.to as string | undefined)
            || (payload.guest_phone as string | undefined)
            || (payload.phone as string | undefined);
          const message = renderTemplate(
            String(action.message || action.body || ""),
            payload,
            { business_name: businessName },
          );
          if (!to || !message) {
            console.warn(`[crm-automation-dispatch] send_sms: missing to/message`);
            break;
          }
          const sid = process.env.TWILIO_ACCOUNT_SID;
          const token = process.env.TWILIO_AUTH_TOKEN;
          const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_DEFAULT_NUMBER;
          if (!sid || !token || !from) {
            console.warn(`[crm-automation-dispatch] send_sms: Twilio not configured`);
            break;
          }
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
          });
          break;
        }
        default:
          // no-op for unknown action types (future expansion)
          break;
      }
    } catch (err) {
      console.error(
        `[crm-automation-dispatch] action "${action.type}" failed:`,
        err,
      );
    }
  }
}
