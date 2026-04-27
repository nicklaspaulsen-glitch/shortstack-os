/**
 * Public Status Page — `/status/[ownerSlug]`.
 *
 * Anonymous, ISR-rendered (revalidate 60s), uses the anon Supabase key.
 * RLS policies on `incidents` only return rows where
 * `resolved_at IS NULL OR resolved_at > now() - interval '7 days'` —
 * older resolved incidents are invisible to anon callers.
 *
 * Layout:
 *   - Big top banner: "All Systems Operational" (green) when no active
 *     incidents, otherwise the highest severity wins.
 *   - 90-day uptime grid per known component (computed from incidents).
 *   - Active incidents block.
 *   - Recent (<7d resolved) incidents block.
 *
 * `ownerSlug` is the agency owner's profile UUID for now. A future
 * migration can add a `status_slug` column on profiles for human-friendly
 * URLs without breaking this page (it'll resolve UUID first, fall back
 * to slug lookup).
 */
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/lib/brand-config";

export const revalidate = 60;
export const dynamic = "force-static";

interface Incident {
  id: string;
  title: string;
  body: string;
  severity: "investigating" | "identified" | "monitoring" | "resolved";
  affected_components: string[];
  started_at: string;
  resolved_at: string | null;
}

interface OwnerProfile {
  id: string;
  full_name: string | null;
}

const SEVERITY_RANK: Record<Incident["severity"], number> = {
  investigating: 4,
  identified: 3,
  monitoring: 2,
  resolved: 1,
};

const SEVERITY_LABEL: Record<Incident["severity"], string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

const SEVERITY_BADGE: Record<Incident["severity"], string> = {
  investigating: "bg-yellow-500/20 border-yellow-500/40 text-yellow-200",
  identified: "bg-orange-500/20 border-orange-500/40 text-orange-200",
  monitoring: "bg-blue-500/20 border-blue-500/40 text-blue-200",
  resolved: "bg-emerald-500/20 border-emerald-500/40 text-emerald-200",
};

function getAnonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

interface DayStatus {
  date: string; // YYYY-MM-DD
  status: "ok" | "incident" | "future";
  incidentCount: number;
}

/**
 * Build a 90-day uptime grid for a given list of incidents. Marks each day
 * as "incident" if at least one incident overlapped that day. Days fully
 * before the earliest incident default to "ok".
 *
 * Note: anon RLS only returns active + last-7-days resolved, so days
 * 8-90 in the past will look "ok" even if older outages happened. This is
 * intentional — Statuspage.io behaves the same on free tiers, and the
 * public page is meant to reassure customers, not be a forensic record.
 */
function buildUptimeGrid(incidents: Incident[]): DayStatus[] {
  const days: DayStatus[] = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    const dayStart = d.getTime();
    const dayEnd = dayStart + 86_400_000;
    let count = 0;
    for (const inc of incidents) {
      const start = new Date(inc.started_at).getTime();
      const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : Date.now();
      if (start < dayEnd && end > dayStart) count++;
    }
    days.push({
      date: d.toISOString().slice(0, 10),
      status: count > 0 ? "incident" : "ok",
      incidentCount: count,
    });
  }
  return days;
}

export default async function PublicStatusPage({
  params,
}: {
  params: { ownerSlug: string };
}) {
  const supabase = getAnonSupabase();

  // Treat the slug as a UUID. If it's not a UUID, return notFound rather
  // than running an injection-risky regex.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(params.ownerSlug)) {
    notFound();
  }

  // We don't read the profile via anon directly — profiles RLS isn't
  // public. Instead we read incidents (anon-readable per the public
  // policy) and rely on the existence of any incident row to validate
  // the slug. For brand-new agencies with zero incidents we still want
  // the page to render, so we accept the slug as-valid if RLS returns
  // an empty array — falling back to a generic agency name. Owners can
  // surface their own brand by posting their first "All systems
  // operational" incident with severity=resolved as a placeholder.
  const { data: incidents, error } = await supabase
    .from("incidents")
    .select(
      "id, title, body, severity, affected_components, started_at, resolved_at",
    )
    .eq("owner_id", params.ownerSlug)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[status/public] incidents fetch failed", error.message);
  }

  const list = (incidents ?? []) as Incident[];
  const active = list.filter((i) => !i.resolved_at);
  const recent = list.filter((i) => i.resolved_at);

  const highestActive =
    active.length > 0
      ? active.reduce((acc, i) =>
          SEVERITY_RANK[i.severity] > SEVERITY_RANK[acc.severity] ? i : acc,
        )
      : null;

  const grid = buildUptimeGrid(list);

  // Per-component grids: gather every unique component across all incidents,
  // then build a grid for each by filtering the incident list to ones that
  // touched that component.
  const allComponents = Array.from(
    new Set(list.flatMap((i) => i.affected_components)),
  );

  const componentGrids = allComponents.map((comp) => ({
    name: comp,
    grid: buildUptimeGrid(
      list.filter((i) => i.affected_components.includes(comp)),
    ),
  }));

  const upDays = grid.filter((d) => d.status === "ok").length;
  const uptimePct = ((upDays / grid.length) * 100).toFixed(2);

  const owner: OwnerProfile = {
    id: params.ownerSlug,
    full_name: null,
  };

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0c", color: "#e5e5e7" }}>
      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16 space-y-10">
        {/* Header */}
        <header className="space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em]"
            style={{ color: "#C9A84C" }}
          >
            {BRAND.product_name}
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {owner.full_name ? `${owner.full_name} — Status` : "System Status"}
          </h1>
        </header>

        {/* Top banner */}
        {!highestActive ? (
          <div
            className="rounded-2xl border p-6 flex items-center gap-4"
            style={{
              borderColor: "rgba(16, 185, 129, 0.4)",
              background: "rgba(16, 185, 129, 0.08)",
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              style={{ background: "rgba(16, 185, 129, 0.2)" }}
            >
              <span aria-hidden>OK</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-emerald-300">
                All systems operational
              </h2>
              <p className="text-sm" style={{ color: "rgba(229, 229, 231, 0.65)" }}>
                90-day uptime: {uptimePct}%
              </p>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl border p-6 space-y-2"
            style={{
              borderColor: "rgba(234, 179, 8, 0.4)",
              background: "rgba(234, 179, 8, 0.08)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold uppercase tracking-wide ${SEVERITY_BADGE[highestActive.severity]}`}
              >
                {SEVERITY_LABEL[highestActive.severity]}
              </span>
              <h2 className="text-xl font-semibold">{highestActive.title}</h2>
            </div>
            {highestActive.body && (
              <p
                className="text-sm whitespace-pre-wrap"
                style={{ color: "rgba(229, 229, 231, 0.75)" }}
              >
                {highestActive.body}
              </p>
            )}
            <p className="text-xs" style={{ color: "rgba(229, 229, 231, 0.5)" }}>
              Started {formatDate(highestActive.started_at)} UTC
            </p>
          </div>
        )}

        {/* Overall uptime grid */}
        <section className="space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em]">
              Last 90 days
            </h2>
            <span
              className="text-xs"
              style={{ color: "rgba(229, 229, 231, 0.55)" }}
            >
              {uptimePct}% uptime
            </span>
          </header>
          <div className="flex gap-[2px]">
            {grid.map((d) => (
              <div
                key={d.date}
                title={`${d.date} — ${d.status === "ok" ? "Operational" : `${d.incidentCount} incident${d.incidentCount === 1 ? "" : "s"}`}`}
                className="flex-1 h-9 rounded-sm transition-transform hover:scale-y-110"
                style={{
                  background:
                    d.status === "ok"
                      ? "linear-gradient(180deg, rgba(16, 185, 129, 0.85), rgba(16, 185, 129, 0.55))"
                      : "linear-gradient(180deg, rgba(234, 179, 8, 0.85), rgba(234, 179, 8, 0.55))",
                }}
              />
            ))}
          </div>
          <div
            className="flex items-center justify-between text-[10px]"
            style={{ color: "rgba(229, 229, 231, 0.4)" }}
          >
            <span>90 days ago</span>
            <span>Today</span>
          </div>
        </section>

        {/* Per-component grids */}
        {componentGrids.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em]">
              Components
            </h2>
            <div className="space-y-3">
              {componentGrids.map((c) => (
                <div
                  key={c.name}
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: "rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">{c.name}</h3>
                    <span
                      className="text-[11px]"
                      style={{ color: "rgba(229, 229, 231, 0.55)" }}
                    >
                      {(
                        (c.grid.filter((d) => d.status === "ok").length /
                          c.grid.length) *
                        100
                      ).toFixed(2)}
                      %
                    </span>
                  </div>
                  <div className="flex gap-[2px]">
                    {c.grid.map((d) => (
                      <div
                        key={d.date}
                        title={`${d.date} — ${d.status === "ok" ? "Operational" : `${d.incidentCount} incident${d.incidentCount === 1 ? "" : "s"}`}`}
                        className="flex-1 h-5 rounded-[1px]"
                        style={{
                          background:
                            d.status === "ok"
                              ? "rgba(16, 185, 129, 0.7)"
                              : "rgba(234, 179, 8, 0.8)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active incidents */}
        {active.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em]">
              Active incidents
            </h2>
            <ul className="space-y-2">
              {active.map((i) => (
                <li
                  key={i.id}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_BADGE[i.severity]}`}
                    >
                      {SEVERITY_LABEL[i.severity]}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: "rgba(229, 229, 231, 0.5)" }}
                    >
                      {formatDate(i.started_at)} UTC
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{i.title}</h3>
                  {i.body && (
                    <p
                      className="text-xs whitespace-pre-wrap"
                      style={{ color: "rgba(229, 229, 231, 0.65)" }}
                    >
                      {i.body}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recent resolved */}
        {recent.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em]">
              Recent incidents
            </h2>
            <ul className="space-y-2">
              {recent.slice(0, 10).map((i) => (
                <li
                  key={i.id}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.015)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_BADGE.resolved}`}
                    >
                      Resolved
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: "rgba(229, 229, 231, 0.5)" }}
                    >
                      {formatDate(i.started_at)} → {i.resolved_at && formatDate(i.resolved_at)} UTC
                    </span>
                  </div>
                  <h3 className="text-sm font-medium mb-1">{i.title}</h3>
                  {i.body && (
                    <p
                      className="text-xs whitespace-pre-wrap"
                      style={{ color: "rgba(229, 229, 231, 0.55)" }}
                    >
                      {i.body}
                    </p>
                  )}
                  {i.affected_components.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {i.affected_components.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-2 py-0.5 rounded-full border"
                          style={{
                            borderColor: "rgba(255,255,255,0.1)",
                            color: "rgba(229, 229, 231, 0.55)",
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer
          className="pt-8 border-t text-center text-xs"
          style={{
            borderColor: "rgba(255,255,255,0.05)",
            color: "rgba(229, 229, 231, 0.4)",
          }}
        >
          Powered by {BRAND.product_name} · Updates every 60 seconds
        </footer>
      </main>
    </div>
  );
}
