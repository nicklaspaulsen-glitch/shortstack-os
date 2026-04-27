/**
 * GET /api/branded-emails
 *
 * Returns the full set of branded transactional templates for the caller's
 * agency, with defaults filled in for kinds that haven't been customized.
 * Used by the editor at /dashboard/settings/email-templates to populate
 * the tab list.
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { loadAllTemplates } from "@/lib/email-templates/loader";

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await loadAllTemplates(supabase, ownerId);
  return NextResponse.json({ templates });
}
