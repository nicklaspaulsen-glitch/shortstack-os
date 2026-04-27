"use client";

/**
 * Vertical detail page — shows what a vertical contains and lets the user
 * pick which modules to apply.
 */

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Loader2,
  Zap,
  MessageSquare,
  Mail,
  Phone,
  TrendingUp,
  BookOpen,
  GitBranch,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";

interface ModuleItem {
  key:
    | "automations"
    | "sms"
    | "email"
    | "scripts"
    | "scoring"
    | "course"
    | "funnel";
  label: string;
  description: string;
  count: number;
  icon: typeof Zap;
}

interface ApiTemplate {
  template: {
    vertical: "real_estate" | "coaches" | "ecommerce";
    display_name: string;
    tagline: string;
    description: string;
    accent: "gold" | "blue" | "purple" | "green" | "sunset" | "ocean";
    automations: { name: string; description: string }[];
    sms_templates: { name: string; category: string }[];
    email_templates: { name: string; subject: string; category: string }[];
    call_scripts: { name: string; scenario: string }[];
    scoring_rules: { name: string; signal: string; score_delta: number; dimension: string }[];
    course: {
      title: string;
      description: string;
      modules: { title: string; description: string; lessons: { title: string }[] }[];
    };
    funnel: { name: string; description: string; steps: { title: string; step_type: string }[] };
  };
  counts: {
    automations: number;
    sms: number;
    email: number;
    scripts: number;
    scoring: number;
    course_modules: number;
    course_lessons: number;
    funnel_steps: number;
  };
}

interface ApplyResponse {
  vertical: string;
  applied: { module: string; status: "success" | "skipped" | "failed"; count: number; error?: string }[];
  total_created: number;
}

const ALL_MODULES: ReadonlyArray<ModuleItem["key"]> = [
  "automations",
  "sms",
  "email",
  "scripts",
  "scoring",
  "course",
  "funnel",
] as const;

interface PageProps {
  params: Promise<{ vertical: string }>;
}

export default function VerticalDetailPage({ params }: PageProps) {
  const { vertical } = use(params);
  const router = useRouter();

  const [data, setData] = useState<ApiTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(ALL_MODULES));
  const [applied, setApplied] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/verticals/${vertical}`, { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 404) {
            toast.error("Vertical not found");
            router.push("/dashboard/verticals");
            return;
          }
          throw new Error("Failed to load");
        }
        const json = (await res.json()) as ApiTemplate;
        if (!cancelled) setData(json);

        // Load applied state for checkmarks.
        const meRes = await fetch("/api/user/me", { cache: "no-store" }).catch(() => null);
        if (meRes && meRes.ok) {
          const meJson = (await meRes.json().catch(() => ({}))) as {
            user?: { id?: string };
            id?: string;
          };
          const userId = meJson?.user?.id ?? meJson?.id;
          if (userId) {
            const aRes = await fetch(`/api/verticals/applies/${userId}`, { cache: "no-store" });
            if (aRes.ok) {
              const aJson = (await aRes.json().catch(() => ({}))) as {
                applied_modules_by_vertical?: Record<string, string[]>;
              };
              if (!cancelled) {
                setApplied(aJson.applied_modules_by_vertical?.[vertical] ?? []);
              }
            }
          }
        }
      } catch {
        if (!cancelled) toast.error("Failed to load vertical");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vertical, router]);

  const moduleItems: ModuleItem[] = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: "automations",
        label: "Automations",
        description: "CRM rule-based workflows triggered by lead/customer events.",
        count: data.counts.automations,
        icon: Zap,
      },
      {
        key: "sms",
        label: "SMS Templates",
        description: "Reusable SMS templates for the dialer + manual messaging.",
        count: data.counts.sms,
        icon: MessageSquare,
      },
      {
        key: "email",
        label: "Email Templates",
        description: "Editorial email templates for sequences and one-offs.",
        count: data.counts.email,
        icon: Mail,
      },
      {
        key: "scripts",
        label: "Call Scripts",
        description: "Cold-call and discovery-call scripts surfaced in the dialer.",
        count: data.counts.scripts,
        icon: Phone,
      },
      {
        key: "scoring",
        label: "Lead Scoring Rules",
        description: "Editorial scoring rules merged into your lead-scoring metadata.",
        count: data.counts.scoring,
        icon: TrendingUp,
      },
      {
        key: "course",
        label: "Course",
        description: `${data.counts.course_modules}-module course with ${data.counts.course_lessons} lessons.`,
        count: data.counts.course_lessons,
        icon: BookOpen,
      },
      {
        key: "funnel",
        label: "Funnel",
        description: `${data.counts.funnel_steps}-step funnel ready for customisation.`,
        count: data.counts.funnel_steps,
        icon: GitBranch,
      },
    ];
  }, [data]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSelected = data ? selected.size === ALL_MODULES.length : false;

  const handleApply = async () => {
    if (selected.size === 0) {
      toast.error("Pick at least one module");
      return;
    }
    if (!data) return;

    const totalCount = moduleItems
      .filter((m) => selected.has(m.key))
      .reduce((acc, m) => acc + m.count, 0);

    const ok = window.confirm(
      `Apply ${selected.size} module${selected.size > 1 ? "s" : ""} (${totalCount} items) to your account?\n\nThis creates automations, templates, scripts, scoring rules, course content, and funnel steps tied to your tenant. You can edit or delete them after.`,
    );
    if (!ok) return;

    setApplying(true);
    try {
      const res = await fetch("/api/verticals/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical, modules: Array.from(selected) }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Apply failed");
      }
      const json = (await res.json()) as ApplyResponse;
      const failed = json.applied.filter((o) => o.status === "failed");
      if (failed.length === 0) {
        toast.success(`Applied — ${json.total_created} items created`);
      } else {
        toast(
          `Applied ${json.total_created} items. ${failed.length} module${failed.length > 1 ? "s" : ""} had issues.`,
          { icon: "⚠️" },
        );
      }
      setApplied((prev) => Array.from(new Set([...prev, ...Array.from(selected)])));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d]">
        <PageHero
          title="Loading vertical…"
          icon={<Briefcase size={28} />}
          gradient="gold"
        />
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="rounded-2xl bg-white/5 h-96 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <PageHero
        title={data.template.display_name}
        subtitle={data.template.description}
        icon={<Briefcase size={28} />}
        gradient={data.template.accent}
        eyebrow={
          <Link
            href="/dashboard/verticals"
            className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase opacity-90 hover:opacity-100"
          >
            <ArrowLeft size={12} />
            Back to verticals
          </Link>
        }
      />

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Module selection */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Pick what to apply
              </h2>
              <p className="text-sm text-white/50">
                Each module creates real rows in your account. Skip what you don&apos;t want — you can always come back.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSelected(allSelected ? new Set() : new Set(ALL_MODULES))
              }
              className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {moduleItems.map((m) => {
              const isSel = selected.has(m.key);
              const wasApplied = applied.includes(m.key);
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => toggle(m.key)}
                  className={`text-left rounded-xl p-4 border transition-colors ${
                    isSel
                      ? "bg-white/10 border-white/30"
                      : "bg-black/30 border-white/10 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center ${
                        isSel ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-white/60"
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-medium text-white">{m.label}</span>
                        <span className="text-xs text-white/50">{m.count}</span>
                      </div>
                      <p className="text-xs text-white/50 leading-snug">{m.description}</p>
                      {wasApplied && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 text-[10px] text-emerald-300">
                          <CheckCircle2 size={10} />
                          Previously applied
                        </span>
                      )}
                    </div>
                    <div
                      className={`mt-1 h-5 w-5 rounded-md border flex items-center justify-center ${
                        isSel
                          ? "bg-emerald-500 border-emerald-500 text-black"
                          : "border-white/20"
                      }`}
                    >
                      {isSel && <CheckCircle2 size={14} />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Preview lists */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PreviewBlock
            title="Automations"
            items={data.template.automations.map((a) => `${a.name} — ${a.description}`)}
          />
          <PreviewBlock
            title="SMS Templates"
            items={data.template.sms_templates.map((t) => `${t.name} (${t.category})`)}
          />
          <PreviewBlock
            title="Email Templates"
            items={data.template.email_templates.map((e) => `${e.name} — ${e.subject}`)}
          />
          <PreviewBlock
            title="Call Scripts"
            items={data.template.call_scripts.map((s) => `${s.name} — ${s.scenario}`)}
          />
          <PreviewBlock
            title="Lead Scoring Rules"
            items={data.template.scoring_rules.map(
              (r) =>
                `${r.name} — ${r.score_delta > 0 ? "+" : ""}${r.score_delta} (${r.dimension})`,
            )}
          />
          <PreviewBlock
            title={`Course — ${data.template.course.title}`}
            items={data.template.course.modules.map((m) => m.title)}
          />
          <div className="md:col-span-2">
            <PreviewBlock
              title={`Funnel — ${data.template.funnel.name}`}
              items={data.template.funnel.steps.map((s) => `${s.title} (${s.step_type})`)}
            />
          </div>
        </section>

        {/* Apply CTA — sticky bar */}
        <div className="sticky bottom-4 z-10">
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-2xl">
            <div className="text-sm text-white/70">
              <Sparkles size={14} className="inline -mt-0.5 mr-1.5 text-amber-400" />
              {selected.size} module{selected.size === 1 ? "" : "s"} selected
            </div>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || selected.size === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-medium hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {applying ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  Apply selected
                  <CheckCircle2 size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-5">
      <h3 className="text-sm font-medium text-white mb-3">{title}</h3>
      <ul className="space-y-1.5 text-sm text-white/60">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 items-start">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-white/40 flex-shrink-0" />
            <span className="line-clamp-1">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
