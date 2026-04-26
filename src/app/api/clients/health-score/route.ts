import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { requireOwnedClient, getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Auto Health Score Calculator
// Factors: task completion (25%), content published (20%), invoices paid on time (20%),
// outreach reply rate (15%), days since last activity (20%)
// Score: 0-100, updates client record in Supabase

async function calculateScore(clientId: string, serviceSupabase: ReturnType<typeof createServiceClient>) {
  const [
    { count: totalTasks },
    { count: completedTasks },
    { count: contentPublished },
    { count: totalInvoices },
    { count: paidInvoices },
    { count: outreachSent },
    { count: outreachReplied },
    { data: lastActivity },
  ] = await Promise.all([
    serviceSupabase.from("tasks").select("*", { count: "exact", head: true }).eq("client_id", clientId),
    serviceSupabase.from("tasks").select("*", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "completed"),
    serviceSupabase.from("content_calendar").select("*", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "published"),
    serviceSupabase.from("invoices").select("*", { count: "exact", head: true }).eq("client_id", clientId),
    serviceSupabase.from("invoices").select("*", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "paid"),
    serviceSupabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("client_id", clientId),
    serviceSupabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "replied"),
    serviceSupabase.from("trinity_log").select("created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1),
  ]);

  // Task completion % (weight 25)
  const taskRate = (totalTasks || 0) > 0 ? ((completedTasks || 0) / (totalTasks || 1)) * 100 : 50;
  const taskScore = Math.min(taskRate, 100) * 0.25;

  // Content published count (weight 20) — cap at 20 for full score
  const contentScore = Math.min(((contentPublished || 0) / 20) * 100, 100) * 0.20;

  // Invoices paid on time % (weight 20)
  const invoiceRate = (totalInvoices || 0) > 0 ? ((paidInvoices || 0) / (totalInvoices || 1)) * 100 : 50;
  const invoiceScore = Math.min(invoiceRate, 100) * 0.20;

  // Outreach reply rate (weight 15)
  const replyRate = (outreachSent || 0) > 0 ? ((outreachReplied || 0) / (outreachSent || 1)) * 100 : 50;
  const outreachScore = Math.min(replyRate * 5, 100) * 0.15; // 20% reply = 100 score

  // Days since last activity (weight 20) — 0 days = 100, 30+ days = 0
  let activityScore = 50;
  if (lastActivity && lastActivity.length > 0) {
    const daysSince = Math.floor((Date.now() - new Date(lastActivity[0].created_at).getTime()) / 86400000);
    activityScore = Math.max(0, 100 - (daysSince * 3.33)); // 30 days = 0
  }
  const activityWeighted = activityScore * 0.20;

  const totalScore = Math.round(taskScore + contentScore + invoiceScore + outreachScore + activityWeighted);
  const clampedScore = Math.max(0, Math.min(100, totalScore));

  await serviceSupabase
    .from("clients")
    .update({ health_score: clampedScore })
    .eq("id", clientId);

  return {
    client_id: clientId,
    health_score: clampedScore,
    breakdown: {
      task_completion: { rate: Math.round(taskRate), weighted: Math.round(taskScore), weight: 25 },
      content_published: { count: contentPublished || 0, weighted: Math.round(contentScore), weight: 20 },
      invoices_paid: { rate: Math.round(invoiceRate), weighted: Math.round(invoiceScore), weight: 20 },
      outreach_replies: { rate: Math.round(replyRate), weighted: Math.round(outreachScore), weight: 15 },
      recent_activity: { score: Math.round(activityScore), weighted: Math.round(activityWeighted), weight: 20 },
    },
  };
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id } = await request.json();
  const serviceSupabase = createServiceClient();

  // Single client — verify ownership before writing the score
  if (client_id) {
    const ctx = await requireOwnedClient(supabase, user.id, client_id);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const result = await calculateScore(client_id, serviceSupabase);
    return NextResponse.json(result);
  }

  // Bulk recalculate — resolve the effective owner so team_members scope to their agency.
  // We intentionally support "all my clients" here; a null client_id means "recalculate
  // all clients that belong to my agency". The ownerId filter ensures we never touch
  // another tenant's records.
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // All clients belonging to this owner only
  const { data: clients } = await serviceSupabase
    .from("clients")
    .select("id")
    .eq("profile_id", ownerId)
    .eq("is_active", true);

  if (!clients || clients.length === 0) {
    return NextResponse.json({ message: "No active clients found", results: [] });
  }

  const results = [];
  for (const client of clients) {
    const result = await calculateScore(client.id, serviceSupabase);
    results.push(result);
  }

  return NextResponse.json({
    message: `Recalculated health scores for ${results.length} clients`,
    results,
  });
}
