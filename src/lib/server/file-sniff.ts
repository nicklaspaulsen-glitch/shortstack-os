/**
 * Server-side MIME sniffing via magic bytes.
 *
 * DEFENSE LAYER 2 — sits below the client-declared MIME check.
 * Layer 1: client-side MIME + extension allowlist (src/lib/file-types.ts).
 * Layer 2 (this file): magic-byte sniff using the `file-type` package.
 *
 * Why both layers?
 *   An attacker can trivially spoof `Content-Type` and `file.type`. The
 *   `file-type` package reads the actual bytes and infers the real format.
 *   If the sniffed type disagrees with the declared MIME and isn't in the
 *   allowlist, we reject before the bytes ever reach storage.
 *
 *   Caveat: text-based formats (CSV, plain-text, SVG, markdown) cannot be
 *   reliably sniffed by magic bytes. `fileTypeFromBuffer` returns `undefined`
 *   for them — that is expected and safe. In those cases we fall back to the
 *   MIME-based check already done at the route level.
 */

import { fileTypeFromBuffer } from "file-type";

/** Number of bytes passed to `fileTypeFromBuffer`. file-type needs ~64 bytes
 *  for most formats; 4096 is generous and avoids loading the whole file. */
const SNIFF_BYTES = 4096;

/**
 * Sniff the actual MIME type of `buffer` from magic bytes.
 * Returns the IANA MIME string (e.g. `"image/png"`) or `null` when the
 * format cannot be determined (text files, CSV, SVG, etc.).
 */
export async function sniffMimeType(buffer: Buffer): Promise<string | null> {
  const slice = buffer.subarray(0, SNIFF_BYTES);
  const result = await fileTypeFromBuffer(slice);
  return result?.mime ?? null;
}

/**
 * Verify that a buffer's magic bytes are consistent with the declared MIME
 * type and the route-level allowlist.
 *
 * Returns `null` when the file passes (safe to proceed), or a human-readable
 * error string when it should be rejected with HTTP 400.
 *
 * Decision table:
 *   sniffed === null          → text/unsniffable format; skip magic-byte check
 *   sniffed === declaredMime  → bytes match declaration; accept
 *   sniffed in allowed        → bytes are a known-safe type; accept
 *   otherwise                 → mismatch; reject
 */
export async function verifySniffedMime(
  buffer: Buffer,
  allowed: readonly string[],
  declaredMime: string,
): Promise<string | null> {
  const sniffed = await sniffMimeType(buffer);

  // Text / unsniffable formats return null — fall back to route-level MIME check
  if (sniffed === null) return null;

  // Magic bytes match the declared type — all good
  if (sniffed === declaredMime) return null;

  // Even if declared MIME differs, accept if the actual bytes are a valid type
  if (allowed.includes(sniffed)) return null;

  return (
    `File content (${sniffed}) does not match the declared type ` +
    `(${declaredMime || "unknown"}). Upload rejected for security.`
  );
}
