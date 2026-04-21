"use client";

/**
 * Phone Setup — client-facing page to provision a Twilio phone number
 * for one of the agency's clients. Wraps the `/api/twilio/provision`
 * backend (security + plan-tier gates live there — we just drive the UI).
 *
 * Three-step wizard:
 *   1. Pick a client (from agency-owned clients list)
 *   2. Pick area code (search available numbers via /api/twilio/provision GET)
 *   3. Confirm + buy (POST /api/twilio/provision → Twilio purchase →
 *                     ElevenLabs phone import → ElevenAgent creation)
 *
 * After purchase: shows the new number + "Send test SMS" button that
 * hits /api/twilio/send-sms.
 */

import { useEffect, useState } from "react";
import {
  Phone,
  Search,
  Check,
  ArrowLeft,
  ArrowRight,
  Loader,
  CheckCircle2,
  AlertTriangle,
  Send,
  MessageSquare,
  Globe,
  Sparkles,
  ArrowUpRight,
  Users,
  Settings,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";

interface Client {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  twilio_phone_number?: string | null;
}

interface AvailableNumber {
  phone: string;
  locality: string;
  region: string;
}

interface UsageSnapshot {
  plan_tier: string;
  usage: Record<string, number>;
  limits: Record<string, number | "unlimited">;
  remaining: Record<string, number | "unlimited">;
}

// Common country codes for the picker
const COUNTRIES: Array<{ code: string; label: string; flag: string }> = [
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "CA", label: "Canada", flag: "🇨🇦" },
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "AU", label: "Australia", flag: "🇦🇺" },
  { code: "DK", label: "Denmark", flag: "🇩🇰" },
  { code: "DE", label: "Germany", flag: "🇩🇪" },
  { code: "FR", label: "France", flag: "🇫🇷" },
  { code: "NL", label: "Netherlands", flag: "🇳🇱" },
  { code: "ES", label: "Spain", flag: "🇪🇸" },
  { code: "IT", label: "Italy", flag: "🇮🇹" },
  { code: "SE", label: "Sweden", flag: "🇸🇪" },
  { code: "NO", label: "Norway", flag: "🇳🇴" },
];

export default function PhoneSetupPage() {
  useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [country, setCountry] = useState("US");
  const [areaCode, setAreaCode] = useState("");
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<AvailableNumber | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyingStage, setBuyingStage] = useState<
    "idle" | "purchasing" | "importing" | "agent" | "saving"
  >("idle");
  const [purchaseResult, setPurchaseResult] = useState<{
    phone_number: string;
    twilio_sid: string;
    eleven_agent_id: string | null;
  } | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [atLimit, setAtLimit] = useState(false);

  // Fetch agency-owned clients + current usage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingClients(true);
        const res = await fetch("/api/admin/switch-client");
        const data = await res.json();
        if (!cancelled && data.success) {
          setClients(data.clients as Client[]);
        }
      } catch (err) {
        console.error("[phone-setup] fetch clients failed:", err);
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/usage/current", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as UsageSnapshot;
        if (cancelled) return;
        setUsage(data);
        const used = data.usage?.phone_numbers ?? 0;
        const limit = data.limits?.phone_numbers;
        if (typeof limit === "number" && used >= limit) setAtLimit(true);
      } catch {
        // Non-fatal — header quota just won't render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function searchNumbers() {
    setLoadingNumbers(true);
    setAvailableNumbers([]);
    setSelectedNumber(null);
    try {
      const params = new URLSearchParams({ country });
      if (areaCode) params.set("area_code", areaCode);
      const res = await fetch(`/api/twilio/provision?${params}`);
      const data = await res.json();
      if (data.numbers && Array.isArray(data.numbers)) {
        setAvailableNumbers(data.numbers);
        if (data.numbers.length === 0) {
          toast.error("No numbers available for that area code — try a different one.");
        }
      } else {
        toast.error(data.error || "Failed to search for numbers");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoadingNumbers(false);
    }
  }

  async function provision() {
    if (!selectedClient || !selectedNumber) return;
    setBuying(true);
    setBuyingStage("purchasing");
    // Fake-step the stage indicator so the user sees progress during the
    // 2-3s backend pipeline (Twilio purchase → ElevenLabs import → agent).
    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    stageTimers.push(setTimeout(() => setBuyingStage("importing"), 1200));
    stageTimers.push(setTimeout(() => setBuyingStage("agent"), 2400));
    stageTimers.push(setTimeout(() => setBuyingStage("saving"), 3600));
    try {
      const res = await fetch("/api/twilio/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient.id,
          area_code: areaCode || undefined,
          country,
          agent_name: `${selectedClient.business_name} AI Caller`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 402) {
          // Plan limit hit — flip the page into upgrade CTA mode instead of
          // firing a toast that can be missed.
          setAtLimit(true);
          if (typeof data.current === "number" && typeof data.limit === "number") {
            setUsage((prev) =>
              prev
                ? {
                    ...prev,
                    usage: { ...prev.usage, phone_numbers: data.current },
                    limits: { ...prev.limits, phone_numbers: data.limit },
                  }
                : {
                    plan_tier: data.plan_tier || "Starter",
                    usage: { phone_numbers: data.current },
                    limits: { phone_numbers: data.limit },
                    remaining: { phone_numbers: 0 },
                  },
            );
          }
          toast.error("You've hit your plan's phone number cap. Upgrade to provision more.", {
            duration: 6000,
          });
          return;
        }
        toast.error(data.error || `Purchase failed (${res.status})`);
        return;
      }
      setPurchaseResult({
        phone_number: data.phone_number,
        twilio_sid: data.twilio_sid,
        eleven_agent_id: data.eleven_agent_id,
      });
      setStep(4);
      toast.success(`Phone number ${data.phone_number} is live!`);
      // Refresh quota after successful purchase so the header reflects new use
      void refreshUsage();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      stageTimers.forEach(clearTimeout);
      setBuying(false);
      setBuyingStage("idle");
    }
  }

  async function refreshUsage() {
    try {
      const res = await fetch("/api/usage/current", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as UsageSnapshot;
      setUsage(data);
      const used = data.usage?.phone_numbers ?? 0;
      const limit = data.limits?.phone_numbers;
      setAtLimit(typeof limit === "number" && used >= limit);
    } catch {
      // silent
    }
  }

  async function sendTestSms() {
    if (!selectedClient || !purchaseResult) return;
    const ownerPhone = window.prompt(
      "Enter YOUR personal phone number (E.164 format, e.g. +15551234567) to receive a test SMS:",
    );
    if (!ownerPhone) return;
    setTestSending(true);
    try {
      const res = await fetch("/api/twilio/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient.id,
          to_number: ownerPhone.trim(),
          message: `ShortStack test: your new AI caller number ${purchaseResult.phone_number} is live. Reply STOP to opt out.`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || `Send failed (${res.status})`);
        return;
      }
      toast.success("Test SMS sent — check your phone!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setTestSending(false);
    }
  }

  const canProceedStep1 = !!selectedClient;
  const canProceedStep2 = !!selectedNumber;

  const phoneUsed = usage?.usage?.phone_numbers ?? 0;
  const phoneLimitRaw = usage?.limits?.phone_numbers;
  const phoneLimitDisplay =
    phoneLimitRaw === "unlimited"
      ? "∞"
      : typeof phoneLimitRaw === "number"
        ? phoneLimitRaw
        : "—";
  const planTierLabel = usage?.plan_tier || "Starter";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        title="Phone Setup"
        subtitle="Buy a Twilio phone number for your client. AI receptionist + SMS + voice — all wired in one click."
        icon={<Phone size={20} />}
        actions={
          usage ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-[10px] text-white/85">
              <Phone size={11} />
              <span>
                <span className="font-semibold">{phoneUsed}</span>
                <span className="opacity-70"> / {phoneLimitDisplay}</span>
                <span className="opacity-60"> numbers · {planTierLabel}</span>
              </span>
            </div>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-4xl px-6 pb-10 pt-4">
        {/* Quota / agency-pays hint — always visible under the hero */}
        <div className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-border/40 bg-surface-light/20 p-3 text-[11px] text-muted">
          <div className="flex items-center gap-1.5 text-[11px] text-foreground/80">
            <Sparkles size={12} className="text-gold" />
            <span>
              You&apos;ve provisioned{" "}
              <span className="font-semibold text-foreground">{phoneUsed}</span> of{" "}
              <span className="font-semibold text-foreground">{phoneLimitDisplay}</span> numbers on
              your <span className="font-semibold text-foreground">{planTierLabel}</span> plan.
            </span>
          </div>
          <span className="opacity-40">·</span>
          <span>
            ~$1/mo per number is billed to <span className="font-semibold">your</span> Twilio
            account — rebill clients however you like.
          </span>
        </div>

        {/* At-limit: replace wizard with upgrade card so the user never wanders
            into the wizard only to fail on the final step. */}
        {atLimit && step !== 4 && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-400" />
              <h2 className="text-base font-semibold">
                You&apos;ve hit your {planTierLabel} plan&apos;s phone-number cap
              </h2>
            </div>
            <p className="mb-4 text-sm text-muted">
              You&apos;re using <span className="font-semibold text-foreground">{phoneUsed}</span>{" "}
              of <span className="font-semibold text-foreground">{phoneLimitDisplay}</span>{" "}
              numbers. Upgrade to a higher tier to provision another, or release an existing
              number from{" "}
              <a href="/dashboard/phone-email" className="text-gold hover:underline">
                Phone &amp; Email
              </a>
              .
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/dashboard/upgrade"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90"
              >
                <ArrowUpRight size={14} /> See plans
              </a>
              <a
                href="/dashboard/phone-email"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-4 py-2 text-sm text-muted transition hover:text-foreground"
              >
                <Settings size={14} /> Manage existing numbers
              </a>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => {
            const label =
              n === 1 ? "Client" : n === 2 ? "Number" : n === 3 ? "Confirm" : "Done";
            const active = step === n;
            const done = step > n;
            return (
              <div key={n} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition ${
                    done
                      ? "bg-gold text-black"
                      : active
                        ? "bg-gold/15 text-gold ring-2 ring-gold/50"
                        : "bg-surface-light text-muted"
                  }`}
                >
                  {done ? <Check size={12} /> : n}
                </div>
                <span
                  className={`text-[11px] font-medium ${active ? "text-foreground" : "text-muted"}`}
                >
                  {label}
                </span>
                {n < 4 && <div className="ml-1 flex-1 h-px bg-border/60" />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Pick client */}
        {step === 1 && (
          <div className="rounded-xl border border-border/50 bg-surface-light/20 p-6">
            <h2 className="mb-1 text-lg font-semibold">Which client is this number for?</h2>
            <p className="mb-5 text-sm text-muted">
              The phone will be attached to this client so their calls + SMS route correctly.
            </p>

            {loadingClients ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader size={14} className="animate-spin" /> Loading your clients…
              </div>
            ) : clients.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/50 bg-background/30 p-8 text-center">
                <Users size={28} className="mx-auto mb-3 text-muted/40" />
                <p className="mb-1 text-sm font-semibold text-foreground">
                  You need to add a client first
                </p>
                <p className="mb-4 text-[12px] text-muted">
                  Phone numbers are attached to a specific client so calls + SMS route
                  correctly. Add a client, then come back here.
                </p>
                <a
                  href="/dashboard/clients"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black transition hover:bg-gold/90"
                >
                  <ArrowRight size={12} /> Go to Clients
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {clients.map((c) => {
                  const selected = selectedClient?.id === c.id;
                  const alreadyHas = !!c.twilio_phone_number;
                  return (
                    <button
                      key={c.id}
                      onClick={() => !alreadyHas && setSelectedClient(c)}
                      disabled={alreadyHas}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                        selected
                          ? "border-gold bg-gold/10"
                          : alreadyHas
                            ? "border-border/30 bg-surface-light/10 opacity-50 cursor-not-allowed"
                            : "border-border/50 hover:border-gold/40"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold font-semibold">
                        {c.business_name[0] || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.business_name}</p>
                        <p className="truncate text-[11px] text-muted">
                          {alreadyHas
                            ? `Already has ${c.twilio_phone_number}`
                            : c.contact_name || c.email || "—"}
                        </p>
                      </div>
                      {selected && <Check size={16} className="text-gold" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Pick number */}
        {step === 2 && (
          <div className="rounded-xl border border-border/50 bg-surface-light/20 p-6">
            <h2 className="mb-1 text-lg font-semibold">Pick a phone number</h2>
            <p className="mb-4 text-sm text-muted">
              Search by area code and pick any available number. Numbers are $1/mo from Twilio.
            </p>

            {/* Search controls */}
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr_auto]">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
                  Country
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
                  Area code (optional)
                </label>
                <input
                  type="text"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="415, 212, 305…"
                  className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm placeholder:text-muted"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={searchNumbers}
                  disabled={loadingNumbers}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-light/80 px-4 py-2 text-sm font-semibold transition hover:bg-surface-light disabled:opacity-40"
                >
                  {loadingNumbers ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  Search
                </button>
              </div>
            </div>

            {/* Results */}
            {availableNumbers.length === 0 && !loadingNumbers ? (
              <div className="rounded-lg border border-dashed border-border/50 p-8 text-center text-sm text-muted">
                <Globe size={20} className="mx-auto mb-2 opacity-50" />
                Click Search to see available numbers.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableNumbers.map((n) => {
                  const selected = selectedNumber?.phone === n.phone;
                  return (
                    <button
                      key={n.phone}
                      onClick={() => setSelectedNumber(n)}
                      className={`rounded-lg border p-3 text-left transition ${
                        selected
                          ? "border-gold bg-gold/10"
                          : "border-border/50 hover:border-gold/40"
                      }`}
                    >
                      <p className="font-mono text-sm font-semibold">{n.phone}</p>
                      <p className="text-[11px] text-muted">
                        {n.locality || "—"}, {n.region || country}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && selectedClient && selectedNumber && (
          <div className="rounded-xl border border-border/50 bg-surface-light/20 p-6">
            <h2 className="mb-1 text-lg font-semibold">Confirm purchase</h2>
            <p className="mb-5 text-sm text-muted">
              Review before we charge your Twilio balance.
            </p>

            <div className="mb-5 space-y-3 rounded-lg border border-border/40 bg-background/40 p-4">
              <Row label="Client" value={selectedClient.business_name} />
              <Row
                label="Phone number"
                value={
                  <span className="font-mono font-semibold text-foreground">
                    {selectedNumber.phone}
                  </span>
                }
              />
              <Row label="Location" value={`${selectedNumber.locality || "—"}, ${selectedNumber.region || country}`} />
              <Row label="Monthly cost" value="~$1.00 USD (Twilio)" />
              <Row
                label="Includes"
                value={
                  <span className="text-[13px]">
                    SMS webhook · Voice webhook · ElevenLabs phone import · Auto-created AI
                    receptionist agent
                  </span>
                }
              />
            </div>

            <div className="mb-5 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-[11px] text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <p>
                This is a real purchase against your Twilio account. The number stays yours
                until you release it from the Twilio dashboard.
              </p>
            </div>

            {/* Live progress during the 2-3s Twilio → ElevenLabs pipeline */}
            {buying && (
              <div className="mb-5 rounded-lg border border-gold/30 bg-gold/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-gold">
                  <Loader size={13} className="animate-spin" /> Provisioning your number —
                  hang tight, this takes 2-3 seconds
                </div>
                <div className="space-y-1.5 text-[11px] text-muted">
                  <PipelineStep
                    label="Purchasing from Twilio"
                    active={buyingStage === "purchasing"}
                    done={["importing", "agent", "saving"].includes(buyingStage)}
                  />
                  <PipelineStep
                    label="Importing to ElevenLabs"
                    active={buyingStage === "importing"}
                    done={["agent", "saving"].includes(buyingStage)}
                  />
                  <PipelineStep
                    label="Creating AI receptionist agent"
                    active={buyingStage === "agent"}
                    done={buyingStage === "saving"}
                  />
                  <PipelineStep
                    label="Wiring SMS + voice webhooks"
                    active={buyingStage === "saving"}
                    done={false}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                disabled={buying}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-40"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={provision}
                disabled={buying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-60"
              >
                {buying ? (
                  <>
                    <Loader size={14} className="animate-spin" /> Buying number…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Buy this number
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && purchaseResult && selectedClient && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 size={22} className="text-emerald-400" />
              <h2 className="text-lg font-semibold">Number is live!</h2>
            </div>

            <div className="mb-5 space-y-3 rounded-lg border border-border/40 bg-background/40 p-4">
              <Row label="Client" value={selectedClient.business_name} />
              <Row
                label="Phone"
                value={
                  <span className="font-mono text-base font-semibold text-emerald-300">
                    {purchaseResult.phone_number}
                  </span>
                }
              />
              <Row label="Twilio SID" value={<span className="font-mono text-[11px]">{purchaseResult.twilio_sid}</span>} />
              {purchaseResult.eleven_agent_id && (
                <Row
                  label="AI Agent"
                  value={
                    <span className="inline-flex items-center gap-1 text-[12px]">
                      <Check size={11} className="text-emerald-400" /> Created
                    </span>
                  }
                />
              )}
            </div>

            <p className="mb-4 text-sm text-muted">
              <MessageSquare size={12} className="mr-1 inline" /> SMS webhook wired → inbound
              messages appear in Conversations.
              <br />
              <Phone size={12} className="mr-1 inline" /> Voice webhook wired → inbound calls
              route to the ElevenLabs AI receptionist.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={sendTestSms}
                disabled={testSending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-60"
              >
                {testSending ? (
                  <>
                    <Loader size={14} className="animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send size={14} /> Send test SMS
                  </>
                )}
              </button>
              <a
                href="/dashboard/phone-email"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-light/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-light"
              >
                <Settings size={14} /> Manage this number
              </a>
              <button
                onClick={() => {
                  setStep(1);
                  setSelectedClient(null);
                  setSelectedNumber(null);
                  setAvailableNumbers([]);
                  setAreaCode("");
                  setPurchaseResult(null);
                  void refreshUsage();
                }}
                disabled={atLimit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-light/80 px-4 py-2 text-sm font-semibold transition hover:bg-surface-light disabled:cursor-not-allowed disabled:opacity-50"
                title={atLimit ? "You've hit your plan's phone-number cap" : undefined}
              >
                <Sparkles size={14} /> Provision another
              </button>
              <a
                href="/dashboard/eleven-agents"
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-muted transition hover:text-foreground"
              >
                Customise the AI agent →
              </a>
            </div>

            {/* Next-step nudge — connect this number to a real inbox + outbound */}
            <div className="mt-5 rounded-lg border border-border/40 bg-background/40 p-3 text-[11px] text-muted">
              <span className="font-semibold text-foreground">Next step:</span> assign a sender
              identity and compose your first broadcast from{" "}
              <a href="/dashboard/phone-email" className="text-gold hover:underline">
                Phone &amp; Email
              </a>
              .
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 size={12} className="text-emerald-400" />
      ) : active ? (
        <Loader size={12} className="animate-spin text-gold" />
      ) : (
        <span className="inline-block h-[10px] w-[10px] rounded-full border border-border/60" />
      )}
      <span
        className={
          done
            ? "text-emerald-300"
            : active
              ? "text-foreground"
              : "text-muted opacity-60"
        }
      >
        {label}
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}
