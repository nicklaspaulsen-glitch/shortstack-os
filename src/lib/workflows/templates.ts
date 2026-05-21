/**
 * Workflow Template Library — battle-tested automations shipped out of the box.
 *
 * Each template is a self-contained automation that maps cleanly to the existing
 * workflow + workflow_triggers tables. Installing a template creates:
 *   - one row in `workflows` (with `installed_from_template_id` set)
 *   - one row in `workflow_triggers` (linking trigger_type → workflow_id)
 *
 * The `nodes` array on the workflow row holds the action steps. Each step is
 * a plain object the executor (`src/lib/services/workflows.ts`) understands:
 *   { id, name, type: "action" | "condition" | "delay", config: { action, params } }
 *
 * Templates are intentionally LINEAR (no branch trees deeper than v1). That
 * keeps them debuggable and renderable in the existing builder. Branching is
 * supported via the `condition` step type (with nextIfFalse) but the v1 set
 * stays linear by design.
 *
 * To add a new template:
 *   1. Append an entry to `TEMPLATES`
 *   2. Add corresponding email/sms copy to `template-copy.ts` for any
 *      template_id referenced in steps
 *   3. Add an integration test in `src/__tests__/workflow-library.test.ts`
 *
 * Templates ship with `version` so we can evolve them without breaking
 * existing installs (a follow-up "upgrade" flow can compare versions).
 */

export type TemplateCategory =
  | "sales"
  | "onboarding"
  | "retention"
  | "recovery"
  | "social"
  | "support"
  | "marketing";

export interface WorkflowTriggerSpec {
  /** Trigger type string — must match a TriggerType in trigger-dispatch.ts. */
  type: string;
  /** Optional config filter passed verbatim into workflow_triggers.config. */
  config?: Record<string, unknown>;
}

export interface WorkflowStepSpec {
  /** The action name resolved by `WORKFLOW_ACTIONS` in services/workflows.ts. */
  type: string;
  /** Free-form params object passed to the action handler. */
  params?: Record<string, unknown>;
  /** Optional human-readable label for the builder UI. */
  label?: string;
}

export interface WorkflowTemplate {
  /** Stable id — never rename. The DB stores this on `installed_from_template_id`. */
  id: string;
  /** Display name shown in the library gallery. */
  name: string;
  /** One-paragraph description shown on the card. */
  description: string;
  /** Category for filtering. */
  category: TemplateCategory;
  /** Schema version. Bump when a template's shape changes incompatibly. */
  version: number;
  /** What kicks this off. */
  trigger: WorkflowTriggerSpec;
  /** Linear list of steps. The executor walks these in order. */
  steps: WorkflowStepSpec[];
  /** Provider keys the template needs configured (informational, no enforcement). */
  required_integrations: string[];
  /** Optional industry filter for the gallery. */
  vertical_tags?: string[];
  /** Estimated time to install + customize, in minutes. */
  estimated_setup_minutes: number;
}

/**
 * Build the workflow.nodes array from a template's steps. Each node gets a
 * stable id derived from its index so the executor can route between them.
 */
export function templateStepsToNodes(steps: WorkflowStepSpec[]): Array<{
  id: string;
  name: string;
  type: "action" | "condition" | "delay";
  config: { action: string; params: Record<string, unknown> };
}> {
  return steps.map((step, idx) => {
    const nodeType: "action" | "condition" | "delay" =
      step.type === "wait" || step.type === "wait_until"
        ? "delay"
        : step.type.startsWith("if.") || step.type === "branch"
          ? "condition"
          : "action";
    return {
      id: `step_${idx + 1}`,
      name: step.label || step.type,
      type: nodeType,
      config: {
        action: step.type,
        params: (step.params || {}) as Record<string, unknown>,
      },
    };
  });
}

export const TEMPLATES: WorkflowTemplate[] = [
  // ── 1. Failed payment recovery ───────────────────────────────────────────
  {
    id: "failed-payment-recovery",
    name: "Failed payment recovery",
    description:
      "3-step dunning sequence when a Stripe payment fails. Day 1 nudge, retry the card, escalate to SMS, and create a high-priority task for the owner if it's still open after 5 days.",
    category: "recovery",
    version: 1,
    trigger: { type: "stripe.payment_failed", config: {} },
    steps: [
      {
        type: "send_email",
        label: "Day 0 — heads up email",
        params: { template_id: "payment-failed-day-1", voice: "user" },
      },
      { type: "wait", label: "Wait 24h", params: { hours: 24 } },
      {
        type: "stripe.retry_invoice",
        label: "Retry the invoice",
        params: {},
      },
      { type: "wait", label: "Wait 24h", params: { hours: 24 } },
      {
        type: "send_sms",
        label: "Day 2 — SMS reminder",
        params: { template_id: "payment-failed-day-2" },
      },
      { type: "wait", label: "Wait 48h", params: { hours: 48 } },
      {
        type: "create_task",
        label: "Escalate to owner",
        params: {
          assignee: "owner",
          priority: "urgent",
          title: "Failed payment escalation: {{client_name}}",
        },
      },
    ],
    required_integrations: ["stripe", "resend", "twilio"],
    estimated_setup_minutes: 5,
  },

  // ── 2. New lead → AI research → suggested email ───────────────────────────
  {
    id: "new-lead-ai-research",
    name: "New lead → AI research → suggested email",
    description:
      "When a lead lands in the system, run AI research on their company and pre-draft a personalized first email. Owner reviews and sends — keeps you in the loop without grinding the manual research step.",
    category: "sales",
    version: 1,
    trigger: { type: "lead.created", config: {} },
    steps: [
      {
        type: "ai.research_lead",
        label: "AI research the lead",
        params: { depth: "medium" },
      },
      {
        type: "ai.draft_email",
        label: "Draft personalized first touch",
        params: { template_id: "first-touch", voice: "user" },
      },
      {
        type: "create_task",
        label: "Owner review",
        params: { assignee: "owner", title: "Review and send: {{lead_name}}" },
      },
    ],
    required_integrations: ["anthropic"],
    estimated_setup_minutes: 2,
  },

  // ── 3. Calendar booking flow ──────────────────────────────────────────────
  {
    id: "calendar-booking-flow",
    name: "Calendar booking → confirmations + reminders + follow-up",
    description:
      "Standard meeting flow: confirmation email, 24h reminder, 1h SMS reminder, post-call thank you, and an AI-generated follow-up summary the owner can edit and send.",
    category: "sales",
    version: 1,
    trigger: { type: "appointment_booked", config: {} },
    steps: [
      {
        type: "send_email",
        label: "Booking confirmation",
        params: { template_id: "booking-confirmation" },
      },
      {
        type: "wait_until",
        label: "24h before appointment",
        params: { relative_to: "appointment_start", offset_hours: -24 },
      },
      {
        type: "send_email",
        label: "24h reminder",
        params: { template_id: "booking-reminder-24h" },
      },
      {
        type: "wait_until",
        label: "1h before appointment",
        params: { relative_to: "appointment_start", offset_hours: -1 },
      },
      {
        type: "send_sms",
        label: "1h SMS reminder",
        params: { template_id: "booking-reminder-1h" },
      },
      {
        type: "wait_until",
        label: "1h after appointment",
        params: { relative_to: "appointment_completed", offset_hours: 1 },
      },
      {
        type: "send_email",
        label: "Post-call thank you",
        params: { template_id: "post-call-thank-you", voice: "user" },
      },
      {
        type: "ai.draft_summary",
        label: "Draft follow-up summary",
        params: {},
      },
    ],
    required_integrations: ["resend", "twilio"],
    estimated_setup_minutes: 5,
  },

  // ── 4. Content cross-post ─────────────────────────────────────────────────
  {
    id: "content-cross-post",
    name: "Content publish → cross-post + Slack ping",
    description:
      "When you publish a piece of content, this template fans it out to LinkedIn, Instagram, and TikTok via Zernio, then posts to your team's Slack feed so everyone knows it shipped.",
    category: "social",
    version: 1,
    trigger: { type: "content.published", config: {} },
    steps: [
      {
        type: "social.post",
        label: "Cross-post to socials",
        params: { platforms: ["linkedin", "instagram", "tiktok"] },
      },
      {
        type: "slack.send_message",
        label: "Ping the team",
        params: { channel: "agency-feed", template_id: "content-published" },
      },
    ],
    required_integrations: ["zernio", "slack"],
    estimated_setup_minutes: 3,
  },

  // ── 5. Cold email reply → exit + create deal ──────────────────────────────
  {
    id: "cold-email-reply",
    name: "Cold-email reply → exit sequence + create deal",
    description:
      "When a prospect replies to a cold email, exit them from the active sequence so they don't get the next nag, create a deal in the pipeline, and assign to a sales rep round-robin style.",
    category: "sales",
    version: 1,
    trigger: {
      type: "email_replied",
      config: { is_cold_email_recipient: true },
    },
    steps: [
      {
        type: "sequence.exit",
        label: "Exit from sequence",
        params: { reason: "replied" },
      },
      {
        type: "deal.create",
        label: "Create deal",
        params: { stage: "engaged", value: "{{lead_estimated_value}}" },
      },
      {
        type: "assign_to",
        label: "Assign to rep",
        params: { strategy: "round_robin" },
      },
      {
        type: "create_task",
        label: "Reply follow-up",
        params: { template_id: "reply-followup" },
      },
    ],
    required_integrations: [],
    estimated_setup_minutes: 2,
  },

  // ── 6. 5-day client onboarding ────────────────────────────────────────────
  {
    id: "client-onboarding-5day",
    name: "Client onboarding (5-day welcome series)",
    description:
      "5-day drip for new clients: welcome (day 0), kickoff form (day 1), feature tour (day 2), book onboarding call (day 3), success tips (day 5). Sets the tone before the first call.",
    category: "onboarding",
    version: 1,
    trigger: { type: "client.created", config: {} },
    steps: [
      {
        type: "send_email",
        label: "Day 0 welcome",
        params: { template_id: "welcome-day-0" },
      },
      { type: "wait", label: "Wait 1d", params: { days: 1 } },
      {
        type: "send_email",
        label: "Day 1 kickoff form",
        params: { template_id: "kickoff-form-day-1" },
      },
      { type: "wait", label: "Wait 1d", params: { days: 1 } },
      {
        type: "send_email",
        label: "Day 2 feature tour",
        params: { template_id: "feature-tour-day-2" },
      },
      { type: "wait", label: "Wait 1d", params: { days: 1 } },
      {
        type: "send_email",
        label: "Day 3 book a call",
        params: { template_id: "book-call-day-3" },
      },
      { type: "wait", label: "Wait 2d", params: { days: 2 } },
      {
        type: "send_email",
        label: "Day 5 success tips",
        params: { template_id: "success-tips-day-5" },
      },
    ],
    required_integrations: ["resend"],
    estimated_setup_minutes: 5,
  },

  // ── 7. Subscription cancelled → win-back ──────────────────────────────────
  {
    id: "subscription-canceled-winback",
    name: "Subscription cancelled → win-back",
    description:
      "3-touch win-back after a Stripe cancellation. Acknowledge the cancel, follow up at 3 days with a re-engage offer, then a final hail mary at 10 days.",
    category: "retention",
    version: 1,
    trigger: { type: "stripe.subscription_canceled", config: {} },
    steps: [
      {
        type: "send_email",
        label: "Day 0 acknowledge",
        params: { template_id: "cancel-acknowledged" },
      },
      { type: "wait", label: "Wait 3d", params: { days: 3 } },
      {
        type: "send_email",
        label: "Day 3 win-back offer",
        params: { template_id: "winback-1" },
      },
      { type: "wait", label: "Wait 7d", params: { days: 7 } },
      {
        type: "send_email",
        label: "Day 10 final ask",
        params: { template_id: "winback-final" },
      },
    ],
    required_integrations: ["stripe", "resend"],
    estimated_setup_minutes: 3,
  },

  // ── 8. Negative review → CSM alert ────────────────────────────────────────
  {
    id: "negative-review-alert",
    name: "Negative review → owner alert + make-good offer",
    description:
      "When a 1-3 star review hits, immediately ping the owner in Slack, queue a make-good offer email, and create an urgent task. Catch the unhappy customer fast.",
    category: "support",
    version: 1,
    trigger: { type: "review.received", config: { rating_max: 3 } },
    steps: [
      {
        type: "slack.send_message",
        label: "Slack alert",
        params: { channel: "alerts", template_id: "negative-review" },
      },
      {
        type: "create_task",
        label: "Urgent owner task",
        params: {
          assignee: "owner",
          priority: "urgent",
          title: "Reach out: {{client_name}}",
        },
      },
      {
        type: "send_email",
        label: "Make-good offer",
        params: { template_id: "make-good-offer", voice: "user" },
      },
    ],
    required_integrations: ["slack", "resend"],
    estimated_setup_minutes: 2,
  },

  // ── 9. Lead score crosses 80 ──────────────────────────────────────────────
  {
    id: "lead-score-crosses-80",
    name: "Lead score crosses 80 → notify + auto-book offer",
    description:
      "Hot lead alert. When a lead's score crosses 80 going up, ping the owner in Slack, send a 'let's talk' email with a calendar link, and create a follow-up task.",
    category: "sales",
    version: 1,
    trigger: {
      type: "lead.score_crossed",
      config: { threshold: 80, direction: "upward" },
    },
    steps: [
      {
        type: "slack.send_message",
        label: "Slack hot-leads alert",
        params: { channel: "hot-leads" },
      },
      {
        type: "send_email",
        label: "Hot lead outreach",
        params: { template_id: "hot-lead-outreach", voice: "user" },
      },
      {
        type: "create_task",
        label: "Owner follow-up",
        params: { title: "Hot lead: {{lead_name}} ({{lead_score}})" },
      },
    ],
    required_integrations: ["slack", "resend"],
    estimated_setup_minutes: 2,
  },

  // ── 10. Deal won → onboarding + celebration ───────────────────────────────
  {
    id: "deal-won-celebration",
    name: "Deal won → celebration + onboarding kickoff",
    description:
      "New deal closed. Send a thank-you, kick off the 5-day onboarding workflow, and post a celebration in the team Slack #wins channel.",
    category: "sales",
    version: 1,
    trigger: { type: "deal.won", config: {} },
    steps: [
      {
        type: "send_email",
        label: "Thank you",
        params: { template_id: "deal-won-thanks", voice: "user" },
      },
      {
        type: "workflow.run",
        label: "Kick off onboarding",
        params: { template_id: "client-onboarding-5day" },
      },
      {
        type: "slack.send_message",
        label: "Celebrate",
        params: { channel: "wins", template_id: "celebration" },
      },
    ],
    required_integrations: ["resend", "slack"],
    estimated_setup_minutes: 2,
  },

  // ── 11. Invoice overdue 7d → escalate ────────────────────────────────────
  {
    id: "invoice-overdue-7d",
    name: "Invoice overdue 7d → escalate",
    description:
      "Friendly reminder at 7 days overdue, firm reminder at 10 days, owner escalation task at 14 days. Keeps cash flow pressure on without you remembering to follow up.",
    category: "recovery",
    version: 1,
    trigger: { type: "invoice.overdue", config: { days_overdue: 7 } },
    steps: [
      {
        type: "send_email",
        label: "Day 7 friendly nudge",
        params: { template_id: "invoice-overdue-friendly" },
      },
      { type: "wait", label: "Wait 3d", params: { days: 3 } },
      {
        type: "send_email",
        label: "Day 10 firm reminder",
        params: { template_id: "invoice-overdue-firm" },
      },
      { type: "wait", label: "Wait 4d", params: { days: 4 } },
      {
        type: "create_task",
        label: "Owner escalation",
        params: {
          assignee: "owner",
          priority: "high",
          title: "Overdue: {{client_name}} {{amount}}",
        },
      },
    ],
    required_integrations: ["resend"],
    estimated_setup_minutes: 3,
  },

  // ── 13. Full client acquisition pipeline ─────────────────────────────────
  {
    id: "full-client-acquisition",
    name: "Full client acquisition pipeline (AI-autonomous)",
    description:
      "End-to-end autonomous lifecycle: scores a new lead, drafts the first-touch outreach, generates a proposal, tracks through to payment, then kicks off delivery. Each stage waits for real-world events (acceptance, payment) before advancing. Human review is surfaced as Trinity actions — not forced automation.",
    category: "sales",
    version: 1,
    trigger: { type: "lead.created", config: {} },
    steps: [
      {
        type: "pipeline.advance",
        label: "Score + classify lead (AI)",
        params: { action: "advance" },
      },
      {
        type: "wait",
        label: "Score propagation buffer",
        params: { minutes: 5 },
      },
      {
        type: "pipeline.advance",
        label: "Draft first-touch outreach (AI)",
        params: { action: "advance" },
      },
      {
        type: "wait",
        label: "Await owner approval of outreach",
        params: { days: 1 },
      },
      {
        type: "pipeline.advance",
        label: "Draft proposal (AI)",
        params: { action: "advance" },
      },
      {
        type: "wait",
        label: "Await proposal acceptance",
        params: { days: 7 },
      },
      {
        type: "pipeline.advance",
        label: "Advance on payment confirmed",
        params: { action: "advance" },
      },
    ],
    required_integrations: ["anthropic"],
    estimated_setup_minutes: 2,
    vertical_tags: ["agency", "freelance", "consulting", "marketing"],
  },

  // ── 14. Refund issued → log + apology ────────────────────────────────────
  {
    id: "refund-acknowledgment",
    name: "Refund issued → log + apology email",
    description:
      "When a Stripe refund is processed, log it on the lead, send an empathetic apology email, and tag the contact 'refunded' for downstream filtering.",
    category: "support",
    version: 1,
    trigger: { type: "stripe.refund_issued", config: {} },
    steps: [
      {
        type: "create_note",
        label: "Log the refund",
        params: { template_id: "refund-log" },
      },
      {
        type: "send_email",
        label: "Apology email",
        params: { template_id: "refund-apology", voice: "user" },
      },
      { type: "add_tag", label: "Tag as refunded", params: { tag: "refunded" } },
    ],
    required_integrations: ["stripe", "resend"],
    estimated_setup_minutes: 2,
  },
];

/** Get a template by id. Returns null if missing. */
export function getTemplateById(id: string): WorkflowTemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Filter templates by category, optionally also by integration availability. */
export function listTemplates(opts?: {
  category?: TemplateCategory;
  vertical?: string;
}): WorkflowTemplate[] {
  let out = TEMPLATES.slice();
  if (opts?.category) out = out.filter((t) => t.category === opts.category);
  if (opts?.vertical) {
    out = out.filter(
      (t) => !t.vertical_tags || t.vertical_tags.includes(opts.vertical!),
    );
  }
  return out;
}
