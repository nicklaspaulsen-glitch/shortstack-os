import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

// Create Stripe invoice for a client
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, amount, description, due_days } = await request.json();

  // Validate required fields
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });
  const amountNum = parseFloat(amount);
  if (!amountNum || Number.isNaN(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
  }
  // Guard against enormous values that would overflow Stripe's integer unit field.
  if (amountNum > 1_000_000) {
    return NextResponse.json({ error: "amount too large" }, { status: 400 });
  }
  const dueDaysNum = due_days !== undefined ? parseInt(due_days) : undefined;
  if (dueDaysNum !== undefined && (Number.isNaN(dueDaysNum) || dueDaysNum < 1 || dueDaysNum > 365)) {
    return NextResponse.json({ error: "due_days must be between 1 and 365" }, { status: 400 });
  }

  // Verify ownership before touching Stripe
  const ctx = await requireOwnedClient(supabase, user.id, client_id);
  if (!ctx) return NextResponse.json({ error: "Forbidden — not your client" }, { status: 403 });

  const { data: client } = await supabase.from("clients").select("*").eq("id", client_id).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  let stripeInvoiceId = null;
  let invoiceUrl = null;

  if (stripeKey && client.stripe_customer_id) {
    try {
      // Create invoice item
      await fetch("https://api.stripe.com/v1/invoiceitems", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          customer: client.stripe_customer_id,
          amount: String(Math.round(amountNum * 100)),
          currency: "usd",
          description: description || `ShortStack ${client.package_tier || "Growth"} Package`,
        }),
      });

      // Create and send invoice
      const invoiceRes = await fetch("https://api.stripe.com/v1/invoices", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          customer: client.stripe_customer_id,
          collection_method: "send_invoice",
          days_until_due: String(dueDaysNum || 7),
          auto_advance: "true",
        }),
      });
      const invoice = await invoiceRes.json();
      stripeInvoiceId = invoice.id;

      // Send the invoice
      if (invoice.id) {
        const sendRes = await fetch(`https://api.stripe.com/v1/invoices/${invoice.id}/send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        const sent = await sendRes.json();
        invoiceUrl = sent.hosted_invoice_url;
      }
    } catch (err) {
      console.error("Stripe invoice error:", err);
    }
  }

  // Save in our DB
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (dueDaysNum || 7));

  const { data: inv } = await supabase.from("invoices").insert({
    client_id,
    stripe_invoice_id: stripeInvoiceId,
    amount: amountNum,
    status: stripeInvoiceId ? "sent" : "draft",
    due_date: dueDate.toISOString().split("T")[0],
    invoice_url: invoiceUrl,
    description: description || `ShortStack ${client.package_tier || "Growth"} Package`,
  }).select().single();

  return NextResponse.json({ success: true, invoice: inv, stripe_url: invoiceUrl });
}
