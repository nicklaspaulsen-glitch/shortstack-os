#!/usr/bin/env node
/**
 * scripts/regenerate-icons.mjs
 *
 * Pure-Node ESM twin of scripts/regenerate-icons.ts, so we can regenerate
 * the raster/ICO icons without needing `tsx` in node_modules.
 *
 * Reads public/icons/shortstack-logo.svg (the canonical mandala mark) and
 * writes:
 *   - public/icons/shortstack-logo.png        1024x1024  (Electron main / tray)
 *   - public/icons/shortstack-logo-1024.png   1024x1024  (explicit-size copy)
 *   - public/icons/shortstack-logo.ico        16/32/48/64/128/256 Vista PNG ICO
 *   - public/favicon.ico                      16/32/48 Vista PNG ICO
 *   - public/og-image.png                     1200x630 social preview card
 *   - public/icons/email-logo.png             200x200 email-client fallback
 *
 * Legacy files (*-legacy.*) are not touched.
 *
 * Usage:
 *   node scripts/regenerate-icons.mjs
 *   npm run icons:mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "..");
const SVG_PATH = path.join(REPO_ROOT, "public", "icons", "shortstack-logo.svg");
const ICONS_DIR = path.join(REPO_ROOT, "public", "icons");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");

const BRAND_GOLD = "#C9A84C";
const BRAND_BG_DARK = "#06080c";

const MAIN_ICO_SIZES = [16, 32, 48, 64, 128, 256];
const FAVICON_SIZES = [16, 32, 48];

async function rasterize(svgBuffer, size) {
  // SVG's viewBox is 256×256. Density scales the librsvg render against the
  // SVG's intrinsic pixel dimensions: `renderedPx = (density/72) * viewBox`.
  // Oversample at 2× the target, clamp to 72 min so tiny icons still render
  // from a reasonable-size intermediate.
  const density = Math.max(72, Math.round((size / 256) * 144));
  return sharp(svgBuffer, { density, unlimited: true })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function buildIco(pngs) {
  const ICONDIR_SIZE = 6;
  const ICONDIRENTRY_SIZE = 16;
  const header = Buffer.alloc(ICONDIR_SIZE);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  const payloads = [];
  let offset = ICONDIR_SIZE + ICONDIRENTRY_SIZE * pngs.length;

  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(ICONDIRENTRY_SIZE);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    payloads.push(data);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...payloads]);
}

async function writeIco(outPath, svgBuffer, sizes) {
  const pngs = await Promise.all(
    sizes.map(async (size) => ({ size, data: await rasterize(svgBuffer, size) })),
  );
  const ico = buildIco(pngs);
  await fs.writeFile(outPath, ico);
}

async function writePng(outPath, svgBuffer, size) {
  const buf = await rasterize(svgBuffer, size);
  await fs.writeFile(outPath, buf);
}

async function writeOgImage(outPath, svgBuffer) {
  const width = 1200;
  const height = 630;
  const logoSize = 320;
  const logoX = 120;
  const logoY = (height - logoSize) / 2;

  const logoPng = await sharp(svgBuffer, { density: 288, unlimited: true })
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

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

async function main() {
  const svgBuffer = await fs.readFile(SVG_PATH);
  console.log(`Source SVG: ${SVG_PATH} (${svgBuffer.byteLength} bytes)`);

  const targets = [
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
