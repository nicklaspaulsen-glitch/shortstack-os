import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyProjectDomain, validateCustomDomain } from "@/lib/whitelabel/vercel";

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { domain?: string } = {};
  try { body = await req.json(); } catch { /* body optional */ }

  const service = createServiceClient();
  const { data: row } = await service
    .from("white_label_config")
    .select("custom_domain")
    .eq("user_id", user.id)
    .maybeSingle();

  const candidate = body.domain || row?.custom_domain || "";
  const domain = validateCustomDomain(candidate);
  if (!domain) return NextResponse.json({ error: "No custom domain configured" }, { status: 400 });

  if (row?.custom_domain && row.custom_domain !== domain) {
    return NextResponse.json({ error: "Domain does not match account" }, { status: 403 });
  }

  const result = await verifyProjectDomain(domain);
  if (!result.ok && !result.verified) {
    return NextResponse.json({ ok: false, verified: false, error: result.error }, { status: 200 });
  }

  await service
    .from("white_label_config")
    .update({
      custom_domain_verified: result.verified,
      custom_domain_ssl_status: result.verified ? "active" : "provisioning",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, verified: result.verified });
}
