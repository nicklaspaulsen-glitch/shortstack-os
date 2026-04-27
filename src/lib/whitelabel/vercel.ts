const VERCEL_API_BASE = "https://api.vercel.com";

interface VercelEnv {
  token: string;
  projectId: string;
  teamId: string | null;
}

function readVercelEnv(): VercelEnv | null {
  const token = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN || "";
  const projectId = process.env.VERCEL_PROJECT_ID || "";
  const teamId = process.env.VERCEL_TEAM_ID || null;
  if (!token || !projectId) return null;
  return { token, projectId, teamId };
}

function withTeamQuery(env: VercelEnv, path: string): string {
  return env.teamId
    ? `${path}${path.includes("?") ? "&" : "?"}teamId=${env.teamId}`
    : path;
}

export interface VercelDomainAddResult {
  ok: boolean;
  verified: boolean;
  error?: string;
  raw?: unknown;
}

export async function addDomainToProject(domain: string): Promise<VercelDomainAddResult> {
  const env = readVercelEnv();
  if (!env) return { ok: false, verified: false, error: "VERCEL_API_TOKEN / VERCEL_PROJECT_ID not configured" };
  try {
    const res = await fetch(
      withTeamQuery(env, `${VERCEL_API_BASE}/v10/projects/${env.projectId}/domains`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.token}` },
        body: JSON.stringify({ name: domain }),
      },
    );
    const data: unknown = await res.json().catch(() => ({}));
    const errorCode = (data as { error?: { code?: string; message?: string } })?.error?.code;
    const errorMessage = (data as { error?: { code?: string; message?: string } })?.error?.message;
    const verified = (data as { verified?: boolean })?.verified === true;
    if (res.ok) return { ok: true, verified, raw: data };
    if (errorCode === "domain_already_in_use" || errorCode === "domain_already_in_project") {
      return { ok: true, verified: false, raw: data };
    }
    return { ok: false, verified: false, error: errorMessage || `Vercel add failed (${res.status})`, raw: data };
  } catch (err) {
    return { ok: false, verified: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface VercelDomainVerifyResult {
  ok: boolean;
  verified: boolean;
  error?: string;
  raw?: unknown;
}

export async function verifyProjectDomain(domain: string): Promise<VercelDomainVerifyResult> {
  const env = readVercelEnv();
  if (!env) return { ok: false, verified: false, error: "VERCEL_API_TOKEN / VERCEL_PROJECT_ID not configured" };
  try {
    const res = await fetch(
      withTeamQuery(env, `${VERCEL_API_BASE}/v9/projects/${env.projectId}/domains/${encodeURIComponent(domain)}/verify`),
      { method: "POST", headers: { Authorization: `Bearer ${env.token}` } },
    );
    const data: unknown = await res.json().catch(() => ({}));
    const verified = (data as { verified?: boolean })?.verified === true;
    if (res.ok) return { ok: true, verified, raw: data };
    const errorMessage = (data as { error?: { message?: string } })?.error?.message;
    return { ok: false, verified, error: errorMessage || `Vercel verify failed (${res.status})`, raw: data };
  } catch (err) {
    return { ok: false, verified: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface VercelDomainRemoveResult {
  ok: boolean;
  error?: string;
}

export async function removeDomainFromProject(domain: string): Promise<VercelDomainRemoveResult> {
  const env = readVercelEnv();
  if (!env) return { ok: false, error: "VERCEL_API_TOKEN / VERCEL_PROJECT_ID not configured" };
  try {
    const res = await fetch(
      withTeamQuery(env, `${VERCEL_API_BASE}/v9/projects/${env.projectId}/domains/${encodeURIComponent(domain)}`),
      { method: "DELETE", headers: { Authorization: `Bearer ${env.token}` } },
    );
    if (res.ok || res.status === 404) return { ok: true };
    const data = await res.json().catch(() => ({}));
    const errorMessage = (data as { error?: { message?: string } })?.error?.message;
    return { ok: false, error: errorMessage || `Vercel remove failed (${res.status})` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function validateCustomDomain(input: string): string | null {
  const trimmed = (input || "").trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.includes("/") || trimmed.includes(":") || trimmed.includes(" ")) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) return null;
  const RESERVED = new Set([
    "shortstack.work",
    "www.shortstack.work",
    "app.shortstack.work",
    "shortstack-os.vercel.app",
    "vercel.app",
    "vercel.com",
  ]);
  if (RESERVED.has(trimmed)) return null;
  return trimmed;
}
