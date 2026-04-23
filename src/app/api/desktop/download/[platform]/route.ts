import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

type Platform = "windows" | "mac" | "linux";

const DEFAULT_FILES: Record<Platform, string> = {
  windows: "ShortStack-OS-Setup.exe",
  mac: "ShortStack-OS.dmg",
  linux: "ShortStack-OS.AppImage",
};

/**
 * Download redirect — 302s the browser to the actual installer.
 *
 * Resolution order:
 *   1. If `public/downloads/manifest.json` lists a file for this platform,
 *      redirect to `<base>/<file>` where base = DESKTOP_DOWNLOAD_BASE_URL
 *      (R2 / external CDN) or `/downloads` (Vercel static).
 *   2. Else fall back to the default `<base>/<DEFAULT_FILES[platform]>`.
 *   3. If the resolved path is local (`/downloads/...`) and the file does
 *      NOT exist on disk, return 404 JSON so the UI can render a
 *      "contact support" message rather than a raw browser 404.
 */
export async function GET(
  req: Request,
  { params }: { params: { platform: string } },
) {
  const platform = params.platform as Platform;
  if (!["windows", "mac", "linux"].includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const manifestPath = path.join(process.cwd(), "public", "downloads", "manifest.json");
  const configuredBase = process.env.DESKTOP_DOWNLOAD_BASE_URL?.replace(/\/$/, "");
  const base = configuredBase || "/downloads";

  let file = DEFAULT_FILES[platform];
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as {
      files?: Partial<Record<Platform, { file?: string } | null>>;
    };
    const entry = parsed.files?.[platform];
    if (entry && entry.file) file = entry.file;
  } catch {
    // No manifest -> use default filename
  }

  const isExternal = /^https?:\/\//i.test(base);
  const target = `${base}/${file}`;

  // If the target is local, verify the file is actually present on disk.
  if (!isExternal) {
    const localPath = path.join(process.cwd(), "public", "downloads", file);
    try {
      await stat(localPath);
    } catch {
      return NextResponse.json(
        {
          error: "Installer not available",
          platform,
          hint: "Desktop installer has not been uploaded yet. Contact support or check the GitHub releases page.",
        },
        { status: 404 },
      );
    }
  }

  // For relative paths, construct the redirect URL from the incoming request
  // so host/protocol stay correct across preview/prod deploys.
  const redirectUrl = isExternal ? target : new URL(target, req.url).toString();
  return NextResponse.redirect(redirectUrl, 302);
}
