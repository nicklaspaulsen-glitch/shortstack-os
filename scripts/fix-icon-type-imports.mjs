/**
 * Fix Icon/IconProps/IconWeight type imports.
 *
 * Phosphor exports Icon, IconProps, IconWeight as TYPE-ONLY:
 *   export type { Icon, IconProps, IconWeight } from './lib'
 *
 * They must be imported with `import type { }`, not `import { }`.
 *
 * This script:
 *   1. Finds all files with Icon/IconProps/IconWeight in a value phosphor import
 *   2. Splits them out into a separate `import type { ... }` line
 *   3. Keeps the remaining value imports unchanged
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

const TYPE_ONLY = new Set(["Icon", "IconProps", "IconWeight"]);

// Matches: import { ...names... } from "@phosphor-icons/react"
// Does NOT match: import type { ... }
const VALUE_IMPORT_RE = /^import\s*\{([^}]+)\}\s*from\s*['"]@phosphor-icons\/react['"];?\s*$/m;
const TYPE_IMPORT_RE = /^import\s+type\s*\{([^}]+)\}\s*from\s*['"]@phosphor-icons\/react['"];?\s*$/m;

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

  const valueMatch = content.match(VALUE_IMPORT_RE);
  if (!valueMatch) continue;

  const allNames = valueMatch[1]
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  const typeNames = allNames.filter((n) => TYPE_ONLY.has(n));
  if (typeNames.length === 0) continue;

  const valueNames = allNames.filter((n) => !TYPE_ONLY.has(n));

  // Check if there's already a type import we should merge into
  const existingTypeMatch = content.match(TYPE_IMPORT_RE);

  let newImportBlock;

  if (valueNames.length === 0) {
    // All names were type-only — replace value import with type import entirely
    if (existingTypeMatch) {
      // Merge into existing type import
      const existingTypeNames = existingTypeMatch[1]
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      const merged = [...new Set([...existingTypeNames, ...typeNames])].sort();
      const newTypeImport = `import type { ${merged.join(", ")} } from "@phosphor-icons/react";`;
      // Remove the value import
      content = content.replace(VALUE_IMPORT_RE, "");
      // Replace existing type import with merged
      content = content.replace(TYPE_IMPORT_RE, newTypeImport);
    } else {
      const newTypeImport = `import type { ${typeNames.sort().join(", ")} } from "@phosphor-icons/react";`;
      content = content.replace(VALUE_IMPORT_RE, newTypeImport);
    }
  } else {
    // Some names are value, some are type — split them
    const newValueImport = `import { ${valueNames.sort().join(", ")} } from "@phosphor-icons/react";`;

    if (existingTypeMatch) {
      // Merge typeNames into existing type import
      const existingTypeNames = existingTypeMatch[1]
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      const merged = [...new Set([...existingTypeNames, ...typeNames])].sort();
      const newTypeImport = `import type { ${merged.join(", ")} } from "@phosphor-icons/react";`;
      // Replace value import with value-only version
      content = content.replace(VALUE_IMPORT_RE, newValueImport);
      // Replace existing type import with merged
      content = content.replace(TYPE_IMPORT_RE, newTypeImport);
    } else {
      // Insert a new type import right after the value import line
      const newTypeImport = `import type { ${typeNames.sort().join(", ")} } from "@phosphor-icons/react";`;
      content = content.replace(
        VALUE_IMPORT_RE,
        `${newValueImport}\n${newTypeImport}`
      );
    }
  }

  if (content !== original) {
    writeFileSync(filePath, content, "utf8");
    patched++;
    console.log(`Fixed: ${filePath.replace(ROOT + "\\", "").replace(ROOT + "/", "")}`);
  }
}

console.log(`\nPatched: ${patched} files`);
