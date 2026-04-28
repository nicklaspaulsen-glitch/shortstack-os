// Apr 28: One-shot to convert `(await getEffectiveOwnerId(s, user.id)) || user.id`
// (and `?? user.id`) to a 403-on-null pattern across the API surface.
//
// Reason: getEffectiveOwnerId returns null for suspended team_members. The
// `|| user.id` / `?? user.id` fallback let them keep operating on their own
// user_id rows after suspension. Now we 403.
//
// Run: `node scripts/fix-effective-owner-fallback.mjs --apply` to write changes.
// Default (no --apply) is dry-run.

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const APPLY = process.argv.includes("--apply");
const ROOT = path.resolve(process.cwd(), "src", "app", "api");

// Match: (await getEffectiveOwnerId(<arg>, user.id)) (|||??) user.id;
// We capture the supabase-arg name to keep it (some routes use `auth`/`authSupabase`).
const PATTERN =
  /^(\s*)((?:const|let)\s+ownerId\s*=\s*)\(await\s+getEffectiveOwnerId\(\s*([A-Za-z_$][\w$]*)\s*,\s*user\.id\s*\)\)\s*(?:\|\||\?\?)\s*user\.id;\s*$/gm;

const REPLACEMENT = (
  /** @type {string} */ indent,
  /** @type {string} */ declPrefix,
  /** @type {string} */ supaArg,
) =>
  `${indent}// Apr 28: removed \`|| user.id\` fallback — null = suspended team_member.\n` +
  `${indent}${declPrefix}await getEffectiveOwnerId(${supaArg}, user.id);\n` +
  `${indent}if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });`;

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile() && full.endsWith(".ts")) yield full;
  }
}

let totalFiles = 0;
let totalSites = 0;

for await (const file of walk(ROOT)) {
  const src = await fs.readFile(file, "utf8");

  // Skip files that already use the helper assertion idiom in every site —
  // we still run the regex; if no match, totalSites stays 0 for this file.
  let count = 0;
  const next = src.replace(PATTERN, (_match, indent, declPrefix, supaArg) => {
    count += 1;
    return REPLACEMENT(indent, declPrefix, supaArg);
  });

  if (count > 0) {
    totalFiles += 1;
    totalSites += count;
    if (APPLY) {
      await fs.writeFile(file, next, "utf8");
      console.log(`fixed ${count}× ${path.relative(ROOT, file)}`);
    } else {
      console.log(`would fix ${count}× ${path.relative(ROOT, file)}`);
    }
  }
}

console.log(
  `\n${APPLY ? "applied" : "dry-run"}: ${totalSites} sites in ${totalFiles} files`,
);
