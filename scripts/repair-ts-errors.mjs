/**
 * Targeted repair for remaining TypeScript errors after Phosphor migration.
 *
 * Fixes:
 * 1. `Cannot find name 'Icon'` — add `import type { Icon }` to files that need it
 * 2. Duplicate `Link` identifier — rename Phosphor Link → LinkIcon where icon is used,
 *    or remove it where only next/link is used
 * 3. Duplicate `Image` identifier — rename/remove Phosphor Image where it conflicts
 * 4. Duplicate `Buildings` — remove from Phosphor import in websites/page.tsx (iconsax has it)
 * 5. nav-icon-3d duplicate `FileText` object key — remove the second one
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { join } from "path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function readFile(rel) {
  return readFileSync(join(SRC, rel), "utf8");
}

function writeFile(rel, content) {
  writeFileSync(join(SRC, rel), content, "utf8");
  console.log(`Fixed: ${rel}`);
}

function patch(rel, original, fn) {
  const content = fn(original);
  if (content !== original) {
    writeFile(rel, content);
    return true;
  }
  console.log(`No change: ${rel}`);
  return false;
}

// Remove a specific named export from a phosphor import line
function removeFromPhosphorImport(content, name) {
  return content.replace(
    /^(import\s*\{)([^}]+)(\}\s*from\s*['"]@phosphor-icons\/react['"];?\s*$)/m,
    (_match, open, names, close) => {
      const filtered = names
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n !== name)
        .filter(Boolean);
      return `${open} ${filtered.join(", ")} ${close}`;
    }
  );
}

// Rename a specific named export in a phosphor import line
function renameInPhosphorImport(content, oldName, newName) {
  return content.replace(
    /^(import\s*\{)([^}]+)(\}\s*from\s*['"]@phosphor-icons\/react['"];?\s*$)/m,
    (_match, open, names, close) => {
      const updated = names
        .split(",")
        .map((n) => {
          const trimmed = n.trim();
          return trimmed === oldName ? `${oldName} as ${newName}` : trimmed;
        })
        .filter(Boolean);
      return `${open} ${updated.join(", ")} ${close}`;
    }
  );
}

// Add `import type { Icon }` right after the value phosphor import
// If no phosphor import, add after the first import block
function addIconTypeImport(content) {
  if (content.includes("import type { Icon }") || content.includes("import type {Icon}")) {
    return content; // already has it
  }

  // Check if there's already a phosphor TYPE import to merge into
  const typeImportRe = /^import\s+type\s*\{([^}]+)\}\s*from\s*['"]@phosphor-icons\/react['"];?\s*$/m;
  if (typeImportRe.test(content)) {
    return content.replace(typeImportRe, (match, names) => {
      const existing = names.split(",").map((n) => n.trim()).filter(Boolean);
      if (existing.includes("Icon")) return match;
      const merged = [...new Set([...existing, "Icon"])].sort();
      return `import type { ${merged.join(", ")} } from "@phosphor-icons/react";`;
    });
  }

  // Insert after phosphor value import
  const valueImportRe = /^(import\s*\{[^}]+\}\s*from\s*['"]@phosphor-icons\/react['"];?\s*)$/m;
  if (valueImportRe.test(content)) {
    return content.replace(
      valueImportRe,
      `$1\nimport type { Icon } from "@phosphor-icons/react";`
    );
  }

  // Fallback: insert after first import line
  return content.replace(/^(import\s.+;?\s*)$/m, `$1\nimport type { Icon } from "@phosphor-icons/react";`);
}

// ────────────────────────────────────────────────
// Fix 1: Add `import type { Icon }` to 10 files
// ────────────────────────────────────────────────

const NEED_ICON_TYPE = [
  "app/dashboard/verticals/page.tsx",
  "app/dashboard/video-editor/page.tsx",
  "app/onboarding/vertical/page.tsx",
  "components/clients/smart-manage-overlay.tsx",
  "components/dashboard/coming-soon.tsx",
  "components/dashboard/main-navbar.tsx",
  "components/dashboard/personalized-metrics.tsx",
  "components/mail-setup/mailbox-planner.tsx",
  "components/onboarding/solo-onboarding-wizard.tsx",
  "components/thumbnail-editor/tools-palette.tsx",
];

for (const rel of NEED_ICON_TYPE) {
  const content = readFile(rel);
  patch(rel, content, addIconTypeImport);
}

// sidebar.tsx already has `import type { Icon }` — skip

// ────────────────────────────────────────────────
// Fix 2: websites/page.tsx — remove `Buildings` from Phosphor import
//         (iconsax-react also exports Buildings)
// ────────────────────────────────────────────────

{
  const rel = "app/dashboard/websites/page.tsx";
  const content = readFile(rel);
  patch(rel, content, (c) => removeFromPhosphorImport(c, "Buildings"));
}

// ────────────────────────────────────────────────
// Fix 3: demo/page.tsx — remove `Image` from Phosphor import
//         (next/image exports Image, Phosphor Image icon not used here)
// ────────────────────────────────────────────────

{
  const rel = "app/demo/page.tsx";
  const content = readFile(rel);
  patch(rel, content, (c) => removeFromPhosphorImport(c, "Image"));
}

// ────────────────────────────────────────────────
// Fix 4: sidebar.tsx — remove `Link` from Phosphor import
//         (only next/link Link is used for routing, no Link icon rendered)
// ────────────────────────────────────────────────

{
  const rel = "components/sidebar.tsx";
  const content = readFile(rel);
  patch(rel, content, (c) => removeFromPhosphorImport(c, "Link"));
}

// ────────────────────────────────────────────────
// Fix 5: email-composer/page.tsx — rename Phosphor Link → LinkIcon
//         (Link icon IS used as <Link size={12} />, but clashes with next/link)
// ────────────────────────────────────────────────

{
  const rel = "app/dashboard/email-composer/page.tsx";
  let content = readFile(rel);
  // Rename in import
  content = renameInPhosphorImport(content, "Link", "LinkIcon");
  // Rename in JSX: <Link size={...} ... /> where it's an icon (not href=...)
  // Icon usages are: <Link size={12} /> — replace only these (not <Link href=...>)
  content = content.replace(/<Link\s+(size=)/g, "<LinkIcon $1");
  content = content.replace(/<Link\s+(className[^>]*size=)/g, "<LinkIcon $1");
  // Catch remaining self-closing usages with size prop
  content = content.replace(/\{ icon: <Link size=/g, "{ icon: <LinkIcon size=");
  patch(rel, content, (c) => c); // write if changed
  if (content !== readFile(rel)) {
    writeFile(rel, content);
  }
}

// ────────────────────────────────────────────────
// Fix 6: meetings/page.tsx — rename Phosphor Link → LinkIcon
// ────────────────────────────────────────────────

{
  const rel = "app/dashboard/meetings/page.tsx";
  let content = readFile(rel);
  content = renameInPhosphorImport(content, "Link", "LinkIcon");
  // Replace icon usages: <Link size={...}> but not <Link href=...>
  content = content.replace(/<Link\s+(size=)/g, "<LinkIcon $1");
  const original = readFile(rel);
  if (content !== original) writeFile(rel, content);
}

// ────────────────────────────────────────────────
// Fix 7: client-billing-panel.tsx — rename Phosphor Link → LinkIcon
// ────────────────────────────────────────────────

{
  const rel = "components/clients/client-billing-panel.tsx";
  let content = readFile(rel);
  content = renameInPhosphorImport(content, "Link", "LinkIcon");
  content = content.replace(/<Link\s+(size=)/g, "<LinkIcon $1");
  const original = readFile(rel);
  if (content !== original) writeFile(rel, content);
}

// ────────────────────────────────────────────────
// Fix 8: layers-panel.tsx — rename Phosphor Image → ImageIcon
//         (new Image() browser constructor is shadowed by Phosphor Image)
// ────────────────────────────────────────────────

{
  const rel = "components/thumbnail-editor/layers-panel.tsx";
  let content = readFile(rel);
  content = renameInPhosphorImport(content, "Image", "ImageIcon");
  // Update usages: Image used in LAYER_ICONS map and in JSX icon rendering
  // Record<LayerType, typeof Image> → Record<LayerType, typeof ImageIcon>
  content = content.replace(/typeof Image\b/g, "typeof ImageIcon");
  // image: Image, → image: ImageIcon,
  content = content.replace(/\bimage:\s*Image\b/g, "image: ImageIcon");
  // <Image ... /> icon usage (only icon-like, not next/image)
  content = content.replace(/<Image\s+(size=)/g, "<ImageIcon $1");
  const original = readFile(rel);
  if (content !== original) writeFile(rel, content);
}

// ────────────────────────────────────────────────
// Fix 9: nav-icon-3d.tsx — remove duplicate `FileText` key
//         (line 151 duplicates line 130)
// ────────────────────────────────────────────────

{
  const rel = "components/brand/nav-icon-3d.tsx";
  let content = readFile(rel);

  // Find and remove the SECOND occurrence of "FileText:" in the object literal
  // The first occurrence (FileText: documentIcon) should stay
  let count = 0;
  content = content.replace(/^\s*FileText:.*$/gm, (match) => {
    count++;
    if (count === 2) return ""; // Remove the second occurrence
    return match;
  });

  const original = readFile(rel);
  if (content !== original) writeFile(rel, content);
}

console.log("\nAll targeted repairs complete.");
