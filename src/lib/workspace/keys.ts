/**
 * Workspace Files — R2 key + filename helpers.
 *
 * Convention for keys:
 *   workspace/{agency_owner_id}/{folder_id}/{ts}-{slug(name)}.{ext}
 *
 * The agency_owner_id prefix means recursive-folder-delete can do a cheap
 * prefix scan + batch delete without joining files-by-folder in DB. The
 * folder_id second segment makes "list R2 objects in this folder" possible
 * even when the DB row has been deleted but the object lingered.
 */

/** Slugify a filename (without extension) — keeps ascii alnum + dash. */
export function slugifyFilename(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\.[^.]+$/, "") // strip extension; we re-add it below
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
}

/** Pull the file extension (without dot, lowercased). Returns "" if none. */
export function extOf(name: string): string {
  const m = /\.([^.]+)$/.exec(name);
  if (!m) return "";
  return m[1].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
}

/**
 * Build the canonical R2 object key for a workspace file.
 * Caller is responsible for passing already-validated UUIDs.
 */
export function buildWorkspaceFileKey(opts: {
  agencyOwnerId: string;
  folderId: string;
  fileName: string;
}): string {
  const { agencyOwnerId, folderId, fileName } = opts;
  const ts = Date.now();
  const slug = slugifyFilename(fileName);
  const ext = extOf(fileName);
  const tail = ext ? `${ts}-${slug}.${ext}` : `${ts}-${slug}`;
  return `workspace/${agencyOwnerId}/${folderId}/${tail}`;
}

/** Hard upper limit on a single file upload (1 GiB). */
export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
