import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/services/trinity";
import { isAtClientLimit } from "@/lib/plan-config";

// Full client onboarding — creates client, portal access, welcome doc, first invoice, Zernio profile
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    business_name, contact_name, email, phone, website, industry,
    package_tier, mrr, services, password, create_portal,
    create_invoice, setup_zernio, notes,
  } = body;

  // Validate required fields
  if (!business_name || typeof business_name !== "string" || business_name.trim().length === 0) {
    return NextResponse.json({ error: "business_name is required" }, { status: 400 });
  }
  if (email && typeof email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }
  if (password && typeof password === "string" && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Check client limit for the agency's plan
  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const agencyPlan = profile?.plan_tier || "Starter";
  const { count: currentClients } = await supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true);
  if (isAtClientLimit(agencyPlan, currentClients || 0)) {
    return NextResponse.json({
      error: `You've reached the maximum number of clients for your ${agencyPlan} plan. Upgrade to add more.`,
      upgrade_needed: true,
    }, { status: 403 });
  }

  const results: Record<string, unknown> = {};

  // 1. Create the client record
  const { data: client, error: clientError } = await supabase.from("clients").insert({
    business_name, contact_name, email, phone, website, industry,
    package_tier, mrr: parseFloat(mrr) || 0,
    services: services || [],
    notes: notes || "",
    contract_status: "draft",
    onboarded_at: new Date().toISOString(),
  }).select().single();

  if (clientError || !client) {
    return NextResponse.json({ error: clientError?.message || "Failed to create client" }, { status: 500 });
  }
  results.client = { id: client.id, created: true };

  // 2. Create portal access if requested
  if (create_portal && password) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: serviceKey!,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email, password,
        email_confirm: true,
        user_metadata: { full_name: contact_name, role: "client" },
      }),
    });
    const userData = await authRes.json();

    if (authRes.ok && userData.id) {
      await supabase.from("clients").update({ profile_id: userData.id }).eq("id", client.id);
      results.portal = { created: true, user_id: userData.id };
    } else {
      results.portal = { created: false, error: userData.msg };
    }
  }

  // 3. Create first invoice if requested
  if (create_invoice && mrr) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    await supabase.from("invoices").insert({
      client_id: client.id,
      amount: parseFloat(mrr),
      status: "sent",
      due_date: dueDate.toISOString().split("T")[0],
      description: `${package_tier || "Growth"} Package — First Month`,
    });
    results.invoice = { created: true };
  }

  // 4. Create default tasks
  const defaultTasks = [
    "Onboarding call scheduled",
    "Brand assets received (logos, fonts, colors)",
    "Social media access granted",
    "Website access granted",
    "Ad account access granted",
    "Content strategy document approved",
    "First content batch in production",
    "Ad campaigns launched",
  ];

  await supabase.from("client_tasks").insert(
    defaultTasks.map(title => ({
      client_id: client.id,
      title,
      is_completed: false,
    }))
  );
  results.tasks = { created: defaultTasks.length };

  // 5. Setup Zernio profile if requested
  if (setup_zernio) {
    const { setupClientInZernio } = await import("@/lib/services/zernio");
    const serviceSupabase = createServiceClient();
    const zernio = await setupClientInZernio(serviceSupabase, client.id, business_name);
    results.zernio = zernio;
  }

  // 6. Auto-create GHL sub-account
  const ghlKey = process.env.GHL_API_KEY;
  if (ghlKey) {
    try {
      const ghlRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app"}/api/ghl/sub-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": request.headers.get("cookie") || "" },
        body: JSON.stringify({
          client_id: client.id,
          business_name,
          email,
          phone,
          industry,
        }),
      });
      const ghlData = await ghlRes.json();
      results.ghl = ghlData.success ? { created: true, location_id: ghlData.location_id } : { created: false, error: ghlData.error };
    } catch {
      results.ghl = { created: false, error: "GHL connection failed" };
    }
  }

  // 7. Notify on Telegram
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    const ghlStatus = (results.ghl as Record<string, unknown>)?.created ? " + GHL sub-account" : "";
    await sendTelegramMessage(chatId, `🎉 *New Client Onboarded!*\n\n*${business_name}*\nContact: ${contact_name}\nPackage: ${package_tier || "Growth"}\nMRR: $${mrr}\nServices: ${(services || []).join(", ")}${ghlStatus}`);
  }

  // 8. Log in trinity
  await supabase.from("trinity_log").insert({
    action_type: "custom",
    description: `Client onboarded: ${business_name} (${package_tier} — $${mrr}/mo)`,
    client_id: client.id,
    status: "completed",
    result: results,
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, client_id: client.id, results });
}
