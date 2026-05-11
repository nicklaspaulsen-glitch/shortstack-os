/**
 * Batch replace PageHero with slim editorial strip for COMPLEX pages (has actions= prop).
 * Extracts eyebrow, title, and the actions JSX block.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const COMPLEX_FILES = [
  'src/app/dashboard/ab-tests/[id]/page.tsx',
  'src/app/dashboard/ab-tests/page.tsx',
  'src/app/dashboard/activity-log/page.tsx',
  'src/app/dashboard/admin/agent-traces/page.tsx',
  'src/app/dashboard/admin/llm-costs/page.tsx',
  'src/app/dashboard/admin/self-test/page.tsx',
  'src/app/dashboard/admin/status/page.tsx',
  'src/app/dashboard/ads/page.tsx',
  'src/app/dashboard/affiliates/[id]/page.tsx',
  'src/app/dashboard/agent-controls/page.tsx',
  'src/app/dashboard/agent-desktop/page.tsx',
  'src/app/dashboard/agent-office/page.tsx',
  'src/app/dashboard/api-docs/page.tsx',
  'src/app/dashboard/api/keys/page.tsx',
  'src/app/dashboard/api/webhooks/page.tsx',
  'src/app/dashboard/audit/page.tsx',
  'src/app/dashboard/automations/page.tsx',
  'src/app/dashboard/billing/page.tsx',
  'src/app/dashboard/brand-voice/page.tsx',
  'src/app/dashboard/briefing/page.tsx',
  'src/app/dashboard/carousel-generator/page.tsx',
  'src/app/dashboard/client-reports/page.tsx',
  'src/app/dashboard/coach/analyses/[id]/page.tsx',
  'src/app/dashboard/cold-email/page.tsx',
  'src/app/dashboard/commission-tracker/page.tsx',
  'src/app/dashboard/competitive-monitor/page.tsx',
  'src/app/dashboard/competitor-tracker/page.tsx',
  'src/app/dashboard/content-library/page.tsx',
  'src/app/dashboard/content/page.tsx',
  'src/app/dashboard/courses/[id]/page.tsx',
  'src/app/dashboard/courses/page.tsx',
  'src/app/dashboard/custom-dashboard/page.tsx',
  'src/app/dashboard/dedup/page.tsx',
  'src/app/dashboard/design/page.tsx',
  'src/app/dashboard/discord/page.tsx',
  'src/app/dashboard/dm-controller/page.tsx',
  'src/app/dashboard/domains/page.tsx',
  'src/app/dashboard/download/page.tsx',
  'src/app/dashboard/eleven-agents/page.tsx',
  'src/app/dashboard/email-composer/page.tsx',
  'src/app/dashboard/email-templates/page.tsx',
  'src/app/dashboard/forms/page.tsx',
  'src/app/dashboard/funnels/[id]/page.tsx',
  'src/app/dashboard/funnels/page.tsx',
  'src/app/dashboard/google-business/page.tsx',
  'src/app/dashboard/inbox/page.tsx',
  'src/app/dashboard/integrations-hub/page.tsx',
  'src/app/dashboard/invoice-templates/page.tsx',
  'src/app/dashboard/invoices/page.tsx',
  'src/app/dashboard/landing-pages/page.tsx',
  'src/app/dashboard/lead-sources/page.tsx',
  'src/app/dashboard/leads/scoring/page.tsx',
  'src/app/dashboard/marketplace/listings/page.tsx',
  'src/app/dashboard/marketplace/orders/page.tsx',
  'src/app/dashboard/marketplace/page.tsx',
  'src/app/dashboard/meetings/page.tsx',
  'src/app/dashboard/monitor/page.tsx',
  'src/app/dashboard/newsletter/page.tsx',
  'src/app/dashboard/notifications/page.tsx',
  'src/app/dashboard/onboard/page.tsx',
  'src/app/dashboard/phone-setup/page.tsx',
  'src/app/dashboard/pricing/page.tsx',
  'src/app/dashboard/pricing/payment-links/page.tsx',
  'src/app/dashboard/production/page.tsx',
  'src/app/dashboard/projects/page.tsx',
  'src/app/dashboard/report-generator/page.tsx',
  'src/app/dashboard/reports/page.tsx',
  'src/app/dashboard/reviews/auto-reply/page.tsx',
  'src/app/dashboard/scheduling/page.tsx',
  'src/app/dashboard/sequences/page.tsx',
  'src/app/dashboard/services/page.tsx',
  'src/app/dashboard/settings/getting-started/page.tsx',
  'src/app/dashboard/settings/voice-profile/page.tsx',
  'src/app/dashboard/sms-templates/page.tsx',
  'src/app/dashboard/subaccounts/page.tsx',
  'src/app/dashboard/surveys/page.tsx',
  'src/app/dashboard/system-status/page.tsx',
  'src/app/dashboard/tags/page.tsx',
  'src/app/dashboard/team/page.tsx',
  'src/app/dashboard/telegram-bot/page.tsx',
  'src/app/dashboard/telegram-presets/page.tsx',
  'src/app/dashboard/upgrade/page.tsx',
  'src/app/dashboard/usage/page.tsx',
  'src/app/dashboard/voice-studio/[id]/page.tsx',
  'src/app/dashboard/voicemail-drop/page.tsx',
  'src/app/dashboard/webhooks/page.tsx',
  'src/app/dashboard/whatsapp/page.tsx',
  'src/app/dashboard/white-label/page.tsx',
  'src/app/dashboard/workflows/page.tsx',
  'src/app/dashboard/workspace/board/page.tsx',
  'src/app/dashboard/workspace/files/page.tsx',
  'src/app/dashboard/workspace/whiteboard/page.tsx',
  'src/app/dashboard/workspaces/page.tsx',
];

/**
 * Find where the <PageHero .../> block ends.
 * Tracks brace depth (for JSX expressions like actions={...}) and skips strings.
 * Returns the index AFTER the closing "/>" of the PageHero element.
 */
function findPageHeroEnd(content, phStart) {
  let i = phStart + '<PageHero'.length;
  let braceDepth = 0;

  while (i < content.length) {
    const ch = content[i];

    // Skip single or double quoted strings when NOT inside braces
    // (prop values like title="..." at depth 0 can't contain unbalanced braces normally)
    if (ch === '"' || ch === "'") {
      const q = ch;
      i++;
      while (i < content.length && content[i] !== q) {
        if (content[i] === '\\') i++; // escape
        i++;
      }
      // i now points to closing quote
    } else if (ch === '`') {
      // template literal - handle ${} expressions inside
      i++;
      while (i < content.length && content[i] !== '`') {
        if (content[i] === '\\') {
          i++;
        } else if (content[i] === '$' && i + 1 < content.length && content[i + 1] === '{') {
          i += 2;
          let exprD = 1;
          while (i < content.length && exprD > 0) {
            const c2 = content[i];
            if (c2 === '{') exprD++;
            else if (c2 === '}') exprD--;
            i++;
          }
          continue; // don't increment again
        }
        i++;
      }
      // i now points to closing backtick
    } else if (ch === '{') {
      braceDepth++;
    } else if (ch === '}') {
      braceDepth--;
    } else if (ch === '/' && i + 1 < content.length && content[i + 1] === '>' && braceDepth === 0) {
      // This is PageHero's own closing />
      return i + 2;
    }

    i++;
  }

  return -1;
}

/**
 * Extract the content inside actions={...}.
 * Returns the raw string between the outer { and }.
 */
function extractActions(block) {
  const aIdx = block.indexOf('actions={');
  if (aIdx === -1) return null;

  let i = aIdx + 'actions={'.length;
  let depth = 1;
  const start = i;

  while (i < block.length && depth > 0) {
    const ch = block[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      i++;
      while (i < block.length && block[i] !== q) {
        if (block[i] === '\\') i++;
        i++;
      }
    } else if (ch === '`') {
      i++;
      while (i < block.length && block[i] !== '`') {
        if (block[i] === '\\') {
          i++;
        } else if (block[i] === '$' && i + 1 < block.length && block[i + 1] === '{') {
          i += 2;
          let d2 = 1;
          while (i < block.length && d2 > 0) {
            if (block[i] === '{') d2++;
            else if (block[i] === '}') d2--;
            i++;
          }
          continue;
        }
        i++;
      }
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return block.slice(start, i).trim();
      }
    }
    i++;
  }

  return null;
}

function extractStringProp(block, propName) {
  const re = new RegExp(`\\b${propName}="([^"]+)"`, 's');
  const m = block.match(re);
  return m ? m[1] : null;
}

function extractTitleProp(block) {
  const strM = block.match(/\btitle="([^"]+)"/);
  if (strM) return { value: strM[1], isExpr: false };
  const exprM = block.match(/\btitle=\{([^}]+)\}/);
  if (exprM) return { value: exprM[1], isExpr: true };
  return null;
}

function processFile(filePath) {
  const full = resolve(filePath);
  let content = readFileSync(full, 'utf8');

  if (!content.includes('import PageHero') && !content.includes('<PageHero')) {
    console.log(`  SKIP (already done): ${filePath}`);
    return false;
  }

  const phStart = content.indexOf('<PageHero');
  if (phStart === -1) {
    console.log(`  SKIP (no JSX): ${filePath}`);
    return false;
  }

  const phEnd = findPageHeroEnd(content, phStart);
  if (phEnd === -1) {
    console.log(`  FAIL (no end found): ${filePath}`);
    return false;
  }

  const phBlock = content.slice(phStart, phEnd);

  // Extract title
  const titleInfo = extractTitleProp(phBlock);
  if (!titleInfo) {
    console.log(`  FAIL (no title): ${filePath}`);
    return false;
  }
  const titlePlain = titleInfo.isExpr
    ? titleInfo.value.replace(/['"]/g, '').trim()
    : titleInfo.value;
  const h1Content = titleInfo.isExpr ? `{${titleInfo.value}}` : titleInfo.value;

  // Extract eyebrow (string only; if JSX expression or missing, derive from title)
  let eyebrow = extractStringProp(phBlock, 'eyebrow');
  if (!eyebrow) {
    eyebrow = titlePlain.toUpperCase();
  }

  // Extract actions content
  const actionsContent = extractActions(phBlock);

  // Determine indentation from what's before <PageHero on same line
  const lineStart = content.lastIndexOf('\n', phStart);
  const beforePH = content.slice(lineStart + 1, phStart);
  const indentMatch = beforePH.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '      ';

  // Build strip
  let strip;
  if (actionsContent) {
    strip = `{/* -- ${titlePlain} command strip -- */}
${indent}<div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
${indent}  <div className="min-w-0">
${indent}    <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">${eyebrow}</p>
${indent}    <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">${h1Content}</h1>
${indent}  </div>
${indent}  <div className="flex items-center gap-2 shrink-0">
${indent}    ${actionsContent}
${indent}  </div>
${indent}</div>`;
  } else {
    strip = `{/* -- ${titlePlain} command strip -- */}
${indent}<div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
${indent}  <div className="min-w-0">
${indent}    <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">${eyebrow}</p>
${indent}    <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">${h1Content}</h1>
${indent}  </div>
${indent}</div>`;
  }

  // Replace block
  content = content.slice(0, phStart) + strip + content.slice(phEnd);

  // Remove import
  content = content.replace(/^import PageHero from ['"][^'"]+['"];\n/m, '');

  writeFileSync(full, content, 'utf8');
  console.log(`  OK: ${filePath}`);
  return true;
}

let ok = 0, fail = 0, skip = 0;
for (const f of COMPLEX_FILES) {
  try {
    const result = processFile(f);
    if (result) ok++; else skip++;
  } catch (err) {
    console.error(`  ERROR: ${f} — ${err.message}`);
    fail++;
  }
}
console.log(`\nDone: ${ok} processed, ${skip} skipped, ${fail} errors`);
