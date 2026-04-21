import { NextResponse } from "next/server";

/**
 * DEPRECATED — was the platform-Stripe invoice endpoint.
 *
 * bug-hunt-apr20-v2 MEDIUM #7: this route charged against Trinity's
 * platform STRIPE_SECRET_KEY instead of the agency's connected account,
 * which would route real customer payments to Trinity's bank instead of
 * the agency's. A grep of src/ shows zero callers — the app uses
 * /api/clients/[id]/invoices (Connect-based) everywhere instead.
 *
 * Kept as a 410 Gone to surface any lingering integrations rather than a
 * silent 404.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Gone — use /api/clients/[id]/invoices (Stripe Connect flow) instead.",
      migration: "See src/app/api/clients/[id]/invoices/route.ts",
    },
    { status: 410 },
  );
}
