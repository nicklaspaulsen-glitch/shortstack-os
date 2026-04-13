import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SS-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET — Load referral code + stats for the current user
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get or create referral code
  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", user.id)
    .single();

  let referralCode = profile?.referral_code;

  if (!referralCode) {
    // Generate and save a new code
    referralCode = generateReferralCode();
    // Try up to 3 times in case of collision
    for (let i = 0; i < 3; i++) {
      const { error } = await supabase
        .from("profiles")
        .update({ referral_code: referralCode })
        .eq("id", user.id);
      if (!error) break;
      referralCode = generateReferralCode();
    }
  }

  // Get referral stats
  const { data: referrals } = await supabase
    .from("referrals")
    .select("id, referred_name, referred_email, status, commission_earned, created_at")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });

  const stats = {
    total: referrals?.length || 0,
    pending: referrals?.filter(r => r.status === "pending").length || 0,
    signed_up: referrals?.filter(r => r.status === "signed_up").length || 0,
    converted: referrals?.filter(r => r.status === "converted").length || 0,
    total_earned: referrals?.reduce((sum, r) => sum + (r.commission_earned || 0), 0) || 0,
  };

  return NextResponse.json({
    referral_code: referralCode,
    stats,
    referrals: referrals || [],
  });
}

// POST — Submit a new referral
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { referred_name, referred_email, referred_phone } = await request.json();

  if (!referred_name || !referred_email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("referrals")
    .select("id")
    .eq("referrer_id", user.id)
    .eq("referred_email", referred_email.toLowerCase().trim())
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "You've already referred this email" }, { status: 409 });
  }

  // Determine commission rate based on total referrals
  const { count } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", user.id);

  const totalReferrals = count || 0;
  let commissionRate = 10;
  if (totalReferrals >= 10) commissionRate = 20;
  else if (totalReferrals >= 3) commissionRate = 15;

  const { data: referral, error } = await supabase
    .from("referrals")
    .insert({
      referrer_id: user.id,
      referred_name: referred_name.trim(),
      referred_email: referred_email.toLowerCase().trim(),
      referred_phone: referred_phone?.trim() || null,
      commission_rate: commissionRate,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create referral" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: referral.id });
}
