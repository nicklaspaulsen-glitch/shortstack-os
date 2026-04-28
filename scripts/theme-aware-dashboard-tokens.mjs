// Apr 28 v4: dashboard-home was hardcoding `tokens.bg.X` / `tokens.text.X`
// in inline styles. Those values are dark-themed hex literals baked at
// import time, so every card stayed dark even when the page was on the
// light theme.
//
// This script swaps the safe usage sites — bg/text/border tokens that
// are passed straight into a `style={{ ... }}` prop — to `themeTokens`,
// which is the CSS-var-backed sibling export. Hex+alpha string
// concatenation patterns (`${tokens.brand.lime}22`) are LEFT ALONE
// because CSS-var strings don't support hex-string math.
//
// Run: node scripts/theme-aware-dashboard-tokens.mjs --apply

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const APPLY = process.argv.includes("--apply");
const ROOT = path.resolve("src", "components", "dashboard-home");

// The simple replacements — non-string-template usage of tokens.X.Y.
// Anything inside a `${...}` expression (string interpolation building
// hex+alpha) is matched by the negative lookahead to avoid touching it.
const REPLACEMENTS = [
  [/(?<![`{])tokens\.bg\.base(?![22a-fA-F0-9])/g, "themeTokens.bg.base"],
  [/(?<![`{])tokens\.bg\.surface1(?![22a-fA-F0-9])/g, "themeTokens.bg.surface1"],
  [/(?<![`{])tokens\.bg\.surface2(?![22a-fA-F0-9])/g, "themeTokens.bg.surface2"],
  [/(?<![`{])tokens\.bg\.surface3(?![22a-fA-F0-9])/g, "themeTokens.bg.surface3"],
  [/(?<![`{])tokens\.text\.primary(?![22a-fA-F0-9])/g, "themeTokens.text.primary"],
  [/(?<![`{])tokens\.text\.secondary(?![22a-fA-F0-9])/g, "themeTokens.text.secondary"],
  [/(?<![`{])tokens\.text\.muted(?![22a-fA-F0-9])/g, "themeTokens.text.muted"],
];

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile() && full.endsWith(".tsx")) yield full;
  }
}

let totalSites = 0;
let totalFiles = 0;

for await (const f of walk(ROOT)) {
  let src = await fs.readFile(f, "utf8");
  let count = 0;
  let next = src;
  for (const [pat, rep] of REPLACEMENTS) {
    const before = next;
    next = next.replace(pat, () => {
      count += 1;
      return rep;
    });
    if (next === before) continue;
  }
  if (count === 0) continue;

  // Ensure import has both `tokens` AND `themeTokens` in the named imports.
  // We only touch the existing `from "@/lib/brand/tokens"` import.
  next = next.replace(
    /import\s+\{([^}]*)\}\s+from\s+["']@\/lib\/brand\/tokens["'];?/,
    (_m, names) => {
      const list = names.split(",").map(s => s.trim()).filter(Boolean);
      const has = list.includes("themeTokens");
      const updated = has ? list : [...list, "themeTokens"];
      return `import { ${updated.join(", ")} } from "@/lib/brand/tokens";`;
    },
  );

  totalFiles += 1;
  totalSites += count;
  if (APPLY) {
    await fs.writeFile(f, next, "utf8");
    console.log(`fixed ${count}× ${path.relative(ROOT, f)}`);
  } else {
    console.log(`would fix ${count}× ${path.relative(ROOT, f)}`);
  }
}

console.log(`\n${APPLY ? "applied" : "dry-run"}: ${totalSites} sites in ${totalFiles} files`);
