import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateContractPDF } from "@/lib/services/contracts";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { client_id } = body;

  // Get client data
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", client_id)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const pdfBuffer = await generateContractPDF({
    clientName: client.contact_name,
    clientEmail: client.email,
    clientBusiness: client.business_name,
    services: client.services || [],
    packageTier: client.package_tier || "Growth",
    mrr: client.mrr || 0,
    startDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    contractLength: body.contract_length || "12 months",
    customTerms: body.custom_terms,
  });

  // Save contract record
  await supabase.from("contracts").insert({
    client_id,
    title: `Service Agreement — ${client.business_name}`,
    status: "draft",
    value: client.mrr * 12,
    start_date: new Date().toISOString().split("T")[0],
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${client.business_name.replace(/[^a-zA-Z0-9]/g, "_")}_contract.pdf"`,
    },
  });
}
