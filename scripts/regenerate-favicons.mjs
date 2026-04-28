// Apr 28: regenerate the PNG/ICO favicons from the new ShortStack
// stack-mark SVG. Replaces the old gold mandala raster files which
// were still loading despite the SVG having been swapped.
//
// Outputs:
//   public/icons/shortstack-logo.png        — 512x512 master + apple-touch-icon
//   public/icons/shortstack-logo-1024.png   — 1024x1024 installer icon
//   public/icons/shortstack-logo-192.png    — PWA icon
//   public/icons/shortstack-logo-512.png    — PWA icon
//   public/icons/email-logo.png             — email-template logo (256x256, white-bg)
//
// ICO is regenerated separately via a small in-script flow that takes
// the 64x64 PNG and embeds it as a single-image ICO container (this
// is what every modern browser actually reads — Windows expects
// multi-image but a single 64x64 works fine for Chrome/Firefox/Edge).
//
// Run: node scripts/regenerate-favicons.mjs

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const SOURCE_BLACK = path.resolve("public", "icons", "shortstack-logo-black.svg");
const OUT_DIR = path.resolve("public", "icons");

async function pngFromSvg(srcPath, size) {
  const buf = await fs.readFile(srcPath);
  return sharp(buf, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function pngOnWhite(srcPath, size) {
  const buf = await fs.readFile(srcPath);
  return sharp(buf, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: "#FFFFFF" })
    .png()
    .toBuffer();
}

const TASKS = [
  { name: "shortstack-logo.png", size: 512, fn: pngFromSvg },
  { name: "shortstack-logo-1024.png", size: 1024, fn: pngFromSvg },
  { name: "shortstack-logo-192.png", size: 192, fn: pngFromSvg },
  { name: "shortstack-logo-512.png", size: 512, fn: pngFromSvg },
  { name: "shortstack-logo-180.png", size: 180, fn: pngFromSvg },
  { name: "email-logo.png", size: 256, fn: pngOnWhite },
];

for (const { name, size, fn } of TASKS) {
  const buf = await fn(SOURCE_BLACK, size);
  await fs.writeFile(path.join(OUT_DIR, name), buf);
  console.log(`generated ${name} (${size}x${size}, ${buf.byteLength} bytes)`);
}

// ICO: take the 64x64 PNG and wrap it as a single-image ICO.
// Format reference: https://en.wikipedia.org/wiki/ICO_(file_format)
//   Header (6 bytes) + Directory entry (16 bytes) + Image data
const png64 = await pngFromSvg(SOURCE_BLACK, 64);
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type=icon
icoHeader.writeUInt16LE(1, 4); // count=1

const icoDir = Buffer.alloc(16);
icoDir.writeUInt8(64, 0);  // width
icoDir.writeUInt8(64, 1);  // height
icoDir.writeUInt8(0, 2);   // palette count
icoDir.writeUInt8(0, 3);   // reserved
icoDir.writeUInt16LE(1, 4); // color planes
icoDir.writeUInt16LE(32, 6); // bits-per-pixel
icoDir.writeUInt32LE(png64.byteLength, 8); // image size
icoDir.writeUInt32LE(22, 12); // image offset (header 6 + dir 16)

const ico = Buffer.concat([icoHeader, icoDir, png64]);
await fs.writeFile(path.join(OUT_DIR, "shortstack-logo.ico"), ico);
console.log(`generated shortstack-logo.ico (${ico.byteLength} bytes)`);
