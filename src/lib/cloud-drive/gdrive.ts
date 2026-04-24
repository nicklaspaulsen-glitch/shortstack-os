/**
 * Google Drive OAuth + file helpers.
 *
 * The portal uses this to:
 *  - build the consent URL (`buildGDriveAuthUrl`)
 *  - exchange a code on callback (`exchangeGDriveCode`)
 *  - list files (`listGDriveFiles`)
 *  - download a file's bytes for import into our Storage bucket (`downloadGDriveFile`)
 *
 * Tokens on disk (client_oauth_tokens) are AES-256-GCM encrypted with
 * src/lib/crypto/token-cipher.ts — encrypt before insert, decrypt on load.
 */
import { google, type drive_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export const GDRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getGDriveEnv() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  };
}

export function missingGDriveEnv(): string[] {
  const { clientId, clientSecret, redirectUri } = getGDriveEnv();
  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!redirectUri) missing.push("GOOGLE_OAUTH_REDIRECT_URI");
  return missing;
}

/** Build a configured OAuth2 client. Throws if env is missing. */
export function createGDriveOAuthClient(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = getGDriveEnv();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      `Google Drive OAuth not configured. Missing: ${missingGDriveEnv().join(", ")}`,
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Build the consent-screen URL for the portal to redirect the client to.
 * `state` is opaque to us — portal signs & verifies it.
 */
export function buildGDriveAuthUrl(state: string): string {
  const client = createGDriveOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GDRIVE_SCOPES,
    include_granted_scopes: true,
    state,
  });
}

export interface GDriveTokenBundle {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null; // ISO
  scopes: string[];
}

export async function exchangeGDriveCode(code: string): Promise<GDriveTokenBundle> {
  const client = createGDriveOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error("No access token returned from Google");
  }
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    scopes: (tokens.scope || "").split(" ").filter(Boolean),
  };
}

/** Produce an authed Drive client from decrypted tokens. */
export function gdriveFromTokens(tokens: {
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
}): drive_v3.Drive {
  const client = createGDriveOAuthClient();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expires_at ? new Date(tokens.expires_at).getTime() : undefined,
  });
  return google.drive({ version: "v3", auth: client });
}

export interface GDriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  iconLink: string | null;
  webViewLink: string | null;
}

export async function listGDriveFiles(
  drive: drive_v3.Drive,
  pageSize = 50,
): Promise<GDriveFileSummary[]> {
  const res = await drive.files.list({
    pageSize,
    fields: "files(id, name, mimeType, size, modifiedTime, iconLink, webViewLink)",
    orderBy: "modifiedTime desc",
    q: "trashed = false",
  });
  return (res.data.files || []).map((f) => ({
    id: f.id || "",
    name: f.name || "(unnamed)",
    mimeType: f.mimeType || "application/octet-stream",
    size: f.size ? Number(f.size) : null,
    modifiedTime: f.modifiedTime || null,
    iconLink: f.iconLink || null,
    webViewLink: f.webViewLink || null,
  }));
}

/**
 * Download a Drive file as a Buffer. For Google-native docs (mimeType starts with
 * application/vnd.google-apps.*) we export to a portable format — docs → pdf,
 * sheets → xlsx, slides → pptx. Everything else streams raw.
 */
export async function downloadGDriveFile(
  drive: drive_v3.Drive,
  fileId: string,
  sourceMime: string,
): Promise<{ buffer: Buffer; mimeType: string; suggestedExt: string }> {
  const nativeExports: Record<string, { mimeType: string; ext: string }> = {
    "application/vnd.google-apps.document": {
      mimeType: "application/pdf",
      ext: ".pdf",
    },
    "application/vnd.google-apps.spreadsheet": {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ext: ".xlsx",
    },
    "application/vnd.google-apps.presentation": {
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ext: ".pptx",
    },
  };

  if (nativeExports[sourceMime]) {
    const exp = nativeExports[sourceMime];
    const res = await drive.files.export(
      { fileId, mimeType: exp.mimeType },
      { responseType: "arraybuffer" },
    );
    return {
      buffer: Buffer.from(res.data as ArrayBuffer),
      mimeType: exp.mimeType,
      suggestedExt: exp.ext,
    };
  }

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );
  return {
    buffer: Buffer.from(res.data as ArrayBuffer),
    mimeType: sourceMime,
    suggestedExt: "",
  };
}
