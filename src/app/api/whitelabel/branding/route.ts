import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveBrandingByHost, resolveBrandingByUser } from "@/lib/whitelabel/resolve";

export async function GET() {
  const headerList = headers();
  const host = headerList.get("x-whitelabel-host");
  if (host) {
    const branding = await resolveBrandingByHost(host);
    return NextResponse.json(
      { branding },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
    );
  }
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ branding: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const branding = await resolveBrandingByUser(user.id);
  return NextResponse.json({ branding }, { headers: { "Cache-Control": "private, max-age=30" } });
}
