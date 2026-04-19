import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateContractPDF } from "@/lib/services/contracts";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { client_id } = body;

  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  // Scope by profile_id — otherwise any authed user could download a
  // branded PDF contract for someone else's client.
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", client_id)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!client) return NextResponse.json({ error: "Client not found or forbidden" }, { status: 403 });

  const mrr = Number(client.mrr) || 0;

  const pdfBuffer = await generateContractPDF({
    clientName: client.contact_name,
    clientEmail: client.email,
    clientBusiness: client.business_name,
    services: client.services || [],
    packageTier: client.package_tier || "Growth",
    mrr,
    startDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    contractLength: body.contract_length || "12 months",
    customTerms: body.custom_terms,
  });

  // Save contract record. Without the Number() coercion above, client.mrr
  // being null made `client.mrr * 12` -> NaN which silently failed the insert.
  await supabase.from("contracts").insert({
    client_id,
    title: `Service Agreement — ${client.business_name}`,
    status: "draft",
    value: mrr * 12,
    start_date: new Date().toISOString().split("T")[0],
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${client.business_name.replace(/[^a-zA-Z0-9]/g, "_")}_contract.pdf"`,
    },
  });
}
