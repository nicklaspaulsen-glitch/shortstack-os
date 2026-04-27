/**
 * Email validation — primary AbstractAPI, fallback Hunter.io.
 *
 * Free-tier quotas:
 *   - AbstractAPI Email Validation: 100 req/day
 *   - Hunter Email Verifier: 50 req/mo
 *
 * Soft-fail by design. If neither key is set, we return a "skipped" result and
 * the caller decides whether to send anyway. This is the right default for
 * cold-email so a missing key doesn't take the whole cold-email feature down.
 *
 * No throwing at module top — all keys are read lazily via getters.
 */

const TIMEOUT_MS = 5_000;

/** Final shape returned to callers. Stable across providers. */
export interface EmailValidationResult {
  email: string;
  is_valid: boolean;
  is_disposable: boolean;
  is_role_email: boolean;
  is_free_email: boolean;
  deliverability: "deliverable" | "undeliverable" | "risky" | "unknown";
  raw_score: number;
  provider: "abstractapi" | "hunter" | "skipped";
  /** Map onto the contact_validations.status enum. */
  status: "valid" | "risky" | "invalid" | "unknown" | "skipped";
}

function getAbstractKey(): string | null {
  return process.env.ABSTRACTAPI_EMAIL_KEY?.trim() || null;
}

function getHunterKey(): string | null {
  return process.env.HUNTER_API_KEY?.trim() || null;
}

function skippedResult(email: string): EmailValidationResult {
  return {
    email,
    is_valid: false,
    is_disposable: false,
    is_role_email: false,
    is_free_email: false,
    deliverability: "unknown",
    raw_score: 0,
    provider: "skipped",
    status: "skipped",
  };
}

function unknownResult(
  email: string,
  provider: EmailValidationResult["provider"],
): EmailValidationResult {
  return {
    email,
    is_valid: false,
    is_disposable: false,
    is_role_email: false,
    is_free_email: false,
    deliverability: "unknown",
    raw_score: 0,
    provider,
    status: "unknown",
  };
}

/** AbstractAPI email-validation response shape (subset we care about). */
interface AbstractApiResponse {
  email?: string;
  deliverability?: string;
  is_valid_format?: { value?: boolean };
  is_disposable_email?: { value?: boolean };
  is_role_email?: { value?: boolean };
  is_free_email?: { value?: boolean };
  is_smtp_valid?: { value?: boolean };
  quality_score?: string | number;
}

/** Hunter.io verifier response (subset). */
interface HunterResponse {
  data?: {
    status?: string;
    result?: string;
    score?: number;
    disposable?: boolean;
    webmail?: boolean;
    accept_all?: boolean;
    role?: boolean;
    smtp_check?: boolean;
  };
  errors?: Array<{ id?: string; code?: number; details?: string }>;
}

async function fetchWithTimeout(
  url: string,
  ms: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } catch (err) {
    console.warn(
      "[email-validator] fetch failed",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function deliverabilityFromAbstract(
  raw: string | undefined,
): EmailValidationResult["deliverability"] {
  switch ((raw || "").toUpperCase()) {
    case "DELIVERABLE":
      return "deliverable";
    case "UNDELIVERABLE":
      return "undeliverable";
    case "RISKY":
    case "UNKNOWN":
      return "risky";
    default:
      return "unknown";
  }
}

function statusFromDeliverability(
  d: EmailValidationResult["deliverability"],
  isDisposable: boolean,
): EmailValidationResult["status"] {
  if (isDisposable) return "invalid";
  switch (d) {
    case "deliverable":
      return "valid";
    case "undeliverable":
      return "invalid";
    case "risky":
      return "risky";
    default:
      return "unknown";
  }
}

async function validateViaAbstractApi(
  email: string,
  apiKey: string,
): Promise<EmailValidationResult | null> {
  const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`;
  const res = await fetchWithTimeout(url, TIMEOUT_MS);
  if (!res) return null;
  if (!res.ok) {
    console.warn("[email-validator] abstractapi non-200", res.status);
    return null;
  }
  let json: AbstractApiResponse;
  try {
    json = (await res.json()) as AbstractApiResponse;
  } catch {
    return null;
  }
  const deliverability = deliverabilityFromAbstract(json.deliverability);
  const isDisposable = json.is_disposable_email?.value === true;
  const isRole = json.is_role_email?.value === true;
  const isFree = json.is_free_email?.value === true;
  const isFormatValid = json.is_valid_format?.value === true;
  const rawScore =
    typeof json.quality_score === "number"
      ? json.quality_score
      : typeof json.quality_score === "string"
        ? Number.parseFloat(json.quality_score) || 0
        : 0;
  const isValid = isFormatValid && deliverability === "deliverable" && !isDisposable;
  return {
    email,
    is_valid: isValid,
    is_disposable: isDisposable,
    is_role_email: isRole,
    is_free_email: isFree,
    deliverability,
    raw_score: rawScore,
    provider: "abstractapi",
    status: statusFromDeliverability(deliverability, isDisposable),
  };
}

async function validateViaHunter(
  email: string,
  apiKey: string,
): Promise<EmailValidationResult | null> {
  const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetchWithTimeout(url, TIMEOUT_MS);
  if (!res) return null;
  if (!res.ok) {
    console.warn("[email-validator] hunter non-200", res.status);
    return null;
  }
  let json: HunterResponse;
  try {
    json = (await res.json()) as HunterResponse;
  } catch {
    return null;
  }
  const data = json.data;
  if (!data) return null;
  const result = (data.result || data.status || "").toLowerCase();
  // Hunter "result" buckets: deliverable, undeliverable, risky, unknown.
  const deliverability: EmailValidationResult["deliverability"] =
    result === "deliverable"
      ? "deliverable"
      : result === "undeliverable"
        ? "undeliverable"
        : result === "risky"
          ? "risky"
          : "unknown";
  const score =
    typeof data.score === "number" ? Math.max(0, Math.min(100, data.score)) / 100 : 0;
  const isDisposable = data.disposable === true;
  const isRole = data.role === true;
  const isFree = data.webmail === true;
  const isValid = deliverability === "deliverable" && !isDisposable;
  return {
    email,
    is_valid: isValid,
    is_disposable: isDisposable,
    is_role_email: isRole,
    is_free_email: isFree,
    deliverability,
    raw_score: score,
    provider: "hunter",
    status: statusFromDeliverability(deliverability, isDisposable),
  };
}

/**
 * Validate a single email. Tries AbstractAPI first, falls back to Hunter, then
 * returns a "skipped" placeholder if neither is configured.
 *
 * Never throws. On network/parse error we degrade to "unknown" so the caller
 * can still decide what to do (e.g. send anyway with EMAIL_VALIDATION_STRICT=false).
 */
export async function validateEmail(
  email: string,
): Promise<EmailValidationResult> {
  const trimmed = (email || "").trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    return {
      email: trimmed,
      is_valid: false,
      is_disposable: false,
      is_role_email: false,
      is_free_email: false,
      deliverability: "undeliverable",
      raw_score: 0,
      provider: "skipped",
      status: "invalid",
    };
  }

  const abstractKey = getAbstractKey();
  if (abstractKey) {
    const r = await validateViaAbstractApi(trimmed, abstractKey);
    if (r) return r;
  }

  const hunterKey = getHunterKey();
  if (hunterKey) {
    const r = await validateViaHunter(trimmed, hunterKey);
    if (r) return r;
  }

  if (!abstractKey && !hunterKey) {
    return skippedResult(trimmed);
  }

  // Both providers configured but both failed → unknown.
  return unknownResult(trimmed, abstractKey ? "abstractapi" : "hunter");
}

/**
 * Validate many emails. Respects free-tier rate limits with light throttling
 * (default concurrency = 5, ~50 req over 10s). Caller is responsible for
 * not exceeding daily caps — we do not persist quota state here.
 */
export async function validateEmailsBatch(
  emails: string[],
  maxConcurrency = 5,
): Promise<Map<string, EmailValidationResult>> {
  const result = new Map<string, EmailValidationResult>();
  const unique = Array.from(new Set(emails.map((e) => (e || "").trim().toLowerCase())));
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < unique.length) {
      const idx = cursor++;
      const email = unique[idx];
      if (!email) continue;
      const validation = await validateEmail(email);
      result.set(email, validation);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(maxConcurrency, unique.length || 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  return result;
}
