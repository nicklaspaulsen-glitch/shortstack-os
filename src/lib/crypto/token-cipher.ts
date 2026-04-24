/**
 * AES-256-GCM symmetric cipher for OAuth tokens at rest.
 *
 * Used by client_oauth_tokens.{access_token,refresh_token} — the DB columns
 * store the ciphertext string produced by `encryptToken` and decrypted on
 * read with `decryptToken`.
 *
 * Key material:
 *   OAUTH_TOKEN_ENCRYPTION_KEY — 32 bytes, hex-encoded (64 hex chars).
 *   Generate with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Ciphertext format (all pieces base64url, dot-separated):
 *   <iv>.<auth_tag>.<ciphertext>
 *
 * IV is 12 bytes (96-bit), random per encryption. Auth tag is 16 bytes.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_ENV = "OAUTH_TOKEN_ENCRYPTION_KEY";

function loadKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(
      `${KEY_ENV} is not set. Generate 32 random bytes as hex and add it to .env.local.`,
    );
  }
  const hex = raw.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `${KEY_ENV} must be a 64-char hex string (32 bytes). Got length ${hex.length}.`,
    );
  }
  return Buffer.from(hex, "hex");
}

function toB64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromB64Url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

export function encryptToken(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new Error("encryptToken: plaintext must be a string");
  }
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${toB64Url(iv)}.${toB64Url(tag)}.${toB64Url(enc)}`;
}

export function decryptToken(ciphertext: string): string {
  if (typeof ciphertext !== "string" || !ciphertext.includes(".")) {
    throw new Error("decryptToken: invalid ciphertext format");
  }
  const parts = ciphertext.split(".");
  if (parts.length !== 3) {
    throw new Error("decryptToken: expected 3 dot-separated segments");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = loadKey();
  const iv = fromB64Url(ivB64);
  const tag = fromB64Url(tagB64);
  const data = fromB64Url(dataB64);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

/** Try decrypt, return null on any failure (expired key, tampering, etc). */
export function tryDecryptToken(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  try {
    return decryptToken(ciphertext);
  } catch {
    return null;
  }
}

/** Safe encryption of an optional field (returns null for null input). */
export function encryptTokenOrNull(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  return encryptToken(plaintext);
}
