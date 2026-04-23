#!/usr/bin/env node
// Copies electron-builder output from `dist-electron/` into `public/downloads/`
// under stable filenames and writes `public/downloads/manifest.json` so the
// /dashboard/download page can advertise real file size / version / updated.
//
// Triggered by `npm run postbuild:electron` which runs automatically after
// `npm run electron:build` (via postbuild:electron entry).
//
// Behavior:
//   - Finds latest `ShortStack-OS-<version>-Setup.exe` in dist-electron/
//   - Copies to public/downloads/ShortStack-OS-Setup.exe (stable name the
//     UI + API both reference)
//   - Reads version from package.json and mtime from the source file
//   - Writes public/downloads/manifest.json
//
// The copy is SKIPPED for Vercel deploys (>25MB installers are too big for
// the static bundle — upload to Cloudflare R2 manually and set
// DESKTOP_DOWNLOAD_BASE_URL in env). This script still writes the manifest so
// the UI picks up real metadata in both modes.
//
// To run manually:
//   node scripts/postbuild-electron.mjs
//   node scripts/postbuild-electron.mjs --skip-copy   # just write manifest

import { readdir, stat, copyFile, writeFile, mkdir, readFile } from "fs/promises";
import { createReadStream } from "fs";
import { createHash } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SRC_DIR = path.join(ROOT, "dist-electron");
const DEST_DIR = path.join(ROOT, "public", "downloads");

// Stable filenames the page / redirect API reference.
const STABLE_NAMES = {
  windows: "ShortStack-OS-Setup.exe",
  mac: "ShortStack-OS.dmg",
  linux: "ShortStack-OS.AppImage",
};

function log(msg) {
  console.log(`[postbuild-electron] ${msg}`);
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function sha512(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64")));
  });
}

async function findLatest(dir, pattern) {
  if (!(await exists(dir))) return null;
  const entries = await readdir(dir);
  const matches = entries.filter((f) => pattern.test(f));
  if (!matches.length) return null;
  // Pick the newest by mtime
  const withStats = await Promise.all(
    matches.map(async (f) => {
      const full = path.join(dir, f);
      const s = await stat(full);
      return { full, mtime: s.mtimeMs, size: s.size, name: f };
    }),
  );
  withStats.sort((a, b) => b.mtime - a.mtime);
  return withStats[0];
}

async function main() {
  const skipCopy = process.argv.includes("--skip-copy");

  const pkgRaw = await readFile(path.join(ROOT, "package.json"), "utf8");
  const pkg = JSON.parse(pkgRaw);
  const version = pkg.version || "0.0.0";

  await mkdir(DEST_DIR, { recursive: true });

  // Find latest Windows Setup installer
  const win = await findLatest(SRC_DIR, /^ShortStack-OS-.+-Setup\.exe$/);
  // Mac/Linux builds are not produced on Windows by default — look for them
  // anyway so cross-platform CI builds get picked up.
  const mac = await findLatest(SRC_DIR, /^ShortStack-OS-.+\.dmg$/);
  const linux = await findLatest(SRC_DIR, /^ShortStack-OS-.+\.AppImage$/);

  const files = {
    windows: null,
    mac: null,
    linux: null,
  };

  let latestMtime = 0;

  async function stage(platform, src) {
    if (!src) return;
    const destName = STABLE_NAMES[platform];
    const dest = path.join(DEST_DIR, destName);
    const sha = await sha512(src.full);
    if (!skipCopy) {
      await copyFile(src.full, dest);
      log(`copied ${src.name} -> public/downloads/${destName} (${(src.size / 1024 / 1024).toFixed(1)} MB)`);
    } else {
      log(`skipped copy for ${platform} (--skip-copy)`);
    }
    files[platform] = { file: destName, size: src.size, sha512: sha };
    if (src.mtime > latestMtime) latestMtime = src.mtime;
  }

  await stage("windows", win);
  await stage("mac", mac);
  await stage("linux", linux);

  if (!win && !mac && !linux) {
    log("WARNING: no electron-builder output found in dist-electron/. Run `npm run electron:build` first.");
  }

  const manifest = {
    version,
    updated: latestMtime ? new Date(latestMtime).toISOString() : new Date().toISOString(),
    files,
  };

  const manifestPath = path.join(DEST_DIR, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  log(`wrote manifest at public/downloads/manifest.json`);
  log(`version=${version} updated=${manifest.updated}`);
  log(
    `platforms: ${Object.entries(files)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ") || "(none)"}`,
  );
}

main().catch((err) => {
  console.error("[postbuild-electron] failed:", err);
  process.exit(1);
});
