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
  const [purchaseResult, setPurchaseResult] = useState<{
    phone_number: string;
    twilio_sid: string;
    eleven_agent_id: string | null;
  } | null>(null);
  const [testSending, setTestSending] = useState(false);

  // Fetch agency-owned clients on mount
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
        toast.error(data.error || `Purchase failed (${res.status})`);
        if (res.status === 402) {
          toast.error("You've hit your plan's phone number cap. Upgrade at /dashboard/upgrade.", {
            duration: 6000,
          });
        }
        return;
      }
      setPurchaseResult({
        phone_number: data.phone_number,
        twilio_sid: data.twilio_sid,
        eleven_agent_id: data.eleven_agent_id,
      });
      setStep(4);
      toast.success(`Phone number ${data.phone_number} is live!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBuying(false);
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        title="Phone Setup"
        subtitle="Buy a Twilio phone number for your client. AI receptionist + SMS + voice — all wired in one click."
        icon={<Phone size={20} />}
      />

      <div className="mx-auto max-w-4xl px-6 pb-10">
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
              <div className="rounded-lg border border-dashed border-border/50 p-6 text-center text-sm text-muted">
                No clients yet.{" "}
                <a href="/dashboard/clients" className="text-gold hover:underline">
                  Add one first →
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
              <button
                onClick={() => {
                  setStep(1);
                  setSelectedClient(null);
                  setSelectedNumber(null);
                  setAvailableNumbers([]);
                  setAreaCode("");
                  setPurchaseResult(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-light/80 px-4 py-2 text-sm font-semibold transition hover:bg-surface-light"
              >
                Provision another
              </button>
              <a
                href="/dashboard/eleven-agents"
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-muted transition hover:text-foreground"
              >
                Customise the AI agent →
              </a>
            </div>
          </div>
        )}
      </div>
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
