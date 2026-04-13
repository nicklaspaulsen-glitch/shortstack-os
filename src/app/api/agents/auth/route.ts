import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── POST /api/agents/auth ──────────────────────────────────────
// Electron agent authenticates with email/password or refreshes a session.
export async function POST(request: NextRequest) {
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
