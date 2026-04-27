/**
 * Lazy-initialised Cloudflare R2 S3 client.
 *
 * R2 exposes an S3-compatible API via @aws-sdk/client-s3. The same
 * lazy-singleton pattern used by getStripe() / the Anthropic helper
 * is applied here — module-level `new S3Client()` is BANNED per CLAUDE.md
 * because Next.js page-data collection imports every route module at
 * build time, before runtime env vars are available.
 *
 * Required Vercel env vars:
 *   R2_ACCOUNT_ID         Cloudflare account ID
 *   R2_ACCESS_KEY_ID      R2 API token — Access Key ID
 *   R2_SECRET_ACCESS_KEY  R2 API token — Secret Access Key
 *   R2_S3_ENDPOINT        https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *   R2_BUCKET_NAME        shortstack-cdn
 *   R2_PUBLIC_URL         https://cdn.shortstack.cloud
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _r2: S3Client | null = null;

/** Required env var names. Checked once on first call. */
const REQUIRED_VARS = [
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_S3_ENDPOINT",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

/**
 * Returns a lazy-initialised S3Client pointed at Cloudflare R2.
 * Throws a descriptive error if any required env var is missing — fail fast
 * inside the request handler rather than silently uploading nowhere.
 */
export function getR2(): S3Client {
  if (_r2) return _r2;

  const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `R2 client: missing required env vars: ${missing.join(", ")}. ` +
        "Set them in Vercel env (or .env.local for dev) before calling R2-backed routes.",
    );
  }

  _r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_S3_ENDPOINT,
    // R2 uses virtual-hosted-style URLs — forcePathStyle MUST stay false.
    forcePathStyle: false,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });

  return _r2;
}

/** Resolved once per cold-start alongside getR2(). */
function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME env var is not set.");
  return bucket;
}

function getPublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) throw new Error("R2_PUBLIC_URL env var is not set.");
  // Strip trailing slash so callers can safely do `${base}/${key}`.
  return url.replace(/\/$/, "");
}

/**
 * Upload a Buffer to R2 and return the public CDN URL.
 *
 * @param key         Object key inside the bucket (no leading slash).
 *                    Convention: `{prefix}/{user_id}/{ts}-{name}.{ext}`
 * @param buffer      Raw file bytes — must have already passed verifySniffedMime.
 * @param contentType IANA MIME type (e.g. "image/png").
 * @returns           Public URL: `${R2_PUBLIC_URL}/${key}`
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const r2 = getR2();
  const bucket = getBucketName();

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return `${getPublicUrl()}/${key}`;
}

/**
 * Delete an object from R2 by key. Best-effort — callers should not surface
 * a delete error to the end user when the primary upload operation succeeded.
 *
 * @param key Object key inside the bucket (same value used in uploadToR2).
 */
export async function deleteFromR2(key: string): Promise<void> {
  const r2 = getR2();
  const bucket = getBucketName();

  await r2.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

/** Default TTL for presigned GET URLs (1 hour). */
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Generate a presigned GET URL for an R2 object.
 * The URL expires after `ttlSeconds` (default 1 hour), restoring the
 * same access boundary that Supabase `createSignedUrl` provided.
 *
 * @param key        Object key inside the bucket (no leading slash).
 * @param ttlSeconds Expiry in seconds (default: SIGNED_URL_TTL_SECONDS = 3600).
 * @returns          A time-limited presigned HTTPS URL.
 */
export async function getR2SignedGetUrl(
  key: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const r2 = getR2();
  const bucket = getBucketName();

  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: ttlSeconds },
  );
}

/**
 * Derive the R2 object key from a public CDN URL previously stored in the DB.
 * Returns null when the URL doesn't look like an R2 CDN URL (e.g. old Supabase
 * URLs that still exist in the DB — those are left untouched).
 */
export function r2KeyFromPublicUrl(publicUrl: string): string | null {
  const base = getPublicUrl();
  if (!publicUrl.startsWith(base + "/")) return null;
  // Strip base and any query string (cache-bust `?v=...`)
  return publicUrl.slice(base.length + 1).split("?")[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace Files helpers — added in feat/workspace-files (Apr 27).
//
// These are the exports the Workspace Files API routes consume. They follow
// the naming the migration brief specified (getR2Client / getR2BucketName /
// getR2PublicUrl) so future R2 surfaces have a stable interface, even though
// we already have getR2() / getBucketName() / getPublicUrl() above as the
// internal singletons. The "public" names just delegate.
// ─────────────────────────────────────────────────────────────────────────────

/** Brief-spec name. Returns the lazy R2 S3Client. */
export function getR2Client(): S3Client {
  return getR2();
}

/** Brief-spec name. Returns the bucket name from env. */
export function getR2BucketName(): string {
  return getBucketName();
}

/** Brief-spec name. Returns the trailing-slash-trimmed CDN URL. */
export function getR2PublicUrl(): string {
  return getPublicUrl();
}

/** Default TTL for presigned PUT URLs used by the upload-url route (5 min). */
export const SIGNED_PUT_URL_TTL_SECONDS = 300;

/**
 * Generate a presigned PUT URL for direct browser → R2 upload.
 *
 * The browser calls `fetch(upload_url, { method: 'PUT', body: file })`. The
 * Content-Type the browser sends MUST match the `contentType` baked into the
 * signature — otherwise R2 will reject with SignatureDoesNotMatch.
 *
 * @param key         Object key in the bucket (no leading slash).
 * @param contentType IANA MIME type the browser will set on the PUT.
 * @param ttlSeconds  Expiry in seconds (default: 300 / 5 min).
 */
export async function getR2SignedPutUrl(
  key: string,
  contentType: string,
  ttlSeconds: number = SIGNED_PUT_URL_TTL_SECONDS,
): Promise<string> {
  const r2 = getR2();
  const bucket = getBucketName();

  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: ttlSeconds },
  );
}

/**
 * Verify that an object exists in R2. Used by the /finalize route to confirm
 * the browser's PUT actually landed before flipping the DB row to 'ready'.
 *
 * @returns true if the object exists, false otherwise (incl. 403 / 404).
 */
export async function r2ObjectExists(key: string): Promise<boolean> {
  const r2 = getR2();
  const bucket = getBucketName();
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete many objects in batches of up to 1000 (the S3 DeleteObjects limit).
 * Used by recursive-folder-delete to clean up R2 after a cascade DELETE on
 * the workspace_folders row.
 *
 * Best-effort: errors on individual keys are swallowed so a partial failure
 * doesn't block the DB cascade. The caller surfaces "row deleted" success
 * even if a stray R2 object lingered.
 */
export async function deleteFromR2Batch(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const r2 = getR2();
  const bucket = getBucketName();

  // S3 DeleteObjects caps at 1000 keys per request.
  const BATCH = 1000;
  for (let i = 0; i < keys.length; i += BATCH) {
    const slice = keys.slice(i, i + BATCH);
    try {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: slice.map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
    } catch (err) {
      // Log + continue — DB cascade has already happened.
      console.error("[r2-client] batch delete failed:", err);
    }
  }
}

/**
 * Build the public CDN URL for an R2 key. Inverse of r2KeyFromPublicUrl.
 * Used when storing the convenience `r2_public_url` on workspace_files rows.
 */
export function r2PublicUrlFor(key: string): string {
  return `${getPublicUrl()}/${key}`;
}
