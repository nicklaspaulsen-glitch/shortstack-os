import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { publishFromQueue } from "@/lib/services/metricool";
import { createServiceClient } from "@/lib/supabase/server";

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

  const serviceSupabase = createServiceClient();
  const result = await publishFromQueue(serviceSupabase, item);

  return NextResponse.json(result);
}
