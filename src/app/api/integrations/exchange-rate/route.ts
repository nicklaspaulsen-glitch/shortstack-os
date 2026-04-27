import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getRate } from "@/lib/integrations/currency";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ISO_4217_RE = /^[A-Z]{3}$/;

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromRaw = (searchParams.get("from") || "USD").toUpperCase();
  const toRaw = (searchParams.get("to") || "EUR").toUpperCase();

  if (!ISO_4217_RE.test(fromRaw) || !ISO_4217_RE.test(toRaw)) {
    return NextResponse.json(
      { error: "from and to must be 3-letter ISO 4217 codes (e.g. USD, EUR)" },
      { status: 400 },
    );
  }

  const rate = await getRate(fromRaw, toRaw);
  return NextResponse.json({ success: true, rate });
}
