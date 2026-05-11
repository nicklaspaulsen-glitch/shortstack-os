"use strict";
/**
 * AST-based MotionPage sweep using ts-morph.
 * Finds the default export component, gets its return statement,
 * wraps the outermost JSX element with <MotionPage>, adds the import.
 */

const { Project, SyntaxKind } = require("ts-morph");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const DASHBOARD = path.join(ROOT, "src", "app", "dashboard");
const MOTION_IMPORT = '@/components/motion/motion-page';

const project = new Project({
  tsConfigFilePath: path.join(ROOT, "tsconfig.json"),
  skipAddingFilesFromTsConfig: true,
  addFilesFromTsConfig: false,
});

// Find all page.tsx files
function findPages(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findPages(full));
    else if (entry.name === "page.tsx") results.push(full);
  }
  return results;
}

const pages = findPages(DASHBOARD);
let modified = 0;
let skipped = 0;
let failed = [];

for (const filePath of pages) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");

    // Quick skip if already has MotionPage
    if (raw.includes("MotionPage") || raw.includes("motion-page")) {
      skipped++;
      continue;
    }

    const sourceFile = project.addSourceFileAtPath(filePath);

    // 1. Find the default export function/component
    let defaultExport = null;

    // Try: export default function Foo() {}
    const exportedFunctions = sourceFile.getFunctions().filter(f => f.isDefaultExport());
    if (exportedFunctions.length > 0) {
      defaultExport = exportedFunctions[0];
    }

    // Try: export default arrow function / export default class
    if (!defaultExport) {
      const exportAssignments = sourceFile.getExportAssignments();
      for (const ea of exportAssignments) {
        const expr = ea.getExpression();
        if (expr.getKind() === SyntaxKind.Identifier) {
          // export default Foo; - find Foo's declaration
          const name = expr.getText();
          const decl = sourceFile.getFunction(name) || sourceFile.getVariableDeclaration(name);
          if (decl) {
            defaultExport = decl;
            break;
          }
        } else if (
          expr.getKind() === SyntaxKind.ArrowFunction ||
          expr.getKind() === SyntaxKind.FunctionExpression
        ) {
          defaultExport = expr;
          break;
        }
      }
    }

    // Fallback: find the last function in the file that has a return with JSX
    if (!defaultExport) {
      const allFunctions = [
        ...sourceFile.getFunctions(),
        ...sourceFile.getVariableDeclarations()
          .map(v => v.getInitializer())
          .filter(i => i && (i.getKind() === SyntaxKind.ArrowFunction || i.getKind() === SyntaxKind.FunctionExpression))
      ];
      // Take last one that has JSX return
      for (let i = allFunctions.length - 1; i >= 0; i--) {
        const fn = allFunctions[i];
        if (!fn) continue;
        const text = fn.getText();
        if (text.includes("return (") && text.includes("<")) {
          defaultExport = fn;
          break;
        }
      }
    }

    if (!defaultExport) {
      console.log(`  [NO EXPORT] ${filePath.replace(DASHBOARD + path.sep, "")}`);
      project.removeSourceFile(sourceFile);
      failed.push(filePath);
      continue;
    }

    // 2. Find the return statement in the default export
    const bodyNode = defaultExport.getBody ? defaultExport.getBody() : null;
    if (!bodyNode) {
      console.log(`  [NO BODY]   ${filePath.replace(DASHBOARD + path.sep, "")}`);
      project.removeSourceFile(sourceFile);
      failed.push(filePath);
      continue;
    }

    // Find all return statements in the body
    const returnStmts = bodyNode.getDescendantsOfKind(SyntaxKind.ReturnStatement);

    // Find the one that returns JSX (has a JsxElement or JsxFragment as the expression)
    let mainReturn = null;
    for (const ret of returnStmts) {
      const expr = ret.getExpression();
      if (!expr) continue;
      const kind = expr.getKind();
      if (
        kind === SyntaxKind.JsxElement ||
        kind === SyntaxKind.JsxSelfClosingElement ||
        kind === SyntaxKind.JsxFragment ||
        kind === SyntaxKind.ParenthesizedExpression
      ) {
        // For parenthesized, check inner
        if (kind === SyntaxKind.ParenthesizedExpression) {
          const inner = expr.getExpression();
          const innerKind = inner.getKind();
          if (
            innerKind === SyntaxKind.JsxElement ||
            innerKind === SyntaxKind.JsxSelfClosingElement ||
            innerKind === SyntaxKind.JsxFragment
          ) {
            mainReturn = ret;
          }
        } else {
          mainReturn = ret;
        }
        if (mainReturn) break; // take the first JSX return (the main one)
      }
    }

    // If first return didn't work, take last one
    if (!mainReturn) {
      for (let i = returnStmts.length - 1; i >= 0; i--) {
        const ret = returnStmts[i];
        const expr = ret.getExpression();
        if (expr && expr.getText().trim().startsWith("<")) {
          mainReturn = ret;
          break;
        }
      }
    }

    if (!mainReturn) {
      console.log(`  [NO JSX-RET]${filePath.replace(DASHBOARD + path.sep, "")}`);
      project.removeSourceFile(sourceFile);
      failed.push(filePath);
      continue;
    }

    // 3. Get the JSX root element from the return
    let returnExpr = mainReturn.getExpression();
    if (returnExpr.getKind() === SyntaxKind.ParenthesizedExpression) {
      returnExpr = returnExpr.getExpression();
    }

    const jsxKind = returnExpr.getKind();
    if (
      jsxKind !== SyntaxKind.JsxElement &&
      jsxKind !== SyntaxKind.JsxFragment &&
      jsxKind !== SyntaxKind.JsxSelfClosingElement
    ) {
      console.log(`  [NOT JSX]   ${filePath.replace(DASHBOARD + path.sep, "")}: ${SyntaxKind[jsxKind]}`);
      project.removeSourceFile(sourceFile);
      failed.push(filePath);
      continue;
    }

    // 4. Check if the outermost element is already MotionPage or motion.div
    let outerTagName = "";
    if (jsxKind === SyntaxKind.JsxElement) {
      outerTagName = returnExpr.getOpeningElement().getTagNameNode().getText();
    } else if (jsxKind === SyntaxKind.JsxSelfClosingElement) {
      outerTagName = returnExpr.getTagNameNode().getText();
    }

    if (outerTagName === "MotionPage") {
      skipped++;
      project.removeSourceFile(sourceFile);
      continue;
    }

    // 5. Wrap the return JSX in <MotionPage>...</MotionPage>
    const originalJsx = returnExpr.getText();
    // Get the indentation of the return expression
    const retPos = returnExpr.getStart();
    const retLine = sourceFile.getLineAndColumnAtPos(retPos);
    const col = retLine.column - 1; // 0-indexed
    const indent = " ".repeat(col);

    // Determine className from outer div if it has one
    let classNameProp = "";
    if (jsxKind === SyntaxKind.JsxElement) {
      const openEl = returnExpr.getOpeningElement();
      const classAttr = openEl.getAttribute("className");
      if (classAttr && outerTagName === "div") {
        classNameProp = ` className={${classAttr.getInitializer().getText()}}`;
      }
    }

    // Replace the outer element:
    // If it's a <div className="...">, replace with <MotionPage className="...">
    // Otherwise, wrap with <MotionPage>...</MotionPage>
    let newJsx;
    if (outerTagName === "div" && jsxKind === SyntaxKind.JsxElement) {
      const openEl = returnExpr.getOpeningElement();
      const closeEl = returnExpr.getClosingElement();
      const openText = openEl.getText();
      const closeText = closeEl.getText();
      const children = returnExpr.getJsxChildren().map(c => c.getText()).join("");

      // Replace <div with <MotionPage and </div> with </MotionPage>
      const newOpen = openText.replace(/^<div\b/, "<MotionPage");
      const newClose = closeText.replace(/^<\/div>$/, "</MotionPage>");
      newJsx = `${newOpen}${children}${newClose}`;
    } else {
      // Wrap with MotionPage
      newJsx = `<MotionPage>\n${indent}  ${originalJsx}\n${indent}</MotionPage>`;
    }

    returnExpr.replaceWithText(newJsx);

    // 6. Add the import
    const existingImport = sourceFile.getImportDeclaration(
      (i) => i.getModuleSpecifierValue() === MOTION_IMPORT
    );
    if (!existingImport) {
      sourceFile.addImportDeclaration({
        namedImports: ["MotionPage"],
        moduleSpecifier: MOTION_IMPORT,
      });
    }

    // 7. Save
    sourceFile.saveSync();
    modified++;
    console.log(`  [OK]        ${filePath.replace(DASHBOARD + path.sep, "")}`);
    project.removeSourceFile(sourceFile);
  } catch (err) {
    console.error(`  [ERROR]     ${filePath.replace(DASHBOARD + path.sep, "")}: ${err.message}`);
    failed.push(filePath);
    try { project.removeSourceFile(project.getSourceFile(filePath)); } catch {}
  }
}

console.log("\n=== SUMMARY ===");
console.log(`Modified:    ${modified}`);
console.log(`Skipped:     ${skipped}`);
console.log(`Failed:      ${failed.length}`);
if (failed.length > 0) {
  console.log("\nFailed:");
  failed.forEach(f => console.log("  " + f.replace(DASHBOARD + path.sep, "")));
}
