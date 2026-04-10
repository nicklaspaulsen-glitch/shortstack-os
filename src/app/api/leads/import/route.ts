import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST — import leads from CSV data
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leads } = await request.json();

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "No leads provided" }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;

  for (const lead of leads.slice(0, 1000)) {
    const name = lead.business_name || lead.name || lead.company || "";
    if (!name) { skipped++; continue; }

    // Check for duplicates by email or phone
    if (lead.email) {
      const { count } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("email", lead.email);
      if (count && count > 0) { skipped++; continue; }
    }

    const { error } = await supabase.from("leads").insert({
      business_name: name,
      owner_name: lead.owner_name || lead.contact_name || lead.first_name || null,
      email: lead.email || null,
      phone: lead.phone || null,
      website: lead.website || null,
      city: lead.city || null,
      state: lead.state || null,
      industry: lead.industry || lead.niche || null,
      source: lead.source || "csv_import",
      status: "new",
    });

    if (!error) imported++;
    else skipped++;
  }

  // Log the import
  await supabase.from("trinity_log").insert({
    agent: "lead-engine",
    action_type: "lead_gen",
    description: `CSV import: ${imported} leads imported, ${skipped} skipped`,
    status: "completed",
    result: { imported, skipped, total: leads.length },
  });

  return NextResponse.json({ success: true, imported, skipped, total: leads.length });
}
