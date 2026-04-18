import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { publishFromQueue } from "@/lib/services/metricool";
import { createServiceClient } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { publish_queue_id } = await request.json();

  const { data: item } = await supabase
    .from("publish_queue")
    .select("*")
    .eq("id", publish_queue_id)
    .single();

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership check: publish_queue has no direct user_id column, so verify the
  // caller owns the client_id this queue row belongs to.
  const ctx = await requireOwnedClient(supabase, user.id, item.client_id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const serviceSupabase = createServiceClient();
  const result = await publishFromQueue(serviceSupabase, item);

  return NextResponse.json(result);
}
