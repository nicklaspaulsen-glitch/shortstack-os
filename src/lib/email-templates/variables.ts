/**
 * Variable resolution for email templates and getting-started docs.
 *
 * Two responsibilities:
 *   1. Build a `vars` map for a given (agency, optional client/team-member)
 *      context by querying profiles + white_label_config.
 *   2. Render a template string by substituting `{{var}}` placeholders.
 *
 * Vars include both per-agency branding (logo, brand color, agency name,
 * owner first name) and per-recipient fields (client first name, email).
 * Missing vars resolve to "" — never `undefined` — so a template never
 * renders the literal `{{...}}` to a recipient.
 */

import { SupabaseClient } from "@supabase/supabase-js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
const DEFAULT_BRAND_COLOR = "#5E5BFF"; // brand indigo from tokens.ts
const DEFAULT_LOGO = `${APP_URL}/icons/shortstack-logo.png`;
const DEFAULT_AGENCY_NAME = "Trinity";

export interface TemplateVarContext {
  agency_owner_id: string;
  client_id?: string;
  team_member_id?: string;
  /**
   * Free-form per-call overrides — useful for one-shot URLs (magic links,
   * reset tokens, invite tokens) that the caller already has in hand.
   */
  extra?: Record<string, string>;
}

/** Pull a recipient's first name out of a full name, falling back to "there". */
function firstNameOf(fullName: string | null | undefined, fallback = "there"): string {
  if (!fullName) return fallback;
  const trimmed = fullName.trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0];
}

interface ProfileRow {
  full_name?: string | null;
  email?: string | null;
}

interface WhiteLabelRow {
  brand_name?: string | null;
  company_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  support_email?: string | null;
  custom_domain?: string | null;
}

interface ClientRow {
  business_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
}

/**
 * Resolve all variables for the given context. Always returns a complete
 * map — fields the caller doesn't have data for resolve to "".
 */
export async function resolveTemplateVars(
  supabase: SupabaseClient,
  ctx: TemplateVarContext,
): Promise<Record<string, string>> {
  // Load owner profile + white-label config in parallel.
  const [profileRes, whiteLabelRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", ctx.agency_owner_id)
      .maybeSingle(),
    supabase
      .from("white_label_config")
      .select("brand_name, company_name, logo_url, primary_color, support_email, custom_domain")
      .eq("user_id", ctx.agency_owner_id)
      .maybeSingle(),
  ]);

  const owner = (profileRes.data || {}) as ProfileRow;
  const wl = (whiteLabelRes.data || {}) as WhiteLabelRow;

  // Optional client lookup (only for client-facing emails).
  let client: ClientRow = {};
  if (ctx.client_id) {
    const { data } = await supabase
      .from("clients")
      .select("business_name, contact_name, email")
      .eq("id", ctx.client_id)
      .maybeSingle();
    client = (data || {}) as ClientRow;
  }

  // Optional team-member lookup (only for team-invite emails).
  let teamMember: ProfileRow = {};
  if (ctx.team_member_id) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", ctx.team_member_id)
      .maybeSingle();
    teamMember = (data || {}) as ProfileRow;
  }

  const agencyName = wl.brand_name || wl.company_name || DEFAULT_AGENCY_NAME;
  const logoUrl = wl.logo_url || DEFAULT_LOGO;
  const brandColor = wl.primary_color || DEFAULT_BRAND_COLOR;
  const ownerFirstName = firstNameOf(owner.full_name, "your contact");
  const ownerEmail = wl.support_email || owner.email || "";
  const clientFirstName = firstNameOf(client.contact_name);
  const clientEmail = client.email || "";
  const teamMemberFirstName = firstNameOf(teamMember.full_name);
  const teamMemberEmail = teamMember.email || "";

  const baseUrl = wl.custom_domain ? `https://${wl.custom_domain}` : APP_URL;
  const portalUrl = `${baseUrl}/dashboard/portal`;
  const loginUrl = `${baseUrl}/login`;
  const gettingStartedUrl = `${baseUrl}/getting-started/${ctx.agency_owner_id}`;

  const vars: Record<string, string> = {
    // Agency branding
    agency_name: agencyName,
    agency_logo_url: logoUrl,
    logo_url: logoUrl, // alias
    brand_color: brandColor,
    primary_color: brandColor, // alias
    owner_first_name: ownerFirstName,
    owner_email: ownerEmail,
    owner_full_name: owner.full_name || "",

    // Recipient — client
    client_first_name: clientFirstName,
    client_email: clientEmail,
    client_business_name: client.business_name || "",

    // Recipient — team member
    team_member_first_name: teamMemberFirstName,
    team_member_email: teamMemberEmail,

    // URLs
    portal_url: portalUrl,
    login_url: loginUrl,
    getting_started_url: gettingStartedUrl,
    magic_link_url: ctx.extra?.magic_link_url || loginUrl,
    reset_url: ctx.extra?.reset_url || `${baseUrl}/reset-password`,
    invite_url: ctx.extra?.invite_url || `${baseUrl}/accept-invite`,

    // Misc
    current_year: String(new Date().getFullYear()),
  };

  // Apply any caller-provided overrides last so they win.
  if (ctx.extra) {
    for (const [key, value] of Object.entries(ctx.extra)) {
      vars[key] = value;
    }
  }

  return vars;
}

/**
 * Mustache-style `{{var}}` replacement. Missing keys resolve to "" so a
 * recipient never sees a raw placeholder.
 *
 * Intentionally NOT a full template engine — no conditionals, no loops, no
 * partials. The defaults rely on this simplicity so they remain HTML-clean
 * and trivially diffable in the editor.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  if (!template) return "";
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = vars[key];
    return value !== undefined && value !== null ? String(value) : "";
  });
}

/**
 * Sample variables for the editor's live preview pane. Hand-tuned to make
 * the preview look like what a real client would see, without exposing
 * any actual customer data.
 */
export function buildPreviewVars(ownerHints: {
  ownerFirstName?: string;
  agencyName?: string;
  brandColor?: string;
  logoUrl?: string;
  ownerEmail?: string;
}): Record<string, string> {
  const baseUrl = APP_URL;
  return {
    agency_name: ownerHints.agencyName || "Your Agency",
    agency_logo_url: ownerHints.logoUrl || DEFAULT_LOGO,
    logo_url: ownerHints.logoUrl || DEFAULT_LOGO,
    brand_color: ownerHints.brandColor || DEFAULT_BRAND_COLOR,
    primary_color: ownerHints.brandColor || DEFAULT_BRAND_COLOR,
    owner_first_name: ownerHints.ownerFirstName || "Sam",
    owner_email: ownerHints.ownerEmail || "you@youragency.com",
    owner_full_name: ownerHints.ownerFirstName ? `${ownerHints.ownerFirstName} (you)` : "Sam Owner",
    client_first_name: "Alex",
    client_email: "alex@clientco.com",
    client_business_name: "Client Co",
    team_member_first_name: "Jordan",
    team_member_email: "jordan@youragency.com",
    portal_url: `${baseUrl}/dashboard/portal`,
    login_url: `${baseUrl}/login`,
    getting_started_url: `${baseUrl}/getting-started/preview`,
    magic_link_url: `${baseUrl}/auth/magic?token=sample`,
    reset_url: `${baseUrl}/reset-password?token=sample`,
    invite_url: `${baseUrl}/accept-invite?token=sample`,
    current_year: String(new Date().getFullYear()),
  };
}
