#!/usr/bin/env node
/**
 * V3: Finds the DEFAULT EXPORT component's return statement (not sub-components).
 * Uses "find export default → find its return → insert wrap" approach.
 */

import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";

const DASHBOARD_DIR = "C:/Claude/shortstack-merge/src/app/dashboard";
const MOTION_IMPORT = `import { MotionPage } from "@/components/motion/motion-page";`;

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
    const raw = readFileSync(filePath, "utf8");

    if (raw.includes("motion-page") || raw.includes("MotionPage")) {
      skipped++;
      continue;
    }

    const content = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = content.split("\n");

    // Strategy: Find the export default component, then its return (
    // Pattern 1: export default function Foo() {
    // Pattern 2: const Foo = () => {  ...  export default Foo;
    // Pattern 3: export default function() {

    // Find export default declaration line
    let exportDefaultLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^export default function\s/.test(lines[i]) ||
          /^export default function\s*\(/.test(lines[i]) ||
          /^export default \(/.test(lines[i])) {
        exportDefaultLineIdx = i;
        break;
      }
    }

    // If no export default function, look for: function Foo() { ... } + export default Foo
    // In this case, find the last function definition before EOF
    if (exportDefaultLineIdx === -1) {
      // Find any exported function that is a component (has return with JSX)
      // Heuristic: look for the LAST top-level function or const that returns JSX
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/^(export default )?function\s+[A-Z]/.test(lines[i]) ||
            /^(export default )?const\s+[A-Z][A-Za-z]+\s*=\s*(\(\)|.*=>)/.test(lines[i])) {
          exportDefaultLineIdx = i;
          break;
        }
      }
    }

    if (exportDefaultLineIdx === -1) {
      noWrapper++;
      console.log(`  [NO EXPORT] ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
      continue;
    }

    // From export default, find the FIRST `  return (` that follows
    let returnLineIdx = -1;
    for (let i = exportDefaultLineIdx; i < lines.length; i++) {
      if (/^\s+return \($/.test(lines[i]) || /^return \($/.test(lines[i])) {
        returnLineIdx = i;
        break;
      }
    }

    if (returnLineIdx === -1) {
      noWrapper++;
      console.log(`  [NO RETURN] ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
      continue;
    }

    const wrapperLineIdx = returnLineIdx + 1;
    const wrapperLine = lines[wrapperLineIdx];

    // Find last module-level import (not inside a function)
    // Module-level imports are at line indent 0 starting with "import"
    let lastImportIdx = -1;
    for (let i = 0; i < exportDefaultLineIdx; i++) {
      if (/^import\s/.test(lines[i])) lastImportIdx = i;
    }

    if (lastImportIdx === -1) {
      console.log(`  [NO IMPORT] ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
      errors.push(filePath);
      continue;
    }

    // Find the matching closing ); for the return
    // Strategy: find the ); that closes this specific return - scan backward from end of function
    // The function's closing brace } is at indent 0
    let functionEndIdx = -1;
    for (let i = lines.length - 1; i >= returnLineIdx; i--) {
      if (/^}$/.test(lines[i])) {
        functionEndIdx = i;
        break;
      }
    }

    if (functionEndIdx === -1) {
      console.log(`  [NO FUNC-END] ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
      errors.push(filePath);
      continue;
    }

    // Find `  );` just before functionEndIdx
    let returnCloseIdx = -1;
    for (let i = functionEndIdx - 1; i >= returnLineIdx; i--) {
      const trimmed = lines[i].trim();
      if (trimmed === ");") {
        returnCloseIdx = i;
        break;
      }
    }

    if (returnCloseIdx === -1) {
      console.log(`  [NO RETURN-CLOSE] ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
      errors.push(filePath);
      continue;
    }

    // Insert wrap strategy:
    // Option A: If wrapperLine is a <div className="...">, replace it and find its close
    // Option B: Insert <MotionPage> after return ( and </MotionPage> before );

    // Use Option B for simplicity and robustness
    const newLines = [...lines];

    // 1. Add import after last module-level import
    newLines.splice(lastImportIdx + 1, 0, MOTION_IMPORT);

    // Recalculate indices after splice
    const adjReturnLine = returnLineIdx + 1;
    const adjWrapperLine = wrapperLineIdx + 1;
    const adjReturnClose = returnCloseIdx + 1;

    // 2. Check if wrapper line already has proper indentation matching for MotionPage replacement
    const wl = newLines[adjWrapperLine];
    if (/<div[\s>]/.test(wl) && !wl.includes("style=")) {
      // Option A: try to replace the div
      // Get indent of wrapper line
      const indent = wl.match(/^(\s*)/)[1];

      // Find the closing div by scanning backward from returnCloseIdx
      let closingDivIdx = -1;
      for (let i = adjReturnClose - 1; i >= adjWrapperLine; i--) {
        const cl = newLines[i];
        // The closing div should have the same indent as the wrapper div
        if (cl.startsWith(indent + "</div>")) {
          closingDivIdx = i;
          break;
        }
      }

      if (closingDivIdx !== -1) {
        // Replace wrapper div -> MotionPage
        newLines[adjWrapperLine] = wl
          .replace(/(<\s*)div(\s)/, "$1MotionPage$2")
          .replace(/(<\s*)div(>)/, "$1MotionPage$2");

        // Replace closing div -> MotionPage
        newLines[closingDivIdx] = newLines[closingDivIdx].replace("</div>", "</MotionPage>");

        const newContent = newLines.join("\n");
        if (newContent.includes("MotionPage")) {
          writeFileSync(filePath, newContent, "utf8");
          modified++;
          console.log(`  [OK-A]     ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
          continue;
        }
        // Fall through to Option B if this didn't work
        // Revert newLines changes
        newLines[adjWrapperLine] = wl;
        newLines[closingDivIdx] = lines[closingDivIdx]; // Revert close too
      }
    }

    // Option B: Insert <MotionPage> before first child and </MotionPage> before );
    // Get indent of the first child line
    const childIndent = newLines[adjWrapperLine].match(/^(\s*)/)[1];
    const mpIndent = childIndent.slice(0, Math.max(0, childIndent.length - 2)) || "    ";

    newLines.splice(adjWrapperLine, 0, `${mpIndent}<MotionPage>`);

    // Now the close needs to be at adjReturnClose + 1 (shifted by the insert)
    const adjReturnClose2 = adjReturnClose + 1;
    newLines.splice(adjReturnClose2, 0, `${mpIndent}</MotionPage>`);

    const newContent = newLines.join("\n");
    if (!newContent.includes("MotionPage")) {
      console.log(`  [TRANSFORM-FAIL] ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
      errors.push(filePath);
      continue;
    }

    writeFileSync(filePath, newContent, "utf8");
    modified++;
    console.log(`  [OK-B]     ${filePath.replace(DASHBOARD_DIR + "/", "")}`);
  } catch (err) {
    console.error(`  [ERROR]    ${filePath}: ${err.message}`);
    errors.push(filePath);
  }
}

console.log("\n=== SUMMARY ===");
console.log(`Modified:    ${modified}`);
console.log(`Skipped:     ${skipped} (already had MotionPage)`);
console.log(`No wrapper:  ${noWrapper}`);
console.log(`Errors:      ${errors.length}`);
if (errors.length > 0) {
  console.log("\nFailed:");
  errors.forEach((f) => console.log("  " + f));
}
