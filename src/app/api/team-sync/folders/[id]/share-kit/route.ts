import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { buildSharePayload, buildQrPlaceholderSvgDataUrl } from "@/lib/syncthing/qr";

export const dynamic = "force-dynamic";

type RouteCtx = { params: { id: string } };

// GET /api/team-sync/folders/[id]/share-kit
// Returns the info a recipient needs to accept the share: sender device_id,
// folder_id, a syncthing:// URL payload, a QR placeholder SVG data-URL, and
// a step-by-step instruction list.
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: folder, error: folderErr } = await service
    .from("syncthing_folders")
    .select("*")
    .eq("id", params.id)
    .single();
  if (folderErr || !folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  if (folder.owner_user_id !== user.id) {
    const { data: m } = await service
      .from("syncthing_folder_members")
      .select("user_id")
      .eq("folder_id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!m) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: devices } = await service
    .from("syncthing_devices")
    .select("device_id, device_name, platform")
    .eq("user_id", user.id)
    .order("added_at", { ascending: true })
    .limit(1);

  const senderDevice = devices?.[0];
  if (!senderDevice) {
    return NextResponse.json(
      {
        error:
          "Register at least one Syncthing device under /dashboard/files/team-sync/devices before generating a share kit.",
      },
      { status: 400 }
    );
  }

  const payload = buildSharePayload({
    deviceId: senderDevice.device_id,
    folderId: folder.folder_id,
    folderLabel: folder.folder_label,
  });

  const instructions = [
    "Install Syncthing on your machine (https://syncthing.net/downloads/).",
    "Open the Syncthing web UI (http://localhost:8384).",
    `Add this remote device ID: ${senderDevice.device_id}`,
    "Accept the incoming folder share prompt when it appears.",
    `Pick a local folder path where Syncthing should store "${folder.folder_label || folder.folder_id}".`,
    "Done. Files sync automatically whenever both machines are online.",
  ];

  return NextResponse.json({
    folder: {
      id: folder.id,
      folder_id: folder.folder_id,
      folder_label: folder.folder_label,
    },
    sender_device: {
      device_id: senderDevice.device_id,
      device_name: senderDevice.device_name,
      platform: senderDevice.platform,
    },
    qr_payload: payload,
    qr_svg_data_url: buildQrPlaceholderSvgDataUrl(payload),
    instructions,
  });
}
