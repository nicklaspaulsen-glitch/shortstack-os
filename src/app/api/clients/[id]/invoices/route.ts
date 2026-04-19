/**
 * Client invoices on the agency's connected Stripe.
 *
 * GET  /api/clients/[id]/invoices
 *      → lists all client_invoices rows for this client (scoped to caller).
 *
 * POST /api/clients/[id]/invoices
 *      body: {
 *        line_items: [{ amount_cents: number, description: string }],
 *        due_days?: number,      // days from now to set the due date (default 14)
 *        currency?: string,      // default "usd"
 *        memo?: string           // shown in the Stripe invoice footer
 *      }
 *      → creates a Stripe Customer (if new) on the agency's connected Stripe,
 *        adds one invoice item per line_item, finalizes + sends the invoice
 *        via Stripe's hosted email. Returns hosted_invoice_url.
 *
 * All Stripe calls use { stripeAccount: agency.stripe_account_id } so the
 * charge, customer, and invoice live on the agency's books.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

async function requireConnectedAccount(
  supabase: ReturnType<typeof createServerSupabase>,
  userId: string,
) {
  const { data: account } = await supabase
    .from("agency_stripe_accounts")
    .select("stripe_account_id, charges_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  return account;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.id);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: invoices, error } = await supabase
    .from("client_invoices")
    .select(
      "id, agency_stripe_invoice_id, amount_cents, currency, status, hosted_invoice_url, due_date, paid_at, created_at",
    )
    .eq("client_id", params.id)
    .eq("agency_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[client invoices] list error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoices: invoices || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.id);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const account = await requireConnectedAccount(supabase, user.id);
  if (!account?.stripe_account_id) {
    return NextResponse.json(
      { error: "Connect your Stripe account first at /dashboard/settings" },
      { status: 400 },
    );
  }
  if (!account.charges_enabled) {
    return NextResponse.json(
      { error: "Your connected Stripe account isn't yet able to accept charges. Finish onboarding first." },
      { status: 400 },
    );
  }

  let body: {
    line_items?: Array<{ amount_cents?: number; description?: string }>;
    due_days?: number;
    currency?: string;
    memo?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.line_items) ? body.line_items : [];
  const items = rawItems
    .map((i) => ({
      amount_cents: Math.round(Number(i?.amount_cents || 0)),
      description: String(i?.description || "").trim(),
    }))
    .filter((i) => i.amount_cents > 0 && i.description);

  if (!items.length) {
    return NextResponse.json(
      { error: "line_items must have at least one { amount_cents, description }" },
      { status: 400 },
    );
  }
  const total = items.reduce((s, i) => s + i.amount_cents, 0);
  if (total < 50) {
    return NextResponse.json(
      { error: "Invoice total must be at least 50 cents" },
      { status: 400 },
    );
  }

  const currency = (body.currency || "usd").toLowerCase();
  const dueDays = Math.max(1, Math.min(365, Number(body.due_days || 14)));

  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, email, contact_name, agency_stripe_customer_id")
    .eq("id", params.id)
    .single();

  if (!client?.email) {
    return NextResponse.json(
      { error: "Client has no email on file — can't send invoice" },
      { status: 400 },
    );
  }

  const connectOpts = { stripeAccount: account.stripe_account_id };

  try {
    // Get or create the Stripe Customer on the CONNECTED account.
    let agencyStripeCustomerId = client.agency_stripe_customer_id as string | null;
    if (!agencyStripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email: client.email,
          name: client.business_name || client.contact_name || undefined,
          metadata: {
            shortstack_client_id: client.id,
            shortstack_agency_user_id: user.id,
          },
        },
        connectOpts,
      );
      agencyStripeCustomerId = customer.id;
      await supabase
        .from("clients")
        .update({ agency_stripe_customer_id: agencyStripeCustomerId })
        .eq("id", client.id);
    }

    // Create an empty invoice first (collection_method: send_invoice), then
    // attach invoice items to it. `collection_method: send_invoice` means
    // Stripe will email the hosted invoice URL on finalize.
    const invoice = await stripe.invoices.create(
      {
        customer: agencyStripeCustomerId,
        collection_method: "send_invoice",
        days_until_due: dueDays,
        currency,
        description: body.memo || undefined,
        metadata: {
          shortstack_client_id: client.id,
          shortstack_agency_user_id: user.id,
        },
      },
      connectOpts,
    );

    if (!invoice.id) {
      throw new Error("Stripe did not return an invoice ID");
    }

    for (const item of items) {
      await stripe.invoiceItems.create(
        {
          customer: agencyStripeCustomerId,
          invoice: invoice.id,
          amount: item.amount_cents,
          currency,
          description: item.description,
        },
        connectOpts,
      );
    }

    // Finalize + send.
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id, {}, connectOpts);
    // sendInvoice triggers the Stripe-hosted email to the client.
    try {
      if (finalized.id) {
        await stripe.invoices.sendInvoice(finalized.id, {}, connectOpts);
      }
    } catch (sendErr) {
      // Non-fatal — the invoice is finalized & has a hosted URL already.
      console.warn("[client invoices] sendInvoice failed (non-fatal):", sendErr);
    }

    const dueDate = finalized.due_date
      ? new Date(finalized.due_date * 1000).toISOString()
      : new Date(Date.now() + dueDays * 86_400_000).toISOString();

    const { data: inserted, error: insertErr } = await supabase
      .from("client_invoices")
      .insert({
        agency_user_id: user.id,
        client_id: params.id,
        agency_stripe_invoice_id: finalized.id || invoice.id,
        amount_cents: finalized.amount_due || total,
        currency,
        status: finalized.status || "open",
        hosted_invoice_url: finalized.hosted_invoice_url || null,
        due_date: dueDate,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[client invoices] insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      invoice: inserted,
      hosted_invoice_url: finalized.hosted_invoice_url,
    });
  } catch (err) {
    console.error("[client invoices] stripe error:", err);
    const message = err instanceof Error ? err.message : "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
