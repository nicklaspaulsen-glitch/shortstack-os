// Apr 28 v8: download Microsoft Fluent UI 3D Emoji as static assets.
//
// User feedback: the R3F primitive scenes (cones/cylinders/spheres)
// looked generic. They want REAL 3D icons — actual money bags,
// credit cards, phones, etc. Microsoft has open-sourced their
// Fluent UI 3D Emoji set under MIT, professionally rendered with
// proper lighting and materials.
//
// Source: https://github.com/microsoft/fluentui-emoji
// License: MIT
// Output:  public/icons/3d/<theme>.png
//
// Each emoji has a 3D PNG variant at:
//   /assets/<Name>/3D/<name>_3d.png
// where <Name> is title-case with spaces, <name> is same lowercase
// with spaces converted to underscores.
//
// Run: node scripts/download-3d-icons.mjs

import { promises as fs } from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("public", "icons", "3d");
const BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets";

// theme key → Microsoft emoji slug. Slug is the URL-safe filename.
const ICONS = {
  // section-hub themes
  sales: { dir: "Money bag", file: "money_bag" },
  create: { dir: "Pencil", file: "pencil" },
  visual: { dir: "Artist palette", file: "artist_palette" },
  automate: { dir: "Counterclockwise arrows button", file: "counterclockwise_arrows_button" },
  manage: { dir: "Office building", file: "office_building" },
  connect: { dir: "Link", file: "link" },
  // domain themes
  ai: { dir: "Robot", file: "robot" },
  voice: { dir: "Microphone", file: "microphone" },
  analytics: { dir: "Bar chart", file: "bar_chart" },
  leads: { dir: "Magnet", file: "magnet" },
  inbox: { dir: "Inbox tray", file: "inbox_tray" },
  // sidebar-icon-matched themes
  phone: { dir: "Telephone receiver", file: "telephone_receiver" },
  mic: { dir: "Studio microphone", file: "studio_microphone" },
  calendar: { dir: "Calendar", file: "calendar" },
  mail: { dir: "E-mail", file: "e-mail" },
  search: { dir: "Magnifying glass tilted right", file: "magnifying_glass_tilted_right" },
  settings: { dir: "Gear", file: "gear" },
  bell: { dir: "Bell", file: "bell" },
  crown: { dir: "Crown", file: "crown" },
  bot: { dir: "Robot", file: "robot" },
  globe: { dir: "Globe with meridians", file: "globe_with_meridians" },
  heart: { dir: "Red heart", file: "red_heart" },
  star: { dir: "Star", file: "star" },
  key: { dir: "Key", file: "key" },
  shield: { dir: "Shield", file: "shield" },
  target: { dir: "Bullseye", file: "bullseye" },
  briefcase: { dir: "Briefcase", file: "briefcase" },
  headphones: { dir: "Headphone", file: "headphone" },
  // fallback
  default: { dir: "Sparkles", file: "sparkles" },
  // bonus icons for misc pages
  rocket: { dir: "Rocket", file: "rocket" },
  gem: { dir: "Gem stone", file: "gem_stone" },
  fire: { dir: "Fire", file: "fire" },
  trophy: { dir: "Trophy", file: "trophy" },
  card: { dir: "Credit card", file: "credit_card" },
  chart: { dir: "Chart increasing", file: "chart_increasing" },
  brain: { dir: "Brain", file: "brain" },
  pen: { dir: "Pen", file: "pen" },
  camera: { dir: "Camera", file: "camera" },
  film: { dir: "Film projector", file: "film_projector" },
  building: { dir: "Office building", file: "office_building" },
  receipt: { dir: "Receipt", file: "receipt" },
  invoice: { dir: "Page with curl", file: "page_with_curl" },
  zap: { dir: "High voltage", file: "high_voltage" },
  cog: { dir: "Gear", file: "gear" },
  pin: { dir: "Pushpin", file: "pushpin" },
  lock: { dir: "Locked", file: "locked" },
  download: { dir: "Down arrow", file: "down_arrow" },
};

async function downloadOne(themeKey, info) {
  const url = `${BASE}/${encodeURIComponent(info.dir)}/3D/${info.file}_3d.png`;
  const outPath = path.join(OUT_DIR, `${themeKey}.png`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  ✗ ${themeKey}: HTTP ${res.status} (${url})`);
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(outPath, buf);
    console.log(`  ✓ ${themeKey}.png (${(buf.byteLength / 1024).toFixed(1)} KB)`);
    return true;
  } catch (e) {
    console.error(`  ✗ ${themeKey}: ${e.message}`);
    return false;
  }
}

await fs.mkdir(OUT_DIR, { recursive: true });

console.log(`Downloading ${Object.keys(ICONS).length} 3D icons to ${OUT_DIR}...`);
let success = 0;
let failed = 0;

// Run in batches of 6 to be polite to the GitHub raw CDN
const entries = Object.entries(ICONS);
const BATCH = 6;
for (let i = 0; i < entries.length; i += BATCH) {
  const batch = entries.slice(i, i + BATCH);
  const results = await Promise.all(
    batch.map(([k, v]) => downloadOne(k, v)),
  );
  for (const r of results) {
    if (r) success++;
    else failed++;
  }
}

console.log(`\nDone: ${success} succeeded, ${failed} failed.`);
