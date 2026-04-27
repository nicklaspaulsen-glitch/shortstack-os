/**
 * Phone validation — primary AbstractAPI Phone Validation, fallback NumVerify.
 *
 * Free-tier quotas:
 *   - AbstractAPI Phone Validation: 250 req/mo
 *   - NumVerify (apilayer): 100 req/mo
 *
 * Soft-fail like email-validator: if neither key is set we return a "skipped"
 * placeholder. Network/parse failures degrade to "unknown".
 *
 * Phones are normalised to E.164 (with leading "+") before being sent to the
 * provider. Caller is responsible for passing in something sensible — we do a
 * best-effort cleanup but won't guess country codes beyond US fallback.
 */

const TIMEOUT_MS = 5_000;

export type PhoneLineType = "mobile" | "landline" | "voip" | "unknown";

export interface PhoneValidationResult {
  phone: string;
  is_valid: boolean;
  country_code: string | null;
  country_name: string | null;
  line_type: PhoneLineType;
  carrier: string | null;
  provider: "abstractapi" | "numverify" | "skipped";
  status: "valid" | "risky" | "invalid" | "unknown" | "skipped";
}

function getAbstractPhoneKey(): string | null {
  return process.env.ABSTRACTAPI_PHONE_KEY?.trim() || null;
}

function getNumVerifyKey(): string | null {
  return process.env.NUMVERIFY_KEY?.trim() || null;
}

function skippedResult(phone: string): PhoneValidationResult {
  return {
    phone,
    is_valid: false,
    country_code: null,
    country_name: null,
    line_type: "unknown",
    carrier: null,
    provider: "skipped",
    status: "skipped",
  };
}

function unknownResult(
  phone: string,
  provider: PhoneValidationResult["provider"],
): PhoneValidationResult {
  return {
    phone,
    is_valid: false,
    country_code: null,
    country_name: null,
    line_type: "unknown",
    carrier: null,
    provider,
    status: "unknown",
  };
}

/** Normalise to E.164. Falls back to +1 prefix when missing. */
export function toE164(raw: string): string | null {
  const cleaned = (raw || "").replace(/[^\d+]/g, "");
  if (cleaned.length < 7 || cleaned.length > 16) return null;
  return cleaned.startsWith("+") ? cleaned : `+1${cleaned}`;
}

interface AbstractPhoneResponse {
  phone?: string;
  valid?: boolean;
  format?: { international?: string; local?: string };
  country?: { code?: string; name?: string };
  line_type?: string;
  carrier?: string;
}

interface NumVerifyResponse {
  valid?: boolean;
  number?: string;
  international_format?: string;
  country_code?: string;
  country_name?: string;
  line_type?: string;
  carrier?: string;
  error?: { code?: number; info?: string };
}

async function fetchWithTimeout(
  url: string,
  ms: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    console.warn(
      "[phone-validator] fetch failed",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function lineTypeFromString(raw: string | undefined): PhoneLineType {
  const r = (raw || "").toLowerCase();
  if (r.includes("mobile") || r.includes("cell") || r.includes("wireless")) return "mobile";
  if (r.includes("landline") || r.includes("fixed_line") || r.includes("fixed")) return "landline";
  if (r.includes("voip")) return "voip";
  return "unknown";
}

async function validateViaAbstractApi(
  phone: string,
  apiKey: string,
): Promise<PhoneValidationResult | null> {
  const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(apiKey)}&phone=${encodeURIComponent(phone)}`;
  const res = await fetchWithTimeout(url, TIMEOUT_MS);
  if (!res) return null;
  if (!res.ok) {
    console.warn("[phone-validator] abstractapi non-200", res.status);
    return null;
  }
  let json: AbstractPhoneResponse;
  try {
    json = (await res.json()) as AbstractPhoneResponse;
  } catch {
    return null;
  }
  const isValid = json.valid === true;
  const lineType = lineTypeFromString(json.line_type);
  return {
    phone,
    is_valid: isValid,
    country_code: json.country?.code ?? null,
    country_name: json.country?.name ?? null,
    line_type: lineType,
    carrier: json.carrier ?? null,
    provider: "abstractapi",
    status: isValid ? "valid" : "invalid",
  };
}

async function validateViaNumVerify(
  phone: string,
  apiKey: string,
): Promise<PhoneValidationResult | null> {
  // NumVerify on free tier requires HTTP (HTTPS is paid). We use http here on
  // purpose — the response is non-sensitive (carrier + line type). If the
  // user is on a paid tier they can flip to https in env, but the free tier
  // is the documented behaviour.
  const numberOnly = phone.replace(/^\+/, "");
  const url = `http://apilayer.net/api/validate?access_key=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(numberOnly)}&format=1`;
  const res = await fetchWithTimeout(url, TIMEOUT_MS);
  if (!res) return null;
  if (!res.ok) {
    console.warn("[phone-validator] numverify non-200", res.status);
    return null;
  }
  let json: NumVerifyResponse;
  try {
    json = (await res.json()) as NumVerifyResponse;
  } catch {
    return null;
  }
  if (json.error) {
    console.warn("[phone-validator] numverify error", json.error.info);
    return null;
  }
  const isValid = json.valid === true;
  const lineType = lineTypeFromString(json.line_type);
  return {
    phone,
    is_valid: isValid,
    country_code: json.country_code ?? null,
    country_name: json.country_name ?? null,
    line_type: lineType,
    carrier: json.carrier ?? null,
    provider: "numverify",
    status: isValid ? "valid" : "invalid",
  };
}

/**
 * Validate one phone. Returns "skipped" when neither provider is configured.
 * Never throws.
 */
export async function validatePhone(
  phone: string,
): Promise<PhoneValidationResult> {
  const e164 = toE164(phone);
  if (!e164) {
    return {
      phone: (phone || "").trim(),
      is_valid: false,
      country_code: null,
      country_name: null,
      line_type: "unknown",
      carrier: null,
      provider: "skipped",
      status: "invalid",
    };
  }

  const abstractKey = getAbstractPhoneKey();
  if (abstractKey) {
    const r = await validateViaAbstractApi(e164, abstractKey);
    if (r) return r;
  }

  const numverifyKey = getNumVerifyKey();
  if (numverifyKey) {
    const r = await validateViaNumVerify(e164, numverifyKey);
    if (r) return r;
  }

  if (!abstractKey && !numverifyKey) {
    return skippedResult(e164);
  }

  return unknownResult(e164, abstractKey ? "abstractapi" : "numverify");
}

/**
 * Validate a batch of phone numbers. Concurrency is conservative since the
 * free monthly quota on both providers is small.
 */
export async function validatePhonesBatch(
  phones: string[],
  maxConcurrency = 3,
): Promise<Map<string, PhoneValidationResult>> {
  const result = new Map<string, PhoneValidationResult>();
  const unique = Array.from(
    new Set(phones.map((p) => toE164(p)).filter((p): p is string => Boolean(p))),
  );
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < unique.length) {
      const idx = cursor++;
      const phone = unique[idx];
      if (!phone) continue;
      const validation = await validatePhone(phone);
      result.set(phone, validation);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(maxConcurrency, unique.length || 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  return result;
}
