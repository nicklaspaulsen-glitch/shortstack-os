import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { addDomainToProject, validateCustomDomain } from "@/lib/whitelabel/vercel";

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { domain?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const domain = validateCustomDomain(body.domain || "");
  if (!domain) return NextResponse.json({ error: "Invalid hostname" }, { status: 400 });

  const service = createServiceClient();
  const { data: clash } = await service
    .from("white_label_config")
    .select("user_id")
    .eq("custom_domain", domain)
    .maybeSingle();
  if (clash && clash.user_id !== user.id) {
    return NextResponse.json({ error: "Domain already claimed by another tenant" }, { status: 409 });
  }

  const vercel = await addDomainToProject(domain);
  if (!vercel.ok) {
    return NextResponse.json({ error: vercel.error || "Vercel attach failed" }, { status: 502 });
  }

  const { error: upsertErr } = await service
    .from("white_label_config")
    .upsert(
      {
        user_id: user.id,
        custom_domain: domain,
        custom_domain_verified: vercel.verified,
        custom_domain_ssl_status: vercel.verified ? "active" : "provisioning",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (upsertErr) {
    console.error("[whitelabel/domains/add] upsert error:", upsertErr);
    return NextResponse.json({ error: "Failed to save domain row" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    domain,
    verified: vercel.verified,
    dns: { apex_a: "76.76.21.21", cname: "cname.vercel-dns.com" },
  });
}
