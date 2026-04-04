import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/services/trinity";

// Full client onboarding — creates client, portal access, welcome doc, first invoice, Zernio profile
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    business_name, contact_name, email, phone, website, industry,
    package_tier, mrr, services, password, create_portal, send_welcome,
    create_invoice, setup_zernio, notes,
  } = body;

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

  // 6. Notify on Telegram
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    await sendTelegramMessage(chatId, `🎉 *New Client Onboarded!*\n\n*${business_name}*\nContact: ${contact_name}\nPackage: ${package_tier || "Growth"}\nMRR: $${mrr}\nServices: ${(services || []).join(", ")}`);
  }

  // 7. Log in trinity
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
