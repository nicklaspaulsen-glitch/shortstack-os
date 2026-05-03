/**
 * Shared types for the email-templates module.
 *
 * Defaults ship pre-filled in `defaults.ts` so an agency does NOT need to
 * customize before clients can be onboarded — the moment they add their
 * logo + brand color via white_label_config, the welcome email already
 * looks branded.
 */

export type EmailTemplateKind =
  | "client_welcome"
  | "team_invite"
  | "trial_signup"
  | "plan_purchase"
  | "plan_cancelled"
  | "magic_link"
  | "password_reset";

export const ALL_EMAIL_TEMPLATE_KINDS: EmailTemplateKind[] = [
  "client_welcome",
  "team_invite",
  "trial_signup",
  "plan_purchase",
  "plan_cancelled",
  "magic_link",
  "password_reset",
];

export interface EmailTemplate {
  id?: string;
  agency_owner_id?: string;
  kind: EmailTemplateKind;
  subject: string;
  preview_text: string | null;
  html_body: string;
  plain_body: string;
  cta_label: string | null;
  cta_url_template: string | null;
  /** True when the row was synthesized from `defaults.ts` rather than loaded from DB. */
  is_default: boolean;
  updated_at?: string;
  created_at?: string;
}

export interface GettingStartedSection {
  title: string;
  body_md: string;
  /** Lucide icon name. Renderer maps to a `lucide-react` component. */
  icon: string;
  links: { label: string; href: string }[];
}

export interface GettingStartedFaq {
  q: string;
  a: string;
}

export interface GettingStartedDoc {
  id?: string;
  agency_owner_id?: string;
  slug: string;
  hero_title: string;
  hero_subtitle: string | null;
  hero_video_url: string | null;
  sections: GettingStartedSection[];
  faq: GettingStartedFaq[];
  contact_email: string | null;
  is_public: boolean;
  updated_at?: string;
  created_at?: string;
}
