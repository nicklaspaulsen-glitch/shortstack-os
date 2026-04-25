import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

/**
 * GET /api/billing/invoices
 * Lists the authenticated agency owner's most recent Stripe invoices.
 * Falls back to an empty array if the user has no Stripe customer yet
 * (i.e. hasn't ever checked out), so the billing page can render cleanly.
 *
 * Response shape:
 *   {
 *     invoices: Array<{
 *       id: string;
 *       number: string | null;
 *       status: string;
 *       amount_paid: number;        // in cents
 *       currency: string;
 *       created: number;            // unix seconds
 *       period_start: number;
 *       period_end: number;
 *       hosted_invoice_url: string | null;
 *       invoice_pdf: string | null;
 *     }>,
 *     has_customer: boolean,
 *   }
 */
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) {
    // No Stripe customer yet — user never checked out. Return empty list
    // rather than 404 so the billing UI doesn't have to special-case.
    return NextResponse.json({ invoices: [], has_customer: false });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Billing not configured (STRIPE_SECRET_KEY missing)" },
      { status: 500 },
    );
  }

  try {
    const stripe = getStripe();
    const list = await stripe.invoices.list({
      customer: customerId,
      limit: 20,
    });
    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status || "unknown",
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      created: inv.created,
      period_start: inv.period_start,
      period_end: inv.period_end,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
    }));
    return NextResponse.json({ invoices, has_customer: true });
  } catch (err) {
    console.error("[billing/invoices] Stripe list failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to list invoices",
        invoices: [],
        has_customer: true,
      },
      { status: 500 },
    );
  }
}
