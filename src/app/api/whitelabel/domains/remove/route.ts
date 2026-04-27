import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { removeDomainFromProject } from "@/lib/whitelabel/vercel";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: row } = await service
    .from("white_label_config")
    .select("custom_domain")
    .eq("user_id", user.id)
    .maybeSingle();

  const domain = row?.custom_domain;
  if (!domain) return NextResponse.json({ ok: true, message: "No domain attached" });

  const result = await removeDomainFromProject(domain);
  if (!result.ok) {
    console.warn("[whitelabel/domains/remove] vercel detach failed:", result.error);
  }
  await service
    .from("white_label_config")
    .update({
      custom_domain: null,
      custom_domain_verified: false,
      custom_domain_ssl_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
