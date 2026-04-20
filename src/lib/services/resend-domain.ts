/**
 * Resend Domain API wrapper.
 *
 * Lets the domain auto-setup flow provision a domain in Resend, fetch the
 * DNS records Resend needs (DKIM/SPF/MX for inbound, return-path), write them
 * to GoDaddy, and kick off verification.
 *
 * Auth: uses `process.env.SMTP_PASS` which is already wired as the shared
 * full-access Resend API key (see ENV_CHECKLIST.md). Falls back to
 * `RESEND_API_KEY` if someone wants to split the key per service.
 *
 * All functions return `{ ok: false, error }` on non-2xx / thrown errors
 * rather than throwing — callers can branch without try/catch bloat.
 */

const RESEND_BASE = "https://api.resend.com";

export interface ResendDnsRecord {
  type: string;        // "TXT" | "MX" | "CNAME"
  name: string;        // e.g. "resend._domainkey.example.com" or "send"
  value: string;       // record target / TXT content
  priority?: number;   // only for MX
  ttl?: string | number;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: string;       // "not_started" | "pending" | "verified" | "failed" | ...
  region?: string;
  created_at?: string;
  records?: ResendDnsRecord[];
}

export type ResendResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

function getApiKey(): string | null {
  return process.env.SMTP_PASS || process.env.RESEND_API_KEY || null;
}

async function resendFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ResendResult<T>> {
  const key = getApiKey();
  if (!key) return { ok: false, error: "Missing SMTP_PASS / RESEND_API_KEY" };

  try {
    const res = await fetch(`${RESEND_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    }
    if (!res.ok) {
      const message =
        (parsed && typeof parsed === "object" && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : null) ||
        (typeof parsed === "string" ? parsed : null) ||
        `Resend returned HTTP ${res.status}`;
      return { ok: false, error: message, status: res.status };
    }
    return { ok: true, data: parsed as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Normalize the Resend API's record shape into something stable for callers
 * and storage. Resend's docs + actual responses drift between fields like
 * `record` / `value` / `data`, so pick whichever is present.
 */
interface RawResendRecord {
  record?: string;
  type?: string;
  name?: string;
  value?: string;
  data?: string;
  content?: string;
  priority?: number;
  ttl?: string | number;
}

function normalizeRecord(r: RawResendRecord): ResendDnsRecord {
  return {
    type: (r.type || r.record || "TXT").toUpperCase(),
    name: r.name || "",
    value: r.value ?? r.data ?? r.content ?? "",
    priority: typeof r.priority === "number" ? r.priority : undefined,
    ttl: r.ttl,
  };
}

function normalizeDomain(raw: unknown): ResendDomain {
  const d = (raw || {}) as Record<string, unknown> & {
    records?: RawResendRecord[];
  };
  return {
    id: String(d.id ?? ""),
    name: String(d.name ?? ""),
    status: String(d.status ?? "pending"),
    region: typeof d.region === "string" ? d.region : undefined,
    created_at: typeof d.created_at === "string" ? d.created_at : undefined,
    records: Array.isArray(d.records) ? d.records.map(normalizeRecord) : [],
  };
}

/**
 * Create a domain in Resend. Returns the Resend id + the DNS records that
 * need to be present on the authoritative server (GoDaddy in our case).
 *
 * Region defaults to "us-east-1" which is Resend's default sending region —
 * fine for agency use; callers can override per-domain if they ever want
 * EU/APAC routing.
 */
export async function addResendDomain(
  name: string,
  region = "us-east-1",
): Promise<ResendResult<ResendDomain>> {
  const res = await resendFetch<unknown>("/domains", {
    method: "POST",
    body: JSON.stringify({ name, region }),
  });
  if (!res.ok) return res;
  return { ok: true, data: normalizeDomain(res.data) };
}

export async function getResendDomain(
  id: string,
): Promise<ResendResult<ResendDomain>> {
  const res = await resendFetch<unknown>(`/domains/${encodeURIComponent(id)}`);
  if (!res.ok) return res;
  return { ok: true, data: normalizeDomain(res.data) };
}

/**
 * Tell Resend to re-check the domain's DNS. Resend then polls on its own; the
 * status transitions from `pending` → `verifying` → `verified`/`failed`.
 */
export async function verifyResendDomain(
  id: string,
): Promise<ResendResult<ResendDomain>> {
  const res = await resendFetch<unknown>(
    `/domains/${encodeURIComponent(id)}/verify`,
    { method: "POST" },
  );
  if (!res.ok) return res;
  return { ok: true, data: normalizeDomain(res.data) };
}

export interface ResendDomainListEntry {
  id: string;
  name: string;
  status: string;
  region?: string;
  created_at?: string;
}

export async function listResendDomains(): Promise<
  ResendResult<ResendDomainListEntry[]>
> {
  const res = await resendFetch<{ data?: ResendDomainListEntry[] } | ResendDomainListEntry[]>(
    "/domains",
  );
  if (!res.ok) return res;
  const raw = res.data;
  const arr = Array.isArray(raw) ? raw : raw?.data || [];
  return { ok: true, data: arr };
}

export async function deleteResendDomain(
  id: string,
): Promise<ResendResult<{ deleted: boolean }>> {
  const res = await resendFetch<unknown>(
    `/domains/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!res.ok) return res;
  return { ok: true, data: { deleted: true } };
}

/**
 * Translate Resend's status strings into the enum we store in
 * `website_domains.resend_status`. Resend has more granular states than we
 * need — bucket anything that's not clearly verified/failed as "verifying".
 */
export function mapResendStatus(
  raw: string | null | undefined,
): "pending" | "verifying" | "verified" | "failed" {
  const s = (raw || "").toLowerCase();
  if (s === "verified") return "verified";
  if (s === "failed" || s === "temporary_failure") return "failed";
  if (s === "not_started" || s === "" || s === "pending") return "pending";
  return "verifying";
}

/**
 * Convert Resend's DNS records into the shape our GoDaddy DNS PATCH endpoint
 * expects: `{ type, name, data, ttl?, priority? }` with the `name` stripped
 * down to the host (GoDaddy names records relative to the root domain).
 */
export function resendRecordsToGoDaddy(
  records: ResendDnsRecord[],
  rootDomain: string,
): Array<{
  type: string;
  name: string;
  data: string;
  ttl: number;
  priority?: number;
}> {
  return records.map(r => {
    // Resend gives fully qualified names like "send.example.com" or
    // "resend._domainkey.example.com". GoDaddy wants the host portion
    // relative to the root, or "@" for the apex.
    let host = r.name;
    if (host.endsWith(`.${rootDomain}`)) {
      host = host.slice(0, -1 * (rootDomain.length + 1));
    } else if (host === rootDomain) {
      host = "@";
    }
    return {
      type: r.type,
      name: host || "@",
      data: r.value,
      ttl: typeof r.ttl === "number" ? r.ttl : Number(r.ttl) || 3600,
      ...(typeof r.priority === "number" ? { priority: r.priority } : {}),
    };
  });
}
