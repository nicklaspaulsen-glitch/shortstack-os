/**
 * Smart Manage — whitelisted action catalog.
 *
 * Claude (via /api/trinity/suggest-actions) is only allowed to return action
 * types that exist in this catalog. Anything else is rejected by the API
 * route before it reaches the UI — Claude never gets to invent arbitrary
 * handler routes.
 *
 * Each action type has:
 *   - `type`            Enum value used across API + UI.
 *   - `label`           Default verb-first label (Claude can override).
 *   - `icon`            lucide-react icon name (rendered by the overlay).
 *   - `handler_route`   Existing API route that the executor POSTs to.
 *                       Use `{client_id}` as a placeholder that gets
 *                       substituted at execution time.
 *   - `http_method`     POST/PATCH/DELETE. Defaults to POST.
 *   - `input_schema`    Keys + types the `one_click_payload` may supply.
 *                       The executor strips anything not in this schema
 *                       before forwarding to the handler route.
 *   - `description`     Short help text for Claude's prompt.
 */

export type SmartManageActionType =
  | "refresh_social_token"
  | "send_invoice_reminder"
  | "pause_ad_campaign"
  | "generate_content_batch"
  | "book_strategy_call"
  | "resend_dns_records"
  | "renew_domain"
  | "request_review"
  | "send_onboarding_resume"
  | "trigger_workflow"
  | "add_to_sequence"
  | "send_sms_followup"
  | "assign_to_team_member"
  | "escalate_ticket"
  | "create_proposal";

export interface SmartManageActionDef {
  type: SmartManageActionType;
  label: string;
  icon: string;
  handler_route: string;
  http_method: "POST" | "PATCH" | "DELETE";
  input_schema: Record<string, "string" | "number" | "boolean">;
  description: string;
  /** If true, an execution is treated as a TODO — handler does not yet exist. */
  todo?: boolean;
}

export const SMART_MANAGE_ACTIONS: Record<SmartManageActionType, SmartManageActionDef> = {
  refresh_social_token: {
    type: "refresh_social_token",
    label: "Refresh social token",
    icon: "RefreshCw",
    handler_route: "/api/zernio/refresh-token",
    http_method: "POST",
    input_schema: { client_id: "string", platform: "string" },
    description:
      "Force-refresh an expiring OAuth token (IG, TikTok, Meta, LinkedIn) via Zernio so posts keep going out.",
  },
  send_invoice_reminder: {
    type: "send_invoice_reminder",
    label: "Send invoice reminder",
    icon: "Receipt",
    handler_route: "/api/invoices/auto-remind",
    http_method: "POST",
    input_schema: { client_id: "string", invoice_id: "string" },
    description:
      "Trigger the reminder email/SMS on an unpaid/overdue invoice. Use when the client has an overdue balance.",
  },
  pause_ad_campaign: {
    type: "pause_ad_campaign",
    label: "Pause ad campaign",
    icon: "PauseCircle",
    handler_route: "/api/ads/pause",
    http_method: "POST",
    input_schema: { client_id: "string", campaign_id: "string" },
    description:
      "Pause a Meta/Google/TikTok ad set that's bleeding budget (CPA well above target, or ROAS < 1).",
    todo: true,
  },
  generate_content_batch: {
    type: "generate_content_batch",
    label: "Generate content batch",
    icon: "Sparkles",
    handler_route: "/api/content-plan/auto-generate",
    http_method: "POST",
    input_schema: { client_id: "string", count: "number", platform: "string" },
    description:
      "Auto-generate the next week of social posts when the content calendar is empty or thin.",
  },
  book_strategy_call: {
    type: "book_strategy_call",
    label: "Book strategy call",
    icon: "CalendarDays",
    handler_route: "/api/calendar/ai-schedule",
    http_method: "POST",
    input_schema: { client_id: "string", duration_minutes: "number" },
    description:
      "Send a Cal/Calendly link + email nudge when the client has been inactive >30 days.",
  },
  resend_dns_records: {
    type: "resend_dns_records",
    label: "Resend DNS records",
    icon: "Globe",
    handler_route: "/api/clients/onboarding-email",
    http_method: "POST",
    input_schema: { client_id: "string", kind: "string" },
    description:
      "Re-email the client their DKIM/SPF/domain DNS records when their mail/domain is still unverified.",
  },
  renew_domain: {
    type: "renew_domain",
    label: "Renew domain",
    icon: "Globe2",
    handler_route: "/api/domains/renew",
    http_method: "POST",
    input_schema: { client_id: "string", domain: "string" },
    description:
      "Trigger a GoDaddy renewal on a domain that's about to expire (< 30d).",
    todo: true,
  },
  request_review: {
    type: "request_review",
    label: "Request a review",
    icon: "Star",
    handler_route: "/api/reviews/request",
    http_method: "POST",
    input_schema: { client_id: "string", channel: "string" },
    description:
      "Send the client a Google/Trustpilot review request. Great for happy, long-tenured accounts.",
  },
  send_onboarding_resume: {
    type: "send_onboarding_resume",
    label: "Resume onboarding",
    icon: "PlayCircle",
    handler_route: "/api/clients/onboarding-email",
    http_method: "POST",
    input_schema: { client_id: "string", kind: "string" },
    description:
      "Nudge the client back into onboarding when their checklist has stalled.",
  },
  trigger_workflow: {
    type: "trigger_workflow",
    label: "Trigger workflow",
    icon: "Zap",
    handler_route: "/api/workflows/agent",
    http_method: "POST",
    input_schema: { client_id: "string", workflow_id: "string" },
    description:
      "Kick off a saved automation workflow (n8n/make style) scoped to this client.",
  },
  add_to_sequence: {
    type: "add_to_sequence",
    label: "Add to email sequence",
    icon: "Mail",
    handler_route: "/api/emails/sequence",
    http_method: "POST",
    input_schema: { client_id: "string", sequence_id: "string" },
    description:
      "Drop the client into a nurture / re-engagement email sequence.",
  },
  send_sms_followup: {
    type: "send_sms_followup",
    label: "Send SMS follow-up",
    icon: "MessageSquare",
    handler_route: "/api/twilio/send-sms",
    http_method: "POST",
    input_schema: { client_id: "string", template_id: "string" },
    description:
      "Shoot a short SMS follow-up — good for no-response clients or warm re-engagement.",
  },
  assign_to_team_member: {
    type: "assign_to_team_member",
    label: "Assign to teammate",
    icon: "UserPlus",
    handler_route: "/api/team/assign-client",
    http_method: "POST",
    input_schema: { client_id: "string", team_member_id: "string" },
    description:
      "Hand this client off to a specific account manager / editor on the team.",
    todo: true,
  },
  escalate_ticket: {
    type: "escalate_ticket",
    label: "Escalate ticket",
    icon: "AlertTriangle",
    handler_route: "/api/tickets/escalate",
    http_method: "POST",
    input_schema: { client_id: "string", ticket_id: "string" },
    description:
      "Bump an open support ticket to P1 when SLA is at risk.",
    todo: true,
  },
  create_proposal: {
    type: "create_proposal",
    label: "Create proposal",
    icon: "FileText",
    handler_route: "/api/contracts/generate",
    http_method: "POST",
    input_schema: { client_id: "string", package_tier: "string" },
    description:
      "Draft an upsell proposal / new contract when the client is primed for expansion.",
  },
};

export const SMART_MANAGE_ACTION_TYPES = Object.keys(
  SMART_MANAGE_ACTIONS,
) as SmartManageActionType[];

/**
 * Validates that `type` is a known action. Returns the action def or null.
 * Use this everywhere you accept a Claude-suggested action type before
 * executing it — Claude MUST NOT get to invent handler routes.
 */
export function resolveSmartManageAction(
  type: string | null | undefined,
): SmartManageActionDef | null {
  if (!type) return null;
  if (!(type in SMART_MANAGE_ACTIONS)) return null;
  return SMART_MANAGE_ACTIONS[type as SmartManageActionType];
}

/**
 * Filters a free-form payload object down to only the keys declared in the
 * action's input_schema. Keeps us from forwarding random Claude output
 * into downstream handler routes.
 */
export function filterPayload(
  action: SmartManageActionDef,
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!payload) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(action.input_schema)) {
    if (key in payload) out[key] = payload[key];
  }
  return out;
}
