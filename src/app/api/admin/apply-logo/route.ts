/**
 * POST /api/admin/apply-logo
 *
 * Applies one of the 20 hand-authored brand concepts as the live ShortStack
 * mark. Admin/founder session required (pattern matches /api/admin/migrate).
 *
 * Body: { concept_number: 1..20 }
 *
 * Flow:
 *   1. Gate: require admin/founder role.
 *   2. Read public/icons/concepts/concept-XX.svg
 *   3. Overwrite public/icons/shortstack-logo.svg
 *   4. Spawn `npx tsx scripts/regenerate-icons.ts` so all raster artefacts
 *      (png/ico/og-image/email-logo/favicon) get rebuilt from the new SVG.
 *   5. Best-effort: copy a subset of the regenerated assets into
 *      electron/build/ and any mobile-app asset folders that exist.
 *   6. Insert a row into logo_apply_log for audit + revert support.
 *
 * Returns { success: true, applied_concept, files_updated }.
 *
 * Note on Vercel rebuilds: the filesystem writes here are local only — Vercel
 * runs read-only. This route is intended for the Electron app dev flow or a
 * self-hosted deployment. For prod, the picker UI also surfaces a "commit &
 * push" hint: the admin should commit the changed files (CI picks it up). We
 * intentionally do NOT shell-out to git from here; unattended git pushes from
 * an API route are a foot-gun.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_ROOT = process.cwd();
const CONCEPTS_DIR = path.join(REPO_ROOT, "public", "icons", "concepts");
const ICONS_DIR = path.join(REPO_ROOT, "public", "icons");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");

const EXTERNAL_ASSET_TARGETS = [
  path.join(REPO_ROOT, "electron", "build"),
  path.resolve(REPO_ROOT, "..", "mochi-app", "assets"),
  path.resolve(REPO_ROOT, "..", "vaos-app", "assets"),
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function runSpawn(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: true });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited ${code}: ${err || out}`));
    });
  });
}

async function copyToExternalTargets(): Promise<string[]> {
  const copied: string[] = [];
  const sources = [
    path.join(ICONS_DIR, "shortstack-logo.svg"),
    path.join(ICONS_DIR, "shortstack-logo.png"),
    path.join(ICONS_DIR, "shortstack-logo.ico"),
    path.join(PUBLIC_DIR, "favicon.ico"),
  ];
  for (const dir of EXTERNAL_ASSET_TARGETS) {
    if (!existsSync(dir)) continue;
    for (const src of sources) {
      try {
        const dest = path.join(dir, path.basename(src));
        await fs.copyFile(src, dest);
        copied.push(path.relative(REPO_ROOT, dest));
      } catch {
        // non-fatal — keep going
      }
    }
  }
  return copied;
}

export async function POST(req: NextRequest) {
  const serverSupabase = createServerSupabase();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "founder") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let body: { concept_number?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const concept = Number(body.concept_number);
  if (!Number.isInteger(concept) || concept < 1 || concept > 20) {
    return NextResponse.json(
      { error: "concept_number must be an integer 1-20" },
      { status: 400 },
    );
  }

  const conceptPath = path.join(CONCEPTS_DIR, `concept-${pad2(concept)}.svg`);
  if (!existsSync(conceptPath)) {
    return NextResponse.json(
      { error: `Concept file missing: concept-${pad2(concept)}.svg` },
      { status: 404 },
    );
  }

  const filesUpdated: string[] = [];

  // 1. Overwrite the canonical brand SVG.
  try {
    const svg = await fs.readFile(conceptPath);
    await fs.writeFile(path.join(ICONS_DIR, "shortstack-logo.svg"), svg);
    filesUpdated.push("public/icons/shortstack-logo.svg");
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to write shortstack-logo.svg: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  // 2. Rebuild rasters.
  try {
    await runSpawn("npx", ["tsx", "scripts/regenerate-icons.ts"], REPO_ROOT);
    filesUpdated.push(
      "public/icons/shortstack-logo.png",
      "public/icons/shortstack-logo-1024.png",
      "public/icons/shortstack-logo.ico",
      "public/favicon.ico",
      "public/og-image.png",
      "public/icons/email-logo.png",
    );
  } catch (e) {
    // SVG already overwritten; surface the error but keep going so the log
    // entry still gets written.
    return NextResponse.json(
      {
        error: `Icon regen failed: ${(e as Error).message}`,
        files_updated: filesUpdated,
      },
      { status: 500 },
    );
  }

  // 3. Copy to downstream shells that exist.
  try {
    filesUpdated.push(...(await copyToExternalTargets()));
  } catch {
    // non-fatal
  }

  // 4. Insert audit row. Use the service client so RLS doesn't block if the
  //    auth cookie didn't round-trip (it did, since we passed the role check —
  //    but service client is more reliable for write-only audit rows).
  const service = createServiceClient();
  const { error: logErr } = await service.from("logo_apply_log").insert({
    applied_concept: concept,
    applied_by_user_id: user.id,
  });
  if (logErr) {
    // If the table doesn't exist yet (migration not run), don't 500 — still
    // return success because the actual file swap worked. Surface a warning.
    return NextResponse.json({
      success: true,
      applied_concept: concept,
      files_updated: filesUpdated,
      warning: `Apply log insert failed: ${logErr.message}. Run supabase migration 20260423_logo_apply_log.sql.`,
    });
  }

  return NextResponse.json({
    success: true,
    applied_concept: concept,
    files_updated: filesUpdated,
  });
}

/**
 * GET /api/admin/apply-logo
 * Returns the most-recently applied concept (for the revert button).
 */
export async function GET() {
  const serverSupabase = createServerSupabase();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "founder") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { data, error } = await serverSupabase
    .from("logo_apply_log")
    .select("applied_concept, applied_at, applied_by_user_id")
    .order("applied_at", { ascending: false })
    .limit(5);

  if (error) {
    // Table missing → treat as no history yet.
    return NextResponse.json({ history: [], last: null });
  }
  return NextResponse.json({
    history: data ?? [],
    last: data?.[0] ?? null,
    // previous = second-most-recent (used by the "revert" button).
    previous: data?.[1] ?? null,
  });
}
