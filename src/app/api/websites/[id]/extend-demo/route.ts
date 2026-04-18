import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * Extend a demo by 7 days for $2 (one-time charge).
 *
 * POST /api/websites/[id]/extend-demo
 *
 * If STRIPE_SECRET_KEY is set, creates a one-time checkout session.
 * Otherwise, immediately extends the demo (stub mode) and returns simulated=true.
 */

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("website_projects")
    .select("id, profile_id, name, demo_expires_at, status")
    .eq("id", params.id)
    .single();

  if (!project || project.profile_id !== user.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  // Compute new expiry: 7 days from current expiry (if still valid) or from now.
  const baseDate = project.demo_expires_at && new Date(project.demo_expires_at).getTime() > Date.now()
    ? new Date(project.demo_expires_at)
    : new Date();
  const newExpiry = new Date(baseDate.getTime() + 7 * 86400_000).toISOString();

  // Stub mode — no Stripe key, just extend.
  if (!process.env.STRIPE_SECRET_KEY) {
    await supabase.from("website_projects").update({
      demo_expires_at: newExpiry,
      status: "preview",
      updated_at: new Date().toISOString(),
    }).eq("id", project.id);

    return NextResponse.json({
      success: true,
      simulated: true,
      new_expires_at: newExpiry,
      days_added: 7,
    });
  }

  // Real Stripe one-time checkout for $2
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 200,
          product_data: { name: `Extend demo: ${project.name || "website"} (7 days)` },
        },
        quantity: 1,
      }],
      metadata: {
        type: "demo_extension",
        website_id: project.id,
        profile_id: user.id,
        new_expires_at: newExpiry,
      },
      success_url: `${baseUrl}/dashboard/websites?extended=${project.id}`,
      cancel_url: `${baseUrl}/dashboard/websites?cancelled=${project.id}`,
    });

    return NextResponse.json({ success: true, checkout_url: session.url, new_expires_at: newExpiry });
  } catch (err) {
    console.error("[extend-demo] stripe error", err);
    return NextResponse.json({ error: "Failed to extend demo" }, { status: 500 });
  }
}
