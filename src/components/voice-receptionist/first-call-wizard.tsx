"use client";

/**
 * First-Call Wizard — guided 3-step setup for Voice Receptionist.
 *
 * Lives at the top of /dashboard/voice-receptionist as a dismissible card.
 * Self-hides once `client.eleven_agent_id` AND `client.twilio_phone_number`
 * are both set on at least one client.
 *
 * Steps:
 *   1. Pick a client → ensures we have a `clients.id` to wire to
 *   2. Provision a Twilio number (or paste an existing one) → updates
 *      clients.twilio_phone_number
 *   3. Create / select an ElevenLabs agent → updates clients.eleven_agent_id
 *
 * Each step has a clear CTA, an inline status badge, and a progress bar
 * so the user always knows what's next. Skippable per step but the user
 * can't proceed to the next without completing the current.
 */

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  Loader,
  PhoneCall,
  Sparkles,
  X,
  ArrowRight,
  ExternalLink,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";

interface Client {
  id: string;
  business_name: string;
  twilio_phone_number: string | null;
  eleven_agent_id: string | null;
}

type Step = 1 | 2 | 3;

export default function FirstCallWizard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [twilioInput, setTwilioInput] = useState("");
  const [savingTwilio, setSavingTwilio] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Load clients on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clients");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        const list = ((data.clients || []) as Client[]).map((c) => ({
          id: c.id,
          business_name: c.business_name,
          twilio_phone_number: c.twilio_phone_number || null,
          eleven_agent_id: c.eleven_agent_id || null,
        }));
        setClients(list);

        // If any client is fully configured, hide the wizard
        const fullySetUp = list.find(
          (c) => c.twilio_phone_number && c.eleven_agent_id,
        );
        if (fullySetUp) {
          // Check localStorage for explicit dismiss preference
          const explicitlyDismissed = localStorage.getItem(
            "voice-receptionist-wizard-dismissed",
          ) === "1";
          if (explicitlyDismissed) {
            setDismissed(true);
          }
        }

        // Auto-select first client + jump to the first incomplete step
        const firstClient = list[0];
        if (firstClient) {
          setSelectedClientId(firstClient.id);
          setTwilioInput(firstClient.twilio_phone_number || "");
          if (!firstClient.twilio_phone_number) setStep(2);
          else if (!firstClient.eleven_agent_id) setStep(3);
          else setStep(3); // fully done — wizard will self-hide if dismissed
        }
      } catch {
        // Silent — wizard is opt-in helper, not core functionality
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handlers — both call /api/voice-receptionist/setup with different actions
  const onSaveTwilio = useCallback(async () => {
    if (!selectedClientId || !twilioInput.trim()) return;
    setSavingTwilio(true);
    try {
      const res = await fetch("/api/voice-receptionist/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId,
          action: "save_twilio",
          twilio_phone_number: twilioInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Twilio number saved");
      setClients((prev) =>
        prev.map((c) =>
          c.id === selectedClientId
            ? { ...c, twilio_phone_number: twilioInput.trim() }
            : c,
        ),
      );
      setStep(3);
    } catch (err) {
      toast.error(`Couldn't save: ${(err as Error).message}`);
    } finally {
      setSavingTwilio(false);
    }
  }, [selectedClientId, twilioInput]);

  const onCreateAgent = useCallback(async () => {
    if (!selectedClient) return;
    setCreatingAgent(true);
    try {
      const res = await fetch("/api/voice-receptionist/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient.id,
          action: "create_agent",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create agent");
      toast.success(
        data.existed ? "Agent already exists" : "ElevenLabs agent created",
      );
      setClients((prev) =>
        prev.map((c) =>
          c.id === selectedClient.id
            ? { ...c, eleven_agent_id: data.agent_id }
            : c,
        ),
      );
    } catch (err) {
      toast.error(`Couldn't create agent: ${(err as Error).message}`);
    } finally {
      setCreatingAgent(false);
    }
  }, [selectedClient]);

  const onDismiss = () => {
    localStorage.setItem("voice-receptionist-wizard-dismissed", "1");
    setDismissed(true);
  };

  const fullySetUp =
    selectedClient?.twilio_phone_number && selectedClient?.eleven_agent_id;

  // Don't render at all if dismissed and at least one client is fully set up
  const anyFullySetUp = clients.some(
    (c) => c.twilio_phone_number && c.eleven_agent_id,
  );
  if (dismissed && anyFullySetUp) return null;
  if (loading) return null;

  return (
    <section
      className="relative rounded-2xl p-5 md:p-6 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(168,85,247,0.02))",
        border: "1px solid rgba(168,85,247,0.18)",
      }}
    >
      {/* Ambient purple glow */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-5 relative">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(168,85,247,0.06))",
              border: "1px solid rgba(168,85,247,0.3)",
            }}
          >
            <Sparkles size={16} className="text-purple-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                {fullySetUp
                  ? "✓ Voice Receptionist is wired"
                  : "Place your first call in 3 steps"}
              </h3>
              <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300">
                Setup
              </span>
            </div>
            <p className="text-[11.5px] text-muted mt-0.5">
              {fullySetUp
                ? "You can dismiss this wizard or use it again to set up another client."
                : "Twilio number → ElevenLabs agent → ring it. Should take ~5 minutes."}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted hover:text-foreground p-1 rounded hover:bg-white/[0.05] transition"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-5 relative">
        {[1, 2, 3].map((n) => {
          const done =
            (n === 1 && !!selectedClientId) ||
            (n === 2 && !!selectedClient?.twilio_phone_number) ||
            (n === 3 && !!selectedClient?.eleven_agent_id);
          const active = step === n;
          return (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                style={{
                  background: done
                    ? "rgba(34,197,94,0.18)"
                    : active
                    ? "rgba(168,85,247,0.18)"
                    : "rgba(255,255,255,0.04)",
                  border: done
                    ? "1px solid rgba(34,197,94,0.4)"
                    : active
                    ? "1px solid rgba(168,85,247,0.4)"
                    : "1px solid rgba(255,255,255,0.06)",
                  color: done
                    ? "#86efac"
                    : active
                    ? "#d8b4fe"
                    : "rgba(255,255,255,0.4)",
                }}
              >
                {done ? <CheckCircle2 size={12} /> : n}
              </div>
              {n < 3 && (
                <div
                  className="h-px flex-1 transition-colors"
                  style={{
                    background: done
                      ? "rgba(34,197,94,0.3)"
                      : "rgba(255,255,255,0.06)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="relative space-y-3">
        {/* Step 1: Pick client */}
        <StepRow
          n={1}
          done={!!selectedClientId}
          active={step === 1}
          icon={<Users size={14} />}
          title="Pick a client"
          subtitle={
            selectedClient
              ? `Selected: ${selectedClient.business_name}`
              : "The receptionist will route inbound calls for this client."
          }
        >
          {clients.length === 0 ? (
            <p className="text-[11px] text-amber-300">
              You need at least one client first.{" "}
              <a href="/dashboard/clients" className="underline">
                Add a client
              </a>
              .
            </p>
          ) : (
            <select
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                const c = clients.find((x) => x.id === e.target.value);
                setTwilioInput(c?.twilio_phone_number || "");
                if (c && !c.twilio_phone_number) setStep(2);
                else if (c && !c.eleven_agent_id) setStep(3);
              }}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400/40"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                  {c.twilio_phone_number && c.eleven_agent_id ? " ✓" : ""}
                </option>
              ))}
            </select>
          )}
        </StepRow>

        {/* Step 2: Twilio number */}
        <StepRow
          n={2}
          done={!!selectedClient?.twilio_phone_number}
          active={step === 2}
          icon={<PhoneCall size={14} />}
          title="Connect a Twilio number"
          subtitle={
            selectedClient?.twilio_phone_number
              ? `Saved: ${selectedClient.twilio_phone_number}`
              : "Buy a number on Twilio Console, then paste it here. We'll wire the webhooks."
          }
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="tel"
              value={twilioInput}
              onChange={(e) => setTwilioInput(e.target.value)}
              placeholder="+1 555 555 0123"
              className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400/40"
              disabled={!selectedClientId || savingTwilio}
            />
            <button
              onClick={onSaveTwilio}
              disabled={!selectedClientId || !twilioInput.trim() || savingTwilio}
              className="px-4 py-2 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 text-sm font-semibold hover:bg-purple-500/25 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {savingTwilio ? (
                <Loader size={12} className="animate-spin" />
              ) : (
                <ArrowRight size={12} />
              )}
              Save
            </button>
          </div>
          <a
            href="https://console.twilio.com/us1/develop/phone-numbers/manage/search"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-purple-300 hover:underline mt-2"
          >
            Open Twilio Console <ExternalLink size={9} />
          </a>
        </StepRow>

        {/* Step 3: ElevenLabs agent */}
        <StepRow
          n={3}
          done={!!selectedClient?.eleven_agent_id}
          active={step === 3}
          icon={<Sparkles size={14} />}
          title="Create the AI receptionist"
          subtitle={
            selectedClient?.eleven_agent_id
              ? `Agent: ${selectedClient.eleven_agent_id.slice(0, 12)}…`
              : "We'll create an ElevenLabs ConvAI agent with a starter persona for this client."
          }
        >
          {selectedClient?.eleven_agent_id ? (
            <div className="flex items-center gap-2 text-[11px] text-emerald-300">
              <CheckCircle2 size={12} />
              Agent ready — call your Twilio number to test live.
            </div>
          ) : (
            <button
              onClick={onCreateAgent}
              disabled={
                !selectedClient?.twilio_phone_number ||
                creatingAgent ||
                !selectedClient
              }
              className="px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.08))",
                border: "1px solid rgba(168,85,247,0.4)",
                color: "#e9d5ff",
              }}
            >
              {creatingAgent ? (
                <Loader size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              Create AI receptionist
            </button>
          )}
        </StepRow>
      </div>

      {/* Footer — what to do next */}
      {fullySetUp && (
        <div
          className="mt-5 pt-4 relative"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-[12px] text-emerald-300 font-semibold mb-1">
            🎉 You&apos;re live. Place a test call now:
          </p>
          <p className="text-[11.5px] text-muted">
            Dial{" "}
            <span className="text-foreground font-mono font-semibold">
              {selectedClient.twilio_phone_number}
            </span>{" "}
            from your phone. The AI will pick up. Watch the call appear below
            in real-time.
          </p>
        </div>
      )}
    </section>
  );
}

function StepRow({
  n,
  done,
  active,
  icon,
  title,
  subtitle,
  children,
}: {
  n: number;
  done: boolean;
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-3 md:p-4 transition-all"
      style={{
        background: active
          ? "rgba(168,85,247,0.04)"
          : "rgba(255,255,255,0.02)",
        border: active
          ? "1px solid rgba(168,85,247,0.2)"
          : "1px solid rgba(255,255,255,0.05)",
        opacity: !active && !done ? 0.5 : 1,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
          style={{
            background: done
              ? "rgba(34,197,94,0.14)"
              : "rgba(168,85,247,0.10)",
            color: done ? "#86efac" : "#d8b4fe",
          }}
        >
          {done ? <CheckCircle2 size={12} /> : icon}
        </div>
        <h4 className="text-[13px] font-bold text-foreground">
          Step {n} — {title}
        </h4>
        {done && (
          <span className="ml-auto text-[9.5px] font-bold uppercase tracking-wider text-emerald-300">
            Done
          </span>
        )}
      </div>
      <p className="text-[11.5px] text-muted leading-relaxed mb-2">{subtitle}</p>
      {(active || done) && children}
    </div>
  );
}
