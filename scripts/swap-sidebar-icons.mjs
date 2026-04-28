// Apr 28: One-shot to swap `<LucideName size={16} />` JSX in
// src/components/sidebar.tsx to `<NavIcon3D name="LucideName" size={16} />`.
// Keeps navItems[] format intact; the renderer just picks the Solar
// Bold-Duotone glyph instead of the lucide stroke.
//
// Run: `node scripts/swap-sidebar-icons.mjs --apply` to write changes.

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const APPLY = process.argv.includes("--apply");
const FILE = path.resolve("src", "components", "sidebar.tsx");

// Names that exist in NavIcon3D's LUCIDE_TO_SOLAR map AND appear in
// navItems[] icon JSX. We DON'T touch lucide elsewhere in the file
// (header chevrons, badges, search input icon, etc.) — those keep
// their flat lucide form.
const NAV_ICONS = [
  "Inbox", "Sparkles", "LayoutDashboard", "Users", "BarChart3", "FileText",
  "Bell", "Settings", "ShieldCheck", "Activity", "Send", "Search", "Phone",
  "Headphones", "Mic", "MessagesSquare", "MessageSquare", "Award",
  "ClipboardList", "ClipboardCheck", "MailPlus", "Mail", "ListOrdered",
  "GitBranch", "Layers", "CreditCard", "FileCheck", "TrendingUp", "Target",
  "Calendar", "BookOpen", "Briefcase", "Pen", "PenTool", "Smartphone",
  "Newspaper", "Palette", "FolderOpen", "Globe", "Globe2", "LayoutTemplate",
  "FlaskConical", "Share2", "ImageIcon", "Film", "Zap", "Crown",
  "UsersRound", "SlidersHorizontal", "Monitor", "RotateCcw", "Webhook",
  "Key", "Bot", "Kanban", "LayoutGrid", "Building2", "Receipt",
  "DollarSign", "Heart", "Star", "LifeBuoy", "Gift", "Calculator",
  "FileBarChart2", "Store", "Download", "Puzzle", "Plug", "Link2",
  "Upload", "Home",
];

const NAMES_RE = NAV_ICONS.join("|");
// Match `<Inbox size={16} />` (or 14, 12) anywhere in `navItems` array.
// Captures: 1=name, 2=size literal.
const PATTERN = new RegExp(
  `<(${NAMES_RE})\\s+size=\\{(\\d+)\\}\\s*/>`,
  "g",
);

const src = await fs.readFile(FILE, "utf8");

let count = 0;
const out = src.replace(PATTERN, (_match, name, size) => {
  count += 1;
  return `<NavIcon3D name="${name}" size={${size}} />`;
});

if (count === 0) {
  console.log("no matches");
  process.exit(0);
}

if (APPLY) {
  await fs.writeFile(FILE, out, "utf8");
  console.log(`replaced ${count} icon sites`);
} else {
  console.log(`would replace ${count} icon sites (dry-run)`);
}
