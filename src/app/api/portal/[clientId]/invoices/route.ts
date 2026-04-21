/**
 * Portal Invoices
 *
 * GET /api/portal/[clientId]/invoices
 *   Returns all client_invoices rows for the client, most recent first.
 *   Used by the portal invoices tab. This is the same data as
 *   /api/clients/[id]/invoices but scoped via verifyClientAccess so
 *   a portal-linked client can read their own (not just the agency).
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

  const service = createServiceClient();

  const { data: invoices, error } = await service
    .from("client_invoices")
    .select(
      "id, agency_stripe_invoice_id, amount_cents, currency, status, hosted_invoice_url, due_date, paid_at, created_at",
    )
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[portal invoices] list error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    invoices: (invoices || []).map((i) => ({
      id: i.id,
      stripeInvoiceId: i.agency_stripe_invoice_id,
      amount: i.amount_cents / 100,
      amountCents: i.amount_cents,
      currency: i.currency,
      status: i.status,
      hostedUrl: i.hosted_invoice_url,
      dueDate: i.due_date,
      paidAt: i.paid_at,
      createdAt: i.created_at,
    })),
  });
}
