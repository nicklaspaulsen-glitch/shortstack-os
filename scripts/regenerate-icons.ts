/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * scripts/regenerate-icons.ts
 *
 * One-time / on-demand rebranding script.
 *
 * Reads the canonical ShortStack brand SVG at `public/icons/shortstack-logo.svg`
 * and regenerates every raster icon the app/installer/email-pipeline needs:
 *
 *   - public/icons/shortstack-logo.png         (1024x1024 — Electron main / tray)
 *   - public/icons/shortstack-logo-1024.png    (1024x1024 — explicit-size copy)
 *   - public/icons/shortstack-logo.ico         (multi-size: 16/32/48/64/128/256)
 *   - public/favicon.ico                       (16/32/48 — public fallback)
 *   - src/app/favicon.ico                      (16/32/48/64/128/256 — App Router
 *                                               takes priority over public/favicon.ico
 *                                               per Next.js 14 file convention)
 *   - public/og-image.png                      (1200x630 — social preview w/ wordmark)
 *   - public/icons/email-logo.png              (200x200 — email client fallback)
 *
 * Usage:
 *   pnpm icons   # or   npm run icons   # or   tsx scripts/regenerate-icons.ts
 *
 * Does NOT touch any `*-legacy.*` files — those are the rollback path.
 *
 * ICO format: per the Microsoft spec, ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes
 * per image) + concatenated PNG payloads (Vista-style PNG-in-ICO is widely
 * supported by Windows 7+, Electron, all modern browsers).
 *
 * Rationale for hand-building ICO: the project does not ship `to-ico` /
 * `png-to-ico` / `icon-gen` in node_modules, and the task rules forbid
 * installing new heavy packages. Sharp is already a first-class dep.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";

// sharp is a production dep (see package.json).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp: typeof import("sharp") = require("sharp");

const REPO_ROOT = path.resolve(__dirname, "..");
const SVG_PATH = path.join(REPO_ROOT, "public", "icons", "shortstack-logo.svg");
const ICONS_DIR = path.join(REPO_ROOT, "public", "icons");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");
const APP_DIR = path.join(REPO_ROOT, "src", "app");

const BRAND_GOLD = "#C9A84C";
const BRAND_BG_DARK = "#06080c";

// ICO sizes for the main multi-size product icon.
const MAIN_ICO_SIZES: readonly number[] = [16, 32, 48, 64, 128, 256];
// ICO sizes for the browser favicon.
const FAVICON_SIZES: readonly number[] = [16, 32, 48];

async function rasterize(svgBuffer: Buffer, size: number): Promise<Buffer> {
  // SVG's viewBox is 256×256. librsvg renders at `(density/72) * viewBox`px,
  // so we oversample 2× the target (clamped to 72 min for tiny sizes) and let
  // sharp downscale with its default Lanczos filter. The old formula
  // `(size/64)*288` produced density=4608 at size=1024, which asked sharp to
  // render a 16384×16384 intermediate and tripped the default pixel limit.
  const density = Math.max(72, Math.round((size / 256) * 144));
  return sharp(svgBuffer, { density, unlimited: true })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Build a Vista-style ICO file that embeds raw PNG payloads for each size.
 * See https://learn.microsoft.com/en-us/previous-versions/ms997538(v=msdn.10)
 */
function buildIco(pngs: { size: number; data: Buffer }[]): Buffer {
  const ICONDIR_SIZE = 6;
  const ICONDIRENTRY_SIZE = 16;
  const header = Buffer.alloc(ICONDIR_SIZE);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = 1 (icon)
  header.writeUInt16LE(pngs.length, 4);

  const entries: Buffer[] = [];
  const payloads: Buffer[] = [];
  let offset = ICONDIR_SIZE + ICONDIRENTRY_SIZE * pngs.length;

  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(ICONDIRENTRY_SIZE);
    // Per spec, 0 in the width/height byte means 256.
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);   // color palette count (0 for no palette)
    entry.writeUInt8(0, 3);   // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8); // image size in bytes
    entry.writeUInt32LE(offset, 12); // offset from start of file
    entries.push(entry);
    payloads.push(data);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...payloads]);
}

async function writeIco(outPath: string, svgBuffer: Buffer, sizes: readonly number[]): Promise<void> {
  const pngs = await Promise.all(
    sizes.map(async (size) => ({ size, data: await rasterize(svgBuffer, size) })),
  );
  const ico = buildIco(pngs);
  await fs.writeFile(outPath, ico);
}

async function writePng(outPath: string, svgBuffer: Buffer, size: number): Promise<void> {
  const buf = await rasterize(svgBuffer, size);
  await fs.writeFile(outPath, buf);
}

/**
 * Social preview card. Dark background, logo on the left, wordmark on the right.
 * Uses an SVG overlay so we don't depend on any font file — system-ui rendered
 * text is fine because we rasterize directly.
 */
async function writeOgImage(outPath: string, svgBuffer: Buffer): Promise<void> {
  const width = 1200;
  const height = 630;
  const logoSize = 320;
  const logoX = 120;
  const logoY = (height - logoSize) / 2;

  // Render the brand SVG to a PNG at logo size.
  const logoPng = await sharp(svgBuffer, { density: 1024 })
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Wordmark + tagline overlay. Font family falls back gracefully; sharp's
  // librsvg uses fontconfig on linux/macos and DirectWrite on windows.
  const overlaySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND_BG_DARK}"/>
      <stop offset="100%" stop-color="#0d1117"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="0" y="${height - 6}" width="${width}" height="6" fill="${BRAND_GOLD}"/>
  <text x="520" y="290" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        font-size="96" font-weight="700" fill="#FAFAF7" letter-spacing="-2">ShortStack</text>
  <text x="520" y="360" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        font-size="36" font-weight="500" fill="${BRAND_GOLD}" letter-spacing="1">Agency Operating System</text>
  <text x="520" y="420" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        font-size="24" font-weight="400" fill="#94a3b8">Leads. Outreach. Analytics. All in one stack.</text>
</svg>`;

  await sharp(Buffer.from(overlaySvg))
    .composite([{ input: logoPng, top: Math.round(logoY), left: logoX }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main(): Promise<void> {
  const svgBuffer = await fs.readFile(SVG_PATH);
  console.log(`Source SVG: ${SVG_PATH} (${svgBuffer.byteLength} bytes)`);

  const targets: { label: string; run: () => Promise<void> }[] = [
    {
      label: "shortstack-logo.png (1024x1024)",
      run: () => writePng(path.join(ICONS_DIR, "shortstack-logo.png"), svgBuffer, 1024),
    },
    {
      label: "shortstack-logo-1024.png (1024x1024)",
      run: () => writePng(path.join(ICONS_DIR, "shortstack-logo-1024.png"), svgBuffer, 1024),
    },
    {
      label: `shortstack-logo.ico (${MAIN_ICO_SIZES.join("/")})`,
      run: () => writeIco(path.join(ICONS_DIR, "shortstack-logo.ico"), svgBuffer, MAIN_ICO_SIZES),
    },
    {
      label: `favicon.ico (${FAVICON_SIZES.join("/")})`,
      run: () => writeIco(path.join(PUBLIC_DIR, "favicon.ico"), svgBuffer, FAVICON_SIZES),
    },
    {
      // src/app/favicon.ico overrides public/favicon.ico in the App Router, so
      // we need to write BOTH or browsers keep serving the stale app-router copy.
      label: `src/app/favicon.ico (${MAIN_ICO_SIZES.join("/")})`,
      run: () => writeIco(path.join(APP_DIR, "favicon.ico"), svgBuffer, MAIN_ICO_SIZES),
    },
    {
      label: "og-image.png (1200x630)",
      run: () => writeOgImage(path.join(PUBLIC_DIR, "og-image.png"), svgBuffer),
    },
    {
      label: "email-logo.png (200x200)",
      run: () => writePng(path.join(ICONS_DIR, "email-logo.png"), svgBuffer, 200),
    },
  ];

  for (const { label, run } of targets) {
    const start = Date.now();
    await run();
    console.log(`  wrote ${label} in ${Date.now() - start}ms`);
  }

  console.log("Done. Legacy files untouched.");
}

main().catch((err) => {
  console.error("regenerate-icons failed:", err);
  process.exit(1);
});
