import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  // Auth check — only authenticated users can seed demo data
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  try {
    // Clean up any existing demo client
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("business_name", "Bright Smile Dental")
      .single();

    if (existing) {
      const cid = existing.id;
      await Promise.all([
        supabase.from("client_tasks").delete().eq("client_id", cid),
        supabase.from("invoices").delete().eq("client_id", cid),
        supabase.from("content_calendar").delete().eq("client_id", cid),
        supabase.from("outreach_log").delete().eq("client_id", cid),
      ]);
      await supabase.from("clients").delete().eq("id", cid);
    }

    // Create demo client
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .insert({
        business_name: "Bright Smile Dental",
        industry: "dentist",
        mrr: 2497,
        health_score: 87,
        package_tier: "Growth",
        services: ["Social Media", "Paid Ads", "SEO", "Content Creation"],
        contract_status: "signed",
        is_active: true,
        contact_name: "Dr. Sarah Mitchell",
        email: "demo@brightsmiledental.com",
        phone: "(555) 123-4567",
        website: "https://brightsmiledental.com",
      })
      .select("id")
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: clientErr?.message || "Failed to create client" }, { status: 500 });
    }

    const clientId = client.id;
    const now = new Date();

    // Create 5 client tasks
    const tasks = [
      { client_id: clientId, title: "Setup Google Business Profile", is_completed: true, completed_at: new Date(now.getTime() - 5 * 86400000).toISOString(), due_date: new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0], priority: "high" },
      { client_id: clientId, title: "Create Instagram content calendar", is_completed: true, completed_at: new Date(now.getTime() - 3 * 86400000).toISOString(), due_date: new Date(now.getTime() - 4 * 86400000).toISOString().split("T")[0], priority: "high" },
      { client_id: clientId, title: "Launch Facebook ad campaign", is_completed: false, due_date: new Date(now.getTime() + 3 * 86400000).toISOString().split("T")[0], priority: "high" },
      { client_id: clientId, title: "Optimize website for SEO", is_completed: false, due_date: new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0], priority: "medium" },
      { client_id: clientId, title: "Setup email automation", is_completed: false, due_date: new Date(now.getTime() + 14 * 86400000).toISOString().split("T")[0], priority: "low" },
    ];
    await supabase.from("client_tasks").insert(tasks);

    // Create 3 invoices
    const invoices = [
      { client_id: clientId, amount: 2497, status: "paid", due_date: new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0], paid_at: new Date(now.getTime() - 28 * 86400000).toISOString(), description: "Growth Package - March" },
      { client_id: clientId, amount: 2497, status: "sent", due_date: new Date(now.getTime() + 5 * 86400000).toISOString().split("T")[0], description: "Growth Package - April" },
      { client_id: clientId, amount: 997, status: "overdue", due_date: new Date(now.getTime() - 10 * 86400000).toISOString().split("T")[0], description: "SEO Add-on - March" },
    ];
    await supabase.from("invoices").insert(invoices);

    // Create 5 content calendar entries
    const content = [
      { client_id: clientId, platform: "instagram", title: "Before & After Smile Transformation", status: "published", scheduled_date: new Date(now.getTime() - 2 * 86400000).toISOString().split("T")[0], content_type: "image" },
      { client_id: clientId, platform: "facebook", title: "Patient Testimonial Video", status: "scheduled", scheduled_date: new Date(now.getTime() + 1 * 86400000).toISOString().split("T")[0], content_type: "video" },
      { client_id: clientId, platform: "tiktok", title: "Day in the Life of a Dentist", status: "draft", scheduled_date: new Date(now.getTime() + 3 * 86400000).toISOString().split("T")[0], content_type: "video" },
      { client_id: clientId, platform: "instagram", title: "Dental Tips Carousel", status: "approved", scheduled_date: new Date(now.getTime() + 5 * 86400000).toISOString().split("T")[0], content_type: "carousel" },
      { client_id: clientId, platform: "linkedin", title: "New Technology Announcement", status: "pending_review", scheduled_date: new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0], content_type: "image" },
    ];
    await supabase.from("content_calendar").insert(content);

    // Create 3 outreach log entries
    const outreach = [
      { client_id: clientId, platform: "instagram", message: "Hi! We help dental practices grow their patient base through social media. Would love to chat!", status: "sent", prospect_name: "Downtown Dental Arts", sent_at: new Date(now.getTime() - 2 * 86400000).toISOString() },
      { client_id: clientId, platform: "facebook", message: "Hey! Noticed your practice could benefit from some digital marketing. Free audit available!", status: "sent", prospect_name: "Smile Center LA", sent_at: new Date(now.getTime() - 1 * 86400000).toISOString() },
      { client_id: clientId, platform: "instagram", message: "Love your content! We specialize in helping dentists get more visibility online.", status: "sent", prospect_name: "Pearl White Dentistry", sent_at: new Date(now.getTime() - 4 * 86400000).toISOString() },
    ];
    await supabase.from("outreach_log").insert(outreach);

    return NextResponse.json({ success: true, client_id: clientId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
