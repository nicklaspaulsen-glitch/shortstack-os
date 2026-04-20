/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * scripts/seed-preview-library.ts
 *
 * Seeds the `preview_content` table with real viral thumbnails
 * (ytimg.com public CDN, no rehosting) and CC0 video clip URLs.
 *
 * Usage:
 *   ts-node scripts/seed-preview-library.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * (read from the project's .env.local).
 *
 * Safe to re-run — we upsert on { tool, media_url } semantics by
 * deleting existing rows with the same tool+media_url then inserting.
 *
 * The same data is embedded in src/lib/preview-content-seed.ts so the
 * repository is the source of truth and anyone can re-seed any
 * environment from it.
 */
import { createClient } from "@supabase/supabase-js";
import { PREVIEW_CONTENT_SEED } from "../src/lib/preview-content-seed";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env");
    process.exit(1);
  }
  const db = createClient(url, key);

  // Wipe and repopulate — table is read-only for users so this is safe.
  const { error: delErr } = await db.from("preview_content").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) {
    console.error("Failed to clear preview_content:", delErr.message);
    process.exit(1);
  }

  const { error: insErr } = await db.from("preview_content").insert(PREVIEW_CONTENT_SEED);
  if (insErr) {
    console.error("Insert failed:", insErr.message);
    process.exit(1);
  }

  const byTool: Record<string, number> = {};
  for (const row of PREVIEW_CONTENT_SEED) {
    byTool[row.tool] = (byTool[row.tool] || 0) + 1;
  }
  console.log(`Seeded ${PREVIEW_CONTENT_SEED.length} rows:`);
  for (const tool of Object.keys(byTool)) {
    console.log(`  - ${tool}: ${byTool[tool]}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
