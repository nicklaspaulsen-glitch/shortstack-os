import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const TOKEN_PACKS: Record<string, { tokens: number; price: number }> = {
  "100k": { tokens: 100_000, price: 19 },
  "500k": { tokens: 500_000, price: 79 },
  "1m": { tokens: 1_000_000, price: 149 },
  "5m": { tokens: 5_000_000, price: 599 },
};

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { pack_id } = body as { pack_id: string };
  const pack = TOKEN_PACKS[pack_id];
  if (!pack)
    return NextResponse.json({ error: "Invalid token pack" }, { status: 400 });

  // Read existing bonus tokens
  const key = `bonus_tokens_${user.id}`;
  const { data: existing } = await supabase
    .from("system_health")
    .select("metadata")
    .eq("integration_name", key)
    .single();

  const currentTokens =
    (existing?.metadata as Record<string, number>)?.tokens || 0;
  const newTotal = currentTokens + pack.tokens;

  if (existing) {
    await supabase
      .from("system_health")
      .update({
        metadata: {
          tokens: newTotal,
          last_purchase: new Date().toISOString(),
          pack_id,
        },
      })
      .eq("integration_name", key);
  } else {
    await supabase.from("system_health").insert({
      integration_name: key,
      status: "healthy",
      metadata: {
        tokens: newTotal,
        last_purchase: new Date().toISOString(),
        pack_id,
      },
      last_check_at: new Date().toISOString(),
    });
  }

  // Log the purchase
  await supabase.from("trinity_log").insert({
    action_type: "token_purchase",
    description: `Purchased ${pack.tokens.toLocaleString()} tokens ($${pack.price})`,
    status: "completed",
  });

  // In production this would create a Stripe checkout session before granting tokens.
  // For now tokens are added directly.
  return NextResponse.json({
    success: true,
    tokens_added: pack.tokens,
    new_balance: newTotal,
    message: `Added ${pack.tokens.toLocaleString()} tokens to your account`,
  });
}
