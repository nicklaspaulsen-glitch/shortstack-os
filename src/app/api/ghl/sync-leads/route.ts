import { NextRequest, NextResponse } from "next/server";

// Sync scraped leads to GoHighLevel CRM
export async function POST(request: NextRequest) {
  const { leads } = await request.json();
  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: "No leads to sync" }, { status: 400 });
  }

  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey) {
    return NextResponse.json({ error: "GoHighLevel API key not configured" }, { status: 500 });
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    try {
      const res = await fetch("https://services.leadconnectorhq.com/contacts/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
        body: JSON.stringify({
          firstName: lead.business_name?.split(" ")[0] || "",
          lastName: lead.business_name?.split(" ").slice(1).join(" ") || "",
          name: lead.business_name,
          email: lead.email || undefined,
          phone: lead.phone || undefined,
          address1: lead.address || undefined,
          website: lead.website || undefined,
          source: "ShortStack Lead Scraper",
          tags: [lead.industry || "scraped", "shortstack"],
          ...(locationId ? { locationId } : {}),
          customField: {
            industry: lead.industry,
            google_rating: lead.google_rating,
            review_count: lead.review_count,
            source_platform: lead.source,
          },
        }),
      });

      if (res.ok) {
        synced++;
      } else {
        failed++;
        const data = await res.json();
        if (errors.length < 3) errors.push(`${lead.business_name}: ${data.message || res.status}`);
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      failed++;
      if (errors.length < 3) errors.push(`${lead.business_name}: ${err}`);
    }
  }

  return NextResponse.json({
    success: true,
    synced,
    failed,
    total: leads.length,
    errors,
  });
}
