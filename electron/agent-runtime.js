/**
 * ShortStack Agent Runtime — Sandboxed local execution engine
 * Runs tool calls from the AI agent within safe boundaries.
 *
 * Tools:
 *   [Core]       run_command, read_file, write_file, list_directory
 *   [Files]      search_files, analyze_file, move_file, copy_file, delete_file
 *   [Projects]   create_project
 *   [System]     get_system_info, open_file
 *   [Network]    download_file
 *   [Archive]    zip_folder
 */

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const http = require("http");
const zlib = require("zlib");

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

// ---------------------------------------------------------------------------
//  CORE TOOLS (original 4)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
//  NEW TOOL 1 — search_files
//  Recursive search for files by name pattern (glob-like) within workspace.
// ---------------------------------------------------------------------------

function searchFiles(pattern, searchDir) {
  try {
    const baseDir = searchDir
      ? path.resolve(WORKSPACE, searchDir)
      : WORKSPACE;
    if (!baseDir.startsWith(WORKSPACE)) {
      return { success: false, error: "Outside workspace." };
    }
    if (!fs.existsSync(baseDir)) {
      return { success: false, error: "Directory not found." };
    }

    // Convert simple glob pattern to regex:
    //   *  -> [^/\\]*
    //   ?  -> .
    //   ** -> .*
    // Escape everything else that is regex-special.
    const regexStr = pattern
      .replace(/([.+^${}()|[\]\\])/g, "\\$1")  // escape specials except * and ?
      .replace(/\*\*/g, "⚬DOUBLESTAR⚬")
      .replace(/\*/g, "[^/\\\\]*")
      .replace(/\?/g, ".")
      .replace(/⚬DOUBLESTAR⚬/g, ".*");
    const regex = new RegExp("^" + regexStr + "$", "i");

    const results = [];
    const MAX_RESULTS = 500;

    function walk(dir) {
      if (results.length >= MAX_RESULTS) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return; // skip unreadable dirs
      }
      for (const entry of entries) {
        if (results.length >= MAX_RESULTS) return;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip node_modules / .git for performance
          if (entry.name === "node_modules" || entry.name === ".git") continue;
          walk(fullPath);
        }
        if (regex.test(entry.name)) {
          results.push(path.relative(WORKSPACE, fullPath).replace(/\\/g, "/"));
        }
      }
    }

    walk(baseDir);
    return { success: true, matches: results, total: results.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
//  NEW TOOL 2 — analyze_file
//  Return metadata: size, type, dates, extension, line count, image dims.
// ---------------------------------------------------------------------------

function analyzeFile(filePath) {
  try {
    const resolved = path.resolve(WORKSPACE, filePath);
    if (!resolved.startsWith(WORKSPACE)) return { success: false, error: "Outside workspace." };
    if (!fs.existsSync(resolved)) return { success: false, error: "File not found." };

    const stat = fs.statSync(resolved);
    const ext = path.extname(resolved).toLowerCase();

    const info = {
      success: true,
      name: path.basename(resolved),
      path: path.relative(WORKSPACE, resolved).replace(/\\/g, "/"),
      extension: ext,
      sizeBytes: stat.size,
      sizeHuman: humanSize(stat.size),
      isDirectory: stat.isDirectory(),
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
    };

    // Guess MIME-ish type from extension
    const TEXT_EXTS = new Set([
      ".txt", ".md", ".html", ".htm", ".css", ".js", ".ts", ".jsx", ".tsx",
      ".json", ".xml", ".yaml", ".yml", ".csv", ".svg", ".sh", ".bat",
      ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".env",
      ".toml", ".ini", ".cfg", ".log", ".gitignore",
    ]);
    const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".ico", ".tiff"]);
    const VIDEO_EXTS = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm"]);
    const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"]);

    if (stat.isDirectory()) {
      info.type = "directory";
      try {
        info.childCount = fs.readdirSync(resolved).length;
      } catch { /* ignore */ }
    } else if (TEXT_EXTS.has(ext)) {
      info.type = "text";
      if (stat.size <= 2 * 1024 * 1024) {
        const content = fs.readFileSync(resolved, "utf8");
        info.lineCount = content.split("\n").length;
        info.charCount = content.length;
      }
    } else if (IMAGE_EXTS.has(ext)) {
      info.type = "image";
      // Try to read dimensions from the first bytes
      const dims = getImageDimensions(resolved, ext);
      if (dims) {
        info.width = dims.width;
        info.height = dims.height;
      }
    } else if (VIDEO_EXTS.has(ext)) {
      info.type = "video";
    } else if (AUDIO_EXTS.has(ext)) {
      info.type = "audio";
    } else {
      info.type = "binary";
    }

    return info;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

/** Minimal image dimension reader for PNG and JPEG using raw bytes. */
function getImageDimensions(filePath, ext) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4096);
    fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);

    if (ext === ".png") {
      // PNG: width at offset 16 (4 bytes BE), height at 20
      if (buf[0] === 0x89 && buf[1] === 0x50) {
        return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
      }
    }

    if (ext === ".jpg" || ext === ".jpeg") {
      // JPEG: scan for SOF0 (0xFF 0xC0) marker
      let offset = 2;
      while (offset < buf.length - 8) {
        if (buf[offset] === 0xff) {
          const marker = buf[offset + 1];
          if (marker >= 0xc0 && marker <= 0xc3) {
            const height = buf.readUInt16BE(offset + 5);
            const width = buf.readUInt16BE(offset + 7);
            return { width, height };
          }
          const segLen = buf.readUInt16BE(offset + 2);
          offset += 2 + segLen;
        } else {
          offset++;
        }
      }
    }

    if (ext === ".gif") {
      // GIF: width at 6 (LE 16), height at 8
      if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
        return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
      }
    }

    if (ext === ".bmp") {
      // BMP: width at 18 (LE 32), height at 22
      if (buf[0] === 0x42 && buf[1] === 0x4d) {
        return { width: buf.readUInt32LE(18), height: Math.abs(buf.readInt32LE(22)) };
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
//  NEW TOOL 3 — move_file
//  Move / rename a file or folder within the workspace.
// ---------------------------------------------------------------------------

function moveFile(srcPath, destPath) {
  try {
    const resolvedSrc = path.resolve(WORKSPACE, srcPath);
    const resolvedDest = path.resolve(WORKSPACE, destPath);
    if (!resolvedSrc.startsWith(WORKSPACE)) return { success: false, error: "Source outside workspace." };
    if (!resolvedDest.startsWith(WORKSPACE)) return { success: false, error: "Destination outside workspace." };
    if (!fs.existsSync(resolvedSrc)) return { success: false, error: "Source not found." };

    const destDir = path.dirname(resolvedDest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.renameSync(resolvedSrc, resolvedDest);

    return {
      success: true,
      from: path.relative(WORKSPACE, resolvedSrc).replace(/\\/g, "/"),
      to: path.relative(WORKSPACE, resolvedDest).replace(/\\/g, "/"),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
//  NEW TOOL 4 — copy_file
//  Copy a file within the workspace.
// ---------------------------------------------------------------------------

function copyFile(srcPath, destPath) {
  try {
    const resolvedSrc = path.resolve(WORKSPACE, srcPath);
    const resolvedDest = path.resolve(WORKSPACE, destPath);
    if (!resolvedSrc.startsWith(WORKSPACE)) return { success: false, error: "Source outside workspace." };
    if (!resolvedDest.startsWith(WORKSPACE)) return { success: false, error: "Destination outside workspace." };
    if (!fs.existsSync(resolvedSrc)) return { success: false, error: "Source not found." };

    const destDir = path.dirname(resolvedDest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const stat = fs.statSync(resolvedSrc);
    if (stat.isDirectory()) {
      copyDirRecursive(resolvedSrc, resolvedDest);
    } else {
      fs.copyFileSync(resolvedSrc, resolvedDest);
    }

    return {
      success: true,
      from: path.relative(WORKSPACE, resolvedSrc).replace(/\\/g, "/"),
      to: path.relative(WORKSPACE, resolvedDest).replace(/\\/g, "/"),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcEntry = path.join(src, entry.name);
    const destEntry = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcEntry, destEntry);
    } else {
      fs.copyFileSync(srcEntry, destEntry);
    }
  }
}

// ---------------------------------------------------------------------------
//  NEW TOOL 5 — delete_file
//  Delete a file or folder with safety checks.
// ---------------------------------------------------------------------------

function deleteFile(filePath) {
  try {
    const resolved = path.resolve(WORKSPACE, filePath);
    if (!resolved.startsWith(WORKSPACE)) return { success: false, error: "Outside workspace." };
    // Never delete the workspace root itself
    if (resolved === WORKSPACE) return { success: false, error: "Cannot delete workspace root." };
    if (!fs.existsSync(resolved)) return { success: false, error: "File not found." };

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      fs.rmSync(resolved, { recursive: true, force: true });
    } else {
      fs.unlinkSync(resolved);
    }

    return {
      success: true,
      deleted: path.relative(WORKSPACE, resolved).replace(/\\/g, "/"),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
//  NEW TOOL 6 — create_project
//  Scaffold a project from templates.
// ---------------------------------------------------------------------------

const PROJECT_TEMPLATES = {
  "website": {
    dirs: ["assets"],
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Website</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <nav>
      <a href="/" class="logo">Brand</a>
      <ul>
        <li><a href="#about">About</a></li>
        <li><a href="#work">Work</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <section id="hero">
      <h1>Welcome to My Website</h1>
      <p>A clean starting point for your next web project.</p>
      <a href="#contact" class="btn">Get in Touch</a>
    </section>

    <section id="about">
      <h2>About</h2>
      <p>Tell your story here.</p>
    </section>

    <section id="work">
      <h2>Work</h2>
      <p>Showcase your projects or portfolio.</p>
    </section>

    <section id="contact">
      <h2>Contact</h2>
      <p>Reach out at hello@example.com</p>
    </section>
  </main>

  <footer>
    <p>&copy; ${new Date().getFullYear()} Brand. All rights reserved.</p>
  </footer>

  <script src="script.js"></script>
</body>
</html>`,

      "styles.css": `/* ========================================
   Base Styles
   ======================================== */

*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --color-primary: #6C63FF;
  --color-dark: #1a1a2e;
  --color-light: #f5f5f5;
  --color-text: #333;
  --font-main: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

body {
  font-family: var(--font-main);
  color: var(--color-text);
  line-height: 1.6;
}

header nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: var(--color-dark);
  color: #fff;
}

header nav ul {
  display: flex;
  list-style: none;
  gap: 1.5rem;
}

header nav a {
  color: #fff;
  text-decoration: none;
}

section {
  padding: 4rem 2rem;
  max-width: 960px;
  margin: 0 auto;
}

#hero {
  text-align: center;
  padding: 6rem 2rem;
}

#hero h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: #fff;
  border-radius: 6px;
  text-decoration: none;
  margin-top: 1rem;
}

footer {
  text-align: center;
  padding: 2rem;
  background: var(--color-dark);
  color: #fff;
}
`,

      "script.js": `// ========================================
// Main Script
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('Site loaded successfully.');

  // Smooth-scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
`,
    },
  },

  "social-campaign": {
    dirs: ["captions", "images"],
    files: {
      "brief.md": `# Social Media Campaign Brief

## Campaign Name
[Your Campaign Name]

## Objective
What is the goal? (awareness, engagement, conversions, traffic)

## Target Audience
- **Age:**
- **Interests:**
- **Platforms:** Instagram, TikTok, LinkedIn, Twitter

## Key Messages
1.
2.
3.

## Tone & Voice
Describe the brand voice: (casual, professional, witty, inspirational)

## Content Pillars
- [ ] Educational
- [ ] Entertaining
- [ ] Behind-the-scenes
- [ ] User-generated content
- [ ] Promotional

## Deliverables
- [ ] X carousel posts
- [ ] X reels / short videos
- [ ] X stories
- [ ] X static posts

## Timeline
| Phase       | Dates          | Focus           |
|-------------|----------------|-----------------|
| Pre-launch  |                | Teasers, hype   |
| Launch      |                | Core content    |
| Sustain     |                | Engagement, UGC |

## Budget
| Item              | Amount |
|-------------------|--------|
| Paid ads          |        |
| Influencer fees   |        |
| Creative assets   |        |
| **Total**         |        |

## Success Metrics
- Impressions target:
- Engagement rate target:
- Conversions target:
`,

      "hashtags.txt": `# Hashtag Sets — Mix and match per post
# ============================================

# Primary (always use 2-3 of these)


# Secondary (rotate these)


# Trending / Timely


# Community / Niche


# Branded


# Tips:
# - Instagram: 20-30 hashtags, mix sizes
# - TikTok: 3-5 targeted hashtags
# - Twitter: 1-3 hashtags max
# - LinkedIn: 3-5 professional hashtags
`,

      "schedule.md": `# Posting Schedule

## Week 1

| Day       | Platform   | Content Type | Caption File         | Status |
|-----------|------------|--------------|----------------------|--------|
| Monday    | Instagram  | Carousel     | captions/mon.md      | [ ]    |
| Tuesday   | TikTok     | Reel         | captions/tue.md      | [ ]    |
| Wednesday | LinkedIn   | Text post    | captions/wed.md      | [ ]    |
| Thursday  | Instagram  | Story        | captions/thu.md      | [ ]    |
| Friday    | TikTok     | Reel         | captions/fri.md      | [ ]    |

## Best Posting Times
- **Instagram:** 11am, 2pm, 7pm
- **TikTok:** 9am, 12pm, 7pm
- **LinkedIn:** 8am, 12pm, 5pm
- **Twitter:** 9am, 12pm, 5pm

## Notes
-
`,
    },
  },

  "brand-kit": {
    dirs: ["logos", "fonts", "templates"],
    files: {
      "brand-guidelines.md": `# Brand Guidelines

## Brand Overview
**Brand Name:**
**Tagline:**
**Mission:**

## Logo Usage
- Minimum clear space: [X]px around logo
- Never stretch, rotate, or recolor the logo
- Place logo files in the \`logos/\` folder

### Logo Versions
| Version           | File              | Usage            |
|-------------------|-------------------|------------------|
| Primary           | logos/primary.svg  | Default use      |
| Secondary         | logos/secondary.svg| Dark backgrounds |
| Icon              | logos/icon.svg     | Favicons, apps   |
| Monochrome        | logos/mono.svg     | Print, overlays  |

## Typography
- **Heading Font:**
- **Body Font:**
- **Accent Font:**
- Place font files in the \`fonts/\` folder

## Photography & Imagery
- Style: (candid, editorial, flat-lay, lifestyle)
- Filters: (warm, cool, high-contrast, muted)
- Avoid:

## Voice & Tone
- **Personality traits:**
- **We are:**
- **We are not:**

## Social Media Templates
Store reusable post templates in the \`templates/\` folder.
`,

      "colors.md": `# Brand Color Palette

## Primary Colors
| Name        | Hex       | RGB              | Usage               |
|-------------|-----------|------------------|----------------------|
| Primary     | #         | rgb(, , )        | Main brand color     |
| Secondary   | #         | rgb(, , )        | Accents, CTAs        |

## Neutral Colors
| Name        | Hex       | RGB              | Usage               |
|-------------|-----------|------------------|----------------------|
| Dark        | #1a1a2e   | rgb(26, 26, 46)  | Text, headings       |
| Medium      | #666666   | rgb(102,102,102) | Body text            |
| Light       | #f5f5f5   | rgb(245,245,245) | Backgrounds          |
| White       | #ffffff   | rgb(255,255,255) | Cards, spacing       |

## Accent / Seasonal
| Name        | Hex       | Usage                         |
|-------------|-----------|-------------------------------|
|             |           |                               |

## Gradients
- Primary gradient: [color1] -> [color2], direction: [deg]

## Accessibility Notes
- Ensure minimum contrast ratio of 4.5:1 for body text
- Test all color combos at https://webaim.org/resources/contrastchecker/
`,
    },
  },

  "content-calendar": {
    dirs: ["scripts", "assets", "published"],
    files: {
      "calendar.md": `# Content Calendar

## This Month: [Month Year]

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1    |     |     |     |     |     |     |     |
| 2    |     |     |     |     |     |     |     |
| 3    |     |     |     |     |     |     |     |
| 4    |     |     |     |     |     |     |     |

## Content Themes
- **Week 1:**
- **Week 2:**
- **Week 3:**
- **Week 4:**

## Platform Breakdown
| Platform   | Posts/Week | Content Types         |
|------------|------------|-----------------------|
| Instagram  |            | Reels, carousels      |
| TikTok     |            | Short-form video      |
| LinkedIn   |            | Articles, text posts  |
| YouTube    |            | Long-form, shorts     |
| Newsletter |            | Weekly digest         |

## Recurring Series
1. **[Series Name]** — Every [day], covers [topic]
2.
3.

## Key Dates & Events
- [ ] [Date] — [Event / Holiday / Launch]
- [ ]
`,

      "ideas.md": `# Content Ideas Backlog

## High Priority
- [ ]
- [ ]
- [ ]

## Medium Priority
- [ ]
- [ ]

## Low Priority / Someday
- [ ]
- [ ]

## Evergreen Topics
Topics we can revisit and repurpose regularly:
1.
2.
3.

## Trending / Timely
Capture trending hooks or news to riff on:
- [ ]

## Content Repurposing Pipeline
| Original Piece  | Repurposed As          | Platform   | Status |
|------------------|------------------------|------------|--------|
|                  | Carousel               | Instagram  | [ ]    |
|                  | Short video            | TikTok     | [ ]    |
|                  | Thread                 | Twitter    | [ ]    |
|                  | Newsletter section     | Email      | [ ]    |
`,
    },
  },

  "email-sequence": {
    dirs: ["emails"],
    files: {
      "sequence-plan.md": `# Email Sequence Plan

## Sequence Name
[Name]

## Goal
What action should the reader take after this sequence?

## Target Audience
Who receives this sequence? (new subscribers, leads, customers)

## Trigger
What starts the sequence? (signup, purchase, tag, date)

## Sequence Overview
| #  | Subject Line Idea      | Goal             | Delay      |
|----|------------------------|------------------|------------|
| 1  | Welcome / Hook         | Build rapport    | Immediate  |
| 2  | Story / Value          | Educate          | +2 days    |
| 3  | Social proof / CTA     | Convert          | +2 days    |

## Sender Details
- **From name:**
- **From email:**
- **Reply-to:**

## Key Metrics to Track
- Open rate (target: >40%)
- Click rate (target: >5%)
- Unsubscribe rate (keep <1%)
- Conversion rate

## A/B Testing Ideas
- Subject line variations
- Send time (morning vs evening)
- CTA button color / text
`,

      "emails/email-1.md": `# Email 1 — Welcome

**Subject:** [Welcome subject line]
**Preview text:** [First 80 chars visible in inbox]
**Send delay:** Immediate after trigger

---

Hi {first_name},

Welcome aboard! We're thrilled to have you.

Here's what you can expect:
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

To get started right away, [primary CTA]:

[**Button: Get Started**](https://example.com)

Talk soon,
[Your Name]

---

**Notes:**
- Goal: Set expectations, deliver first value
- CTA: [describe desired action]
`,

      "emails/email-2.md": `# Email 2 — Value & Story

**Subject:** [Value-driven subject line]
**Preview text:** [First 80 chars visible in inbox]
**Send delay:** +2 days after Email 1

---

Hi {first_name},

[Share a short story or teach something valuable]

Here's one thing that changed everything for us:

> [Insight or quote]

**The takeaway:** [One clear lesson]

Want to see this in action?

[**Button: See How**](https://example.com)

Best,
[Your Name]

---

**Notes:**
- Goal: Build trust, provide value
- CTA: [describe desired action]
`,

      "emails/email-3.md": `# Email 3 — Social Proof & Call to Action

**Subject:** [Urgency or curiosity subject line]
**Preview text:** [First 80 chars visible in inbox]
**Send delay:** +2 days after Email 2

---

Hi {first_name},

Don't just take our word for it:

> "[Testimonial quote]"
> — [Customer Name], [Title/Company]

Here's what [customers/users] are achieving:
- [Result 1]
- [Result 2]
- [Result 3]

Ready to get the same results?

[**Button: Start Now**](https://example.com)

Cheers,
[Your Name]

P.S. [Add urgency or bonus]

---

**Notes:**
- Goal: Overcome objections, convert
- CTA: [describe desired action]
`,
    },
  },
};

function createProject(type, name) {
  try {
    if (!name || !name.trim()) return { success: false, error: "Project name is required." };

    const template = PROJECT_TEMPLATES[type];
    if (!template) {
      return {
        success: false,
        error: `Unknown project type: "${type}". Valid types: ${Object.keys(PROJECT_TEMPLATES).join(", ")}`,
      };
    }

    // Sanitize name for safe folder creation
    const safeName = name.replace(/[<>:"/\\|?*]/g, "-").trim();
    const projectDir = path.resolve(WORKSPACE, safeName);
    if (!projectDir.startsWith(WORKSPACE)) return { success: false, error: "Invalid project name." };

    if (fs.existsSync(projectDir)) {
      return { success: false, error: `Folder "${safeName}" already exists.` };
    }

    // Create root dir
    fs.mkdirSync(projectDir, { recursive: true });

    // Create sub-directories
    for (const dir of template.dirs) {
      fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
    }

    // Create files
    const createdFiles = [];
    for (const [filePath, content] of Object.entries(template.files)) {
      const fullPath = path.join(projectDir, filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content, "utf8");
      createdFiles.push(filePath);
    }

    return {
      success: true,
      project: safeName,
      type,
      path: path.relative(WORKSPACE, projectDir).replace(/\\/g, "/"),
      directories: template.dirs,
      files: createdFiles,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
//  NEW TOOL 7 — get_system_info
//  Return system information so the AI knows the environment.
// ---------------------------------------------------------------------------

function getSystemInfo() {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    // Disk space: try to exec synchronously for the workspace drive
    let diskInfo = null;
    try {
      const { execSync } = require("child_process");
      if (process.platform === "win32") {
        const drive = WORKSPACE.substring(0, 2); // e.g. "C:"
        const raw = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace,Size /format:csv`, {
          timeout: 5000,
          encoding: "utf8",
        });
        const lines = raw.trim().split("\n").filter(l => l.trim());
        if (lines.length >= 2) {
          const parts = lines[lines.length - 1].split(",");
          if (parts.length >= 3) {
            diskInfo = {
              drive,
              freeBytes: parseInt(parts[1]),
              totalBytes: parseInt(parts[2]),
              freeHuman: humanSize(parseInt(parts[1])),
              totalHuman: humanSize(parseInt(parts[2])),
            };
          }
        }
      } else {
        const raw = execSync(`df -B1 "${WORKSPACE}" | tail -1`, { timeout: 5000, encoding: "utf8" });
        const parts = raw.trim().split(/\s+/);
        if (parts.length >= 4) {
          diskInfo = {
            mount: parts[5] || parts[0],
            totalBytes: parseInt(parts[1]),
            freeBytes: parseInt(parts[3]),
            totalHuman: humanSize(parseInt(parts[1])),
            freeHuman: humanSize(parseInt(parts[3])),
          };
        }
      }
    } catch { /* disk info is optional */ }

    return {
      success: true,
      os: {
        platform: process.platform,
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
      },
      user: os.userInfo().username,
      cpu: {
        model: cpus.length > 0 ? cpus[0].model : "unknown",
        cores: cpus.length,
      },
      memory: {
        totalBytes: totalMem,
        freeBytes: freeMem,
        totalHuman: humanSize(totalMem),
        freeHuman: humanSize(freeMem),
        usedPercent: ((1 - freeMem / totalMem) * 100).toFixed(1) + "%",
      },
      disk: diskInfo,
      workspace: {
        path: WORKSPACE,
        exists: fs.existsSync(WORKSPACE),
      },
      node: process.version,
      uptime: (os.uptime() / 3600).toFixed(1) + " hours",
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
//  NEW TOOL 8 — open_file
//  Open a file in the default system application via Electron shell.
//  This is a stub — the actual shell.openPath call must go through IPC
//  because this runtime runs in the main/renderer bridge context.
// ---------------------------------------------------------------------------

function openFile(filePath) {
  try {
    const resolved = path.resolve(WORKSPACE, filePath);
    if (!resolved.startsWith(WORKSPACE)) return { success: false, error: "Outside workspace." };
    if (!fs.existsSync(resolved)) return { success: false, error: "File not found." };

    // If running inside Electron with access to shell, use it directly
    try {
      const { shell } = require("electron");
      shell.openPath(resolved);
      return { success: true, content: `Opened ${path.relative(WORKSPACE, resolved)}`, path: resolved };
    } catch {
      // Not in Electron context — return IPC instructions
    }

    // Fallback: try to use OS-native open commands
    const openCommand =
      process.platform === "win32" ? `start "" "${resolved}"`
      : process.platform === "darwin" ? `open "${resolved}"`
      : `xdg-open "${resolved}"`;

    exec(openCommand, { timeout: 10000, shell: true }, () => {});

    return {
      success: true,
      opened: path.relative(WORKSPACE, resolved).replace(/\\/g, "/"),
      method: "os-command",
      note: "For Electron IPC integration, send an 'open-file' event to the main process with the resolved path.",
      ipcExample: `ipcRenderer.send('open-file', '${resolved.replace(/\\/g, "\\\\")}')`,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
//  NEW TOOL 9 — download_file
//  Download a file from a URL to the workspace. Max 50 MB.
// ---------------------------------------------------------------------------

const MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024; // 50 MB

function downloadFile(url, destPath) {
  return new Promise((resolve) => {
    try {
      const resolved = path.resolve(WORKSPACE, destPath);
      if (!resolved.startsWith(WORKSPACE)) {
        return resolve({ success: false, error: "Destination outside workspace." });
      }

      const destDir = path.dirname(resolved);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === "https:" ? https : http;

      const request = client.get(url, { timeout: 60000, headers: { "User-Agent": "ShortStack-Agent/1.0" } }, (res) => {
        // Follow one redirect
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location;
          const redirectClient = redirectUrl.startsWith("https") ? https : http;
          redirectClient.get(redirectUrl, { timeout: 60000, headers: { "User-Agent": "ShortStack-Agent/1.0" } }, (redirectRes) => {
            handleResponse(redirectRes, resolved, resolve);
          }).on("error", (err) => {
            resolve({ success: false, error: `Redirect failed: ${err.message}` });
          });
          return;
        }

        handleResponse(res, resolved, resolve);
      });

      request.on("error", (err) => {
        resolve({ success: false, error: `Request failed: ${err.message}` });
      });

      request.on("timeout", () => {
        request.destroy();
        resolve({ success: false, error: "Download timed out (60s)." });
      });

    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

function handleResponse(res, destPath, resolve) {
  if (res.statusCode !== 200) {
    return resolve({ success: false, error: `HTTP ${res.statusCode}: ${res.statusMessage}` });
  }

  const contentLength = parseInt(res.headers["content-length"] || "0", 10);
  if (contentLength > MAX_DOWNLOAD_SIZE) {
    res.destroy();
    return resolve({ success: false, error: `File too large (${humanSize(contentLength)}). Limit is 50 MB.` });
  }

  const chunks = [];
  let receivedBytes = 0;

  res.on("data", (chunk) => {
    receivedBytes += chunk.length;
    if (receivedBytes > MAX_DOWNLOAD_SIZE) {
      res.destroy();
      return resolve({ success: false, error: "Download exceeded 50 MB limit." });
    }
    chunks.push(chunk);
  });

  res.on("end", () => {
    try {
      const data = Buffer.concat(chunks);
      fs.writeFileSync(destPath, data);
      resolve({
        success: true,
        path: path.relative(WORKSPACE, destPath).replace(/\\/g, "/"),
        sizeBytes: data.length,
        sizeHuman: humanSize(data.length),
        contentType: res.headers["content-type"] || "unknown",
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });

  res.on("error", (err) => {
    resolve({ success: false, error: `Download stream error: ${err.message}` });
  });
}

// ---------------------------------------------------------------------------
//  NEW TOOL 10 — zip_folder
//  Create a zip archive of a folder in the workspace.
//  Uses tar on Unix or PowerShell Compress-Archive on Windows.
// ---------------------------------------------------------------------------

async function zipFolder(folderPath, outputPath) {
  try {
    const resolvedFolder = path.resolve(WORKSPACE, folderPath);
    if (!resolvedFolder.startsWith(WORKSPACE)) return { success: false, error: "Folder outside workspace." };
    if (!fs.existsSync(resolvedFolder)) return { success: false, error: "Folder not found." };
    if (!fs.statSync(resolvedFolder).isDirectory()) return { success: false, error: "Path is not a directory." };

    // Default output name
    const zipName = outputPath || (path.basename(resolvedFolder) + ".zip");
    const resolvedOutput = path.resolve(WORKSPACE, zipName);
    if (!resolvedOutput.startsWith(WORKSPACE)) return { success: false, error: "Output path outside workspace." };

    const outputDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Remove existing zip if present
    if (fs.existsSync(resolvedOutput)) fs.unlinkSync(resolvedOutput);

    return new Promise((resolve) => {
      let cmd;
      if (process.platform === "win32") {
        // Use PowerShell's Compress-Archive (available on Windows 10+)
        const psFolder = resolvedFolder.replace(/'/g, "''");
        const psOutput = resolvedOutput.replace(/'/g, "''");
        cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${psFolder}\\*' -DestinationPath '${psOutput}' -Force"`;
      } else {
        // Use zip if available, else tar
        const parentDir = path.dirname(resolvedFolder);
        const folderName = path.basename(resolvedFolder);
        cmd = `cd "${parentDir}" && zip -r "${resolvedOutput}" "${folderName}"`;
      }

      exec(cmd, { timeout: 120000, maxBuffer: 5 * 1024 * 1024, shell: true }, (error, stdout, stderr) => {
        if (error) {
          // Fallback: try tar + gzip if zip failed on non-Windows
          if (process.platform !== "win32") {
            const tgzOutput = resolvedOutput.replace(/\.zip$/, ".tar.gz");
            const parentDir = path.dirname(resolvedFolder);
            const folderName = path.basename(resolvedFolder);
            exec(
              `cd "${parentDir}" && tar -czf "${tgzOutput}" "${folderName}"`,
              { timeout: 120000, shell: true },
              (err2) => {
                if (err2) {
                  resolve({ success: false, error: `Zip failed: ${error.message}. Tar also failed: ${err2.message}` });
                } else {
                  const stat = fs.statSync(tgzOutput);
                  resolve({
                    success: true,
                    archive: path.relative(WORKSPACE, tgzOutput).replace(/\\/g, "/"),
                    format: "tar.gz",
                    sizeBytes: stat.size,
                    sizeHuman: humanSize(stat.size),
                    note: "zip was not available, created .tar.gz instead",
                  });
                }
              }
            );
            return;
          }
          resolve({ success: false, error: `Zip failed: ${error.message}` });
          return;
        }

        if (fs.existsSync(resolvedOutput)) {
          const stat = fs.statSync(resolvedOutput);
          resolve({
            success: true,
            archive: path.relative(WORKSPACE, resolvedOutput).replace(/\\/g, "/"),
            format: "zip",
            sizeBytes: stat.size,
            sizeHuman: humanSize(stat.size),
          });
        } else {
          resolve({ success: false, error: "Archive was not created. Check folder permissions." });
        }
      });
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
//  NEW TOOL 11 — auto_organize
//  Scan a folder and organize files into subfolders by type.
// ---------------------------------------------------------------------------

function autoOrganize(targetDir) {
  try {
    const resolved = path.resolve(WORKSPACE, targetDir || ".");
    if (!resolved.startsWith(WORKSPACE)) return { success: false, error: "Outside workspace." };
    if (!fs.existsSync(resolved)) return { success: false, error: "Directory not found." };

    const TYPE_MAP = {
      images:  [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg", ".ico", ".tiff", ".heic", ".avif"],
      videos:  [".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv", ".m4v"],
      audio:   [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".wma"],
      documents: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".odt"],
      design:  [".psd", ".ai", ".sketch", ".fig", ".xd", ".indd", ".eps", ".afdesign"],
      code:    [".js", ".ts", ".jsx", ".tsx", ".py", ".html", ".css", ".scss", ".json", ".xml", ".yaml", ".yml"],
      fonts:   [".ttf", ".otf", ".woff", ".woff2", ".eot"],
      archives: [".zip", ".rar", ".tar", ".gz", ".7z", ".tar.gz"],
      data:    [".csv", ".sql", ".db", ".sqlite"],
    };

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const moved = [];
    const skipped = [];

    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      let destFolder = null;

      for (const [folder, exts] of Object.entries(TYPE_MAP)) {
        if (exts.includes(ext)) { destFolder = folder; break; }
      }

      if (!destFolder) { skipped.push(entry.name); continue; }

      const srcPath = path.join(resolved, entry.name);
      const destDir = path.join(resolved, destFolder);
      const destPath = path.join(destDir, entry.name);

      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      // Avoid overwriting
      if (fs.existsSync(destPath)) {
        const base = path.basename(entry.name, ext);
        const newName = `${base}_${Date.now()}${ext}`;
        fs.renameSync(srcPath, path.join(destDir, newName));
        moved.push({ file: entry.name, to: `${destFolder}/${newName}` });
      } else {
        fs.renameSync(srcPath, destPath);
        moved.push({ file: entry.name, to: `${destFolder}/${entry.name}` });
      }
    }

    return {
      success: true,
      organized: moved.length,
      skipped: skipped.length,
      moved,
      skippedFiles: skipped.slice(0, 20),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
//  NEW TOOL 12 — batch_rename
//  Rename files matching a pattern with a template.
//  Template vars: {n} = number, {name} = original name, {ext} = extension,
//  {date} = YYYY-MM-DD, {platform} = platform prefix if provided.
// ---------------------------------------------------------------------------

function batchRename(targetDir, pattern, template, platform) {
  try {
    const resolved = path.resolve(WORKSPACE, targetDir || ".");
    if (!resolved.startsWith(WORKSPACE)) return { success: false, error: "Outside workspace." };
    if (!fs.existsSync(resolved)) return { success: false, error: "Directory not found." };
    if (!template) return { success: false, error: "Rename template is required." };

    const regexStr = (pattern || "*")
      .replace(/([.+^${}()|[\]\\])/g, "\\$1")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    const regex = new RegExp("^" + regexStr + "$", "i");

    const entries = fs.readdirSync(resolved, { withFileTypes: true })
      .filter(e => !e.isDirectory() && regex.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    const dateStr = new Date().toISOString().split("T")[0];
    const renamed = [];

    entries.forEach((entry, index) => {
      const ext = path.extname(entry.name);
      const nameOnly = path.basename(entry.name, ext);

      const newName = template
        .replace(/\{n\}/g, String(index + 1).padStart(3, "0"))
        .replace(/\{name\}/g, nameOnly)
        .replace(/\{ext\}/g, ext)
        .replace(/\{date\}/g, dateStr)
        .replace(/\{platform\}/g, platform || "post");

      // Add extension if template doesn't include {ext}
      const finalName = newName.includes(".") ? newName : newName + ext;

      const srcPath = path.join(resolved, entry.name);
      const destPath = path.join(resolved, finalName);

      if (srcPath !== destPath && !fs.existsSync(destPath)) {
        fs.renameSync(srcPath, destPath);
        renamed.push({ from: entry.name, to: finalName });
      }
    });

    return {
      success: true,
      renamed: renamed.length,
      total: entries.length,
      files: renamed.slice(0, 50),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
//  NEW TOOL 13 — workspace_stats
//  Get a summary of the entire workspace: file counts, sizes by type, etc.
// ---------------------------------------------------------------------------

function workspaceStats() {
  try {
    ensureWorkspace();
    const stats = { totalFiles: 0, totalDirs: 0, totalSizeBytes: 0, byType: {}, largestFiles: [] };

    function walk(dir) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        if (entry.isDirectory()) {
          stats.totalDirs++;
          walk(fullPath);
        } else {
          stats.totalFiles++;
          try {
            const s = fs.statSync(fullPath);
            stats.totalSizeBytes += s.size;
            const ext = path.extname(entry.name).toLowerCase() || "(none)";
            stats.byType[ext] = (stats.byType[ext] || 0) + 1;
            stats.largestFiles.push({ name: path.relative(WORKSPACE, fullPath).replace(/\\/g, "/"), size: s.size });
          } catch {}
        }
      }
    }

    walk(WORKSPACE);
    stats.largestFiles.sort((a, b) => b.size - a.size);
    stats.largestFiles = stats.largestFiles.slice(0, 10).map(f => ({ ...f, sizeHuman: humanSize(f.size) }));
    stats.totalSizeHuman = humanSize(stats.totalSizeBytes);

    return { success: true, ...stats };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
//  RATE LIMITER — cap tool calls to avoid runaway loops / abuse.
//  Token-bucket per tool name, refilled over a rolling window.
// ---------------------------------------------------------------------------

const RATE_LIMIT = {
  // Max calls per rolling window, per tool name.
  maxPerWindow: 60,
  // Destructive tools get a tighter budget.
  destructiveMax: 15,
  destructive: new Set(["delete_file", "move_file", "batch_rename", "auto_organize", "zip_folder"]),
  windowMs: 60 * 1000, // 1 minute
  _calls: new Map(), // name → array of timestamps
};

function rateLimitCheck(name) {
  const now = Date.now();
  const arr = RATE_LIMIT._calls.get(name) || [];
  // Drop entries older than the window.
  const fresh = arr.filter((t) => now - t < RATE_LIMIT.windowMs);
  const cap = RATE_LIMIT.destructive.has(name)
    ? RATE_LIMIT.destructiveMax
    : RATE_LIMIT.maxPerWindow;
  if (fresh.length >= cap) {
    const retryIn = Math.max(1, Math.ceil((RATE_LIMIT.windowMs - (now - fresh[0])) / 1000));
    return { allowed: false, retryIn };
  }
  fresh.push(now);
  RATE_LIMIT._calls.set(name, fresh);
  return { allowed: true };
}

// ---------------------------------------------------------------------------
//  TOOL EXECUTOR — routes tool calls to the right function
// ---------------------------------------------------------------------------

async function executeTool(name, input) {
  ensureWorkspace();

  // Rate limit before any work happens.
  const gate = rateLimitCheck(name);
  if (!gate.allowed) {
    return {
      success: false,
      error: `Rate limit reached for "${name}". Retry in ~${gate.retryIn}s.`,
    };
  }

  switch (name) {
    // Original tools
    case "run_command":
      return runCommand(input.command, input.cwd);
    case "read_file":
      return readFile(input.path);
    case "write_file":
      return writeFile(input.path, input.content);
    case "list_directory":
      return listDirectory(input.path);

    // File tools
    case "search_files":
      return searchFiles(input.pattern, input.path);
    case "analyze_file":
      return analyzeFile(input.path);
    case "move_file":
      return moveFile(input.from, input.to);
    case "copy_file":
      return copyFile(input.from, input.to);
    case "delete_file":
      return deleteFile(input.path);
    case "create_project":
      return createProject(input.type, input.name);
    case "get_system_info":
      return getSystemInfo();
    case "open_file":
      return openFile(input.path);
    case "download_file":
      return downloadFile(input.url, input.filename);
    case "zip_folder":
      return zipFolder(input.path, input.output);

    // Batch & organization tools
    case "auto_organize":
      return autoOrganize(input.path);
    case "batch_rename":
      return batchRename(input.path, input.pattern, input.template, input.platform);
    case "workspace_stats":
      return workspaceStats();

    // Browser navigation — prefers the embedded browser panel if the
    // renderer has one mounted, otherwise falls back to shell.openExternal.
    case "browser_navigate":
      return browserNavigate(input.url);

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

// ---------------------------------------------------------------------------
//  TOOL 14 — browser_navigate
//  Route the URL through the automation bridge (embedded <webview>) when
//  present, else open in the OS default browser. Never throws.
// ---------------------------------------------------------------------------

async function browserNavigate(url) {
  if (!url || typeof url !== "string") {
    return { success: false, error: "url (string) required" };
  }
  try { new URL(url); } catch { return { success: false, error: "Invalid URL" }; }

  // Prefer the automation bridge (sends to renderer for embedded browser).
  try {
    const auto = require("./automation-handlers");
    if (auto && typeof auto.browserNavigate === "function") {
      return await auto.browserNavigate({ url });
    }
  } catch { /* fall through to shell */ }

  try {
    const { shell } = require("electron");
    await shell.openExternal(url);
    return { success: true, url, delivery: "external" };
  } catch (err) {
    return { success: false, error: String(err?.message || err) };
  }
}

module.exports = { executeTool, WORKSPACE, ensureWorkspace };
