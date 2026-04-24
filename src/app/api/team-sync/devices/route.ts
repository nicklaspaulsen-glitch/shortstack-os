import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { isValidSyncthingDeviceId } from "@/lib/syncthing/qr";

export const dynamic = "force-dynamic";

// GET /api/team-sync/devices - list the caller's registered Syncthing devices.
export async function GET() {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("syncthing_devices")
    .select("*")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ devices: data ?? [] });
}

// POST /api/team-sync/devices
// Body: { device_id: string, device_name?: string, platform?: string }
export async function POST(request: NextRequest) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const device_id: string = (body.device_id ?? "").toString().trim().toUpperCase();
  const device_name: string = (body.device_name ?? "").toString().slice(0, 120);
  const platform: string = (body.platform ?? "other").toString();

  if (!isValidSyncthingDeviceId(device_id)) {
    return NextResponse.json(
      { error: "Invalid Syncthing device ID. Expected 7 groups of 7 chars separated by dashes." },
      { status: 400 }
    );
  }
  const allowedPlatforms = ["windows", "mac", "linux", "android", "ios", "other"];
  const normalizedPlatform = allowedPlatforms.includes(platform) ? platform : "other";

  const service = createServiceClient();
  const { data, error } = await service
    .from("syncthing_devices")
    .upsert(
      { user_id: user.id, device_id, device_name, platform: normalizedPlatform },
      { onConflict: "user_id,device_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ device: data });
}

// DELETE /api/team-sync/devices?id=<row-uuid>
export async function DELETE(request: NextRequest) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("syncthing_devices")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
