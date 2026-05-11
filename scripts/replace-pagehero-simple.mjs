/**
 * Batch replace PageHero with slim editorial strip for SIMPLE pages (no actions= prop).
 * Extracts eyebrow + title from PageHero props and generates the standard strip.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const SIMPLE_FILES = [
  'src/app/dashboard/admin/page.tsx',
  'src/app/dashboard/ads-manager/page.tsx',
  'src/app/dashboard/affiliates/page.tsx',
  'src/app/dashboard/automations/browser-tasks/[id]/page.tsx',
  'src/app/dashboard/automations/browser-tasks/page.tsx',
  'src/app/dashboard/automations/library/page.tsx',
  'src/app/dashboard/client-health/page.tsx',
  'src/app/dashboard/coach/page.tsx',
  'src/app/dashboard/console/page.tsx',
  'src/app/dashboard/design-studio/page.tsx',
  'src/app/dashboard/dialer/page.tsx',
  'src/app/dashboard/domains/hub-setup/page.tsx',
  'src/app/dashboard/domains/hub-status/[jobId]/page.tsx',
  'src/app/dashboard/financials/page.tsx',
  'src/app/dashboard/forecast/page.tsx',
  'src/app/dashboard/funnels/new/page.tsx',
  'src/app/dashboard/getting-started/page.tsx',
  'src/app/dashboard/mail-setup/page.tsx',
  'src/app/dashboard/notion-sync/page.tsx',
  'src/app/dashboard/outreach-feed/page.tsx',
  'src/app/dashboard/outreach-logs/page.tsx',
  'src/app/dashboard/phone-email/page.tsx',
  'src/app/dashboard/portal/agency-room/page.tsx',
  'src/app/dashboard/profile/page.tsx',
  'src/app/dashboard/proposals/page.tsx',
  'src/app/dashboard/referrals/page.tsx',
  'src/app/dashboard/reviews/page.tsx',
  'src/app/dashboard/roi-calculator/page.tsx',
  'src/app/dashboard/scraper/page.tsx',
  'src/app/dashboard/settings/danger/page.tsx',
  'src/app/dashboard/settings/email-templates/page.tsx',
  'src/app/dashboard/settings/page.tsx',
  'src/app/dashboard/social-studio/page.tsx',
  'src/app/dashboard/tickets/page.tsx',
  'src/app/dashboard/triggers/page.tsx',
  'src/app/dashboard/trinity/page.tsx',
  'src/app/dashboard/trinity/proposals/page.tsx',
  'src/app/dashboard/verticals/[vertical]/page.tsx',
  'src/app/dashboard/verticals/page.tsx',
  'src/app/dashboard/voice-receptionist/page.tsx',
  'src/app/dashboard/workflow-builder/page.tsx',
];

function toTitleCase(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function extractStringProp(content, propName) {
  const re = new RegExp(`${propName}="([^"]+)"`, 's');
  const m = content.match(re);
  return m ? m[1] : null;
}

function extractTitleProp(content) {
  // handles title="..." or title={expr}
  const strMatch = content.match(/\btitle="([^"]+)"/);
  if (strMatch) return { value: strMatch[1], isExpr: false };
  const exprMatch = content.match(/\btitle=\{([^}]+)\}/);
  if (exprMatch) return { value: exprMatch[1], isExpr: true };
  return null;
}

function processFile(filePath) {
  const full = resolve(filePath);
  let content = readFileSync(full, 'utf8');

  if (!content.includes('import PageHero')) {
    console.log(`  SKIP (no import): ${filePath}`);
    return false;
  }

  // Find start of PageHero block
  const phStart = content.indexOf('<PageHero');
  if (phStart === -1) {
    console.log(`  SKIP (no JSX): ${filePath}`);
    return false;
  }

  // Find the end: first standalone /> after phStart
  // "Standalone" means the /> is on its own line (only whitespace before)
  const afterPH = content.slice(phStart);
  // Match \n<spaces/> to find the PageHero's own closing />
  // We need to skip nested /> from icon props (they're on the same line as icon=...)
  // Strategy: find all /> positions, pick the first one that's at the start of a line
  const standalonEnd = afterPH.match(/\n[ \t]*\/>/);
  if (!standalonEnd) {
    console.log(`  SKIP (no standalone />): ${filePath}`);
    return false;
  }

  const phBlockInAfter = afterPH.slice(0, afterPH.indexOf(standalonEnd[0]) + standalonEnd[0].length);
  const phEnd = phStart + phBlockInAfter.length;

  // Extract props from the block
  const phBlock = content.slice(phStart, phEnd);

  // Get title
  const titleInfo = extractTitleProp(phBlock);
  if (!titleInfo) {
    console.log(`  SKIP (no title): ${filePath}`);
    return false;
  }
  const titleStr = titleInfo.isExpr ? `{${titleInfo.value}}` : titleInfo.value;
  const titlePlain = titleInfo.isExpr ? titleInfo.value.replace(/['"]/g, '') : titleInfo.value;

  // Get eyebrow - string only (JSX eyebrow expressions get simplified to uppercase title)
  let eyebrow = extractStringProp(phBlock, 'eyebrow');
  if (!eyebrow) {
    // Derive from title
    eyebrow = titlePlain.toUpperCase();
  }

  // Determine the indentation from context (look at what's before <PageHero on same line)
  const lineStart = content.lastIndexOf('\n', phStart);
  const indentMatch = content.slice(lineStart + 1, phStart).match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '      ';

  // Build the slim strip
  const h1Content = titleInfo.isExpr ? `{${titleInfo.value}}` : titleInfo.value;
  const strip = `{/* -- ${titlePlain} command strip -- */}
${indent}<div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
${indent}  <div className="min-w-0">
${indent}    <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">${eyebrow}</p>
${indent}    <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">${h1Content}</h1>
${indent}  </div>
${indent}</div>`;

  // Replace PageHero block
  content = content.slice(0, phStart) + strip + content.slice(phEnd);

  // Remove import line
  content = content.replace(/^import PageHero from ['"][^'"]+['"];\n/m, '');

  writeFileSync(full, content, 'utf8');
  console.log(`  OK: ${filePath}`);
  return true;
}

let ok = 0, skip = 0;
for (const f of SIMPLE_FILES) {
  const result = processFile(f);
  if (result) ok++; else skip++;
}
console.log(`\nDone: ${ok} processed, ${skip} skipped`);
