/**
 * Revealbot API Client
 *
 * Revealbot is an ad automation platform that wraps Meta, Google, TikTok,
 * and Snapchat campaign management. It lets you view campaign data aggregated
 * across platforms and create automation rules (e.g., "pause campaign if
 * ROAS < 1.5x for 7 days", "increase budget 20% if CTR > 5%").
 *
 * Auth: API key stored as `access_token` in `oauth_connections` with
 *       `platform = "revealbot"`. The header is `Authorization: {api_key}`.
 *
 * Docs: https://app.revealbot.com/api/docs
 */

const REVEALBOT_BASE = "https://app.revealbot.com/api/v1";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RevealbotAdAccount {
  id: string;
  name: string;
  platform: "facebook" | "google" | "tiktok" | "snapchat";
  account_id: string;
  currency?: string;
  timezone?: string;
}

export interface RevealbotCampaignStats {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number | null;
  roas: number | null;
}

export interface RevealbotCampaign {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  start_time: string | null;
  stop_time: string | null;
  stats?: RevealbotCampaignStats;
}

export type AutomationTriggerType = "scheduled" | "event_based" | "continuous";
export type AutomationSchedule = "every_30_min" | "hourly" | "every_6h" | "daily" | "weekly";
export type AutomationActionType =
  | "pause"
  | "enable"
  | "increase_budget"
  | "decrease_budget"
  | "set_budget"
  | "send_notification";

export type AutomationOperator =
  | "greater_than"
  | "less_than"
  | "equals"
  | "not_equals"
  | "greater_than_or_equal"
  | "less_than_or_equal";

export type AutomationField =
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "cpa"
  | "roas"
  | "conversions"
  | "frequency"
  | "reach";

export type AutomationTimeRange =
  | "today"
  | "yesterday"
  | "last_3_days"
  | "last_7_days"
  | "last_14_days"
  | "last_30_days"
  | "this_month"
  | "lifetime";

export interface AutomationCondition {
  field: AutomationField;
  operator: AutomationOperator;
  value: number;
  time_range: AutomationTimeRange;
}

export interface AutomationAction {
  type: AutomationActionType;
  /** For budget actions: the amount or percentage. */
  value?: number;
  /** For budget adjustments: "absolute" (set) or "percentage" (increase/decrease). */
  value_type?: "absolute" | "percentage";
  /** For send_notification: email address to notify. */
  email?: string;
}

export interface RevealbotRule {
  id: string;
  name: string;
  status: "enabled" | "disabled" | "paused";
  entity_type: "campaign" | "adset" | "ad";
  ad_account_id: string;
  trigger: {
    type: AutomationTriggerType;
    schedule?: AutomationSchedule;
  };
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  created_at: string;
  updated_at: string;
  last_executed_at: string | null;
  execution_count: number;
}

export interface RevealbotRuleExecution {
  id: string;
  rule_id: string;
  executed_at: string;
  status: "success" | "no_match" | "error";
  entities_matched: number;
  entities_affected: number;
  error_message: string | null;
}

export interface CreateRulePayload {
  name: string;
  entity_type: "campaign" | "adset" | "ad";
  ad_account_id: string;
  trigger: {
    type: AutomationTriggerType;
    schedule?: AutomationSchedule;
  };
  conditions: AutomationCondition[];
  actions: AutomationAction[];
}

// ─── Client ────────────────────────────────────────────────────────────────

async function revealbotFetch<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${REVEALBOT_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
      ...options.headers,
    },
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = { message: `HTTP ${res.status}` };
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as Record<string, unknown>).message === "string"
        ? (body as Record<string, unknown>).message
        : `Revealbot API error ${res.status}`;
    throw new Error(String(msg));
  }

  return body as T;
}

export function makeRevealbotClient(apiKey: string) {
  /** Validate the API key by fetching the accounts list. Returns true if valid. */
  async function validateKey(): Promise<boolean> {
    try {
      await revealbotFetch("/ad_accounts", apiKey);
      return true;
    } catch {
      return false;
    }
  }

  /** List all ad accounts connected to this Revealbot workspace. */
  async function listAccounts(): Promise<RevealbotAdAccount[]> {
    type Response = { data: RevealbotAdAccount[] } | RevealbotAdAccount[];
    const result = await revealbotFetch<Response>("/ad_accounts", apiKey);
    // Handle both direct array and {data:[]} envelope shapes
    return Array.isArray(result) ? result : (result.data ?? []);
  }

  /**
   * List campaigns for an ad account with 30-day stats.
   * @param accountId The Revealbot ad_account.id (not the platform account_id)
   */
  async function listCampaigns(
    accountId: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<RevealbotCampaign[]> {
    const params = new URLSearchParams({ include_stats: "1" });
    if (fromDate) params.set("from_date", fromDate);
    if (toDate) params.set("to_date", toDate);

    type Response = { data: RevealbotCampaign[] } | RevealbotCampaign[];
    const result = await revealbotFetch<Response>(
      `/ad_accounts/${accountId}/campaigns?${params}`,
      apiKey,
    );
    return Array.isArray(result) ? result : (result.data ?? []);
  }

  /** List all automation rules for this workspace. */
  async function listRules(): Promise<RevealbotRule[]> {
    type Response = { data: RevealbotRule[] } | RevealbotRule[];
    const result = await revealbotFetch<Response>("/rules", apiKey);
    return Array.isArray(result) ? result : (result.data ?? []);
  }

  /** Create a new automation rule. */
  async function createRule(payload: CreateRulePayload): Promise<RevealbotRule> {
    return revealbotFetch<RevealbotRule>("/rules", apiKey, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /** Enable or disable an existing rule. */
  async function toggleRule(
    ruleId: string,
    status: "enabled" | "disabled",
  ): Promise<RevealbotRule> {
    return revealbotFetch<RevealbotRule>(`/rules/${ruleId}`, apiKey, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  /** Delete an automation rule. */
  async function deleteRule(ruleId: string): Promise<void> {
    await revealbotFetch<unknown>(`/rules/${ruleId}`, apiKey, { method: "DELETE" });
  }

  /** Fetch execution history for a specific rule. */
  async function getRuleExecutions(ruleId: string): Promise<RevealbotRuleExecution[]> {
    type Response = { data: RevealbotRuleExecution[] } | RevealbotRuleExecution[];
    const result = await revealbotFetch<Response>(`/rules/${ruleId}/executions`, apiKey);
    return Array.isArray(result) ? result : (result.data ?? []);
  }

  return { validateKey, listAccounts, listCampaigns, listRules, createRule, toggleRule, deleteRule, getRuleExecutions };
}

export type RevealbotClient = ReturnType<typeof makeRevealbotClient>;

/** Normalise a Revealbot platform string to the UnifiedPlatform source. */
export function revealbotPlatformToSource(
  platform: RevealbotAdAccount["platform"],
): string {
  switch (platform) {
    case "facebook": return "meta";
    case "google":   return "google";
    case "tiktok":   return "tiktok";
    case "snapchat": return "snapchat";
    default:         return platform;
  }
}
