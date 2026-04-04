import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateWebsiteCode } from "@/lib/services/website-builder";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { client_id } = body;

  let config = {
    clientName: body.client_name || "Client",
    businessName: body.business_name || "Business",
    industry: body.industry || "business",
    packageTier: (body.package_tier || "Growth") as "Starter" | "Growth" | "Enterprise",
    brandColors: body.brand_colors,
    description: body.description,
    services: body.services,
    phone: body.phone,
    email: body.email,
    address: body.address,
    domain: body.domain,
  };

  // Auto-fill from client data if client_id provided
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("*").eq("id", client_id).single();
    if (client) {
      config = {
        ...config,
        clientName: client.contact_name,
        businessName: client.business_name,
        industry: client.industry || config.industry,
        packageTier: (client.package_tier || config.packageTier) as "Starter" | "Growth" | "Enterprise",
        services: client.services || config.services,
        phone: client.phone || config.phone,
        email: client.email || config.email,
      };
    }
  }

  const result = await generateWebsiteCode(config);

  // Log in trinity
  await supabase.from("trinity_log").insert({
    action_type: "website",
    description: `Website generated for ${config.businessName} (${config.packageTier} — ${result.pages.length} pages)`,
    client_id: client_id || null,
    status: result.success ? "completed" : "failed",
    result: {
      pages: result.pages.map(p => ({ name: p.name, path: p.path })),
      package: config.packageTier,
    },
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json(result);
}
