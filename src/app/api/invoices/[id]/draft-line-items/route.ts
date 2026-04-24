/**
 * POST /api/invoices/[id]/draft-line-items
 *
 * Given a natural-language scope, generates AI line items for this invoice.
 * Pulls the client profile + last 5 historical invoices as context so the
 * model can match prior pricing when relevant.
 *
 * body: { scope: string, apply?: boolean }
 *   - apply=true persists the drafted items (and re-computed totals) to the
 *     invoice. Otherwise just returns the draft for the UI to preview.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { draftLineItems } from "@/lib/invoices/ai-drafter";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { scope?: string; apply?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const scope = String(body.scope || "").trim();
  if (!scope) {
    return NextResponse.json({ error: "scope is required" }, { status: 400 });
  }

  // Own the invoice + client.
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, client_id, clients:client_id(profile_id, business_name, industry, package_tier)")
    .eq("id", params.id)
    .maybeSingle();

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clients = invoice.clients as
    | { profile_id?: string; business_name?: string; industry?: string; package_tier?: string }
    | { profile_id?: string; business_name?: string; industry?: string; package_tier?: string }[]
    | null;
  const client = Array.isArray(clients) ? clients[0] : clients;
  if (!client || client.profile_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Pull last five invoices for the same client for pricing context.
  const { data: history } = await supabase
    .from("invoices")
    .select("invoice_number, total_cents, line_items, issue_date")
    .eq("client_id", invoice.client_id)
    .neq("id", invoice.id)
    .order("issue_date", { ascending: false })
    .limit(5);

  try {
    const draft = await draftLineItems(scope, {
      clientName: client.business_name,
      clientIndustry: client.industry,
      clientPackageTier: client.package_tier,
      priorInvoices: history || [],
    });

    if (body.apply) {
      const subtotal = draft.line_items.reduce(
        (s, i) => s + i.qty * i.unit_price_cents,
        0,
      );
      const { error: updErr } = await supabase
        .from("invoices")
        .update({
          line_items: draft.line_items,
          subtotal_cents: subtotal,
          total_cents: subtotal, // tax stays whatever it was; don't zero it here
          amount: subtotal / 100,
        })
        .eq("id", params.id);
      if (updErr) {
        console.error("[invoices/draft] apply error:", updErr);
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      line_items: draft.line_items,
      estimated_total_cents: draft.estimated_total_cents,
      reasoning: draft.reasoning,
      applied: Boolean(body.apply),
    });
  } catch (err) {
    console.error("[invoices/draft] error:", err);
    const message = err instanceof Error ? err.message : "Drafter failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
