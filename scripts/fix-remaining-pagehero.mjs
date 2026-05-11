/**
 * Fix remaining PageHero instances — replaces ALL occurrences in each file.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const FILES = [
  'src/app/dashboard/client-reports/page.tsx',
  'src/app/dashboard/content/page.tsx',
  'src/app/dashboard/onboard/page.tsx',
  'src/app/dashboard/portal/agency-room/page.tsx',
  'src/app/dashboard/verticals/[vertical]/page.tsx',
];

function findPageHeroEnd(content, phStart) {
  let i = phStart + '<PageHero'.length;
  let braceDepth = 0;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '"' || ch === "'") {
      const q = ch; i++;
      while (i < content.length && content[i] !== q) { if (content[i] === '\\') i++; i++; }
    } else if (ch === '`') {
      i++;
      while (i < content.length && content[i] !== '`') {
        if (content[i] === '\\') { i++; }
        else if (content[i] === '$' && i+1 < content.length && content[i+1] === '{') {
          i += 2; let d=1;
          while (i < content.length && d>0) { if(content[i]==='{')d++; else if(content[i]==='}')d--; i++; } continue;
        }
        i++;
      }
    } else if (ch === '{') { braceDepth++; }
    else if (ch === '}') { braceDepth--; }
    else if (ch === '/' && i+1<content.length && content[i+1]==='>') {
      if (braceDepth === 0) return i+2;
    }
    i++;
  }
  return -1;
}

function extractActions(block) {
  const aIdx = block.indexOf('actions={');
  if (aIdx === -1) return null;
  let i = aIdx + 'actions={'.length;
  let depth = 1;
  const start = i;
  while (i < block.length && depth > 0) {
    const ch = block[i];
    if (ch === '"' || ch === "'") {
      const q = ch; i++;
      while (i < block.length && block[i] !== q) { if (block[i] === '\\') i++; i++; }
    } else if (ch === '`') {
      i++;
      while (i < block.length && block[i] !== '`') {
        if (block[i] === '\\') { i++; }
        else if (block[i] === '$' && i+1<block.length && block[i+1]==='{') {
          i += 2; let d=1;
          while (i<block.length&&d>0) { if(block[i]==='{')d++; else if(block[i]==='}')d--; i++; } continue;
        }
        i++;
      }
    } else if (ch === '{') { depth++; }
    else if (ch === '}') { depth--; if (depth===0) return block.slice(start,i).trim(); }
    i++;
  }
  return null;
}

function extractStringProp(block, prop) {
  const m = block.match(new RegExp(`\\b${prop}="([^"]+)"`));
  return m ? m[1] : null;
}

function extractTitleProp(block) {
  const s = block.match(/\btitle="([^"]+)"/);
  if (s) return { value: s[1], isExpr: false };
  const e = block.match(/\btitle=\{([^}]+)\}/);
  if (e) return { value: e[1], isExpr: true };
  return null;
}

function makeStrip(indent, eyebrow, h1Content, titlePlain, actionsContent) {
  if (actionsContent) {
    return `{/* -- ${titlePlain} command strip -- */}
${indent}<div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
${indent}  <div className="min-w-0">
${indent}    <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">${eyebrow}</p>
${indent}    <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">${h1Content}</h1>
${indent}  </div>
${indent}  <div className="flex items-center gap-2 shrink-0">
${indent}    ${actionsContent}
${indent}  </div>
${indent}</div>`;
  }
  return `{/* -- ${titlePlain} command strip -- */}
${indent}<div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
${indent}  <div className="min-w-0">
${indent}    <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">${eyebrow}</p>
${indent}    <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">${h1Content}</h1>
${indent}  </div>
${indent}</div>`;
}

function processFile(filePath) {
  const full = resolve(filePath);
  let content = readFileSync(full, 'utf8');
  let replacements = 0;

  // Replace ALL occurrences of <PageHero (that are real JSX, not in comments)
  while (true) {
    // Find next <PageHero that's NOT inside a /* comment */ or // comment line
    let phStart = -1;
    let searchFrom = 0;
    while (searchFrom < content.length) {
      const idx = content.indexOf('<PageHero', searchFrom);
      if (idx === -1) break;

      // Check if this <PageHero is preceded by content suggesting it's in a comment
      // Look back to find the start of the current line
      const lineStart = content.lastIndexOf('\n', idx) + 1;
      const lineContent = content.slice(lineStart, idx + 9);

      // Skip if in a // comment
      if (/^\s*\/\//.test(lineContent)) { searchFrom = idx + 9; continue; }

      // Skip if in a * comment (JSDoc style: lines starting with *)
      if (/^\s*\*/.test(lineContent)) { searchFrom = idx + 9; continue; }

      // Check the character right after <PageHero - must be whitespace/newline (real JSX)
      const nextCh = content[idx + 9];
      if (!nextCh || (nextCh !== '\n' && nextCh !== '\r' && nextCh !== ' ' && nextCh !== '\t')) {
        // Could be <PageHero> in a comment string — check surrounding context
        // If followed by '>' it's likely in a comment
        if (nextCh === '>') { searchFrom = idx + 9; continue; }
      }

      phStart = idx;
      break;
    }

    if (phStart === -1) break;

    const phEnd = findPageHeroEnd(content, phStart);
    if (phEnd === -1) {
      console.log(`  WARNING: could not find end at pos ${phStart} in ${filePath}`);
      break;
    }

    const phBlock = content.slice(phStart, phEnd);

    // Extract title
    const titleInfo = extractTitleProp(phBlock);
    if (!titleInfo) {
      console.log(`  WARNING: no title at pos ${phStart}`);
      break;
    }
    const titlePlain = titleInfo.isExpr ? titleInfo.value.replace(/['"]/g,'').trim() : titleInfo.value;
    const h1Content = titleInfo.isExpr ? `{${titleInfo.value}}` : titleInfo.value;

    let eyebrow = extractStringProp(phBlock, 'eyebrow') ?? titlePlain.toUpperCase();
    const actionsContent = extractActions(phBlock);

    // Determine indentation
    const lineStart = content.lastIndexOf('\n', phStart);
    const beforePH = content.slice(lineStart + 1, phStart);
    const indent = (beforePH.match(/^(\s*)/) ?? ['', ''])[1];

    const strip = makeStrip(indent, eyebrow, h1Content, titlePlain, actionsContent);
    content = content.slice(0, phStart) + strip + content.slice(phEnd);
    replacements++;
    console.log(`  Replaced instance ${replacements}: "${titlePlain}" at ~line ${content.slice(0, phStart).split('\n').length}`);
  }

  if (replacements > 0) {
    writeFileSync(full, content, 'utf8');
    console.log(`  DONE (${replacements} replacements): ${filePath}`);
    return true;
  } else {
    console.log(`  SKIP (nothing found): ${filePath}`);
    return false;
  }
}

for (const f of FILES) {
  console.log(`\nProcessing: ${f}`);
  try { processFile(f); }
  catch (e) { console.error(`  ERROR: ${e.message}`); }
}
console.log('\nAll done.');
