/**
 * Glass style consolidation script — Phase 2
 * Handles ALL remaining inline glass backdrop-filter variants:
 *   - rgba(255,255,255,0.88) backgrounds
 *   - rgba(255,255,255,0.9) backgrounds
 *   - rgba(250,250,251,0.95) backgrounds
 *   - With/without border, borderRadius, boxShadow
 *   - Dynamic border expressions (ternaries)
 *
 * Strategy: any style prop containing backdropFilter+saturate(1.8) has its
 * glass properties stripped. If the remaining style object is empty, the
 * entire style prop is removed. Otherwise only glass properties are removed.
 * "glass" is added to className in all cases.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const DASHBOARD_DIR = join(process.cwd(), 'src/app/dashboard');

// Glass properties to strip from style objects
const GLASS_PROPS = [
  'background',
  'backdropFilter',
  'WebkitBackdropFilter',
  'borderRadius',
];

// Border values that are "glass default" and can be removed (handled by .glass class)
const DEFAULT_BORDERS = [
  '"1px solid rgba(0, 0, 0, 0.10)"',
  '"1px solid rgba(0,0,0,0.10)"',
  '"1px solid rgba(0, 0, 0, 0.08)"',
  '"1px solid rgba(0,0,0,0.08)"',
  '"1px solid rgba(255,255,255,0.70)"',
  '"1px solid rgba(255, 255, 255, 0.70)"',
];

function addGlassToClassName(line) {
  if (line.includes('"glass ') || line.includes(' glass"') || line.includes(' glass ') || line.includes('`glass ') || line.match(/className="glass"/)) {
    return line; // Already has glass
  }

  // className="..." pattern
  if (/className="([^"]*)"/.test(line)) {
    return line.replace(/className="([^"]*)"/, (m, classes) => {
      return `className="glass ${classes}"`;
    });
  }

  // className={`...`} pattern
  if (/className=\{`([^`]*)`\}/.test(line)) {
    return line.replace(/className=\{`([^`]*)`\}/, (m, classes) => {
      return `className={\`glass ${classes}\`}`;
    });
  }

  // className={expr} pattern
  if (/className=\{/.test(line)) {
    return line.replace(/className=\{/, 'className={"glass " + ');
  }

  // No className at all — add one before style or before >
  if (/style=\{/.test(line)) {
    return line.replace(/style=\{/, 'className="glass" style={');
  }

  // Fallback: add before closing >
  return line.replace(/>/, ' className="glass">');
}

function processFile(filepath) {
  const content = readFileSync(filepath, 'utf-8');
  if (!content.includes('saturate(1.8)')) return 0;

  const lines = content.split('\n');
  let replacements = 0;
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (!line.includes('saturate(1.8)')) {
      newLines.push(line);
      continue;
    }

    // This line has glass inline styles. Parse the style prop.
    // Strategy: try to match the full style={{ ... }} and strip glass props

    // Full single-line style prop match
    const styleMatch = line.match(/style=\{\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\}/);
    if (!styleMatch) {
      // Multi-line or complex — skip for manual handling
      newLines.push(line);
      continue;
    }

    const styleContent = styleMatch[1];

    // Parse individual properties (simple comma split won't work for ternaries)
    // Use a smarter split that respects nested ? : expressions
    const props = [];
    let current = '';
    let depth = 0;
    for (const ch of styleContent) {
      if (ch === '(' || ch === '{') depth++;
      if (ch === ')' || ch === '}') depth--;
      if (ch === ',' && depth === 0) {
        props.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) props.push(current.trim());

    // Classify each property
    const glassProps = [];
    const keepProps = [];

    for (const prop of props) {
      const key = prop.split(':')[0].trim();

      // Always strip backdrop-filter related props
      if (key === 'backdropFilter' || key === 'WebkitBackdropFilter') {
        glassProps.push(prop);
        continue;
      }

      // Strip background if it's a glass variant
      if (key === 'background' && /rgba\(2[45]\d,\s*2[45]\d,\s*2[45]\d,\s*0\.\d+\)/.test(prop)) {
        glassProps.push(prop);
        continue;
      }

      // Strip borderRadius if it's 12px (same as .glass)
      if (key === 'borderRadius' && prop.includes('12px')) {
        glassProps.push(prop);
        continue;
      }

      // Strip border if it's a default glass border
      if (key === 'border') {
        const borderVal = prop.replace(/^border:\s*/, '').trim();
        if (DEFAULT_BORDERS.some(b => borderVal === b)) {
          glassProps.push(prop);
          continue;
        }
      }

      // Strip boxShadow if it matches the standard inset pattern
      if (key === 'boxShadow' && prop.includes('inset 0 1px 0 rgba(255')) {
        glassProps.push(prop);
        continue;
      }

      // Keep everything else
      keepProps.push(prop);
    }

    if (glassProps.length === 0) {
      newLines.push(line);
      continue;
    }

    replacements++;

    // Rebuild the line
    if (keepProps.length === 0) {
      // All props were glass — remove entire style prop
      line = line.replace(/\s*style=\{\{[^}]*(?:\{[^}]*\}[^}]*)*\}\}/, '');
    } else {
      // Keep remaining props
      const newStyle = `style={{ ${keepProps.join(', ')} }}`;
      line = line.replace(/style=\{\{[^}]*(?:\{[^}]*\}[^}]*)*\}\}/, newStyle);
    }

    // Add glass class
    line = addGlassToClassName(line);

    // Clean up double/triple spaces mid-line
    const indent = line.match(/^(\s*)/)[1];
    const rest = line.slice(indent.length);
    line = indent + rest.replace(/  +/g, ' ');

    newLines.push(line);
  }

  if (replacements === 0) return 0;

  const result = newLines.join('\n');
  writeFileSync(filepath, result, 'utf-8');
  return replacements;
}

function walkDir(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walkDir(full));
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) files.push(full);
  }
  return files;
}

// Run
const files = walkDir(DASHBOARD_DIR);
let totalReplacements = 0;
const modifiedFiles = [];

for (const f of files) {
  const count = processFile(f);
  if (count > 0) {
    totalReplacements += count;
    modifiedFiles.push({ file: f.replace(process.cwd() + '\\', '').replace(/\\/g, '/'), count });
  }
}

console.log(`\nGlass consolidation Phase 2 complete:`);
console.log(`  ${totalReplacements} inline styles replaced across ${modifiedFiles.length} files\n`);
modifiedFiles.sort((a, b) => b.count - a.count);
for (const { file, count } of modifiedFiles) {
  console.log(`  ${count.toString().padStart(3)} │ ${file}`);
}

// Check remaining
let remaining = 0;
for (const f of files) {
  const c = readFileSync(f, 'utf-8');
  const m = c.match(/saturate\(1\.8\)/g);
  if (m) remaining += m.length;
}
if (remaining > 0) {
  console.log(`\n  ⚠ ${remaining} instances remain (multi-line or complex patterns)`);
}
