import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, extractIp } from "@/lib/server/rate-limit";

// ── POST /api/agents/auth ──────────────────────────────────────
// Electron agent authenticates with email/password or refreshes a session.
export async function POST(request: NextRequest) {
  // Apr 28 audit: env reads moved INSIDE the handler. Module-level
  // `process.env.X!` non-null assertion with `!` would silently swallow
  // unset env on Vercel page-data collection and produce a cryptic
  // `createClient(undefined, undefined)` failure at runtime.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase env not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // ── Refresh token ────────────────────────────────────────────
    if (body.action === "refresh" && body.refresh_token) {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: body.refresh_token,
      });

      if (error || !data.session) {
        return NextResponse.json(
          { error: error?.message || "Session expired" },
          { status: 401 }
        );
      }

      return NextResponse.json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      });
    }

    // ── Email/password login ─────────────────────────────────────
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password required" },
        { status: 400 }
      );
    }

    // Rate limit — prevents brute-force / credential-stuffing attacks.
    // 5 attempts / 60s per email, 20 attempts / 60s per IP (Supabase-backed,
    // survives cold starts unlike the in-memory limiter in src/lib/rate-limit.ts).
    const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
    const ip = extractIp(request);
    const rateLimitClient = createServiceClient();
    const [perEmail, perIp] = await Promise.all([
      checkRateLimit(rateLimitClient, `email:${normalizedEmail}`, "agent_auth", 5),
      checkRateLimit(rateLimitClient, `ip:${ip}`, "agent_auth", 20),
    ]);
    if (!perEmail.ok || !perIp.ok) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 }
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return NextResponse.json(
        { error: error?.message || "Invalid credentials" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    });
  } catch (err) {
    console.error("[agents/auth] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
