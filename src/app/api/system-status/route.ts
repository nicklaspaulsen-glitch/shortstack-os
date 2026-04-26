/**
 * Admin-only: Launch-readiness system status.
 *
 * Unlike /api/integrations/health (which checks *business* integrations your
 * clients use), this endpoint reports on the *operational* systems Trinity
 * itself depends on: Stripe, Supabase, Anthropic, cron authentication,
 * image generation, social posting, email, etc.
 *
 * Each system returns:
 *   - "ok"               — env present AND live probe succeeded
 *   - "configured"       — env present, no live probe available (or probe not worth doing)
 *   - "missing"          — required env vars missing
 *   - "error"            — env present but live probe failed
 *
 * Grouped by category so the UI can show headers.
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type Status = "ok" | "configured" | "missing" | "error";

interface CheckResult {
  id: string;
  label: string;
  status: Status;
  detail?: string;
  missing?: string[];
  critical: boolean; // if true, missing/error blocks launch
  docs_url?: string; // where to get the credential
}

interface StatusGroup {
  category: string;
  checks: CheckResult[];
}

const PROBE_TIMEOUT_MS = 4000;

async function probe(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(t);
  }
}

function missingEnv(keys: string[]): string[] {
  return keys.filter(k => !process.env[k]);
}

// ── Core infrastructure (launch-blocking) ─────────────────────────
async function checkSupabase(): Promise<CheckResult> {
  const missing = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (missing.length) return {
    id: "supabase", label: "Supabase (database)", status: "missing",
    missing, critical: true,
    docs_url: "https://supabase.com/dashboard",
  };
  // Supabase REST v1 requires both `apikey` header and `Authorization: Bearer`
  // header — the legacy ?apikey= query-string approach returns 401 on newer instances.
  const { ok, status } = await probe(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    }
  );
  return ok
    ? { id: "supabase", label: "Supabase (database)", status: "ok", critical: true }
    : { id: "supabase", label: "Supabase (database)", status: "error", detail: `REST API returned HTTP ${status || "timeout"}`, critical: true };
}

async function checkAnthropic(): Promise<CheckResult> {
  const missing = missingEnv(["ANTHROPIC_API_KEY"]);
  if (missing.length) return {
    id: "anthropic", label: "Claude (Anthropic API)", status: "missing",
    missing, critical: true,
    docs_url: "https://console.anthropic.com/settings/keys",
  };
  // Minimal zero-token models list call — fast and cheap
  const { ok, status } = await probe("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
  });
  return ok
    ? { id: "anthropic", label: "Claude (Anthropic API)", status: "ok", critical: true }
    : { id: "anthropic", label: "Claude (Anthropic API)", status: "error", detail: `Anthropic returned HTTP ${status || "timeout"}`, critical: true };
}

async function checkStripe(): Promise<CheckResult> {
  const missing = missingEnv(["STRIPE_SECRET_KEY"]);
  if (missing.length) return {
    id: "stripe", label: "Stripe (billing)", status: "missing",
    missing, critical: true,
    docs_url: "https://dashboard.stripe.com/apikeys",
  };
  const { ok, status } = await probe("https://api.stripe.com/v1/products?limit=1", {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  return ok
    ? { id: "stripe", label: "Stripe (billing)", status: "ok", critical: true }
    : { id: "stripe", label: "Stripe (billing)", status: "error", detail: `Stripe returned HTTP ${status || "timeout"}`, critical: true };
}

// Price IDs — not critical individually but any missing blocks that plan.
// Naming mirrors /api/billing/checkout → priceEnvName(): *_MONTHLY for
// monthly and *_ANNUAL (not YEARLY) for yearly, to match existing Vercel env.
function checkStripePrices(): CheckResult {
  const tiers = ["STARTER", "GROWTH", "PRO", "BUSINESS", "UNLIMITED"];
  const cycles = ["MONTHLY", "ANNUAL"];
  const missing: string[] = [];
  for (const t of tiers) {
    for (const c of cycles) {
      const key = `STRIPE_PRICE_${t}_${c}`;
      if (!process.env[key]) missing.push(key);
    }
  }
  const total = tiers.length * cycles.length;
  if (missing.length === total) {
    return {
      id: "stripe_prices", label: "Stripe Prices (plans)", status: "missing",
      missing, critical: true,
      detail: "No plan Prices configured — users can't subscribe",
      docs_url: "https://dashboard.stripe.com/prices",
    };
  }
  if (missing.length > 0) {
    return {
      id: "stripe_prices", label: "Stripe Prices (plans)", status: "error",
      missing, critical: false,
      detail: `${total - missing.length}/${total} plan prices set — missing plans won't be purchasable`,
      docs_url: "https://dashboard.stripe.com/prices",
    };
  }
  return { id: "stripe_prices", label: "Stripe Prices (plans)", status: "configured", critical: false, detail: `All ${total} tier/cycle combos configured` };
}

function checkStripeWebhook(): CheckResult {
  const missing = missingEnv(["STRIPE_WEBHOOK_SECRET"]);
  return missing.length
    ? {
      id: "stripe_webhook", label: "Stripe Webhook", status: "missing",
      missing, critical: true,
      detail: "Without webhook secret, plan upgrades won't apply",
      docs_url: "https://dashboard.stripe.com/webhooks",
    }
    : { id: "stripe_webhook", label: "Stripe Webhook", status: "configured", critical: true };
}

// ── Automation / cron ─────────────────────────────────────────────
function checkCron(): CheckResult {
  const missing = missingEnv(["CRON_SECRET"]);
  return missing.length
    ? {
      id: "cron", label: "Cron authentication", status: "missing",
      missing, critical: true,
      detail: "Cron workers will return 500 without this — content won't auto-publish",
    }
    : { id: "cron", label: "Cron authentication", status: "configured", critical: true };
}

// ── Content generation ─────────────────────────────────────────────
async function checkRunpodFlux(): Promise<CheckResult> {
  const missing = missingEnv(["RUNPOD_FLUX_ENDPOINT_ID", "RUNPOD_API_KEY"]);
  if (missing.length) return {
    id: "runpod_flux", label: "RunPod FLUX (images)", status: "missing",
    missing, critical: false,
    detail: "Image generation falls back to OpenAI if available",
    docs_url: "https://runpod.io/console/serverless",
  };
  // RunPod has a health endpoint but it requires the endpoint to be warm.
  // Skip live probe — just verify env.
  return { id: "runpod_flux", label: "RunPod FLUX (images)", status: "configured", critical: false };
}

// ── Publishing ─────────────────────────────────────────────────────
function checkZernio(): CheckResult {
  const missing = missingEnv(["ZERNIO_API_KEY"]);
  return missing.length
    ? {
      id: "zernio", label: "Zernio (social posting)", status: "missing",
      missing, critical: false,
      detail: "Auto-posting to TikTok / YouTube requires Zernio",
      docs_url: "https://zernio.com/dashboard",
    }
    : { id: "zernio", label: "Zernio (social posting)", status: "configured", critical: false };
}

function checkTelegram(): CheckResult {
  const missing = missingEnv(["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]);
  return missing.length
    ? {
      id: "telegram", label: "Telegram digest", status: "missing",
      missing, critical: false,
      detail: "Optional — receive publish-worker summaries in Telegram",
    }
    : { id: "telegram", label: "Telegram digest", status: "configured", critical: false };
}

// ── Email / comms ──────────────────────────────────────────────────
function checkResend(): CheckResult {
  const missing = missingEnv(["RESEND_API_KEY"]);
  return missing.length
    ? {
      id: "resend", label: "Resend (transactional email)", status: "missing",
      missing, critical: false,
      detail: "Password resets + client reports won't send",
      docs_url: "https://resend.com/api-keys",
    }
    : { id: "resend", label: "Resend (transactional email)", status: "configured", critical: false };
}

function checkSMTP(): CheckResult {
  const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missing = missingEnv(keys);
  if (missing.length === keys.length) {
    return {
      id: "smtp", label: "Custom SMTP", status: "missing",
      missing, critical: false,
      detail: "Optional — use your own SMTP instead of Resend",
    };
  }
  if (missing.length > 0) {
    return {
      id: "smtp", label: "Custom SMTP", status: "error",
      missing, critical: false,
      detail: `Partially configured — ${missing.length} of ${keys.length} vars missing`,
    };
  }
  return { id: "smtp", label: "Custom SMTP", status: "configured", critical: false };
}

// ── Domains ────────────────────────────────────────────────────────
function checkGoDaddy(): CheckResult {
  const missing = missingEnv(["GODADDY_RESELLER_KEY", "GODADDY_RESELLER_SECRET"]);
  return missing.length
    ? {
      id: "godaddy", label: "GoDaddy Reseller (domains)", status: "missing",
      missing, critical: false,
      detail: "Domain search falls back to public RDAP if missing",
      docs_url: "https://developer.godaddy.com/keys",
    }
    : { id: "godaddy", label: "GoDaddy Reseller (domains)", status: "configured", critical: false };
}

// ── App env ────────────────────────────────────────────────────────
function checkAppOrigin(): CheckResult {
  const missing = missingEnv(["NEXT_PUBLIC_APP_URL"]);
  return missing.length
    ? {
      id: "app_url", label: "App origin URL", status: "missing",
      missing, critical: true,
      detail: "Stripe success/cancel redirects + OAuth callbacks need this",
    }
    : { id: "app_url", label: "App origin URL", status: "configured", critical: true, detail: process.env.NEXT_PUBLIC_APP_URL };
}

// ── Cron-populated live probes (from system_health table) ──────────
// The /api/cron/health-check route runs every 30 min and upserts rows into
// `system_health` with real reachability data. We surface those here so
// admins see actual provider uptime, not just "env present?" checks.
async function loadCronProbes(supabase: ReturnType<typeof createServerSupabase>): Promise<{
  checks: CheckResult[];
  stale: boolean;
  last_run_at: string | null;
}> {
  try {
    const { data: rows } = await supabase
      .from("system_health")
      .select("integration_name, status, last_check_at, error_message, response_time_ms")
      .order("last_check_at", { ascending: false });

    if (!Array.isArray(rows) || rows.length === 0) {
      return { checks: [], stale: false, last_run_at: null };
    }

    const mostRecent = rows[0]?.last_check_at as string | null;
    const stale = mostRecent
      ? Date.now() - new Date(mostRecent).getTime() > 90 * 60 * 1000 // >90 min = stale
      : true;

    const checks: CheckResult[] = rows.map(r => {
      const rawStatus = (r.status as string | null) ?? "unknown";
      let status: Status;
      let detail: string | undefined;
      if (rawStatus === "healthy") {
        status = "ok";
        detail = r.response_time_ms ? `${r.response_time_ms}ms response` : undefined;
      } else if (rawStatus === "degraded") {
        status = "error";
        detail = r.error_message || "Provider responded but with an issue";
      } else if (rawStatus === "down") {
        status = "error";
        detail = r.error_message || "Provider unreachable";
      } else {
        // "unknown" = not configured → show as missing so it's grouped correctly
        status = "missing";
        detail = r.error_message || "Not configured";
      }
      return {
        id: `probe_${String(r.integration_name).toLowerCase().replace(/\W+/g, "_")}`,
        label: String(r.integration_name),
        status,
        detail,
        critical: false, // live probes are informational; env checks are authoritative for launch-blocking
      };
    });

    return { checks, stale, last_run_at: mostRecent };
  } catch {
    return { checks: [], stale: false, last_run_at: null };
  }
}

// ── Group assembler ────────────────────────────────────────────────
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Run live probes in parallel
  const [supa, anthropic, stripe, runpod, cronProbes] = await Promise.all([
    checkSupabase(),
    checkAnthropic(),
    checkStripe(),
    checkRunpodFlux(),
    loadCronProbes(supabase),
  ]);

  const groups: StatusGroup[] = [
    {
      category: "Core Infrastructure",
      checks: [checkAppOrigin(), supa, anthropic, checkCron()],
    },
    {
      category: "Billing",
      checks: [stripe, checkStripePrices(), checkStripeWebhook()],
    },
    {
      category: "Content Generation",
      checks: [runpod],
    },
    {
      category: "Publishing",
      checks: [checkZernio(), checkTelegram()],
    },
    {
      category: "Email",
      checks: [checkResend(), checkSMTP()],
    },
    {
      category: "Domains",
      checks: [checkGoDaddy()],
    },
  ];

  // Append cron-populated live probes as their own group
  if (cronProbes.checks.length > 0) {
    const staleDetail = cronProbes.stale && cronProbes.last_run_at
      ? `Last probe run was ${new Date(cronProbes.last_run_at).toLocaleString()} — data may be stale. Click "Run probes now" to refresh.`
      : undefined;
    groups.push({
      category: cronProbes.stale
        ? "Live Integration Probes (STALE — last run > 90m ago)"
        : "Live Integration Probes",
      checks: staleDetail
        ? [{
            id: "probe_staleness_warning",
            label: "Probe freshness",
            status: "error",
            detail: staleDetail,
            critical: false,
          }, ...cronProbes.checks]
        : cronProbes.checks,
    });
  }

  // Summary: launch-blocking issues. Live probes are informational only
  // (they're integrations, not Trinity-core systems), so only critical:true
  // rows count as blockers.
  const blockers: CheckResult[] = [];
  const warnings: CheckResult[] = [];
  for (const g of groups) {
    for (const c of g.checks) {
      if ((c.status === "missing" || c.status === "error") && c.critical) blockers.push(c);
      else if (c.status === "missing" || c.status === "error") warnings.push(c);
    }
  }

  return NextResponse.json({
    success: true,
    groups,
    summary: {
      blockers: blockers.length,
      warnings: warnings.length,
      ready_to_launch: blockers.length === 0,
      cron_probes_stale: cronProbes.stale,
      cron_probes_last_run: cronProbes.last_run_at,
    },
    checked_at: new Date().toISOString(),
  });
}
