#!/usr/bin/env node
/**
 * Second-pass script for pages that failed the depth-counting approach.
 * Strategy: find the LAST </div> before `  );` at end-of-file.
 * This is robust against <div> appearing in string literals.
 */

import { readFileSync, writeFileSync } from "fs";

const MOTION_IMPORT = `import { MotionPage } from "@/components/motion/motion-page";`;

// Pages that failed or couldn't be handled (NO DIV with motion.div, NO CLOSE)
const failedPages = [
  "C:/Claude/shortstack-merge/src/app/dashboard/activity-log/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/ads/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/client-health/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/competitive-monitor/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/crm/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/design/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/dm-controller/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/eleven-agents/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/financials/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/invoices/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/onboard/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/outreach-logs/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/phone-email/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/portal/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/sequences/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/sms-templates/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/social-manager/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/team/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/trinity/page.tsx",
];

// Pages with motion.div already at top level (wrap with MotionPage around motion.div is redundant)
// Also pages where first element is non-div component
const noDivPages = [
  // motion.div - already has animation, skip
  // "automate", "connect", "create", "custom-dashboard", "lead-sources", "sales", "thumbnail-generator", "visual"
  // Other components - wrap with MotionPage
  "C:/Claude/shortstack-merge/src/app/dashboard/carousel-generator/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/forecast/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/integrations-hub/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/manage/page.tsx",
  "C:/Claude/shortstack-merge/src/app/dashboard/workflow-builder/page.tsx",
];

let modified = 0;
const errors = [];

function processFile(filePath, strategy = "end-pattern") {
  try {
    const raw = readFileSync(filePath, "utf8");

    if (raw.includes("motion-page") || raw.includes("MotionPage")) {
      console.log(`  [SKIP]    ${filePath.split("dashboard/")[1]} (already has MotionPage)`);
      return;
    }

    // Normalize line endings
    const content = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = content.split("\n");

    // Find last import line
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImportIdx = i;
    }
    if (lastImportIdx === -1) {
      console.log(`  [NO IMPORT] ${filePath.split("dashboard/")[1]}`);
      errors.push(filePath);
      return;
    }

    // Find the main component return ( - try multiple indent patterns
    let returnLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^  return \($/.test(lines[i]) || /^return \($/.test(lines[i])) {
        returnLineIdx = i;
        // Don't break - keep the LAST top-level return (the main component one)
        // Actually we want the FIRST one that has a div after it
        const nextLine = lines[i + 1];
        if (nextLine && /<div[\s>]/.test(nextLine)) {
          break; // This is the right one
        }
      }
    }

    if (returnLineIdx === -1) {
      console.log(`  [NO RETURN] ${filePath.split("dashboard/")[1]}`);
      errors.push(filePath);
      return;
    }

    const wrapperLineIdx = returnLineIdx + 1;
    const wrapperLine = lines[wrapperLineIdx];

    if (!/<div[\s>]/.test(wrapperLine)) {
      // For non-div wrappers: wrap the entire return content
      // Find `  );` followed by `}` at end of function
      // Strategy: find the last `  );` before the final `}` in the file
      let closingParenIdx = -1;
      for (let i = lines.length - 1; i >= returnLineIdx; i--) {
        if (/^\s+\);$/.test(lines[i]) || /^\);$/.test(lines[i])) {
          closingParenIdx = i;
          break;
        }
      }

      if (closingParenIdx === -1) {
        console.log(`  [NO CLOSE-PAREN] ${filePath.split("dashboard/")[1]}`);
        errors.push(filePath);
        return;
      }

      // Insert MotionPage around the entire return content
      const newLines = [...lines];
      newLines.splice(lastImportIdx + 1, 0, MOTION_IMPORT);

      const adjWrapper = wrapperLineIdx + 1;
      const adjClosingParen = closingParenIdx + 1;

      // Insert </MotionPage> just before );
      newLines.splice(adjClosingParen, 0, "    </MotionPage>");
      // Insert <MotionPage> just after return (
      newLines.splice(adjWrapper, 0, "    <MotionPage>");

      const newContent = newLines.join("\n");
      writeFileSync(filePath, newContent, "utf8");
      modified++;
      console.log(`  [OK-WRAP]  ${filePath.split("dashboard/")[1]}`);
      return;
    }

    // END-PATTERN strategy: find the last `</div>` that precedes `  );` + `}`
    // Scan backward from the end
    let closingLineIdx = -1;

    // Find the line with `  );` (closing the return)
    let returnCloseIdx = -1;
    for (let i = lines.length - 1; i >= returnLineIdx; i--) {
      if (/^  \);$/.test(lines[i]) || /^\);$/.test(lines[i])) {
        returnCloseIdx = i;
        break;
      }
    }

    if (returnCloseIdx === -1) {
      console.log(`  [NO RETURN-CLOSE] ${filePath.split("dashboard/")[1]}`);
      errors.push(filePath);
      return;
    }

    // The line just before `  );` should be (or near) the closing div
    for (let i = returnCloseIdx - 1; i >= wrapperLineIdx; i--) {
      if (lines[i].includes("</div>")) {
        closingLineIdx = i;
        break;
      }
    }

    if (closingLineIdx === -1) {
      console.log(`  [NO CLOSE-DIV] ${filePath.split("dashboard/")[1]}`);
      errors.push(filePath);
      return;
    }

    // Apply the transformation
    const newLines = [...lines];
    newLines.splice(lastImportIdx + 1, 0, MOTION_IMPORT);

    const adjWrapper = wrapperLineIdx + 1;
    const adjClosing = closingLineIdx + 1;

    // Replace wrapper div -> MotionPage
    newLines[adjWrapper] = newLines[adjWrapper]
      .replace(/(<\s*)div(\s)/, "$1MotionPage$2")
      .replace(/(<\s*)div(>)/, "$1MotionPage$2");

    // Replace closing div -> MotionPage
    newLines[adjClosing] = newLines[adjClosing].replace("</div>", "</MotionPage>");

    const newContent = newLines.join("\n");
    if (!newContent.includes("MotionPage")) {
      console.log(`  [TRANSFORM-FAIL] ${filePath.split("dashboard/")[1]}`);
      errors.push(filePath);
      return;
    }

    writeFileSync(filePath, newContent, "utf8");
    modified++;
    console.log(`  [OK]       ${filePath.split("dashboard/")[1]}`);
  } catch (err) {
    console.error(`  [ERROR]    ${filePath}: ${err.message}`);
    errors.push(filePath);
  }
}

console.log("=== Processing failed pages (end-pattern strategy) ===");
for (const fp of failedPages) {
  processFile(fp, "end-pattern");
}

console.log("\n=== Processing no-div pages (component wrap) ===");
for (const fp of noDivPages) {
  processFile(fp, "wrap");
}

console.log("\n=== SUMMARY ===");
console.log(`Modified: ${modified}`);
console.log(`Errors:   ${errors.length}`);
if (errors.length > 0) {
  errors.forEach((f) => console.log("  " + f));
}
