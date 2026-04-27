import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getRates } from "@/lib/integrations/currency";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ISO_4217_RE = /^[A-Z]{3}$/;
const MAX_TARGETS = 32; // Frankfurter accepts arbitrary lists; we cap to keep responses tight.

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromRaw = (searchParams.get("from") || "USD").toUpperCase();
  const toRaw = searchParams.get("to") || "";

  if (!ISO_4217_RE.test(fromRaw)) {
    return NextResponse.json(
      { error: "from must be a 3-letter ISO 4217 code (e.g. USD)" },
      { status: 400 },
    );
  }

  const targets = toRaw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => ISO_4217_RE.test(c))
    .slice(0, MAX_TARGETS);

  if (targets.length === 0) {
    return NextResponse.json(
      { error: "to must be a comma-separated list of ISO 4217 codes (e.g. EUR,GBP,DKK)" },
      { status: 400 },
    );
  }

  const rates = await getRates(fromRaw, targets);
  return NextResponse.json({
    success: true,
    from: fromRaw,
    rates,
    fetched_at: new Date().toISOString(),
  });
}
