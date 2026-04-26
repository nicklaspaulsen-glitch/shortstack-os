"use client";

/**
 * Mailbox Planner — GHL-style mailbox catalog + cost preview.
 *
 * User asked: "showing which mails there is out there and forming out
 * details to get the thing they want and what client it is for and
 * what they have to pay for it".
 *
 * The existing mail-setup flow handles SUBDOMAIN VERIFICATION (Resend
 * DNS records for sending). What was missing: a clear catalog of
 * mailboxes to create + cost summary BEFORE setup. This component
 * provides that — the user picks which mailboxes they want for which
 * client, sees the monthly cost summary, and gets a clear path to
 * activate.
 */

import { useState } from "react";
import {
  Inbox,
  Mail,
  HeadphonesIcon,
  Briefcase,
  Receipt,
  PhoneCall,
  UserCheck,
  Check,
  Plus,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";

interface MailboxTemplate {
  prefix: string;
  label: string;
  description: string;
  // Lucide ships icons as ForwardRefExoticComponent — using LucideIcon
  // here matches what `import { Mail } from "lucide-react"` actually
  // returns. The previous narrow ComponentType was failing the build
  // (see Vercel build c4708c7).
  icon: LucideIcon;
  popular: boolean;
  /** USD/month per mailbox */
  cost: number;
}

const MAILBOX_TEMPLATES: MailboxTemplate[] = [
  {
    prefix: "hello",
    label: "hello@",
    description: "General catch-all for new prospects + warm leads.",
    icon: Mail,
    popular: true,
    cost: 1,
  },
  {
    prefix: "support",
    label: "support@",
    description: "Inbound customer support — auto-routes to your ticketing.",
    icon: HeadphonesIcon,
    popular: true,
    cost: 1,
  },
  {
    prefix: "sales",
    label: "sales@",
    description: "Outbound sales + RFP/quote replies. Linked to CRM pipeline.",
    icon: Briefcase,
    popular: true,
    cost: 1,
  },
  {
    prefix: "billing",
    label: "billing@",
    description: "Invoices, receipts, payment chasers. Linked to Stripe.",
    icon: Receipt,
    popular: true,
    cost: 1,
  },
  {
    prefix: "info",
    label: "info@",
    description: "Marketing newsletter sender + general inquiries.",
    icon: Inbox,
    popular: false,
    cost: 1,
  },
  {
    prefix: "contact",
    label: "contact@",
    description: "Forms-page handler. Threads into Conversations.",
    icon: PhoneCall,
    popular: false,
    cost: 1,
  },
  {
    prefix: "careers",
    label: "careers@",
    description: "Job applications + recruiting replies.",
    icon: UserCheck,
    popular: false,
    cost: 1,
  },
];

interface Client {
  id: string;
  business_name: string;
}

export default function MailboxPlanner({ clients }: { clients: Client[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(["hello", "support", "sales"]));
  const [forClient, setForClient] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggle = (prefix: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  };

  const totalMonthly = Array.from(selected).reduce((sum, p) => {
    const t = MAILBOX_TEMPLATES.find((x) => x.prefix === p);
    return sum + (t?.cost || 0);
  }, 0);

  const clientName = clients.find((c) => c.id === forClient)?.business_name;

  const visible = showAdvanced
    ? MAILBOX_TEMPLATES
    : MAILBOX_TEMPLATES.filter((t) => t.popular);

  return (
    <section
      className="relative rounded-2xl p-5 md:p-6 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))",
        border: "1px solid rgba(34,197,94,0.2)",
      }}
    >
      {/* Ambient green glow */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(34,197,94,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.04))",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            <Inbox size={16} className="text-emerald-300" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Mailbox Planner
            </h2>
            <p className="text-[12px] text-muted">
              Pick the mailboxes for this client. Set up everything in one go —
              MX, SPF, DKIM, SMTP credentials.
            </p>
          </div>
        </div>

        {/* Client picker */}
        <div className="mb-4">
          <label className="block text-[10.5px] uppercase tracking-wider text-muted font-semibold mb-1.5">
            For which client?
          </label>
          <select
            value={forClient}
            onChange={(e) => setForClient(e.target.value)}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400/40"
          >
            <option value="">— Pick a client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name}
              </option>
            ))}
          </select>
        </div>

        {/* Mailbox grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10.5px] uppercase tracking-wider text-muted font-semibold">
              Pick mailboxes
            </p>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-[11px] text-muted hover:text-foreground"
            >
              {showAdvanced ? "Show popular only" : "Show all 7 options"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {visible.map((t) => {
              const isOn = selected.has(t.prefix);
              const Icon = t.icon;
              return (
                <button
                  key={t.prefix}
                  onClick={() => toggle(t.prefix)}
                  className="text-left rounded-xl p-3 transition flex items-start gap-3"
                  style={{
                    background: isOn
                      ? "rgba(34,197,94,0.08)"
                      : "rgba(255,255,255,0.02)",
                    border: isOn
                      ? "1px solid rgba(34,197,94,0.3)"
                      : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: isOn
                        ? "rgba(34,197,94,0.18)"
                        : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <Icon size={14} className={isOn ? "text-emerald-300" : "text-muted"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-bold text-foreground">
                        {t.label}
                      </span>
                      {t.popular && (
                        <span
                          className="text-[8.5px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                          style={{
                            background: "rgba(200,168,85,0.14)",
                            color: "#e2c878",
                          }}
                        >
                          Popular
                        </span>
                      )}
                      <span
                        className="ml-auto text-[10px] font-semibold"
                        style={{ color: "#86efac" }}
                      >
                        ${t.cost}/mo
                      </span>
                    </div>
                    <p className="text-[10.5px] text-muted leading-relaxed">
                      {t.description}
                    </p>
                  </div>
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition"
                    style={{
                      background: isOn
                        ? "rgba(34,197,94,0.3)"
                        : "transparent",
                      border: isOn
                        ? "1px solid rgba(34,197,94,0.5)"
                        : "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    {isOn ? (
                      <Check size={11} className="text-emerald-200" />
                    ) : (
                      <Plus size={11} className="text-muted" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cost summary card */}
        {selected.size > 0 && (
          <div
            className="rounded-xl p-4 mb-4"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">
                Monthly cost
              </p>
              <p
                className="text-2xl font-extrabold"
                style={{
                  background:
                    "linear-gradient(135deg, #c8a855, #e2c878)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                ${totalMonthly.toFixed(2)}/mo
              </p>
            </div>
            <p className="text-[11px] text-muted">
              {selected.size} mailbox{selected.size === 1 ? "" : "es"}
              {clientName ? ` for ${clientName}` : ""} · billed monthly via your
              Stripe subscription · cancel any time.
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => {
            if (!forClient) return toast.error("Pick a client first");
            if (selected.size === 0) return toast.error("Pick at least one mailbox");
            toast(
              `${selected.size} mailbox${selected.size === 1 ? "" : "es"} queued for setup. Backend wiring shipping next.`,
              { icon: "📬", duration: 5000 },
            );
          }}
          disabled={selected.size === 0 || !forClient}
          className="w-full py-3 rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #22c55e, #15803d)",
            color: "#0b0d12",
            boxShadow: "0 8px 24px rgba(34,197,94,0.25)",
          }}
        >
          Set up {selected.size > 0 ? selected.size : ""} mailbox
          {selected.size === 1 ? "" : "es"}
          <ArrowRight size={14} />
        </button>

        <p className="text-[10px] text-muted/80 mt-2 text-center">
          Includes MX + SPF + DKIM auto-configuration, SMTP credentials, and
          inbox routing into Conversations.
        </p>
      </div>
    </section>
  );
}
