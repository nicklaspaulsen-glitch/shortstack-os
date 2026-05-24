/**
 * Patch pass: fix incorrect Phosphor targets + handle unmapped Lucide icons
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

// Wrong phosphor name → correct phosphor name (from first pass errors)
const FIXES = new Map([
  ["Film", "FilmStrip"],
  ["Wifi", "WifiHigh"],
  ["SlidersVertical", "Sliders"],
  ["Puzzle", "PuzzlePiece"],
  ["FilePen", "NotePencil"],
  ["Webhooks", "PlugsConnected"],
  ["Fork", "ForkKnife"],
  ["ForkKnifeCross", "ForkKnife"],
  ["LifePreserver", "Lifebuoy"],
  ["ChatWarning", "Chat"],
  ["ArrowsMove", "ArrowsOutCardinal"],
  ["Accessibility", "Wheelchair"],
  ["FileCheck", "FileText"],
]);

// Icons that weren't in the first pass MAP
const EXTRA_MAP = new Map([
  ["Bot", "Robot"],
  ["Sparkles", "Sparkle"],
  ["Wand2", "MagicWand"],
]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry)) continue;
      walk(full, files);
    } else if ([".tsx", ".ts", ".jsx", ".js"].includes(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

const LUCIDE_IMPORT_RE = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]lucide-react['"];?\n?/g;
const PHOSPHOR_IMPORT_RE = /import\s*\{([^}]+)\}\s*from\s*['"]@phosphor-icons\/react['"];?\n?/;

const allFiles = walk(SRC);
let patched = 0;
let lucideRemaining = 0;

for (const filePath of allFiles) {
  const original = readFileSync(filePath, "utf8");
  let content = original;

  // ── 1. Fix wrong phosphor names from first migration pass ──────────────────
  for (const [wrong, right] of FIXES) {
    if (!content.includes(wrong)) continue;
    content = content.replace(
      new RegExp(`(?<![A-Za-z0-9$_])${wrong}(?![A-Za-z0-9$_])`, "g"),
      right
    );
  }

  // ── 2. Handle remaining lucide imports (Bot, Sparkles, Wand2, etc.) ────────
  if (content.includes("lucide-react")) {
    const collectedNames = new Set();
    for (const m of content.matchAll(LUCIDE_IMPORT_RE)) {
      for (const raw of m[1].split(",")) {
        const name = raw.trim().replace(/\s+as\s+\S+/, "").trim();
        if (name) collectedNames.add(name);
      }
    }

    // Collect existing phosphor imports
    const phosphorNames = new Set();
    const existingMatch = content.match(PHOSPHOR_IMPORT_RE);
    if (existingMatch) {
      for (const n of existingMatch[1].split(",")) {
        const trimmed = n.trim();
        if (trimmed) phosphorNames.add(trimmed);
      }
    }

    // Map the remaining lucide icons
    for (const name of collectedNames) {
      if (name === "LucideIcon") { continue; }
      if (name === "LucideProps") { continue; }
      const mapped = EXTRA_MAP.get(name);
      if (!mapped) continue;
      phosphorNames.add(mapped);
      if (mapped !== name) {
        content = content.replace(new RegExp(`<${name}([\\s/>])`, "g"), `<${mapped}$1`);
        content = content.replace(new RegExp(`</${name}>`, "g"), `</${mapped}>`);
        content = content.replace(
          new RegExp(`(?<![A-Za-z0-9_$])${name}(?![A-Za-z0-9_$])`, "g"),
          mapped
        );
      }
    }

    // Remove all lucide import lines
    content = content.replace(LUCIDE_IMPORT_RE, "");

    // Update phosphor import
    if (phosphorNames.size > 0) {
      const sorted = [...phosphorNames].sort().join(", ");
      const newImport = `import { ${sorted} } from "@phosphor-icons/react";\n`;
      if (existingMatch) {
        content = content.replace(PHOSPHOR_IMPORT_RE, newImport);
      } else {
        if (content.startsWith('"use client"') || content.startsWith("'use client'")) {
          const idx = content.indexOf("\n") + 1;
          content = content.slice(0, idx) + newImport + content.slice(idx);
        } else {
          content = newImport + content;
        }
      }
    }

    if (content.includes("lucide-react")) lucideRemaining++;
  }

  if (content !== original) {
    writeFileSync(filePath, content, "utf8");
    patched++;
  }
}

console.log(`Patched: ${patched} files`);
console.log(`Still has lucide-react: ${lucideRemaining} files`);
