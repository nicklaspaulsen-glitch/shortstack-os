import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  // Verify auth via server supabase (cookie-based, guaranteed to work)
  const supabase = createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (!user || authErr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 2 MB" }, { status: 400 });
    }
    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid image type" }, { status: 400 });
    }

    // Use service client for storage (bypasses RLS)
    const service = createServiceClient();

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "png";
    const path = `avatars/${user.id}.${ext}`;

    // Try uploading to "avatars" bucket, then "public" bucket
    let publicUrl = "";
    let uploadSuccess = false;

    for (const bucket of ["avatars", "public"]) {
      const { error: uploadErr } = await service.storage
        .from(bucket)
        .upload(path, buffer, {
          upsert: true,
          contentType: file.type,
        });

      if (!uploadErr) {
        const { data: urlData } = service.storage.from(bucket).getPublicUrl(path);
        publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        uploadSuccess = true;
        break;
      }
    }

    // Fallback: store as base64 data URL (works without storage buckets)
    if (!uploadSuccess) {
      const base64 = buffer.toString("base64");
      publicUrl = `data:${file.type};base64,${base64}`;
    }

    // Update the profile with the avatar URL (using service client to bypass RLS)
    const { error: updateErr } = await service
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updateErr) {
      console.error("[avatar] Profile update error:", updateErr);
      return NextResponse.json({ error: "Failed to save avatar" }, { status: 500 });
    }

    return NextResponse.json({ avatar_url: publicUrl });
  } catch (err) {
    console.error("[avatar] Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
