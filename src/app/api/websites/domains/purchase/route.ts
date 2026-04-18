import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Purchase a domain via GoDaddy.
 *
 * Body:
 *   {
 *     domain: string,
 *     project_id?: string,       // link to a website_projects row
 *     contact_info: {
 *       nameFirst, nameLast, email, phone, addressMailing: { address1, city, state, postalCode, country }
 *     }
 *   }
 *
 * If GODADDY_API_KEY is missing, returns a stub order and still creates a row
 * in website_domains with status="pending" so the UI can flow end-to-end.
 */

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { domain, project_id, contact_info } = body as {
    domain: string;
    project_id?: string;
    contact_info?: Record<string, unknown>;
  };

  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  // If project_id provided, verify ownership
  if (project_id) {
    const { data: proj } = await supabase
      .from("website_projects")
      .select("profile_id")
      .eq("id", project_id)
      .single();
    if (!proj || proj.profile_id !== user.id) {
      return NextResponse.json({ error: "Project not found or forbidden" }, { status: 403 });
    }
  }

  const godaddyKey = process.env.GODADDY_API_KEY;
  const godaddySecret = process.env.GODADDY_API_SECRET;
  const godaddyCustomerId = process.env.GODADDY_CUSTOMER_ID || null;

  // ── Stub mode ─────────────────────────────────────────────────────────
  if (!godaddyKey || !godaddySecret) {
    const { data: row } = await supabase
      .from("website_domains")
      .insert({
        profile_id: user.id,
        website_id: project_id || null,
        domain,
        status: "pending",
        godaddy_customer_id: godaddyCustomerId,
        purchase_price: 12.99,
        purchase_currency: "USD",
        expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
        dns_records: [],
      })
      .select("id")
      .single();

    if (project_id) {
      await supabase.from("website_projects").update({
        custom_domain: domain,
        updated_at: new Date().toISOString(),
      }).eq("id", project_id);
    }

    return NextResponse.json({
      success: true,
      stub: true,
      domain,
      domain_id: row?.id,
      message: "Stub purchase recorded. Set GODADDY_API_KEY + GODADDY_API_SECRET to place real orders.",
    });
  }

  // ── Real GoDaddy purchase ─────────────────────────────────────────────
  try {
    const payload = {
      domain,
      consent: {
        agreedAt: new Date().toISOString(),
        agreedBy: user.email || user.id,
        agreementKeys: ["DNRA"],
      },
      period: 1,
      renewAuto: true,
      ...(contact_info ? {
        contactRegistrant: contact_info,
        contactAdmin: contact_info,
        contactBilling: contact_info,
        contactTech: contact_info,
      } : {}),
    };

    const res = await fetch("https://api.godaddy.com/v1/domains/purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `sso-key ${godaddyKey}:${godaddySecret}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.message || "GoDaddy purchase failed", details: data }, { status: 500 });
    }

    const { data: row } = await supabase
      .from("website_domains")
      .insert({
        profile_id: user.id,
        website_id: project_id || null,
        domain,
        status: "purchased",
        godaddy_order_id: data.orderId || null,
        godaddy_customer_id: godaddyCustomerId || data.customerId || null,
        purchase_price: data.total || null,
        purchase_currency: data.currency || "USD",
        expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
        dns_records: [],
      })
      .select("id")
      .single();

    if (project_id) {
      await supabase.from("website_projects").update({
        custom_domain: domain,
        godaddy_order_id: data.orderId || null,
        updated_at: new Date().toISOString(),
      }).eq("id", project_id);
    }

    return NextResponse.json({
      success: true,
      domain,
      domain_id: row?.id,
      order_id: data.orderId,
      price: data.total,
      currency: data.currency,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
