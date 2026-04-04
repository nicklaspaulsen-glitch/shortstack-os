import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { setupClientInZernio } from "@/lib/services/zernio";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id } = await request.json();

  const { data: client } = await supabase.from("clients").select("business_name").eq("id", client_id).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const serviceSupabase = createServiceClient();
  const result = await setupClientInZernio(serviceSupabase, client_id, client.business_name);

  return NextResponse.json(result);
}
