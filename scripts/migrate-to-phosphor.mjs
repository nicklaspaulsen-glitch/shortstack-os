/**
 * Lucide → @phosphor-icons/react migration
 * Run: node scripts/migrate-to-phosphor.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

const MAP = {
  Accessibility: "Accessibility", Activity: "Pulse",
  AlignCenter: "TextAlignCenter", AlignJustify: "TextAlignJustify",
  AlignLeft: "TextAlignLeft", AlignRight: "TextAlignRight",
  AlertCircle: "WarningCircle", AlertDiamond: "WarningDiamond",
  AlertOctagon: "WarningOctagon", AlertTriangle: "Warning",
  Aperture: "Aperture", Archive: "Archive",
  ArrowDown: "ArrowDown", ArrowDownRight: "ArrowDownRight",
  ArrowLeft: "ArrowLeft", ArrowLeftRight: "ArrowsLeftRight",
  ArrowRight: "ArrowRight", ArrowRightLeft: "ArrowsLeftRight",
  ArrowUp: "ArrowUp", ArrowUpCircle: "ArrowCircleUp",
  ArrowUpDown: "ArrowsDownUp", ArrowUpRight: "ArrowUpRight",
  AtSign: "At", Award: "Medal",
  BadgeCheck: "SealCheck", Ban: "Prohibit",
  BarChart: "ChartBar", BarChart2: "ChartBar", BarChart3: "ChartBar",
  Bell: "Bell", BellOff: "BellSlash", BellRing: "BellRinging",
  Bold: "TextB", Bookmark: "Bookmark", BookmarkPlus: "BookmarkSimple",
  BookOpen: "BookOpen", Box: "Cube", Boxes: "Stack",
  Braces: "Brackets", Brain: "Brain", Briefcase: "Briefcase",
  Brush: "PaintBrush", Bug: "Bug", Building: "Building", Building2: "Buildings",
  Calculator: "Calculator", Calendar: "Calendar",
  CalendarClock: "CalendarClock", CalendarCheck: "CalendarCheck",
  CalendarDays: "CalendarDots", CalendarIcon: "Calendar",
  CalendarRange: "CalendarBlank", Camera: "Camera", CameraOff: "CameraSlash",
  Captions: "ClosedCaptioning", CaptionsIcon: "ClosedCaptioning",
  Car: "Car", Check: "Check", CheckCircle: "CheckCircle",
  CheckCircle2: "CheckCircle", CheckIcon: "Check", CheckSquare: "CheckSquare",
  ChevronDown: "CaretDown", ChevronLeft: "CaretLeft",
  ChevronRight: "CaretRight", ChevronRightIcon: "CaretRight",
  ChevronsRight: "CaretDoubleRight", ChevronUp: "CaretUp",
  Circle: "Circle", CircleDot: "CircleDashed",
  Clapperboard: "FilmSlate", Clipboard: "Clipboard",
  ClipboardCheck: "ClipboardText", ClipboardCopy: "ClipboardText",
  ClipboardList: "ClipboardText", Clock: "Clock", Cloud: "Cloud",
  Code: "Code", Code2: "CodeSimple", FileCode: "FileCode",
  Coffee: "Coffee", Coins: "Coins", Columns: "Columns", Columns3: "Columns",
  Compass: "Compass", Contrast: "CircleHalf", Copy: "Copy",
  CreditCard: "CreditCard", Crop: "Crop", Crosshair: "Crosshair",
  Crown: "Crown", Cpu: "Cpu",
  Database: "Database", Diamond: "Diamond", Dice5: "Dice5",
  DollarSign: "CurrencyDollar", Download: "DownloadSimple",
  Droplets: "Drop", Dumbbell: "Barbell",
  Edit: "PencilSimple", Edit2: "PencilSimple", Edit3: "PencilSimple",
  Eraser: "Eraser", Expand: "ArrowsOut", ExternalLink: "ArrowSquareOut",
  Eye: "Eye", EyeOff: "EyeSlash",
  Factory: "Factory", FastForward: "FastForward", File: "File",
  FileAudio: "FileAudio", FileBarChart: "ChartBar", FileBarChart2: "ChartBar",
  FileCheck: "FileCheck", FileIcon: "File", FilePlus: "FilePlus",
  FileQuestion: "FileQuestion", FileSignature: "FilePen",
  FileSpreadsheet: "FileCsv", FileText: "FileText", FileTextIcon: "FileText",
  FileVideo: "FileVideo", FolderIcon: "Folder", FolderKanban: "Folder",
  FolderOpen: "FolderOpen", FolderPlus: "FolderPlus", Folder: "Folder",
  Film: "Film", Filter: "Funnel", Flag: "Flag", Flame: "Fire",
  FlaskConical: "Flask", Focus: "Crosshair", Forward: "ArrowBendUpRight",
  Gauge: "Gauge", Gem: "Diamond", Gift: "Gift",
  GitBranch: "GitBranch", GitCommit: "GitCommit",
  GitCompare: "GitDiff", GitMerge: "GitMerge",
  Globe: "Globe", Globe2: "GlobeHemisphereWest",
  GraduationCap: "GraduationCap",
  Grid: "SquaresFour", Grid3x3: "SquaresFour", Grid3X3: "SquaresFour",
  GridIcon: "SquaresFour", GripVertical: "DotsSixVertical", Guitar: "Guitar",
  Hand: "Hand", Hammer: "Hammer", HandshakeIcon: "Handshake",
  Handshake: "Handshake", HardHat: "HardHat", Hash: "Hash",
  Headphones: "Headphones", HeadphonesIcon: "Headphones",
  Heart: "Heart", HeartPulse: "Heartbeat", HelpCircle: "Question",
  History: "ClockCounterClockwise", Home: "House", HomeIcon: "House",
  Hourglass: "Hourglass",
  IdCard: "IdentificationCard", Image: "Image", ImageDown: "ImageSquare",
  ImageIcon: "Image", ImagePlus: "ImageSquare", Inbox: "Tray",
  Infinity: "Infinity", InfinityIcon: "Infinity", Info: "Info",
  Italic: "TextItalic",
  Kanban: "SquaresFour", Key: "Key", Keyboard: "Keyboard",
  Laptop: "Laptop", Lasso: "Lasso", Laugh: "Smiley",
  Layers: "Stack", LayersIcon: "Stack", Layout: "Layout",
  LayoutDashboard: "SquaresFour", LayoutGrid: "SquaresFour",
  LayoutList: "List", LayoutTemplate: "Layout", Leaf: "Leaf",
  Library: "BookBookmark", LibraryBig: "BookBookmark",
  LifeBuoy: "LifePreserver", Lightbulb: "Lightbulb",
  LineChart: "ChartLine", Link: "Link", Link2: "Link", LinkIcon: "Link",
  List: "ListBullets", ListChecks: "ListChecks", ListIcon: "ListBullets",
  ListOrdered: "ListNumbers", ListPlus: "ListPlus",
  Lock: "Lock", LogIn: "SignIn", LogOut: "SignOut",
  Magnet: "Magnet", Mail: "Envelope", MailCheck: "EnvelopeSimpleOpen",
  MailPlus: "EnvelopeSimple", MailWarning: "EnvelopeSimple",
  Map: "MapTrifold", MapIcon: "MapTrifold", MapPin: "MapPin",
  Maximize2: "ArrowsOut", Megaphone: "Megaphone", Menu: "List",
  MessageCircle: "ChatCircle", MessageCirclePlus: "ChatCircle",
  MessageSquare: "Chat", MessageSquareWarning: "ChatWarning",
  MessagesSquare: "Chats", Mic: "Microphone", Mic2: "Microphone",
  MicOff: "MicrophoneSlash", Minimize2: "ArrowsIn",
  Minus: "Minus", MinusCircle: "MinusCircle",
  Monitor: "Monitor", MonitorPlay: "Monitor",
  MonitorSmartphone: "DeviceMobileCamera",
  Moon: "Moon", MoreHorizontal: "DotsThree", MoreVertical: "DotsThreeVertical",
  Mountain: "Mountains", Mouse: "Mouse",
  MousePointer: "CursorClick", MousePointer2: "CursorClick",
  MousePointerClick: "CursorClick", Move: "ArrowsMove",
  Music: "MusicNote", Music2: "MusicNote",
  Newspaper: "Newspaper",
  Package: "Package", Paintbrush: "PaintBrush", Palette: "Palette",
  PanelLeft: "SidebarSimple", Paperclip: "Paperclip",
  PartyPopper: "Confetti", Pause: "Pause", PauseCircle: "PauseCircle",
  Pen: "Pencil", PenTool: "PenNib", Pencil: "Pencil",
  PencilLine: "PencilLine", Phone: "Phone", PhoneCall: "PhoneCall",
  PhoneForwarded: "PhoneOutgoing", PhoneOff: "PhoneDisconnect",
  PieChart: "ChartPie", PiggyBank: "PiggyBank", Pin: "PushPin",
  PinOff: "PushPinSlash", Pipette: "Eyedropper", Plane: "Airplane",
  Play: "Play", PlayCircle: "PlayCircle", Plug: "Plug", Plus: "Plus",
  PlusCircle: "PlusCircle", Podcast: "Podcast", Power: "Power",
  Puzzle: "Puzzle",
  QrCode: "QrCode", Quote: "Quotes",
  Radar: "Broadcast", Ratio: "Crop", Receipt: "Receipt",
  ReceiptText: "Receipt", Redo2: "ArrowClockwise",
  RefreshCcw: "ArrowCounterClockwise", RefreshCw: "ArrowsClockwise",
  Repeat: "Repeat", Repeat1: "RepeatOnce", Reply: "ArrowBendUpLeft",
  Rewind: "Rewind", Rocket: "Rocket",
  RotateCcw: "ArrowCounterClockwise", RotateCw: "ArrowClockwise",
  Ruler: "Ruler",
  Save: "FloppyDisk", Scale: "Scales", Scissors: "Scissors",
  Search: "MagnifyingGlass", Send: "PaperPlaneTilt", Server: "HardDrive",
  Settings: "Gear", Settings2: "SlidersHorizontal",
  Shapes: "Shapes", Share2: "ShareNetwork", Shield: "Shield",
  ShieldAlert: "ShieldWarning", ShieldCheck: "ShieldCheck",
  Shirt: "TShirt", ShoppingBag: "ShoppingBag", ShoppingCart: "ShoppingCart",
  Shuffle: "Shuffle", SkipBack: "SkipBack", SkipForward: "SkipForward",
  Sliders: "SlidersVertical", SlidersHorizontal: "SlidersHorizontal",
  Smile: "Smiley", Smartphone: "DeviceMobile", Snowflake: "Snowflake",
  Speech: "ChatText", Square: "Square", Star: "Star",
  StickyNote: "Note", StopCircle: "StopCircle", Store: "Storefront",
  Sun: "Sun", SunMedium: "Sun",
  Tablet: "DeviceTablet", Tag: "Tag", Target: "Target", TargetIcon: "Target",
  Terminal: "Terminal", Text: "TextT", TextCursorInput: "Cursor",
  TextIcon: "TextT", ThumbsDown: "ThumbsDown", ThumbsUp: "ThumbsUp",
  Timer: "Timer", ToggleLeft: "ToggleLeft", ToggleRight: "ToggleRight",
  Trash2: "Trash", Trash: "Trash", TreePine: "Tree",
  TrendingDown: "TrendDown", TrendingUp: "TrendUp",
  Trophy: "Trophy", Tv: "Television", Type: "TextT", TypeIcon: "TextT",
  Undo2: "ArrowCounterClockwise", Unlink: "LinkBreak", Unlock: "LockOpen",
  UploadCloud: "CloudArrowUp", Upload: "UploadSimple", UploadIcon: "UploadSimple",
  UserCheck: "UserCheck", UserCircle: "UserCircle", UserCog: "UserGear",
  UserPlus: "UserPlus", User: "User", Users: "Users",
  Users2: "UsersThree", UsersIcon: "Users", UsersRound: "UsersThree",
  Utensils: "Fork", UtensilsCrossed: "ForkKnifeCross",
  Video: "Video", VideoOff: "VideoCameraSlash",
  Voicemail: "Voicemail", Volume2: "SpeakerHigh", VolumeX: "SpeakerX",
  Waves: "Waves", Webhook: "Webhooks", Wifi: "Wifi",
  WifiOff: "WifiSlash", Wind: "Wind", Workflow: "Graph", Wrench: "Wrench",
  X: "X", XCircle: "XCircle", XIcon: "X",
  Zap: "Lightning", ZapOff: "LightningSlash",
  ZoomIn: "MagnifyingGlassPlus", ZoomOut: "MagnifyingGlassMinus",
  Loader: "CircleNotch", Loader2: "CircleNotch",
  Disc3: "Disc",
  LucideIcon: null, LucideProps: null,
  // CodeSquare variant
  CodeSquare: "Code",
};

const phosphorCjs = readFileSync(
  join(ROOT, "node_modules/@phosphor-icons/react/dist/index.cjs.js"),
  "utf8"
);
const phosphorExports = new Set(
  [...phosphorCjs.matchAll(/exports\.([A-Z][A-Za-z0-9]*)\s*=/g)].map((m) => m[1])
);

// Validate
for (const [l, p] of Object.entries(MAP)) {
  if (p && !phosphorExports.has(p)) {
    console.warn(`  MAP issue: ${l} → ${p} not found in phosphor`);
  }
}

function walk(dir, exts, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      walk(full, exts, files);
    } else if (exts.includes(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

const EXTS = [".tsx", ".ts", ".jsx", ".js"];
const allFiles = walk(SRC, EXTS);

let totalMigrated = 0;
const unmapped = new Map();

const LUCIDE_IMPORT_RE = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]lucide-react['"];?\n?/g;

for (const filePath of allFiles) {
  const original = readFileSync(filePath, "utf8");
  if (!original.includes("lucide-react")) continue;

  const collectedNames = new Set();
  for (const m of original.matchAll(LUCIDE_IMPORT_RE)) {
    for (const raw of m[1].split(",")) {
      const name = raw.trim().replace(/\s+as\s+\S+/, "").trim();
      if (name) collectedNames.add(name);
    }
  }

  let content = original;

  // Remove all lucide import lines
  content = content.replace(LUCIDE_IMPORT_RE, "");

  const phosphorNames = new Set();
  let needsTypeImport = false;

  for (const name of collectedNames) {
    if (name === "LucideIcon") { needsTypeImport = true; continue; }
    if (name === "LucideProps") { needsTypeImport = true; continue; }
    const mapped = MAP[name];
    if (mapped === undefined) {
      if (!unmapped.has(name)) unmapped.set(name, []);
      unmapped.get(name).push(filePath.replace(SRC + "\\", "src/").replace(SRC + "/", "src/"));
    } else if (mapped !== null) {
      phosphorNames.add(mapped);
    }
  }

  // Build import lines
  const importLines = [];
  if (needsTypeImport) importLines.push(`import type { Icon } from "@phosphor-icons/react";`);
  if (phosphorNames.size > 0) {
    importLines.push(`import { ${[...phosphorNames].sort().join(", ")} } from "@phosphor-icons/react";`);
  }

  if (importLines.length > 0) {
    const newImport = importLines.join("\n") + "\n";
    if (content.startsWith('"use client"') || content.startsWith("'use client'")) {
      const idx = content.indexOf("\n") + 1;
      content = content.slice(0, idx) + newImport + content.slice(idx);
    } else {
      content = newImport + content;
    }
  }

  // Rename icon usages in JSX and as values
  for (const name of collectedNames) {
    if (name === "LucideIcon") {
      content = content.replace(/\bLucideIcon\b/g, "Icon");
      continue;
    }
    if (name === "LucideProps") {
      content = content.replace(/\bLucideProps\b/g, "IconProps");
      continue;
    }
    const mapped = MAP[name];
    if (!mapped || mapped === name) continue;

    // JSX: <Name ... and </Name>
    content = content.replace(new RegExp(`<${name}([\\s/>])`, "g"), `<${mapped}$1`);
    content = content.replace(new RegExp(`</${name}>`, "g"), `</${mapped}>`);

    // Value usage: word-boundary safe
    content = content.replace(new RegExp(`(?<![A-Za-z0-9_$])${name}(?![A-Za-z0-9_$])`, "g"), mapped);
  }

  if (content !== original) {
    writeFileSync(filePath, content, "utf8");
    totalMigrated++;
  }
}

console.log(`\nMigrated ${totalMigrated} files\n`);

if (unmapped.size > 0) {
  console.log("Unmapped icons (need manual review):");
  for (const [icon, files] of [...unmapped.entries()].sort()) {
    console.log(`  ${icon}:`);
    files.slice(0, 2).forEach((f) => console.log(`    ${f}`));
    if (files.length > 2) console.log(`    ...and ${files.length - 2} more`);
  }
}
