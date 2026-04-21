/**
 * Portal Overview
 *
 * GET /api/portal/[clientId]/overview
 *   Returns everything the landing screen of the client portal needs:
 *     - client   : the client record (business name, contact, plan, etc)
 *     - projects : active project_boards scoped to this client, with task
 *                   progress % derived from project_tasks (done / total)
 *     - milestones: project_tasks due in the next 30 days
 *     - latestInvoice: most recent client_invoices row (status + amount)
 *
 * Access: verified via verifyClientAccess — the caller must be either
 *   (a) the portal-linked client for clientId OR
 *   (b) the agency owner (clients.profile_id = user.id).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

export async function GET(
  _request: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Use service client so we aren't blocked by per-table RLS nuances —
  // we already verified access above.
  const service = createServiceClient();

  const { data: client, error: clientErr } = await service
    .from("clients")
    .select(
      "id, business_name, contact_name, email, phone, industry, package_tier, mrr, health_score, onboarded_at, profile_id",
    )
    .eq("id", params.clientId)
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Active project boards scoped to this client
  const { data: boards } = await service
    .from("project_boards")
    .select("id, name, icon, color, created_at, user_id")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false });

  // Compute progress per-board by counting tasks by status
  const boardIds = (boards || []).map((b) => b.id);
  const projects: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    progress: number;
    taskCount: number;
    doneCount: number;
    nextDueDate: string | null;
  }> = [];

  if (boardIds.length) {
    const { data: tasks } = await service
      .from("project_tasks")
      .select("id, board_id, status, due_date")
      .in("board_id", boardIds);

    const byBoard = new Map<
      string,
      { total: number; done: number; nextDue: string | null }
    >();
    for (const t of tasks || []) {
      const agg = byBoard.get(t.board_id) || { total: 0, done: 0, nextDue: null };
      agg.total += 1;
      if (t.status === "done") agg.done += 1;
      if (t.due_date && (!agg.nextDue || t.due_date < agg.nextDue)) {
        agg.nextDue = t.due_date;
      }
      byBoard.set(t.board_id, agg);
    }

    for (const b of boards || []) {
      const agg = byBoard.get(b.id) || { total: 0, done: 0, nextDue: null };
      const progress = agg.total === 0 ? 0 : Math.round((agg.done / agg.total) * 100);
      projects.push({
        id: b.id,
        name: b.name,
        icon: b.icon,
        color: b.color,
        progress,
        taskCount: agg.total,
        doneCount: agg.done,
        nextDueDate: agg.nextDue,
      });
    }
  }

  // Upcoming milestones — project_tasks due in the next 30 days, not done
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let milestones: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    boardId: string;
    boardName: string | null;
  }> = [];
  if (boardIds.length) {
    const { data: upcoming } = await service
      .from("project_tasks")
      .select("id, title, status, priority, due_date, board_id")
      .in("board_id", boardIds)
      .gte("due_date", today)
      .lte("due_date", in30)
      .neq("status", "done")
      .order("due_date", { ascending: true })
      .limit(25);

    const boardNames = new Map((boards || []).map((b) => [b.id, b.name]));
    milestones = (upcoming || []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.due_date,
      boardId: t.board_id,
      boardName: boardNames.get(t.board_id) || null,
    }));
  }

  // Latest invoice — prefer client_invoices (Stripe Connect flow), fall
  // back to the older `invoices` table if nothing there.
  const { data: latestClientInvoice } = await service
    .from("client_invoices")
    .select("id, amount_cents, currency, status, hosted_invoice_url, due_date, paid_at, created_at")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type LatestInvoice = {
    id: string;
    amount: number;
    currency: string;
    status: string;
    hostedUrl: string | null;
    dueDate: string | null;
    paidAt: string | null;
    createdAt: string | null;
    source: "stripe_connect" | "legacy";
  };
  let latestInvoice: LatestInvoice | null = latestClientInvoice
    ? {
        id: latestClientInvoice.id,
        amount: latestClientInvoice.amount_cents / 100,
        currency: latestClientInvoice.currency,
        status: latestClientInvoice.status,
        hostedUrl: latestClientInvoice.hosted_invoice_url,
        dueDate: latestClientInvoice.due_date,
        paidAt: latestClientInvoice.paid_at,
        createdAt: latestClientInvoice.created_at,
        source: "stripe_connect",
      }
    : null;

  if (!latestInvoice) {
    const { data: legacy } = await service
      .from("invoices")
      .select("id, amount, currency, status, invoice_url, due_date, paid_at, created_at")
      .eq("client_id", params.clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (legacy) {
      latestInvoice = {
        id: legacy.id,
        amount: Number(legacy.amount),
        currency: legacy.currency || "usd",
        status: legacy.status || "open",
        hostedUrl: legacy.invoice_url,
        dueDate: legacy.due_date,
        paidAt: legacy.paid_at,
        createdAt: legacy.created_at,
        source: "legacy",
      };
    }
  }

  return NextResponse.json({
    client: {
      id: client.id,
      businessName: client.business_name,
      contactName: client.contact_name,
      email: client.email,
      phone: client.phone,
      industry: client.industry,
      plan: client.package_tier,
      mrr: client.mrr,
      healthScore: client.health_score,
      onboardedAt: client.onboarded_at,
    },
    projects,
    milestones,
    latestInvoice,
  });
}
