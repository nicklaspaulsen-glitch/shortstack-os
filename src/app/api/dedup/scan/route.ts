import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

type Lead = {
  id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  country: string | null;
  status: string | null;
  source: string | null;
  scraped_at: string | null;
  created_at: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  user_id: string | null;
};

function normalizePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

function normalizeEmail(e: string | null | undefined): string | null {
  if (!e) return null;
  return e.trim().toLowerCase() || null;
}

function normalizeBusiness(n: string | null | undefined): string | null {
  if (!n) return null;
  return n.trim().toLowerCase().replace(/\s+/g, " ") || null;
}

/**
 * GET /api/dedup/scan
 * Scans the caller's leads for duplicates by phone, email, or business name.
 * Returns groups of 2+ leads that collide on at least one of those keys so
 * the UI can show a merge candidate list.
 */
export async function GET(_req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Pull the caller's leads — cap at 5000 to keep the scan bounded.
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, business_name, email, phone, website, city, country, status, source, scraped_at, created_at, instagram_url, facebook_url, user_id")
    .eq("user_id", ownerId)
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build groups keyed by normalized phone / email / business_name.
  const byPhone = new Map<string, Lead[]>();
  const byEmail = new Map<string, Lead[]>();
  const byName = new Map<string, Lead[]>();

  for (const l of (leads || []) as Lead[]) {
    const p = normalizePhone(l.phone);
    if (p) {
      const arr = byPhone.get(p) || [];
      arr.push(l);
      byPhone.set(p, arr);
    }
    const e = normalizeEmail(l.email);
    if (e) {
      const arr = byEmail.get(e) || [];
      arr.push(l);
      byEmail.set(e, arr);
    }
    const n = normalizeBusiness(l.business_name);
    if (n) {
      const arr = byName.get(n) || [];
      arr.push(l);
      byName.set(n, arr);
    }
  }

  // De-dupe groups so a pair that collides on BOTH phone and email only
  // shows up once. Key the group by the sorted ID tuple.
  const seen = new Set<string>();
  const groups: Array<{
    match_on: string[];
    key: string;
    leads: Lead[];
  }> = [];

  const pushGroup = (map: Map<string, Lead[]>, label: string) => {
    map.forEach((arr, k) => {
      if (arr.length < 2) return;
      const uniqMap = new Map<string, Lead>();
      arr.forEach((x: Lead) => uniqMap.set(x.id, x));
      const uniq: Lead[] = Array.from(uniqMap.values());
      if (uniq.length < 2) return;
      const tupleKey = uniq.map((l) => l.id).sort().join("|");
      if (seen.has(tupleKey)) {
        const existing = groups.find((g) => g.key === tupleKey);
        if (existing && !existing.match_on.includes(label)) {
          existing.match_on.push(label);
        }
        return;
      }
      seen.add(tupleKey);
      groups.push({ match_on: [label], key: k, leads: uniq });
    });
  };

  pushGroup(byPhone, "phone");
  pushGroup(byEmail, "email");
  pushGroup(byName, "business_name");

  return NextResponse.json({
    total_leads: leads?.length || 0,
    duplicate_groups: groups.length,
    groups,
  });
}
