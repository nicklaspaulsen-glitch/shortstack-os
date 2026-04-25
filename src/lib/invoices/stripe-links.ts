/**
 * Stripe payment link helper.
 *
 * Creates a one-off Stripe Payment Link for an invoice's total. We
 * intentionally create a fresh Price + Product for each invoice rather than
 * reusing a catalog item, because invoice totals are bespoke.
 */
import { getStripe } from "@/lib/stripe/client";

export function hasStripeKey(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export interface CreateInvoiceLinkArgs {
  invoiceNumber: string;
  clientName: string;
  totalCents: number;
  currency?: string;
  memo?: string | null;
}

export async function createInvoicePaymentLink(args: CreateInvoiceLinkArgs): Promise<{
  url: string;
  price_id: string;
  product_id: string;
}> {
  if (!hasStripeKey()) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  if (!args.totalCents || args.totalCents < 50) {
    throw new Error("Invoice total must be at least 50 cents");
  }

  const stripe = getStripe();
  const currency = (args.currency || "usd").toLowerCase();

  const product = await stripe.products.create({
    name: `Invoice ${args.invoiceNumber} — ${args.clientName}`,
    description: args.memo || undefined,
    metadata: {
      shortstack_invoice_number: args.invoiceNumber,
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: args.totalCents,
    currency,
  });

  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      shortstack_invoice_number: args.invoiceNumber,
    },
  });

  return {
    url: link.url,
    price_id: price.id,
    product_id: product.id,
  };
}
