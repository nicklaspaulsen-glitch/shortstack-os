import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Temporary diagnostic — DELETE after debugging
export async function GET() {
  const supabase = createServerSupabase();
  const service = createServiceClient();

  // 1. Check auth from the user's session (cookie-based)
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  // 2. Check what role the DB has for this user
  let dbRole = null;
  let roleErr = null;
  if (user) {
    const { data, error } = await service.from("profiles").select("role, email").eq("id", user.id).single();
    dbRole = data;
    roleErr = error;
  }

  // 3. Try querying leads with USER's session (tests RLS)
  const { count: leadsViaUser, error: leadsUserErr } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  // 4. Try querying leads with SERVICE role (bypasses RLS)
  const { count: leadsViaService, error: leadsServiceErr } = await service
    .from("leads")
    .select("*", { count: "exact", head: true });

  // 5. Try querying clients with USER's session
  const { count: clientsViaUser, error: clientsUserErr } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true });

  // 6. Test get_user_role function directly
  let fnResult = null;
  if (user) {
    const { data } = await service.rpc("get_user_role", { uid: user.id });
    fnResult = data;
  }

  return NextResponse.json({
    auth: {
      userId: user?.id?.slice(0, 8) || null,
      email: user?.email || null,
      authError: authErr?.message || null,
    },
    dbProfile: {
      role: dbRole?.role || null,
      email: dbRole?.email || null,
      error: roleErr?.message || null,
    },
    rlsFunction: fnResult,
    queries: {
      leads_user_session: { count: leadsViaUser, error: leadsUserErr?.message || null },
      leads_service_role: { count: leadsViaService, error: leadsServiceErr?.message || null },
      clients_user_session: { count: clientsViaUser, error: clientsUserErr?.message || null },
    },
  });
}
