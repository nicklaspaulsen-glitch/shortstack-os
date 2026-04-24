/**
 * POST /api/invoices/[id]/payment-link
 *
 * Creates (or returns the cached) Stripe Payment Link for the invoice's
 * total. Returns 501 when STRIPE_SECRET_KEY isn't configured so the UI can
 * show a helpful hint.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createInvoicePaymentLink, hasStripeKey } from "@/lib/invoices/stripe-links";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasStripeKey()) {
    return NextResponse.json(
      {
        error:
          "payment links disabled, configure STRIPE_SECRET_KEY to generate Stripe payment links",
      },
      { status: 501 },
    );
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, total_cents, currency, notes, stripe_payment_link, client_id, clients:client_id(profile_id, business_name)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clients = invoice.clients as
    | { profile_id?: string; business_name?: string }
    | { profile_id?: string; business_name?: string }[]
    | null;
  const client = Array.isArray(clients) ? clients[0] : clients;
  if (!client || client.profile_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!invoice.total_cents || invoice.total_cents < 50) {
    return NextResponse.json(
      { error: "Add line items and recompute totals before creating a payment link" },
      { status: 400 },
    );
  }

  // Reuse existing link if present.
  if (invoice.stripe_payment_link) {
    return NextResponse.json({
      payment_link: invoice.stripe_payment_link,
      reused: true,
    });
  }

  try {
    const link = await createInvoicePaymentLink({
      invoiceNumber: invoice.invoice_number || invoice.id,
      clientName: client.business_name || "Client",
      totalCents: invoice.total_cents,
      currency: invoice.currency || "USD",
      memo: invoice.notes,
    });

    const { data: updated, error } = await supabase
      .from("invoices")
      .update({ stripe_payment_link: link.url })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("[invoices/payment-link] update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      payment_link: link.url,
      invoice: updated,
    });
  } catch (err) {
    console.error("[invoices/payment-link] stripe error:", err);
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
