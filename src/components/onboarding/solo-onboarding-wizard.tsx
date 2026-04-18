"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Building2,
  Video,
  Home,
  GraduationCap,
  ShoppingBag,
  Rocket,
  Briefcase,
  Globe,
  CheckCircle2,
  Layers,
  Target,
} from "lucide-react";
import WebsiteScraper from "@/components/ui/website-scraper";
import SidebarCustomizer from "@/components/onboarding/sidebar-customizer";
import { USER_TYPES, UserType, getUserTypeMeta } from "@/lib/user-types";

/* ─── Icon lookup for user-type cards ──────────────────────────────── */
const ICONS: Record<string, React.ElementType> = {
  Building2,
  Video,
  Home,
  GraduationCap,
  ShoppingBag,
  Rocket,
  Briefcase,
  Sparkles,
};

/* ─── Types ─────────────────────────────────────────────────────────── */

interface AIQuestion {
  id: string;
  label: string;
  placeholder: string;
  kind: "short_text" | "long_text" | "chips";
  options?: string[];
}

interface WizardState {
  user_type: UserType | null;
  business_name: string;
  handle: string;
  website_url: string;
  niche: string;
  pain_answers: Record<string, unknown>;
  goal_answers: Record<string, unknown>;
  enabled_sidebar: string[];
}

const INITIAL_STATE: WizardState = {
  user_type: null,
  business_name: "",
  handle: "",
  website_url: "",
  niche: "",
  pain_answers: {},
  goal_answers: {},
  enabled_sidebar: [],
};

interface Props {
  /** Optional pre-selected user type (skips step 0 when provided) */
  initialUserType?: UserType | null;
  /** Called when the user clicks "Finish" — receives the full wizard state */
  onComplete: (state: WizardState) => Promise<void> | void;
  /** Called when the user clicks "Cancel" or closes early */
  onCancel?: () => void;
}

const STEPS = [
  "user_type",
  "business_info",
  "niche",
  "pain_points",
  "goals",
  "sidebar",
  "ready",
] as const;
type StepKey = (typeof STEPS)[number];

/* ─── Component ────────────────────────────────────────────────────── */

export default function SoloOnboardingWizard({ initialUserType, onComplete, onCancel }: Props) {
  const [state, setState] = useState<WizardState>({
    ...INITIAL_STATE,
    user_type: initialUserType ?? null,
  });
  const [stepIdx, setStepIdx] = useState(initialUserType ? 1 : 0);
  const [painQuestions, setPainQuestions] = useState<AIQuestion[]>([]);
  const [goalQuestions, setGoalQuestions] = useState<AIQuestion[]>([]);
  const [loadingPain, setLoadingPain] = useState(false);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const stepKey: StepKey = STEPS[stepIdx];
  const progress = ((stepIdx + 1) / STEPS.length) * 100;
  const currentTypeMeta = useMemo(
    () => (state.user_type ? getUserTypeMeta(state.user_type) : null),
    [state.user_type]
  );

  /* ─── Fetch AI questions on pain_points / goals step entry ──── */
  useEffect(() => {
    if (stepKey !== "pain_points" || !state.user_type) return;
    if (painQuestions.length > 0) return;
    fetchQuestions("pain_points");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey, state.user_type]);

  useEffect(() => {
    if (stepKey !== "goals" || !state.user_type) return;
    if (goalQuestions.length > 0) return;
    fetchQuestions("goals");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey, state.user_type]);

  // Seed AI-recommended sidebar when entering the sidebar step (only if the
  // user hasn't already customized it).
  useEffect(() => {
    if (stepKey !== "sidebar" || !state.user_type) return;
    if (state.enabled_sidebar.length > 0) return;
    // Default to the static recommendation for this user type immediately,
    // so the user sees something useful before AI responds.
    setState((prev) => ({
      ...prev,
      enabled_sidebar: getUserTypeMeta(prev.user_type).recommendedSidebar,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  async function fetchQuestions(stage: "pain_points" | "goals") {
    if (!state.user_type) return;
    const setLoading = stage === "pain_points" ? setLoadingPain : setLoadingGoals;
    const setQuestions = stage === "pain_points" ? setPainQuestions : setGoalQuestions;
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/ai-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_type: state.user_type,
          stage,
          business_info: {
            business_name: state.business_name,
            website: state.website_url,
            niche: state.niche,
            ...(stage === "goals" ? { pain_answers: state.pain_answers } : {}),
          },
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.questions)) setQuestions(data.questions);
    } catch (err) {
      console.error("[SoloOnboardingWizard] fetchQuestions failed:", err);
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function canAdvance(): boolean {
    switch (stepKey) {
      case "user_type":
        return !!state.user_type;
      case "business_info":
        return state.business_name.trim().length > 0;
      case "niche":
        return state.niche.trim().length > 0;
      case "pain_points":
        return Object.keys(state.pain_answers).length > 0 || painQuestions.length === 0;
      case "goals":
        return Object.keys(state.goal_answers).length > 0 || goalQuestions.length === 0;
      case "sidebar":
        return state.enabled_sidebar.length > 0;
      case "ready":
        return true;
      default:
        return true;
    }
  }

  function next() {
    if (!canAdvance()) return;
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
  }
  function back() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  async function handleFinish() {
    setSubmitting(true);
    try {
      await onComplete(state);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* ─── Progress ─────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted font-medium">
            Step {stepIdx + 1} of {STEPS.length}
          </span>
          <span className="text-[11px] font-bold text-gold">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-light border border-border overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold to-amber-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => i < stepIdx && setStepIdx(i)}
              className={`rounded-full transition-all duration-200 ${
                i === stepIdx
                  ? "w-6 h-1.5 bg-gold"
                  : i < stepIdx
                  ? "w-1.5 h-1.5 bg-gold/50 hover:bg-gold/80 cursor-pointer"
                  : "w-1.5 h-1.5 bg-border cursor-default"
              }`}
              disabled={i >= stepIdx}
            />
          ))}
        </div>
      </div>

      {/* ─── Step body ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-surface p-6 min-h-[480px]">
        {stepKey === "user_type" && (
          <StepUserType
            selected={state.user_type}
            onPick={(t) => update("user_type", t)}
          />
        )}

        {stepKey === "business_info" && (
          <StepBusinessInfo
            userTypeLabel={currentTypeMeta?.label || ""}
            state={state}
            onChange={update}
          />
        )}

        {stepKey === "niche" && currentTypeMeta && (
          <StepNiche
            meta={currentTypeMeta}
            niche={state.niche}
            onChange={(v) => update("niche", v)}
          />
        )}

        {stepKey === "pain_points" && (
          <StepAIQuestions
            title="What's not working right now?"
            description="Your answers help us prioritize the right tools for you."
            loading={loadingPain}
            questions={painQuestions}
            answers={state.pain_answers}
            onChange={(answers) => update("pain_answers", answers)}
            onRegenerate={() => {
              setPainQuestions([]);
              fetchQuestions("pain_points");
            }}
          />
        )}

        {stepKey === "goals" && (
          <StepAIQuestions
            title="What do you want to achieve?"
            description="We'll tune your dashboard and workflows around these goals."
            loading={loadingGoals}
            questions={goalQuestions}
            answers={state.goal_answers}
            onChange={(answers) => update("goal_answers", answers)}
            onRegenerate={() => {
              setGoalQuestions([]);
              fetchQuestions("goals");
            }}
          />
        )}

        {stepKey === "sidebar" && state.user_type && (
          <StepSidebar
            userType={state.user_type}
            niche={state.niche}
            goals={Object.values(state.goal_answers).filter((v): v is string => typeof v === "string")}
            businessInfo={{
              business_name: state.business_name,
              website: state.website_url,
              niche: state.niche,
            }}
            enabledItems={state.enabled_sidebar}
            onChange={(items) => update("enabled_sidebar", items)}
          />
        )}

        {stepKey === "ready" && currentTypeMeta && (
          <StepReady
            businessName={state.business_name || "your business"}
            userTypeLabel={currentTypeMeta.label}
            enabledCount={state.enabled_sidebar.length}
          />
        )}
      </div>

      {/* ─── Nav ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-5">
        <button
          onClick={stepIdx === 0 ? onCancel : back}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-muted text-xs hover:text-foreground transition-all"
        >
          <ArrowLeft size={13} /> {stepIdx === 0 ? "Cancel" : "Back"}
        </button>

        {stepIdx < STEPS.length - 1 ? (
          <button
            onClick={next}
            disabled={!canAdvance()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black text-xs font-bold hover:shadow-lg hover:shadow-gold/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue <ArrowRight size={13} />
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black text-xs font-bold hover:shadow-lg hover:shadow-gold/20 transition-all disabled:opacity-50"
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {submitting ? "Setting up..." : "Finish & Enter ShortStack"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   STEP: Pick user type
   ════════════════════════════════════════════════════════════════════ */

function StepUserType({
  selected,
  onPick,
}: {
  selected: UserType | null;
  onPick: (t: UserType) => void;
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 items-center justify-center mb-3">
          <Sparkles size={24} className="text-gold" />
        </div>
        <h2 className="text-2xl font-bold mb-1">What best describes you?</h2>
        <p className="text-sm text-muted">We&apos;ll tailor ShortStack OS to your business.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {USER_TYPES.map((t) => {
          const Icon = ICONS[t.iconKey] || Sparkles;
          const isSelected = selected === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              className={`relative text-left p-4 rounded-2xl border transition-all hover-lift ${
                isSelected
                  ? "border-gold bg-gold/10 shadow-[0_0_0_2px_rgba(201,168,76,0.2)]"
                  : "border-border bg-surface-light hover:border-gold/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-gold/20 text-gold" : "bg-surface-light text-muted"
                  }`}
                >
                  <Icon size={18} />
                </div>
                {isSelected && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                    <Check size={11} className="text-black" />
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-foreground mb-0.5">{t.label}</p>
              <p className="text-[11px] text-muted leading-snug">{t.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   STEP: Business info (name, handle, website scrape)
   ════════════════════════════════════════════════════════════════════ */

function StepBusinessInfo({
  userTypeLabel,
  state,
  onChange,
}: {
  userTypeLabel: string;
  state: WizardState;
  onChange: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-widest text-gold font-semibold mb-1">
          {userTypeLabel}
        </p>
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Building2 size={22} className="text-gold" /> Your business basics
        </h2>
        <p className="text-sm text-muted">
          We&apos;ll auto-fill everything we can from your website — skip it if you prefer.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
            Business / Brand name *
          </label>
          <input
            type="text"
            value={state.business_name}
            onChange={(e) => onChange("business_name", e.target.value)}
            placeholder="e.g. Northfield Collective"
            className="w-full px-4 py-2.5 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
            Handle / username <span className="text-muted normal-case">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-muted text-sm">@</span>
            <input
              type="text"
              value={state.handle}
              onChange={(e) => onChange("handle", e.target.value.replace(/^@/, ""))}
              placeholder="yourbrand"
              className="flex-1 px-4 py-2.5 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
            Website <span className="text-muted normal-case">(optional — we&apos;ll scrape it)</span>
          </label>
          <WebsiteScraper
            defaultUrl={state.website_url}
            ctaLabel="Use this to pre-fill"
            compact
            onExtract={(r) => {
              if (!state.website_url) onChange("website_url", r.url);
              if (!state.business_name && r.extracted.businessName) {
                onChange("business_name", r.extracted.businessName);
              }
              if (!state.niche && r.ai?.industry) {
                onChange("niche", r.ai.industry);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   STEP: Niche (AI-personalized prompt copy)
   ════════════════════════════════════════════════════════════════════ */

function StepNiche({
  meta,
  niche,
  onChange,
}: {
  meta: { label: string; nichePrompt: string };
  niche: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-widest text-gold font-semibold mb-1">
          {meta.label}
        </p>
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Target size={22} className="text-gold" /> Your niche / focus
        </h2>
        <p className="text-sm text-muted">{meta.nichePrompt}</p>
      </div>

      <textarea
        value={niche}
        onChange={(e) => onChange(e.target.value)}
        placeholder={meta.nichePrompt}
        rows={4}
        className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none"
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   STEP: AI-generated question flow (shared by pain_points + goals)
   ════════════════════════════════════════════════════════════════════ */

function StepAIQuestions({
  title,
  description,
  loading,
  questions,
  answers,
  onChange,
  onRegenerate,
}: {
  title: string;
  description: string;
  loading: boolean;
  questions: AIQuestion[];
  answers: Record<string, unknown>;
  onChange: (answers: Record<string, unknown>) => void;
  onRegenerate: () => void;
}) {
  function setAnswer(id: string, value: unknown) {
    onChange({ ...answers, [id]: value });
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Sparkles size={22} className="text-gold" /> {title}
          </h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={loading}
          className="text-[10px] text-muted hover:text-gold transition-colors whitespace-nowrap disabled:opacity-40"
        >
          Regenerate
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-2 py-10">
          <Loader2 size={22} className="animate-spin text-gold" />
          <p className="text-xs text-muted">Personalizing questions for you...</p>
        </div>
      )}

      {!loading && questions.length === 0 && (
        <div className="rounded-xl border border-border p-6 text-center text-sm text-muted">
          We couldn&apos;t generate custom questions right now — you can click Continue to skip this step.
        </div>
      )}

      {!loading && questions.length > 0 && (
        <div className="space-y-5">
          {questions.map((q) => (
            <QuestionField
              key={q.id}
              q={q}
              value={answers[q.id]}
              onChange={(v) => setAnswer(q.id, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionField({
  q,
  value,
  onChange,
}: {
  q: AIQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (q.kind === "chips" && q.options) {
    const arr: string[] = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div>
        <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
          {q.label}
        </label>
        <div className="flex flex-wrap gap-2">
          {q.options.map((opt) => {
            const sel = arr.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(sel ? arr.filter((v) => v !== opt) : [...arr, opt])}
                className={`px-3 py-1.5 rounded-full text-[11px] border transition-all ${
                  sel
                    ? "bg-gold/15 border-gold/40 text-gold"
                    : "bg-surface-light border-border text-muted hover:text-foreground"
                }`}
              >
                {opt}
                {sel && <Check size={9} className="inline ml-1" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (q.kind === "long_text") {
    return (
      <div>
        <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
          {q.label}
        </label>
        <textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder}
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none"
        />
      </div>
    );
  }

  // short_text fallback
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
        {q.label}
      </label>
      <input
        type="text"
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={q.placeholder}
        className="w-full px-4 py-2.5 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   STEP: Sidebar customization
   ════════════════════════════════════════════════════════════════════ */

function StepSidebar({
  userType,
  niche,
  goals,
  businessInfo,
  enabledItems,
  onChange,
}: {
  userType: UserType;
  niche: string;
  goals: string[];
  businessInfo: Record<string, unknown>;
  enabledItems: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Layers size={22} className="text-gold" /> Build your sidebar
        </h2>
        <p className="text-sm text-muted">
          Pick the tools that matter — we&apos;ll hide the rest. Click &quot;AI Recommended&quot; for a starter set tailored to you.
        </p>
      </div>
      <SidebarCustomizer
        userType={userType}
        niche={niche}
        goals={goals}
        businessInfo={businessInfo}
        enabledItems={enabledItems}
        onChange={onChange}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   STEP: Ready
   ════════════════════════════════════════════════════════════════════ */

function StepReady({
  businessName,
  userTypeLabel,
  enabledCount,
}: {
  businessName: string;
  userTypeLabel: string;
  enabledCount: number;
}) {
  return (
    <div className="text-center py-6">
      <div className="inline-flex w-20 h-20 rounded-3xl bg-gold/10 border border-gold/20 items-center justify-center mb-4">
        <CheckCircle2 size={36} className="text-gold" />
      </div>
      <h2 className="text-2xl font-bold mb-2">You&apos;re all set!</h2>
      <p className="text-sm text-muted max-w-md mx-auto mb-6">
        ShortStack is personalized for <span className="text-foreground font-medium">{businessName}</span>. Your
        dashboard will focus on <span className="text-gold font-medium">{userTypeLabel}</span> metrics and your
        sidebar has <span className="text-gold font-medium">{enabledCount}</span> tools enabled.
      </p>
      <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
        {[
          { icon: <Globe size={18} />, label: "Personalized" },
          { icon: <Sparkles size={18} />, label: "AI-tuned" },
          { icon: <Rocket size={18} />, label: "Ready to launch" },
        ].map((x) => (
          <div key={x.label} className="p-3 rounded-xl border border-border bg-surface-light/40">
            <div className="text-gold mb-1 inline-flex">{x.icon}</div>
            <p className="text-[11px] font-medium text-foreground">{x.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
