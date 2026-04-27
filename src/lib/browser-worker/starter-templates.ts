/**
 * Browser Worker — starter templates.
 *
 * Six pre-built goal templates seeded the first time a user lands on the
 * Browser Tasks page. Each template uses Mustache-style {{var}} placeholders
 * filled at task creation time.
 *
 * The seeding helper is idempotent — it inserts on first run only; running
 * twice does not duplicate.
 */
import { createServiceClient } from "@/lib/supabase/server";

export interface StarterTemplateVariable {
  name: string;
  required?: boolean;
  kind: "text" | "url" | "number";
}

export interface StarterTemplate {
  name: string;
  description: string;
  category: "scraping" | "posting" | "data_entry" | "monitoring";
  goal_template: string;
  default_max_steps?: number;
  variables: StarterTemplateVariable[];
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Competitor pricing scraper",
    description:
      "Visit a competitor's pricing page and extract every tier, monthly price, and feature list as structured JSON.",
    category: "scraping",
    goal_template:
      "Visit {{competitor_url}} and extract all pricing tiers with their monthly cost, included features, and any limits. Return as a structured JSON object.",
    default_max_steps: 25,
    variables: [{ name: "competitor_url", kind: "url", required: true }],
  },
  {
    name: "Google Maps lead scraper",
    description:
      "Search Google Maps for businesses near a location and extract contact details for the top results.",
    category: "scraping",
    goal_template:
      'Search Google Maps for "{{search_query}} near {{location}}". Extract the top 20 results with name, phone, website, and rating. Return as JSON array.',
    default_max_steps: 40,
    variables: [
      { name: "search_query", kind: "text", required: true },
      { name: "location", kind: "text", required: true },
    ],
  },
  {
    name: "Form filler",
    description:
      "Visit a form URL and fill it out with the values you provide, then submit and confirm success.",
    category: "data_entry",
    goal_template:
      "Visit {{form_url}} and fill out the form with these values: {{values}}. Submit. Confirm success.",
    default_max_steps: 25,
    variables: [
      { name: "form_url", kind: "url", required: true },
      { name: "values", kind: "text", required: true },
    ],
  },
  {
    name: "Job board scraper",
    description:
      "Scrape a job board for a given role and location — pulls company, title, location, link, and posted date.",
    category: "scraping",
    goal_template:
      'Search {{job_board}} for "{{role}}" jobs in {{location}}. Extract top 30 with company, title, location, link, posted date.',
    default_max_steps: 50,
    variables: [
      { name: "job_board", kind: "text", required: true },
      { name: "role", kind: "text", required: true },
      { name: "location", kind: "text", required: true },
    ],
  },
  {
    name: "Daily competitor monitor",
    description:
      "Visit a competitor URL and report any changes since yesterday — pricing, features, blog posts.",
    category: "monitoring",
    goal_template:
      "Visit {{competitor_url}} and report any changes since yesterday: pricing changes, new features mentioned, new blog posts.",
    default_max_steps: 30,
    variables: [{ name: "competitor_url", kind: "url", required: true }],
  },
  {
    name: "Social profile audit",
    description:
      "Audit a social profile (Instagram, X, TikTok, etc.) — pulls follower count, post count, top posts, bio.",
    category: "scraping",
    goal_template:
      "Visit {{profile_url}} on {{platform}} and extract: follower count, post count, top 3 most-liked posts of the past month, bio.",
    default_max_steps: 30,
    variables: [
      { name: "profile_url", kind: "url", required: true },
      { name: "platform", kind: "text", required: true },
    ],
  },
];

/**
 * Seed the starter templates for an agency owner if they have none yet.
 * Idempotent — does nothing if any template already exists for the owner.
 */
export async function seedStarterTemplates(agencyOwnerId: string): Promise<{
  seeded: number;
  alreadyHad: boolean;
}> {
  const supabase = createServiceClient();

  // Check existing.
  const { data: existing, error: existErr } = await supabase
    .from("browser_task_templates")
    .select("id")
    .eq("agency_owner_id", agencyOwnerId)
    .limit(1);

  if (existErr) {
    console.error("[browser-worker] seedStarterTemplates select failed", existErr);
    return { seeded: 0, alreadyHad: false };
  }

  if (existing && existing.length > 0) {
    return { seeded: 0, alreadyHad: true };
  }

  const rows = STARTER_TEMPLATES.map((t) => ({
    agency_owner_id: agencyOwnerId,
    name: t.name,
    description: t.description,
    goal_template: t.goal_template,
    default_max_steps: t.default_max_steps ?? 30,
    category: t.category,
    variables: t.variables,
  }));

  const { error: insertErr } = await supabase.from("browser_task_templates").insert(rows);
  if (insertErr) {
    console.error("[browser-worker] seedStarterTemplates insert failed", insertErr);
    return { seeded: 0, alreadyHad: false };
  }

  return { seeded: rows.length, alreadyHad: false };
}

/**
 * Render a goal template by replacing {{var}} placeholders with provided values.
 * Unknown placeholders are left intact (so the model can still see them).
 */
export function renderGoalTemplate(
  goalTemplate: string,
  values: Record<string, string | number | undefined>,
): string {
  return goalTemplate.replace(/\{\{(\w+)\}\}/g, (full, key: string) => {
    const v = values[key];
    return v === undefined ? full : String(v);
  });
}
