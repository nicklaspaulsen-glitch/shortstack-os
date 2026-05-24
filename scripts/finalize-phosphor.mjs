/**
 * Final pass: fix remaining icon name issues after migration
 * - Rename Sparkles→Sparkle, Wand2→MagicWand, Bot→Robot etc. in JSX
 * - Fix wrong/missing Phosphor targets in imports
 * - Remove LucideIcon type references (replace with Icon)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

// Name-in-JSX → correct Phosphor name
// These were all either missed by migration or incorrectly handled
const RENAMES = new Map([
  ["Sparkles", "Sparkle"],
  ["Wand2", "MagicWand"],
  ["Bot", "Robot"],
  ["ImageIcon", "Image"],
  ["LucideIcon", "Icon"],
  ["IconProps", "IconProps"],  // keep as is (it does exist in phosphor)
  // "Icon" suffix variants
  ["CalendarIcon", "Calendar"],
  ["FileTextIcon", "FileText"],
  ["XIcon", "X"],
  ["TypeIcon", "TextT"],
  ["FileIcon", "File"],
  ["UsersIcon", "Users"],
  ["LayersIcon", "Stack"],
  ["CaptionsIcon", "ClosedCaptioning"],
  ["UploadIcon", "UploadSimple"],
  ["TextIcon", "TextT"],
  ["TargetIcon", "Target"],
  ["MapIcon", "MapTrifold"],
  ["ListIcon", "ListBullets"],
  ["HomeIcon", "House"],
  ["GridIcon", "SquaresFour"],
  ["ChevronRightIcon", "CaretRight"],
  ["CheckIcon", "Check"],
  // Wrong phosphor targets still remaining
  ["CalendarClock", "CalendarCheck"],
  ["Brackets", "BracketsCurly"],
  ["Dice5", "DiceFive"],
  ["FileQuestion", "FileMagnifyingGlass"],
  ["Question", "Question"],  // this one IS in phosphor, keep
]);

const PHOSPHOR_IMPORT_RE = /import\s*\{([^}]+)\}\s*from\s*['"]@phosphor-icons\/react['"];?\n?/;
const PHOSPHOR_TYPE_IMPORT_RE = /import\s*type\s*\{([^}]+)\}\s*from\s*['"]@phosphor-icons\/react['"];?\n?/;

// Verify what exists in phosphor
const phosphorCjs = readFileSync(
  join(ROOT, "node_modules/@phosphor-icons/react/dist/index.cjs.js"),
  "utf8"
);
const phosphorExports = new Set(
  [...phosphorCjs.matchAll(/exports\.([A-Z][A-Za-z0-9]*)\s*=/g)].map((m) => m[1])
);

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

const allFiles = walk(SRC);
let patched = 0;

for (const filePath of allFiles) {
  const original = readFileSync(filePath, "utf8");
  let content = original;

  // For each rename target, check if this file uses it
  for (const [wrong, right] of RENAMES) {
    if (!content.includes(wrong)) continue;
    if (wrong === right) continue;

    // Handle LucideIcon specially — only replace in type positions
    if (wrong === "LucideIcon") {
      content = content.replace(/\bLucideIcon\b/g, "Icon");
      continue;
    }

    // Rename in JSX tags and value positions
    content = content.replace(
      new RegExp(`<${wrong}([\\s/>])`, "g"),
      `<${right}$1`
    );
    content = content.replace(new RegExp(`</${wrong}>`, "g"), `</${right}>`);
    content = content.replace(
      new RegExp(`(?<![A-Za-z0-9_$])${wrong}(?![A-Za-z0-9_$])`, "g"),
      right
    );
  }

  // Now fix the Phosphor import to include any new names needed
  if (content !== original) {
    // Collect all phosphor component uses in this file
    // Find what's imported vs what's used
    const importMatch = content.match(PHOSPHOR_IMPORT_RE);
    if (importMatch) {
      const importedNames = new Set(
        importMatch[1].split(",").map((n) => n.trim()).filter(Boolean)
      );

      // Find all capitalized identifiers used in JSX that look like icons
      // (used as <Name or as {Name} or = Name)
      // More targeted: check which RENAMES.values() appear in the file's import
      const allRenameTargets = new Set([...RENAMES.values()].filter(Boolean));
      const neededInImport = new Set();

      for (const targetName of allRenameTargets) {
        if (!content.includes(targetName)) continue;
        if (importedNames.has(targetName)) continue;
        if (!phosphorExports.has(targetName)) continue;
        // Check if it's actually used as a component/value in this file
        const usageRe = new RegExp(
          `(?:<${targetName}[\\s/>]|</${targetName}>|\\b${targetName}\\b)`,
          "g"
        );
        if (usageRe.test(content)) {
          neededInImport.add(targetName);
        }
      }

      if (neededInImport.size > 0) {
        const merged = [...new Set([...importedNames, ...neededInImport])].sort();
        const newImport = `import { ${merged.join(", ")} } from "@phosphor-icons/react";\n`;
        content = content.replace(PHOSPHOR_IMPORT_RE, newImport);
      }
    } else {
      // No existing phosphor import — build one from scratch for this file
      const neededNames = new Set();
      for (const targetName of [...RENAMES.values()].filter(Boolean)) {
        if (!content.includes(targetName)) continue;
        if (!phosphorExports.has(targetName)) continue;
        const usageRe = new RegExp(`<${targetName}[\\s/>]|</${targetName}>`, "g");
        if (usageRe.test(content)) {
          neededNames.add(targetName);
        }
      }
      if (neededNames.size > 0) {
        const newImport = `import { ${[...neededNames].sort().join(", ")} } from "@phosphor-icons/react";\n`;
        if (content.startsWith('"use client"') || content.startsWith("'use client'")) {
          const idx = content.indexOf("\n") + 1;
          content = content.slice(0, idx) + newImport + content.slice(idx);
        } else {
          content = newImport + content;
        }
      }
    }

    // Also: handle `Icon` type from LucideIcon renaming
    // If we renamed LucideIcon → Icon and there's no type import for Icon, add it
    if (content.includes(": Icon") || content.includes("Icon>") || content.includes("<Icon ")) {
      const typeImportMatch = content.match(PHOSPHOR_TYPE_IMPORT_RE);
      if (!typeImportMatch) {
        // Check if Icon is in the regular import
        const regImport = content.match(PHOSPHOR_IMPORT_RE);
        if (regImport && !regImport[1].includes("Icon,") && !regImport[1].endsWith("Icon")) {
          // Icon (capital) is a valid Phosphor export - could be a component OR type
          // For type usage, add to regular import is fine since Phosphor exports both
        }
      }
    }
  }

  if (content !== original) {
    writeFileSync(filePath, content, "utf8");
    patched++;
  }
}

console.log(`Patched: ${patched} files`);
