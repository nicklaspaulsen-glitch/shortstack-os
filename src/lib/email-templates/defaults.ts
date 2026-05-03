/**
 * Default copy for the five branded email templates.
 *
 * These ship pre-filled — every agency gets a sensible, warm, non-corporate
 * welcome email out of the box. They customize it via the editor at
 * /dashboard/settings/email-templates if they want, otherwise these defaults
 * fire as-is at signup time with their logo + brand color from
 * white_label_config substituted in.
 *
 * Voice: warm, real, like a peer not a vendor. No "we are excited to welcome
 * you to our family". No "synergy". Short sentences. Owner signs off in the
 * first person. CTA is concrete.
 *
 * Variables use Mustache-style `{{var}}` syntax. The full list of available
 * vars per kind lives in `variables.ts`.
 */

import type { EmailTemplate, EmailTemplateKind, GettingStartedDoc } from "./types";

// Shared inline-style fragments. Email clients render <style> tags
// unreliably, so EVERY style is inline. Keep this list short — the
// total HTML size matters for clients like Gmail (clipping at ~102KB).
const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const TEXT_PRIMARY = "#0F172A";
const TEXT_SECONDARY = "#475569";
const TEXT_MUTED = "#6B7280";
const BG_PAGE = "#F9FAFB";
const BG_CARD = "#FFFFFF";

function shellHtml(inner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{{__subject__}}</title>
</head>
<body style="margin:0;padding:0;background:${BG_PAGE};-webkit-font-smoothing:antialiased;">
  <span style="display:none;font-size:1px;color:${BG_PAGE};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{{preview_text}}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_PAGE};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BG_CARD};border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04),0 8px 24px rgba(15,23,42,0.06);">
          ${inner}
        </table>
        <p style="font-family:${FONT};font-size:12px;color:${TEXT_MUTED};margin:24px 0 0;">
          {{agency_name}} &middot; <a href="mailto:{{owner_email}}" style="color:${TEXT_MUTED};">{{owner_email}}</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const CLIENT_WELCOME_HTML = shellHtml(`
  <tr>
    <td style="padding:32px 32px 0;text-align:center;">
      <img src="{{logo_url}}" alt="{{agency_name}}" style="max-width:160px;height:auto;display:inline-block;" />
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 0;">
      <h1 style="font-family:${FONT};font-size:26px;font-weight:700;line-height:1.3;color:${TEXT_PRIMARY};margin:0 0 16px;">
        Hey {{client_first_name}} &mdash; welcome aboard.
      </h1>
      <p style="font-family:${FONT};font-size:16px;line-height:1.65;color:${TEXT_SECONDARY};margin:0 0 16px;">
        I'm {{owner_first_name}} from {{agency_name}}. Stoked to have you on. Real quick on what happens next:
      </p>
      <ul style="font-family:${FONT};font-size:16px;line-height:1.8;color:${TEXT_SECONDARY};margin:0 0 24px;padding-left:20px;">
        <li>Your client portal is live: <a href="{{portal_url}}" style="color:{{brand_color}};font-weight:600;">log in here</a></li>
        <li>I dropped a getting-started guide for you: <a href="{{getting_started_url}}" style="color:{{brand_color}};font-weight:600;">read it</a> (5-min skim)</li>
        <li>Reply to this email any time &mdash; I read every one</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 32px;text-align:center;">
      <a href="{{portal_url}}" style="display:inline-block;background:{{brand_color}};color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;">
        {{cta_label}}
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 32px;border-top:1px solid #E5E7EB;">
      <p style="font-family:${FONT};font-size:14px;line-height:1.6;color:${TEXT_MUTED};margin:24px 0 0;text-align:center;">
        Questions? Just hit reply. &mdash; {{owner_first_name}}
      </p>
    </td>
  </tr>
`);

const CLIENT_WELCOME_PLAIN = `Hey {{client_first_name}},

Welcome aboard. I'm {{owner_first_name}} from {{agency_name}}.

Quick orientation:
- Portal: {{portal_url}}
- Getting started guide: {{getting_started_url}}
- Reply any time -- I read every email

-- {{owner_first_name}}`;

const TEAM_INVITE_HTML = shellHtml(`
  <tr>
    <td style="padding:32px 32px 0;text-align:center;">
      <img src="{{logo_url}}" alt="{{agency_name}}" style="max-width:160px;height:auto;display:inline-block;" />
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 0;">
      <h1 style="font-family:${FONT};font-size:26px;font-weight:700;line-height:1.3;color:${TEXT_PRIMARY};margin:0 0 16px;">
        {{owner_first_name}} added you to {{agency_name}}.
      </h1>
      <p style="font-family:${FONT};font-size:16px;line-height:1.65;color:${TEXT_SECONDARY};margin:0 0 16px;">
        You've been invited as a team member. One click and you're in.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 32px 32px;text-align:center;">
      <a href="{{invite_url}}" style="display:inline-block;background:{{brand_color}};color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;">
        {{cta_label}}
      </a>
      <p style="font-family:${FONT};font-size:13px;color:${TEXT_MUTED};margin:16px 0 0;">
        This link expires in 7 days. If you weren't expecting it, ignore this email.
      </p>
    </td>
  </tr>
`);

const TEAM_INVITE_PLAIN = `{{owner_first_name}} added you to {{agency_name}}.

Accept the invite: {{invite_url}}

This link expires in 7 days.`;

const TRIAL_SIGNUP_HTML = shellHtml(`
  <tr>
    <td style="padding:32px 32px 0;text-align:center;">
      <img src="{{logo_url}}" alt="{{agency_name}}" style="max-width:160px;height:auto;display:inline-block;" />
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 0;">
      <h1 style="font-family:${FONT};font-size:26px;font-weight:700;line-height:1.3;color:${TEXT_PRIMARY};margin:0 0 16px;">
        Your trial is live, {{client_first_name}}.
      </h1>
      <p style="font-family:${FONT};font-size:16px;line-height:1.65;color:${TEXT_SECONDARY};margin:0 0 16px;">
        Take it for a real spin &mdash; I built the trial to be the actual product, not a stripped-down demo. Three tips:
      </p>
      <ol style="font-family:${FONT};font-size:16px;line-height:1.8;color:${TEXT_SECONDARY};margin:0 0 24px;padding-left:20px;">
        <li>Click around. The first 60 seconds tell you if this fits.</li>
        <li>Hit me with questions &mdash; reply to this email.</li>
        <li>Read the <a href="{{getting_started_url}}" style="color:{{brand_color}};font-weight:600;">5-min orientation</a>.</li>
      </ol>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 32px;text-align:center;">
      <a href="{{login_url}}" style="display:inline-block;background:{{brand_color}};color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;">
        {{cta_label}}
      </a>
    </td>
  </tr>
`);

const TRIAL_SIGNUP_PLAIN = `Your trial is live, {{client_first_name}}.

Take it for a real spin -- the trial is the actual product.

Three tips:
1. Click around. The first 60 seconds tell you if this fits.
2. Hit me with questions -- reply to this email.
3. Read the orientation: {{getting_started_url}}

Open your account: {{login_url}}

-- {{owner_first_name}}`;

const MAGIC_LINK_HTML = shellHtml(`
  <tr>
    <td style="padding:32px 32px 0;text-align:center;">
      <img src="{{logo_url}}" alt="{{agency_name}}" style="max-width:140px;height:auto;display:inline-block;" />
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 0;">
      <h1 style="font-family:${FONT};font-size:24px;font-weight:700;line-height:1.3;color:${TEXT_PRIMARY};margin:0 0 12px;">
        Sign in to {{agency_name}}
      </h1>
      <p style="font-family:${FONT};font-size:15px;line-height:1.65;color:${TEXT_SECONDARY};margin:0 0 8px;">
        Click the button below to sign in. The link expires in 1 hour.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 32px 32px;text-align:center;">
      <a href="{{magic_link_url}}" style="display:inline-block;background:{{brand_color}};color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;">
        {{cta_label}}
      </a>
      <p style="font-family:${FONT};font-size:12px;color:${TEXT_MUTED};margin:24px 0 0;">
        Didn't request this? Ignore this email &mdash; nothing will happen.
      </p>
    </td>
  </tr>
`);

const MAGIC_LINK_PLAIN = `Sign in to {{agency_name}}.

{{magic_link_url}}

This link expires in 1 hour. Didn't request it? Ignore this email.`;

const PLAN_PURCHASE_HTML = shellHtml(`
  <tr>
    <td style="padding:32px 32px 0;text-align:center;">
      <img src="{{logo_url}}" alt="{{agency_name}}" style="max-width:160px;height:auto;display:inline-block;" />
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 0;">
      <h1 style="font-family:${FONT};font-size:26px;font-weight:700;line-height:1.3;color:${TEXT_PRIMARY};margin:0 0 8px;">
        You're in, {{client_first_name}}. 🎉
      </h1>
      <p style="font-family:${FONT};font-size:15px;line-height:1.5;color:{{brand_color}};font-weight:600;margin:0 0 20px;">
        {{plan_name}} — {{plan_amount}}
      </p>
      <p style="font-family:${FONT};font-size:16px;line-height:1.65;color:${TEXT_SECONDARY};margin:0 0 16px;">
        Your plan is live. Here's what that means for you:
      </p>
      <ul style="font-family:${FONT};font-size:16px;line-height:1.8;color:${TEXT_SECONDARY};margin:0 0 24px;padding-left:20px;">
        <li>Your portal is ready: <a href="{{portal_url}}" style="color:{{brand_color}};font-weight:600;">log in here</a></li>
        <li>First steps are all in the <a href="{{getting_started_url}}" style="color:{{brand_color}};font-weight:600;">getting-started guide</a></li>
        <li>Any questions? Just reply &mdash; {{owner_first_name}} reads every one</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 32px;text-align:center;">
      <a href="{{portal_url}}" style="display:inline-block;background:{{brand_color}};color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;">
        {{cta_label}}
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 32px;border-top:1px solid #E5E7EB;">
      <p style="font-family:${FONT};font-size:14px;line-height:1.6;color:${TEXT_MUTED};margin:24px 0 0;text-align:center;">
        Billing questions? Reply to this email. &mdash; {{owner_first_name}}
      </p>
    </td>
  </tr>
`);

const PLAN_PURCHASE_PLAIN = `You're in, {{client_first_name}}.

Plan: {{plan_name}} — {{plan_amount}}

Your plan is live. Quick orientation:
- Portal: {{portal_url}}
- Getting started: {{getting_started_url}}
- Questions? Reply to this email

-- {{owner_first_name}}`;

const PLAN_CANCELLED_HTML = shellHtml(`
  <tr>
    <td style="padding:32px 32px 0;text-align:center;">
      <img src="{{logo_url}}" alt="{{agency_name}}" style="max-width:160px;height:auto;display:inline-block;" />
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 0;">
      <h1 style="font-family:${FONT};font-size:24px;font-weight:700;line-height:1.3;color:${TEXT_PRIMARY};margin:0 0 16px;">
        Your {{plan_name}} has been cancelled.
      </h1>
      <p style="font-family:${FONT};font-size:16px;line-height:1.65;color:${TEXT_SECONDARY};margin:0 0 16px;">
        Hey {{client_first_name}}, your subscription to {{agency_name}} has been cancelled.
        Here's what happens next:
      </p>
      <ul style="font-family:${FONT};font-size:16px;line-height:1.8;color:${TEXT_SECONDARY};margin:0 0 24px;padding-left:20px;">
        <li>Your access stays active through the end of your current billing period</li>
        <li>No further charges will be made</li>
        <li>Your data and files are safe — we keep them for 30 days</li>
      </ul>
      <p style="font-family:${FONT};font-size:16px;line-height:1.65;color:${TEXT_SECONDARY};margin:0 0 8px;">
        Changed your mind? Just reply and I'll get you back up in minutes.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 32px 32px;text-align:center;">
      <a href="mailto:{{owner_email}}" style="display:inline-block;background:{{brand_color}};color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;">
        {{cta_label}}
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 32px;border-top:1px solid #E5E7EB;">
      <p style="font-family:${FONT};font-size:14px;line-height:1.6;color:${TEXT_MUTED};margin:24px 0 0;text-align:center;">
        &mdash; {{owner_first_name}} from {{agency_name}}
      </p>
    </td>
  </tr>
`);

const PLAN_CANCELLED_PLAIN = `Hey {{client_first_name}},

Your {{plan_name}} subscription to {{agency_name}} has been cancelled.

What happens next:
- Access stays active through your current billing period
- No further charges
- Your data is kept for 30 days

Changed your mind? Just reply and I'll get you back up right away.

-- {{owner_first_name}}`;

const PASSWORD_RESET_HTML = shellHtml(`
  <tr>
    <td style="padding:32px 32px 0;text-align:center;">
      <img src="{{logo_url}}" alt="{{agency_name}}" style="max-width:140px;height:auto;display:inline-block;" />
    </td>
  </tr>
  <tr>
    <td style="padding:24px 32px 0;">
      <h1 style="font-family:${FONT};font-size:24px;font-weight:700;line-height:1.3;color:${TEXT_PRIMARY};margin:0 0 12px;">
        Reset your password
      </h1>
      <p style="font-family:${FONT};font-size:15px;line-height:1.65;color:${TEXT_SECONDARY};margin:0 0 8px;">
        Hit the button below to set a new password. Link expires in 1 hour.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 32px 32px;text-align:center;">
      <a href="{{reset_url}}" style="display:inline-block;background:{{brand_color}};color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;">
        {{cta_label}}
      </a>
      <p style="font-family:${FONT};font-size:12px;color:${TEXT_MUTED};margin:24px 0 0;">
        Didn't request a reset? Ignore this email and your password stays the same.
      </p>
    </td>
  </tr>
`);

const PASSWORD_RESET_PLAIN = `Reset your password.

{{reset_url}}

Link expires in 1 hour. Didn't request it? Ignore this email.`;

export const DEFAULT_TEMPLATES: Record<EmailTemplateKind, EmailTemplate> = {
  client_welcome: {
    kind: "client_welcome",
    subject: "Welcome to {{agency_name}} — let's get going",
    preview_text: "A quick tour to help you get oriented.",
    html_body: CLIENT_WELCOME_HTML,
    plain_body: CLIENT_WELCOME_PLAIN,
    cta_label: "Open your portal",
    cta_url_template: "{{portal_url}}",
    is_default: true,
  },
  team_invite: {
    kind: "team_invite",
    subject: "{{owner_first_name}} added you to {{agency_name}}",
    preview_text: "You've been invited to join the team.",
    html_body: TEAM_INVITE_HTML,
    plain_body: TEAM_INVITE_PLAIN,
    cta_label: "Accept invite",
    cta_url_template: "{{invite_url}}",
    is_default: true,
  },
  trial_signup: {
    kind: "trial_signup",
    subject: "Your {{agency_name}} trial is live",
    preview_text: "Three tips to get the most out of the next 14 days.",
    html_body: TRIAL_SIGNUP_HTML,
    plain_body: TRIAL_SIGNUP_PLAIN,
    cta_label: "Open your account",
    cta_url_template: "{{login_url}}",
    is_default: true,
  },
  plan_purchase: {
    kind: "plan_purchase",
    subject: "You're on {{plan_name}} — welcome to {{agency_name}}",
    preview_text: "Your plan is live. Here's what to do first.",
    html_body: PLAN_PURCHASE_HTML,
    plain_body: PLAN_PURCHASE_PLAIN,
    cta_label: "Open your portal",
    cta_url_template: "{{portal_url}}",
    is_default: true,
  },
  plan_cancelled: {
    kind: "plan_cancelled",
    subject: "Your {{agency_name}} subscription has been cancelled",
    preview_text: "We've processed your cancellation. Here's what to expect.",
    html_body: PLAN_CANCELLED_HTML,
    plain_body: PLAN_CANCELLED_PLAIN,
    cta_label: "Get back on board",
    cta_url_template: "mailto:{{owner_email}}",
    is_default: true,
  },
  magic_link: {
    kind: "magic_link",
    subject: "Sign in to {{agency_name}}",
    preview_text: "Tap the button to sign in.",
    html_body: MAGIC_LINK_HTML,
    plain_body: MAGIC_LINK_PLAIN,
    cta_label: "Sign in",
    cta_url_template: "{{magic_link_url}}",
    is_default: true,
  },
  password_reset: {
    kind: "password_reset",
    subject: "Reset your {{agency_name}} password",
    preview_text: "Set a new password in one click.",
    html_body: PASSWORD_RESET_HTML,
    plain_body: PASSWORD_RESET_PLAIN,
    cta_label: "Reset password",
    cta_url_template: "{{reset_url}}",
    is_default: true,
  },
};

export function getDefaultTemplate(kind: EmailTemplateKind): EmailTemplate {
  return { ...DEFAULT_TEMPLATES[kind] };
}

export const DEFAULT_GETTING_STARTED: GettingStartedDoc = {
  slug: "main",
  hero_title: "Welcome to {{agency_name}}",
  hero_subtitle: "Everything you need to know in 5 minutes.",
  hero_video_url: null,
  contact_email: null,
  is_public: true,
  sections: [
    {
      title: "What you can do here",
      body_md:
        "Your client portal is mission control. You'll see your project status, upcoming deliverables, files we share, and a running record of decisions we've made together. Everything in one place — no inbox archaeology.",
      icon: "Zap",
      links: [],
    },
    {
      title: "Where things live",
      body_md:
        "**Calendar** — book a call any time using the calendar link in your portal.\n\n**Files** — final deliverables, working drafts, and reference assets.\n\n**Tasks** — what's in flight, what's waiting on you, what's done.\n\n**Invoices** — past bills and what's coming up.",
      icon: "Map",
      links: [],
    },
    {
      title: "How to get hold of {{owner_first_name}}",
      body_md:
        "Reply to any email I send you — that's the fastest path. For anything urgent, you can also message me directly through the portal. I aim to reply within one business day.",
      icon: "MessageCircle",
      links: [],
    },
    {
      title: "Files & deliverables",
      body_md:
        "Everything I'm working on for you lives in your Files tab. Drafts get marked as drafts. Once something's signed off, it moves to Final. Versioning is automatic — old copies aren't lost.",
      icon: "FolderOpen",
      links: [],
    },
    {
      title: "Billing & invoices",
      body_md:
        "Past invoices and upcoming charges live in the Invoices tab. Payments process automatically on the schedule we agreed to. If anything looks off, just reply to the invoice email and I'll sort it.",
      icon: "Receipt",
      links: [],
    },
  ],
  faq: [
    {
      q: "What if I have a question outside of business hours?",
      a: "Just email — I'll get back to you within one business day. For genuine emergencies, mark the subject URGENT and I'll prioritize it.",
    },
    {
      q: "Can I add my team to the portal?",
      a: "Yes — you can invite teammates from the Team tab. They'll get their own login and you control what they can see.",
    },
    {
      q: "Where do I find past calls and meetings?",
      a: "Every call gets a summary written up in the Notes tab within 24 hours. Recordings (if we recorded) are linked there too.",
    },
    {
      q: "What if something is wrong with a deliverable?",
      a: "Tell me. Rounds of revision are baked into how we work — there's no gotcha if you want to change direction. Reply to the email or comment on the file.",
    },
  ],
};
