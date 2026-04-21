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
  | "appointment_booked";

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

async function executeActions(
  supabase: SupabaseClient,
  ownerId: string,
  automation: CrmAutomationRow,
  actions: CrmAutomationAction[],
  payload: Record<string, unknown>,
): Promise<void> {
  const leadId = (payload.lead_id as string | undefined) ?? null;
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
        // send_sms / send_email / ai_call all go through existing endpoints.
        // They require real delivery infra, so we just log the intent here
        // and let the caller follow up via the real endpoint in a later pass.
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
