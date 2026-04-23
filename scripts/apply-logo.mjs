#!/usr/bin/env node
/**
 * scripts/apply-logo.mjs
 *
 * "Pick a concept -> replace the ShortStack mark everywhere" CLI helper.
 *
 * Usage:
 *   node scripts/apply-logo.mjs 07
 *   npm run apply-logo 07
 *
 * What it does:
 *   1. Reads public/icons/concepts/concept-XX.svg
 *   2. Copies it to public/icons/shortstack-logo.svg (overwrites)
 *   3. Invokes scripts/regenerate-icons.ts via tsx to rebuild all raster
 *      sizes + ICO + favicon + og-image + email-logo.
 *   4. (Best-effort) copies the regenerated icons into electron/build/ and
 *      any mobile-app asset folders that exist in the monorepo.
 *
 * Exits non-zero on any failure so callers (including the admin API route)
 * can surface the error.
 */

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const CONCEPTS_DIR = path.join(REPO_ROOT, "public", "icons", "concepts");
const ICONS_DIR = path.join(REPO_ROOT, "public", "icons");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");

// External copy targets. Any non-existent path is silently skipped so the
// script stays portable across the monorepo's various app shells.
const EXTERNAL_ASSET_TARGETS = [
  path.join(REPO_ROOT, "electron", "build"),
  path.resolve(REPO_ROOT, "..", "mochi-app", "assets"),
  path.resolve(REPO_ROOT, "..", "vaos-app", "assets"),
];

function parseConcept(raw) {
  if (!raw) throw new Error("Missing concept number. Usage: apply-logo <01-20>");
  const n = Number.parseInt(String(raw).replace(/[^0-9]/g, ""), 10);
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    throw new Error(`Invalid concept number: ${raw}. Must be 1-20.`);
  }
  return n;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function runSpawn(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: true, ...opts });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function copyIfExists(from, to) {
  try {
    await fs.copyFile(from, to);
    return true;
  } catch {
    return false;
  }
}

async function copyToExternalTargets(filesUpdated) {
  const copied = [];
  // Assets we propagate to downstream app shells (mobile + electron).
  const sources = [
    path.join(ICONS_DIR, "shortstack-logo.svg"),
    path.join(ICONS_DIR, "shortstack-logo.png"),
    path.join(ICONS_DIR, "shortstack-logo.ico"),
    path.join(PUBLIC_DIR, "favicon.ico"),
  ];
  for (const targetDir of EXTERNAL_ASSET_TARGETS) {
    if (!existsSync(targetDir)) continue;
    for (const src of sources) {
      const dest = path.join(targetDir, path.basename(src));
      if (await copyIfExists(src, dest)) {
        copied.push(path.relative(REPO_ROOT, dest));
      }
    }
  }
  filesUpdated.push(...copied);
}

async function main() {
  const concept = parseConcept(process.argv[2]);
  const conceptId = pad2(concept);
  const conceptPath = path.join(CONCEPTS_DIR, `concept-${conceptId}.svg`);

  if (!existsSync(conceptPath)) {
    throw new Error(`Concept file not found: ${conceptPath}`);
  }

  const filesUpdated = [];

  // 1. Copy concept SVG -> canonical shortstack-logo.svg
  const destSvg = path.join(ICONS_DIR, "shortstack-logo.svg");
  const svg = await fs.readFile(conceptPath);
  await fs.writeFile(destSvg, svg);
  filesUpdated.push("public/icons/shortstack-logo.svg");
  console.log(`Wrote ${destSvg} (${svg.byteLength} bytes) from concept-${conceptId}.svg`);

  // 2. Regenerate all raster icons via the existing icon-regen script.
  console.log("Regenerating raster icons (png/ico/og-image)...");
  await runSpawn("npx", ["tsx", "scripts/regenerate-icons.ts"], { cwd: REPO_ROOT });
  filesUpdated.push(
    "public/icons/shortstack-logo.png",
    "public/icons/shortstack-logo-1024.png",
    "public/icons/shortstack-logo.ico",
    "public/favicon.ico",
    "public/og-image.png",
    "public/icons/email-logo.png",
  );

  // 3. Copy to any downstream shells that exist (electron/build, mobile app).
  await copyToExternalTargets(filesUpdated);

  console.log("\nApplied concept", conceptId);
  console.log("Files updated:");
  for (const f of filesUpdated) console.log("  -", f);

  // Emit a JSON line the API route can parse if it spawns us (last line).
  console.log(
    "\n__APPLY_LOGO_RESULT__" +
      JSON.stringify({ applied_concept: concept, files_updated: filesUpdated })
  );
}

main().catch((err) => {
  console.error("apply-logo failed:", err.message);
  process.exit(1);
});
