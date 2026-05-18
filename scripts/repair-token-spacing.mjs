/**
 * Repairs all broken brand token class names introduced by the Phase 2 token sweep.
 * Tokens: text-text-muted, text-text-primary, text-text-secondary, border-border-subtle
 *
 * Breakage categories:
 *  A) ={TOKEN   → ={`TOKEN   (backtick consumed in template literal)
 *  B) =TOKEN    → ="TOKEN   (opening quote consumed in attribute value)
 *  C) ": TOKEN...classes"  → ': "TOKEN...classes"'  (ternary false-branch, quote consumed)
 *  D) wordchar/]TOKEN  → wordchar/ ] TOKEN  (space consumed between classes)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.join(__dirname, '..', 'src');

const TOKENS = [
  'text-text-muted',
  'text-text-primary',
  'text-text-secondary',
  'border-border-subtle',
  'border-border-strong',
];

// Build alternation for regex
const TOK_ALT = TOKENS.map(t => t.replace(/-/g, '\\-')).join('|');

function walk(dir) {
  const results = [];
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }
  for (const item of items) {
    if (['node_modules', '.next', '.git', 'graphify-out'].includes(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) results.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(item.name)) results.push(full);
  }
  return results;
}

const files = walk(base);
let totalFiles = 0;
let totalFixes = 0;

for (const f of files) {
  const original = fs.readFileSync(f, 'utf8');

  // Quick skip if none of our tokens present
  const hasToken = TOKENS.some(t => original.includes(t));
  if (!hasToken) continue;

  let content = original;

  for (const tok of TOKENS) {
    const escaped = tok.replace(/-/g, '\\-');

    // A) Template literal: ={TOKEN → ={`TOKEN (backtick was consumed)
    content = content.replace(new RegExp(`=\\{${escaped}`, 'g'), `={\`${tok}`);

    // B) Attribute value: =TOKEN → ="TOKEN (opening quote consumed)
    //    Capture the char before = to avoid double-processing
    content = content.replace(new RegExp(`([^{=])=${escaped}`, 'g'), `$1="${tok}`);

    // C) Ternary false-branch: ': TOKEN...classes"' → ': "TOKEN...classes"'
    content = content.replace(
      new RegExp(`: ${escaped}([^"}\`\\n]*)"`, 'g'),
      `: "${tok}$1"`
    );

    // E) Ternary true-branch: '? TOKEN...classes"' → '? "TOKEN...classes"'
    content = content.replace(
      new RegExp(`\\? ${escaped}([^"}\`\\n]*)"`, 'g'),
      `? "${tok}$1"`
    );

    // F) Logical OR fallback: '|| TOKEN...classes"' → '|| "TOKEN...classes"'
    content = content.replace(
      new RegExp(`\\|\\| ${escaped}([^"}\`\\n]*)"`, 'g'),
      `|| "${tok}$1"`
    );

    // G) Return / assignment: 'return TOKEN...classes"' → 'return "TOKEN...classes"'
    content = content.replace(
      new RegExp(`return ${escaped}([^";\`\\n]*)"`, 'g'),
      `return "${tok}$1"`
    );

    // D) General missing space: any word char, digit, ], }, or specific chars directly before TOKEN
    //    But EXCLUDE: space, quote, backtick, (, {, :, -  (these are valid preceding chars)
    //    Special case: -- prefix (CSS variable) should NOT get a space added
    content = content.replace(
      new RegExp(`([^\\s"'\`({:\\-])${escaped}`, 'g'),
      `$1 ${tok}`
    );

    // E) Single hyphen before token: -TOKEN (negative lookahead - not preceded by another -)
    //    e.g. hover:-text-text-muted is NOT a valid pattern, but py-2-text-text-muted would be
    //    Actually: single - before text-text- should NOT get a space (it IS a valid Tailwind responsive prefix)
    //    LEAVE ALONE.

    // Sanity: fix any triple repetition that crept through
    const triplePattern = `${tok.replace('text-text-', 'text-text-text-')}`;
    if (content.includes(triplePattern)) {
      content = content.replace(new RegExp(triplePattern.replace(/-/g, '\\-'), 'g'), tok);
    }
  }

  if (content !== original) {
    fs.writeFileSync(f, content, 'utf8');
    totalFiles++;
    totalFixes++;
    console.log(`Fixed: ${path.relative(base + '/..', f)}`);
  }
}

console.log(`\nDone. Fixed ${totalFiles} files.`);
