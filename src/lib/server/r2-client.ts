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

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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
