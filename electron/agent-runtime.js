/**
 * ShortStack Agent Runtime — Sandboxed local execution engine
 * Runs tool calls from the AI agent within safe boundaries.
 */

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const WORKSPACE = path.join(os.homedir(), "ShortStack-Agent");

// Commands that are never allowed
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+[\/\\]/i,
  /del\s+\/s\s+\/q\s+[cC]:\\/i,
  /format\s+[a-zA-Z]:/i,
  /shutdown/i,
  /restart\s+\/r/i,
  /reg\s+delete/i,
  /net\s+user/i,
  /powershell.*-enc/i,
  /curl.*\|\s*(bash|sh|cmd)/i,
];

function ensureWorkspace() {
  if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true });
}

function isPathSafe(filePath) {
  const resolved = path.resolve(WORKSPACE, filePath);
  return resolved.startsWith(WORKSPACE);
}

async function runCommand(command, cwd) {
  ensureWorkspace();
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { success: false, error: "Blocked by safety policy." };
    }
  }

  const workDir = cwd && isPathSafe(cwd) ? path.resolve(WORKSPACE, cwd) : WORKSPACE;

  return new Promise((resolve) => {
    exec(command, {
      cwd: workDir,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      shell: true,
    }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: (stdout || "").slice(0, 10000),
        stderr: (stderr || "").slice(0, 5000),
        error: error ? error.message : undefined,
      });
    });
  });
}

function readFile(filePath) {
  try {
    const resolved = path.resolve(WORKSPACE, filePath);
    if (!resolved.startsWith(WORKSPACE)) return { success: false, error: "Outside workspace." };
    if (!fs.existsSync(resolved)) return { success: false, error: "File not found." };
    const stat = fs.statSync(resolved);
    if (stat.size > 1024 * 1024) return { success: false, error: "File too large (>1MB)." };
    return { success: true, content: fs.readFileSync(resolved, "utf8") };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function writeFile(filePath, content) {
  try {
    const resolved = path.resolve(WORKSPACE, filePath);
    if (!resolved.startsWith(WORKSPACE)) return { success: false, error: "Outside workspace." };
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, content, "utf8");
    return { success: true, path: resolved };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function listDirectory(dirPath) {
  try {
    const resolved = path.resolve(WORKSPACE, dirPath || ".");
    if (!resolved.startsWith(WORKSPACE)) return { success: false, error: "Outside workspace." };
    if (!fs.existsSync(resolved)) return { success: false, error: "Directory not found." };
    const items = fs.readdirSync(resolved, { withFileTypes: true });
    return {
      success: true,
      items: items.map((i) => ({
        name: i.name,
        type: i.isDirectory() ? "directory" : "file",
      })),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function executeTool(name, input) {
  ensureWorkspace();
  switch (name) {
    case "run_command":
      return runCommand(input.command, input.cwd);
    case "read_file":
      return readFile(input.path);
    case "write_file":
      return writeFile(input.path, input.content);
    case "list_directory":
      return listDirectory(input.path);
    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

module.exports = { executeTool, WORKSPACE, ensureWorkspace };
