import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStatus } from "@/lib/services/social-publisher";

// GET — Check which social media publishing provider is active
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getStatus();

  return NextResponse.json({
    ...status,
    recommendation: !status.activeProvider
      ? "No social media provider available. Configure ZERNIO_API_KEY or AYRSHARE_API_KEY."
      : status.activeProvider === "ayrshare"
        ? "Using Ayrshare (Zernio is down/unconfigured)"
        : "Using Zernio as primary provider",
  });
}
