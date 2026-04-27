/**
 * Template copy registry — actual email and SMS bodies for the workflow
 * library's `template_id` references. Real, on-brand, tested copy.
 *
 * The workflow executor resolves `params.template_id` against this registry
 * to fill in subject/html/text (for email) or body (for SMS). Any token
 * `{{first_name}}`, `{{client_name}}`, `{{billing_portal_url}}`, etc. is
 * rendered against the trigger payload at send time by the existing
 * `renderTemplate()` utility in crm-automation-dispatch.ts.
 *
 * Tone is intentionally human and non-corporate. Dunning emails read like
 * "hey, your card didn't go through, here's the link, want me to retry?"
 * — not "your account is in delinquent status."
 */

export interface EmailCopy {
  subject: string;
  html: string;
  text: string;
}

export interface SmsCopy {
  body: string;
}

export const EMAIL_COPY: Record<string, EmailCopy> = {
  // ── Failed payment recovery ──────────────────────────────────────────────
  "payment-failed-day-1": {
    subject: "Quick heads up — your card didn't go through",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Just a heads up — the payment for {{plan_name}} didn't go through this morning. Could be the card, could be the bank — happens all the time.</p>
<p>You can update your card here: <a href="{{billing_portal_url}}" style="color:#c8a855;">{{billing_portal_url}}</a></p>
<p>Want me to retry the existing card first? Just reply "retry" and we'll give it another go.</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Just a heads up — the payment for {{plan_name}} didn't go through this morning. Could be the card, could be the bank — happens all the time.

Update your card: {{billing_portal_url}}

Want me to retry the existing card first? Just reply "retry" and we'll give it another go.

{{owner_first_name}}`,
  },
  "payment-failed-day-2": {
    subject: "Following up — payment still showing as failed",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Sent a note yesterday — the payment for {{plan_name}} is still showing as failed and we're getting close to a service pause.</p>
<p>Two options:</p>
<ol>
  <li>Update the card: <a href="{{billing_portal_url}}" style="color:#c8a855;">{{billing_portal_url}}</a></li>
  <li>Reply with a better day to retry and I'll set it up.</li>
</ol>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Sent a note yesterday — the payment for {{plan_name}} is still showing as failed and we're getting close to a service pause.

1. Update the card: {{billing_portal_url}}
2. Or reply with a better day to retry and I'll set it up.

{{owner_first_name}}`,
  },

  // ── New lead AI research ─────────────────────────────────────────────────
  "first-touch": {
    subject: "Quick question about {{company_name}}",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>{{ai_research_summary}}</p>
<p>I work with {{owner_business_type}} on {{value_prop}}. Worth a 15-min call next week to compare notes?</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

{{ai_research_summary}}

I work with {{owner_business_type}} on {{value_prop}}. Worth a 15-min call next week to compare notes?

{{owner_first_name}}`,
  },

  // ── Calendar booking flow ────────────────────────────────────────────────
  "booking-confirmation": {
    subject: "Confirmed: {{appointment_title}} on {{appointment_date}}",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Confirmed for {{appointment_date}} at {{appointment_time}} ({{appointment_timezone}}).</p>
<p><strong>What:</strong> {{appointment_title}}<br/>
<strong>Where:</strong> {{appointment_location}}<br/>
<strong>How long:</strong> {{appointment_duration}} minutes</p>
<p>If anything comes up, you can reschedule here: <a href="{{appointment_reschedule_url}}" style="color:#c8a855;">{{appointment_reschedule_url}}</a></p>
<p>Talk soon,<br/>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Confirmed for {{appointment_date}} at {{appointment_time}} ({{appointment_timezone}}).

What: {{appointment_title}}
Where: {{appointment_location}}
Duration: {{appointment_duration}} minutes

Reschedule if needed: {{appointment_reschedule_url}}

Talk soon,
{{owner_first_name}}`,
  },
  "booking-reminder-24h": {
    subject: "Tomorrow: {{appointment_title}}",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Quick reminder — we're meeting tomorrow at {{appointment_time}} ({{appointment_timezone}}).</p>
<p><strong>{{appointment_title}}</strong> — {{appointment_duration}} minutes, {{appointment_location}}</p>
<p>If something's blocking, here's the reschedule link: <a href="{{appointment_reschedule_url}}" style="color:#c8a855;">{{appointment_reschedule_url}}</a></p>
<p>Looking forward,<br/>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Quick reminder — we're meeting tomorrow at {{appointment_time}} ({{appointment_timezone}}).

{{appointment_title}} — {{appointment_duration}} minutes, {{appointment_location}}

Reschedule if needed: {{appointment_reschedule_url}}

Looking forward,
{{owner_first_name}}`,
  },
  "post-call-thank-you": {
    subject: "Good talking just now — recap inside",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Good talking with you. Quick recap of what we covered:</p>
<p>{{call_summary}}</p>
<p>Next step on my side: {{owner_next_step}}<br/>
Next step on your side: {{lead_next_step}}</p>
<p>Hit me back if I missed anything.</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Good talking with you. Quick recap:

{{call_summary}}

Next step on my side: {{owner_next_step}}
Next step on your side: {{lead_next_step}}

Hit me back if I missed anything.

{{owner_first_name}}`,
  },

  // ── 5-day onboarding ─────────────────────────────────────────────────────
  "welcome-day-0": {
    subject: "Welcome aboard, {{first_name}} — what's next",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Welcome to {{owner_business_name}} — you're officially on board.</p>
<p>Here's what's coming over the next few days:</p>
<ul>
  <li><strong>Tomorrow:</strong> a kickoff form so I can get your context fast</li>
  <li><strong>Day 2:</strong> a tour of the dashboard so you know where to find things</li>
  <li><strong>Day 3:</strong> book your onboarding call</li>
  <li><strong>Day 5:</strong> success tips from clients who've been here a while</li>
</ul>
<p>If anything's urgent, just reply — these emails are real, not a bot.</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Welcome to {{owner_business_name}} — you're officially on board.

Here's what's coming over the next few days:
- Tomorrow: kickoff form so I can get your context fast
- Day 2: dashboard tour
- Day 3: book your onboarding call
- Day 5: success tips

If anything's urgent, just reply — these emails are real, not a bot.

{{owner_first_name}}`,
  },
  "kickoff-form-day-1": {
    subject: "5-min kickoff form (so we hit the ground running)",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Quick favor — fill out this kickoff form when you get a sec: <a href="{{kickoff_form_url}}" style="color:#c8a855;">{{kickoff_form_url}}</a></p>
<p>It's 5 minutes. Saves us from playing 20 questions on the call later.</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Quick favor — fill out this kickoff form when you get a sec: {{kickoff_form_url}}

5 minutes. Saves us from playing 20 questions on the call later.

{{owner_first_name}}`,
  },
  "feature-tour-day-2": {
    subject: "Quick dashboard tour ({{owner_business_name}})",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Day 2 — I want you to know where the levers are.</p>
<p><a href="{{dashboard_tour_url}}" style="color:#c8a855;">Dashboard tour (3-min walkthrough)</a></p>
<p>Three things I'd check first:</p>
<ol>
  <li>Your account settings — make sure timezone and brand colors are right</li>
  <li>The integrations page — connect any tools you already use</li>
  <li>The dashboard home — that's where the daily brief lives</li>
</ol>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Day 2 — I want you to know where the levers are.

Dashboard tour: {{dashboard_tour_url}}

Three things to check first:
1. Account settings — timezone + brand colors
2. Integrations — connect tools you already use
3. Dashboard home — daily brief lives there

{{owner_first_name}}`,
  },
  "book-call-day-3": {
    subject: "Time to book our onboarding call",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Three days in — time to actually talk. I want to make sure you're getting value, hear what's working / not, and align on the next 30 days.</p>
<p><a href="{{booking_url}}" style="display:inline-block;background:#c8a855;color:#0b0d12;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;">Pick a time</a></p>
<p>30 minutes max — promise.</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Three days in — time to actually talk. I want to make sure you're getting value and align on the next 30 days.

Pick a time: {{booking_url}}

30 minutes max — promise.

{{owner_first_name}}`,
  },
  "success-tips-day-5": {
    subject: "5 things our power users do (steal these)",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>You're a week in. Here's what the people getting the most out of {{owner_business_name}} do differently:</p>
<ol>
  <li><strong>They check the daily brief first thing</strong> — 2 minutes, sets the day</li>
  <li><strong>They ship one piece of content a day</strong> — momentum compounds</li>
  <li><strong>They keep their pipeline up to date</strong> — even just dragging deals once a week</li>
  <li><strong>They lean on automations</strong> — set up the workflow library when you have a sec</li>
  <li><strong>They reply to me when something's broken</strong> — you'd be amazed how many people don't</li>
</ol>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

You're a week in. Here's what the people getting the most out of {{owner_business_name}} do differently:

1. Check the daily brief first thing
2. Ship one piece of content a day
3. Keep pipeline up to date
4. Lean on automations
5. Reply when something's broken

{{owner_first_name}}`,
  },

  // ── Subscription cancelled ───────────────────────────────────────────────
  "cancel-acknowledged": {
    subject: "Cancellation confirmed — and a small ask",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Confirmed — your subscription is cancelled. No more charges.</p>
<p>Small ask: would you reply with one line on what didn't click? It's the most useful feedback we can get and it shapes the roadmap directly.</p>
<p>If you ever want back in: <a href="{{reactivate_url}}" style="color:#c8a855;">{{reactivate_url}}</a></p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Confirmed — your subscription is cancelled. No more charges.

Small ask: would you reply with one line on what didn't click? Most useful feedback we can get.

If you ever want back in: {{reactivate_url}}

{{owner_first_name}}`,
  },
  "winback-1": {
    subject: "What if I knocked 50% off?",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Three days since you cancelled. I've been thinking about what would actually bring you back.</p>
<p>Here's the offer: <strong>50% off for 3 months</strong> if you re-activate this week.</p>
<p><a href="{{winback_url}}" style="display:inline-block;background:#c8a855;color:#0b0d12;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;">Take the offer</a></p>
<p>If 50% off doesn't move the needle, hit reply and tell me what would.</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Three days since you cancelled. I've been thinking about what would bring you back.

Offer: 50% off for 3 months if you re-activate this week.

Take it: {{winback_url}}

If 50% off doesn't move the needle, hit reply and tell me what would.

{{owner_first_name}}`,
  },
  "winback-final": {
    subject: "Last note from me",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Last note from me — I won't keep nagging.</p>
<p>The 50% offer is still good for another 48 hours: <a href="{{winback_url}}" style="color:#c8a855;">{{winback_url}}</a></p>
<p>If not, totally understood. Best of luck with what's next.</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Last note from me — I won't keep nagging.

The 50% offer is good for another 48 hours: {{winback_url}}

If not, totally understood. Best of luck with what's next.

{{owner_first_name}}`,
  },

  // ── Negative review ──────────────────────────────────────────────────────
  "make-good-offer": {
    subject: "Saw your review — let's make it right",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Saw your review come through. I read it twice — that's not the experience I want anyone walking away with.</p>
<p>Two things I'd like to do:</p>
<ol>
  <li>Get on a 15-min call so I can hear it from you directly: <a href="{{booking_url}}" style="color:#c8a855;">{{booking_url}}</a></li>
  <li>{{make_good_offer}}</li>
</ol>
<p>Whether or not you ever come back, I genuinely want to fix what broke.</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Saw your review come through. I read it twice — that's not the experience I want anyone walking away with.

Two things I'd like to do:
1. 15-min call so I can hear it from you: {{booking_url}}
2. {{make_good_offer}}

Whether or not you come back, I want to fix what broke.

{{owner_first_name}}`,
  },

  // ── Lead score crosses 80 ────────────────────────────────────────────────
  "hot-lead-outreach": {
    subject: "Saw you've been around — open to a call?",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Noticed you've been digging around our content / website / pricing page recently. That's a strong signal you're at least kicking the tires.</p>
<p>If you're trying to figure out whether {{owner_business_name}} fits your situation, easiest path is a 20-min call — I can answer in 5 minutes what would take a week of demo videos.</p>
<p><a href="{{booking_url}}" style="display:inline-block;background:#c8a855;color:#0b0d12;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;">Pick a time</a></p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Noticed you've been digging around recently. Strong signal you're kicking the tires.

If you're trying to figure out whether {{owner_business_name}} fits your situation, easiest path is a 20-min call.

Pick a time: {{booking_url}}

{{owner_first_name}}`,
  },

  // ── Deal won ─────────────────────────────────────────────────────────────
  "deal-won-thanks": {
    subject: "Welcome to the team, {{first_name}} 🎉",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Stoked to have you on board. Genuinely.</p>
<p>I'll be your direct line — not a support queue. You'll get a separate kickoff email shortly with the next 5 days mapped out.</p>
<p>Here's my number if you ever want to text instead of email: {{owner_phone}}</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Stoked to have you on board. Genuinely.

I'll be your direct line — not a support queue. You'll get a separate kickoff email shortly with the next 5 days mapped out.

My number if you want to text: {{owner_phone}}

{{owner_first_name}}`,
  },

  // ── Invoice overdue ──────────────────────────────────────────────────────
  "invoice-overdue-friendly": {
    subject: "Friendly nudge — invoice {{invoice_number}}",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Quick nudge — invoice {{invoice_number}} for {{amount}} is showing as overdue. Probably just slipped through.</p>
<p>Pay link: <a href="{{invoice_url}}" style="color:#c8a855;">{{invoice_url}}</a></p>
<p>If there's a problem on our side, hit reply and I'll sort it.</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Quick nudge — invoice {{invoice_number}} for {{amount}} is overdue. Probably just slipped through.

Pay: {{invoice_url}}

If there's a problem on our side, hit reply and I'll sort it.

{{owner_first_name}}`,
  },
  "invoice-overdue-firm": {
    subject: "Second notice — invoice {{invoice_number}}",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Second note on invoice {{invoice_number}} ({{amount}}) — it's now {{days_overdue}} days overdue.</p>
<p>If there's something blocking on your end, please reply so we can work it out. If it's just a queue issue, here's the link: <a href="{{invoice_url}}" style="color:#c8a855;">{{invoice_url}}</a></p>
<p>If we don't hear back by {{escalation_date}}, I'll need to pause services until it clears.</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Second note on invoice {{invoice_number}} ({{amount}}) — now {{days_overdue}} days overdue.

If there's something blocking on your end, please reply. Otherwise: {{invoice_url}}

If we don't hear back by {{escalation_date}}, I'll need to pause services until it clears.

{{owner_first_name}}`,
  },

  // ── Refund issued ────────────────────────────────────────────────────────
  "refund-apology": {
    subject: "Your refund is on the way",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>Hey {{first_name}},</p>
<p>Refund of {{refund_amount}} is processed — should land back on your card in 3-5 business days.</p>
<p>Sorry it didn't work out. If you ever want to revisit, my door's open. And if you have 30 seconds to tell me what specifically didn't fit, that helps me a lot.</p>
<p>{{owner_first_name}}</p>
</div>`,
    text: `Hey {{first_name}},

Refund of {{refund_amount}} is processed — should land back on your card in 3-5 business days.

Sorry it didn't work out. If you ever want to revisit, my door's open. And if you have 30 seconds to tell me what specifically didn't fit, that helps me a lot.

{{owner_first_name}}`,
  },
};

export const SMS_COPY: Record<string, SmsCopy> = {
  "payment-failed-day-2": {
    body: "Hey {{first_name}} — quick SMS since email may have gotten buried. Your {{plan_name}} payment is still failing. Update card here: {{billing_portal_url}} - {{owner_first_name}}",
  },
  "booking-reminder-1h": {
    body: "Hey {{first_name}} — quick reminder we're meeting in 1h ({{appointment_time}} {{appointment_timezone}}). {{appointment_location}}. - {{owner_first_name}}",
  },
};

/** Notes copy used by the create_note action when params.template_id is set. */
export const NOTE_COPY: Record<string, string> = {
  "refund-log":
    "Refund of {{refund_amount}} processed via Stripe on {{refund_date}}. Reason code: {{refund_reason}}.",
};

/** Slack message copy used by slack.send_message when params.template_id is set. */
export const SLACK_COPY: Record<string, string> = {
  "content-published":
    ":rocket: New content shipped: *{{content_title}}* — {{content_url}}",
  "negative-review":
    ":warning: Negative review from *{{client_name}}* ({{rating}}/5)\n\n> {{review_text}}\n\nQueue: <{{review_url}}>",
  celebration:
    ":tada: *{{deal_name}}* closed! Value: {{deal_value}}. Onboarding kicked off.",
};

/** Get email copy by template_id, returning null if missing. */
export function getEmailCopy(templateId: string): EmailCopy | null {
  return EMAIL_COPY[templateId] ?? null;
}

/** Get SMS copy by template_id, returning null if missing. */
export function getSmsCopy(templateId: string): SmsCopy | null {
  return SMS_COPY[templateId] ?? null;
}

/** Get note body by template_id. */
export function getNoteCopy(templateId: string): string | null {
  return NOTE_COPY[templateId] ?? null;
}

/** Get slack message text by template_id. */
export function getSlackCopy(templateId: string): string | null {
  return SLACK_COPY[templateId] ?? null;
}
