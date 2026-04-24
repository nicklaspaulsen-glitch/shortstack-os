import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /api/oauth/notion/start
// Stub — redirects to Notion OAuth when credentials are configured.
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }

  // TODO: implement Notion OAuth redirect once NOTION_CLIENT_ID and
  // NOTION_CLIENT_SECRET are configured in environment variables.
  // https://developers.notion.com/docs/authorization
  return NextResponse.json(
    { error: "Notion OAuth not yet configured. Add NOTION_CLIENT_ID and NOTION_CLIENT_SECRET to env." },
    { status: 501 }
  );
}
