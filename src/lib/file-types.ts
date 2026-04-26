/**
 * Centralised allowed-file-type definitions.
 *
 * CLIENT-SAFE — pure data + pure functions, no server imports.
 *
 * Usage:
 *   import { ALLOWED_IMAGES, buildAccept, validateFile } from "@/lib/file-types";
 *
 *   // on <input accept={...}>
 *   <input accept={buildAccept(ALLOWED_IMAGES)} ... />
 *
 *   // at runtime after drop / select
 *   const err = validateFile(file, ALLOWED_IMAGES, 50 * 1024 * 1024);
 *   if (err) { toast.error(err); return; }
 */

// ── MIME allowlists ──────────────────────────────────────────────────────────

export const ALLOWED_IMAGES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
] as const;

export const ALLOWED_VIDEOS = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const ALLOWED_AUDIO = [
  "audio/mpeg",
  "audio/wav",
  // Some browsers / Windows file-pickers report WAV as audio/x-wav.
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
] as const;

export const ALLOWED_DOCUMENTS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  // Some Excel-aware OSes report CSV as application/vnd.ms-excel.
  "application/vnd.ms-excel",
  "text/markdown",
] as const;

/** Everything the Content Library / portal uploads accept */
export const ALLOWED_GENERAL_UPLOADS = [
  ...ALLOWED_IMAGES,
  ...ALLOWED_VIDEOS,
  ...ALLOWED_AUDIO,
  ...ALLOWED_DOCUMENTS,
] as const;

/** Images + videos + audio (reference files, AI Studio) */
export const ALLOWED_MEDIA = [
  ...ALLOWED_IMAGES,
  ...ALLOWED_VIDEOS,
  ...ALLOWED_AUDIO,
] as const;

/** Logos — small raster + SVG only */
export const ALLOWED_LOGO = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
] as const;

/** CSV import (leads, contacts) */
export const ALLOWED_CSV = [
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel", // Excel-aware OSes label CSVs this way
  "application/csv",
] as const;

/** Audio voice-sample cloning */
export const ALLOWED_VOICE_SAMPLE = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/ogg",
  "audio/webm",
] as const;

// ── Ambiguous MIMEs — MIME alone is not enough ───────────────────────────────
//
// MIME types that map to multiple incompatible file formats. When the
// browser reports one of these for a dropped file, we additionally
// require the extension to be in the allow set so we don't silently
// admit a format the importer can't handle.

const AMBIGUOUS_MIMES = new Set<string>([
  // Reported by Windows for Excel-saved CSVs AND native .xls binaries.
  "application/vnd.ms-excel",
]);

// ── Explicit block list — always rejected ────────────────────────────────────
//
// Round-1 codex review caught the original list missed several common
// executable / installer formats. Rejected regardless of MIME or any other
// signal. Extension match is on the FINAL extension after lowercasing, so
// "logo.png.exe" → ".exe" → blocked.

const BLOCKED_EXTENSIONS = new Set([
  // Windows executables / scripts
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".scr",
  ".msi",
  ".msp",
  ".ps1",
  ".vbs",
  ".vbe",
  ".wsf",
  ".wsh",
  // Cross-platform script families
  ".sh",
  ".js",
  ".ts",
  ".mjs",
  ".cjs",
  ".jar",
  ".py",
  ".pl",
  // Mobile / desktop installer + native module bundles
  ".app",
  ".pkg",
  ".dmg",
  ".deb",
  ".rpm",
  ".apk",
  ".ipa",
  // Native libraries
  ".dll",
  ".dylib",
  ".so",
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a comma-separated string suitable for `<input accept="..." />`.
 * Adds common file-extension aliases alongside MIME types so Windows/macOS
 * file-picker dialogs show the right filter.
 */
export function buildAccept(mimes: readonly string[]): string {
  const extensions: string[] = [];

  const MIME_TO_EXT: Record<string, string[]> = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
    "image/gif": [".gif"],
    "image/svg+xml": [".svg"],
    "video/mp4": [".mp4"],
    "video/webm": [".webm"],
    "video/quicktime": [".mov"],
    "audio/mpeg": [".mp3"],
    "audio/wav": [".wav"],
    "audio/ogg": [".ogg"],
    "audio/mp4": [".m4a"],
    "audio/x-m4a": [".m4a"],
    "audio/webm": [".webm"],
    "application/pdf": [".pdf"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "text/plain": [".txt"],
    "text/csv": [".csv"],
    "text/markdown": [".md"],
  };

  for (const mime of mimes) {
    const exts = MIME_TO_EXT[mime];
    if (exts) extensions.push(...exts);
  }

  return [...mimes, ...extensions].join(",");
}

/**
 * Validate a single File against a MIME allowlist + optional size cap.
 *
 * Returns `null` when the file is valid, or a human-readable error string.
 */
export function validateFile(
  file: File,
  allowed: readonly string[],
  maxBytes: number,
): string | null {
  // Block dangerous extensions first (before MIME check, as MIME can be spoofed)
  const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `"${file.name}" is a potentially unsafe file type and cannot be uploaded.`;
  }

  // MIME allowlist check (case-insensitive, handles .PNG / .JPEG etc.)
  // Some sources (Finder drag, Explorer drag, certain Linux uploads) don't
  // populate file.type at all. In that case we fall back to validating by
  // the cleared extension instead — the BLOCKED_EXTENSIONS check above
  // already cut off dangerous ones.
  const mime = file.type.toLowerCase();
  const allowedExt = mimeListToExtensions(allowed);
  const matchesMime = (allowed as readonly string[]).some((a) => a.toLowerCase() === mime);
  const matchesExtFallback = mime === "" && allowedExt.has(ext);
  const isAllowed = allowed.length === 0 || matchesMime || matchesExtFallback;

  if (!isAllowed) {
    const friendlyTypes = Array.from(new Set((allowed as readonly string[]).map(humanizeMime)))
      .join(", ");
    return `"${file.name}" — unsupported type (${file.type || "unknown"}). Allowed: ${friendlyTypes}.`;
  }

  // Ambiguous-MIME guard. application/vnd.ms-excel is reported by Windows
  // for BOTH legacy Excel-saved CSVs (.csv) and native binary .xls files.
  // Letting the MIME alone gate it would admit .xls files into CSV-only
  // importers (which can't parse them). When the MIME is in this group,
  // ALSO require the extension to be in the allowed set. Codex round-3
  // catch.
  if (matchesMime && AMBIGUOUS_MIMES.has(mime) && !allowedExt.has(ext)) {
    const friendlyTypes = Array.from(new Set((allowed as readonly string[]).map(humanizeMime)))
      .join(", ");
    return `"${file.name}" — extension "${ext}" doesn't match the allowed types. Allowed: ${friendlyTypes}.`;
  }

  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }

  if (file.size > maxBytes) {
    return `"${file.name}" is too large (${formatBytes(file.size)}). Max ${formatBytes(maxBytes)}.`;
  }

  return null;
}

/** Validate multiple files; returns array of error strings (empty = all OK). */
export function validateFiles(
  files: File[],
  allowed: readonly string[],
  maxBytes: number,
): string[] {
  return files
    .map((f) => validateFile(f, allowed, maxBytes))
    .filter((e): e is string => e !== null);
}

/** Human-readable label for a MIME type (e.g. "image/jpeg" → "JPG"). */
function humanizeMime(mime: string): string {
  const MAP: Record<string, string> = {
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/gif": "GIF",
    "image/svg+xml": "SVG",
    "video/mp4": "MP4",
    "video/webm": "WebM",
    "video/quicktime": "MOV",
    "audio/mpeg": "MP3",
    "audio/wav": "WAV",
    "audio/ogg": "OGG",
    "audio/mp4": "M4A",
    "audio/x-m4a": "M4A",
    "audio/webm": "WebM",
    "application/pdf": "PDF",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "text/plain": "TXT",
    "text/csv": "CSV",
    "text/markdown": "MD",
  };
  return MAP[mime] ?? mime.split("/").pop()?.toUpperCase() ?? mime;
}

/** Brief file-size formatter (shared with drop-zone hint text). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** Internal: project a MIME list to a Set of file extensions (".png", ".mp4", …)
 * so we can fall back to extension matching when file.type is empty (which
 * happens with some drag sources on macOS Finder / Linux file managers). */
function mimeListToExtensions(mimes: readonly string[]): Set<string> {
  const map: Record<string, string[]> = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
    "image/gif": [".gif"],
    "image/svg+xml": [".svg"],
    "video/mp4": [".mp4"],
    "video/webm": [".webm"],
    "video/quicktime": [".mov"],
    "audio/mpeg": [".mp3"],
    "audio/wav": [".wav"],
    "audio/x-wav": [".wav"],
    "audio/ogg": [".ogg"],
    "audio/mp4": [".m4a"],
    "audio/x-m4a": [".m4a"],
    "audio/webm": [".webm"],
    "application/pdf": [".pdf"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    // Excel-saved CSVs report this MIME but the file is still a CSV.
    // Map ONLY to .csv (NOT .xls) — native binary .xls files are not
    // supported by the importers that use ALLOWED_CSV (which only parses
    // text), so admitting .xls into the file picker would mislead users
    // into picking a file the importer can't read. Codex round-2 catch.
    "application/vnd.ms-excel": [".csv"],
    "application/csv": [".csv"],
    "text/plain": [".txt"],
    "text/csv": [".csv"],
    "text/markdown": [".md"],
  };
  const out = new Set<string>();
  for (const m of mimes) {
    for (const ext of map[m] || []) out.add(ext);
  }
  return out;
}
