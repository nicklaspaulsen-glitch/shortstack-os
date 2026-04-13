import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Ensure the user has a profile row — handles the case where
      // the Supabase auth trigger didn't fire or failed silently.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const serviceClient = createServiceClient();
          const { data: existingProfile } = await serviceClient
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .single();

          if (!existingProfile) {
            await serviceClient.from("profiles").insert({
              id: user.id,
              email: user.email || "",
              full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
              role: user.user_metadata?.role || "client",
              timezone: "UTC",
            });
          }
        }
      } catch (err) {
        // Profile creation is best-effort — don't block the auth flow
        console.warn("[auth/callback] Profile ensure failed:", err);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
