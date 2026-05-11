#!/usr/bin/env node
/**
 * Batch add MotionPage wrapper to all dashboard pages that are missing it.
 */

import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";

const DASHBOARD_DIR = "C:/Claude/shortstack-merge/src/app/dashboard";
const MOTION_IMPORT = `import { MotionPage } from "@/components/motion/motion-page";`;

// Get all page.tsx paths via find
// Convert POSIX paths (/c/Claude/...) to Windows paths (C:/Claude/...)
const allPages = execFileSync("find", [DASHBOARD_DIR, "-name", "page.tsx"])
  .toString()
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((p) => p.replace(/^\/([a-z])\//, "$1:/"));

let modified = 0;
let skipped = 0;
let noWrapper = 0;
const errors = [];

for (const filePath of allPages) {
  try {
    const content = readFileSync(filePath, "utf8");

    // Skip if already has MotionPage
    if (content.includes("motion-page") || content.includes("MotionPage")) {
      skipped++;
      continue;
    }

    // Normalize CRLF to LF so regexes work correctly
    const normalizedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalizedContent.split("\n");

    // Find the first top-level return statement (2-space or 0-space indent)
    let returnLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^  return \($/.test(lines[i]) || /^return \($/.test(lines[i])) {
        returnLineIdx = i;
        break;
      }
    }

    if (returnLineIdx === -1) {
      noWrapper++;
      console.log(`  [NO RETURN] ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
      continue;
    }

    // The line after return ( should be <div className= or similar wrapper
    const wrapperLineIdx = returnLineIdx + 1;
    const wrapperLine = lines[wrapperLineIdx];

    // Must be a div (self-contained or with attrs)
    if (!/<div[\s>]/.test(wrapperLine)) {
      noWrapper++;
      console.log(`  [NO DIV]    ${filePath.replace(DASHBOARD_DIR + "/", "")}: "${wrapperLine.trim().substring(0, 70)}"`);
      continue;
    }

    // Find the matching closing </div> using depth counting
    let depth = 0;
    let closingLineIdx = -1;

    for (let i = wrapperLineIdx; i < lines.length; i++) {
      const line = lines[i];
      const opens = (line.match(/<div[\s/>]/g) || []).length;
      // self-closing divs shouldn't exist but handle anyway
      const selfClose = (line.match(/<div[^>]*\/>/g) || []).length;
      const closes = (line.match(/<\/div>/g) || []).length;
      depth += opens - selfClose - closes;

      if (i > wrapperLineIdx && depth === 0) {
        closingLineIdx = i;
        break;
      }
    }

    if (closingLineIdx === -1 || !lines[closingLineIdx].includes("</div>")) {
      console.log(`  [NO CLOSE]  ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
      errors.push(filePath);
      continue;
    }

    // Build new content
    const newLines = [...lines];

    // 1. Find last import line and insert MotionPage import after it
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImportIdx = i;
    }
    if (lastImportIdx === -1) {
      console.log(`  [NO IMPORT] ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
      errors.push(filePath);
      continue;
    }
    newLines.splice(lastImportIdx + 1, 0, MOTION_IMPORT);

    // Adjust indices after splice (+1 for inserted import line)
    const adjWrapper = wrapperLineIdx + 1;
    const adjClosing = closingLineIdx + 1;

    // 2. Replace <div ...> with <MotionPage ...>
    newLines[adjWrapper] = newLines[adjWrapper]
      .replace(/(<\s*)div(\s)/, "$1MotionPage$2")
      .replace(/(<\s*)div(>)/, "$1MotionPage$2");

    // 3. Replace first </div> in closing line with </MotionPage>
    newLines[adjClosing] = newLines[adjClosing].replace("</div>", "</MotionPage>");

    const newContent = newLines.join("\n");

    if (!newContent.includes("MotionPage")) {
      console.log(`  [FAILED]    ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
      errors.push(filePath);
      continue;
    }

    // Write with LF endings (consistent)
    writeFileSync(filePath, newContent, "utf8");
    modified++;
    console.log(`  [OK]        ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
  } catch (err) {
    console.error(`  [ERROR]     ${filePath}: ${err.message}`);
    errors.push(filePath);
  }
}

console.log("\n=== SUMMARY ===");
console.log(`Modified:    ${modified}`);
console.log(`Skipped:     ${skipped} (already had MotionPage)`);
console.log(`No wrapper:  ${noWrapper}`);
console.log(`Errors:      ${errors.length}`);
if (errors.length > 0) {
  console.log("\nFailed files:");
  errors.forEach((f) => console.log("  " + f));
}
