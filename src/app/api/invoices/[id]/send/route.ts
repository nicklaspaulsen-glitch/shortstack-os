/**
 * POST /api/invoices/[id]/send
 *
 * Marks an invoice as sent and emails the client via the existing transactional
 * email helper. If SMTP isn't configured the helper falls back to a Telegram
 * notification and we still flip status to 'sent' so the workflow progresses.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendInvoiceEmail } from "@/lib/email";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, client_id, invoice_number, total_cents, currency, notes, stripe_payment_link, status, clients:client_id(profile_id, business_name, contact_name, email)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clients = invoice.clients as
    | { profile_id?: string; business_name?: string; contact_name?: string; email?: string }
    | { profile_id?: string; business_name?: string; contact_name?: string; email?: string }[]
    | null;
  const client = Array.isArray(clients) ? clients[0] : clients;
  if (!client || client.profile_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const amount = (invoice.total_cents || 0) / 100;
  let emailSent = false;

  if (client.email) {
    try {
      emailSent = await sendInvoiceEmail(
        client.email,
        client.contact_name || client.business_name || "there",
        amount,
        invoice.stripe_payment_link || undefined,
      );
    } catch (err) {
      console.warn("[invoices/send] email error:", err);
    }
  } else {
    console.warn("[invoices/send] client has no email — email sending skipped");
  }

  const { data: updated, error } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("[invoices/send] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    invoice: updated,
    email_sent: emailSent,
    email_skipped_reason: emailSent ? null : "SMTP not configured or no client email",
  });
}
