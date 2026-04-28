/**
 * Apr 28: shared "agency-staff only" gate.
 *
 * Many integration routes use the platform's shared API key (twilio,
 * calendly, notion, google ads, stripe-connect). These routes must be
 * gated to roles that legitimately operate the agency — clients should
 * never trigger sends, mutations, or onboarding flows on behalf of the
 * agency account. Previously every one of these routes only checked
 * `auth.getUser()` which let portal clients invoke them.
 *
 * Roles permitted:
 *   - admin       — platform / agency owner
 *   - founder     — agency owner (whitelabel mode)
 *   - agency      — agency role (alias of founder for some legacy rows)
 *   - team_member — seat-holder, only when their team_members row is active
 *
 * Usage:
 *   const denied = await requireAgencyStaff(supabase, user.id);
 *   if (denied) return denied;
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const AGENCY_STAFF_ROLES = ["admin", "founder", "agency", "team_member"] as const;
type AgencyStaffRole = (typeof AGENCY_STAFF_ROLES)[number];

export async function requireAgencyStaff(
  supabase: SupabaseClient,
  userId: string,
): Promise<NextResponse | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, parent_agency_id")
    .eq("id", userId)
    .maybeSingle();

  const role = (profile?.role as string | null) ?? null;
  if (!role || !(AGENCY_STAFF_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json(
      { error: "Agency staff only" },
      { status: 403 },
    );
  }

  // For team_members, require an ACTIVE row in team_members linked to the
  // parent agency. A suspended/revoked seat must not pass the gate.
  if (role === "team_member") {
    if (!profile?.parent_agency_id) {
      return NextResponse.json(
        { error: "Team member missing parent agency" },
        { status: 403 },
      );
    }
    const { data: tm } = await supabase
      .from("team_members")
      .select("status")
      .eq("member_profile_id", userId)
      .eq("agency_owner_id", profile.parent_agency_id)
      .maybeSingle();
    if (!tm || tm.status !== "active") {
      return NextResponse.json(
        { error: "Team membership is not active" },
        { status: 403 },
      );
    }
  }

  return null;
}

export type { AgencyStaffRole };
