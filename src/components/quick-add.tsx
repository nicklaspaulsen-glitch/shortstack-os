"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Briefcase,
  CreditCard,
  Loader2,
  Plus,
  StickyNote,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormType = "lead" | "client" | "deal" | "note" | null;

// ── Speed-dial action registry ─────────────────────────────────────────────────

const ACTIONS = [
  { type: "lead"   as const, label: "+ Lead",   icon: Zap,       color: "#F59E0B" },
  { type: "client" as const, label: "+ Client", icon: Users,     color: "#2563EB" },
  { type: "deal"   as const, label: "+ Deal",   icon: Briefcase, color: "#10B981" },
  { type: "note"   as const, label: "+ Note",   icon: StickyNote,color: "#8B5CF6" },
] as const;

// ── Main component ─────────────────────────────────────────────────────────────

export default function QuickAdd() {
  const router = useRouter();
  const supabase = createClient();

  const [expanded, setExpanded] = useState(false);
  const [form, setForm]         = useState<FormType>(null);
  const [saving, setSaving]     = useState(false);
  const containerRef            = useRef<HTMLDivElement>(null);

  // Form state
  const [lead, setLead]       = useState({ business_name: "", email: "", phone: "", industry: "" });
  const [client, setClient]   = useState({ business_name: "", email: "", phone: "" });
  const [deal, setDeal]       = useState({ title: "", amount: "" });
  const [note, setNote]       = useState({ content: "" });

  // Keyboard shortcut: Shift+N → open speed-dial
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if (e.shiftKey && e.key === "N") { e.preventDefault(); setExpanded(v => !v); }
      if (e.key === "Escape") { setExpanded(false); setForm(null); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Close speed-dial when clicking outside
  useEffect(() => {
    if (!expanded && !form) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
        setForm(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded, form]);

  // ── Action handlers ────────────────────────────────────────────────────────

  function selectAction(type: FormType) {
    setExpanded(false);
    if (type === "client") {
      // Client creation has a full dedicated page — route there
      router.push("/dashboard/clients/new");
      return;
    }
    setForm(type);
  }

  async function saveLead() {
    if (!lead.business_name.trim()) { toast.error("Business name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("leads").insert({
      business_name: lead.business_name.trim(),
      email: lead.email || null,
      phone: lead.phone || null,
      industry: lead.industry || null,
      source: "manual",
      status: "new",
    });
    setSaving(false);
    if (error) { toast.error("Failed to add lead"); return; }
    toast.success("Lead added");
    setLead({ business_name: "", email: "", phone: "", industry: "" });
    setForm(null);
  }

  async function saveClient() {
    if (!client.business_name.trim()) { toast.error("Business name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("clients").insert({
      business_name: client.business_name.trim(),
      email: client.email || null,
      phone: client.phone || null,
      status: "active",
      is_active: true,
    });
    setSaving(false);
    if (error) { toast.error("Failed to add client"); return; }
    toast.success("Client added");
    setClient({ business_name: "", email: "", phone: "" });
    setForm(null);
  }

  async function saveDeal() {
    if (!deal.title.trim() || !deal.amount) { toast.error("Title and amount required"); return; }
    setSaving(true);
    const { error } = await supabase.from("deals").insert({
      title: deal.title.trim(),
      amount: parseFloat(deal.amount),
      status: "open",
      stage: "prospect",
    });
    setSaving(false);
    if (error) { toast.error("Failed to add deal"); return; }
    toast.success("Deal added");
    setDeal({ title: "", amount: "" });
    setForm(null);
  }

  async function saveNote() {
    if (!note.content.trim()) { toast.error("Note is empty"); return; }
    setSaving(true);
    const { error } = await supabase.from("outreach_log").insert({
      type: "note",
      message: note.content.trim(),
      source: "manual",
      timestamp: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error("Failed to save note"); return; }
    toast.success("Note saved");
    setNote({ content: "" });
    setForm(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-[9990] flex flex-col items-end gap-3">

      {/* Speed-dial action chips (fan up when expanded) */}
      {ACTIONS.map((action, i) => {
        const Icon = action.icon;
        const delay = i * 40;
        return (
          <div
            key={action.type}
            className="flex items-center gap-2 transition-all duration-200"
            style={{
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateY(0) scale(1)" : "translateY(12px) scale(0.9)",
              transitionDelay: expanded ? `${delay}ms` : `${(ACTIONS.length - 1 - i) * 25}ms`,
              pointerEvents: expanded ? "auto" : "none",
            }}
          >
            {/* Label */}
            <span className="text-xs font-medium text-[#111827] bg-white border border-[rgba(0,0,0,0.1)] px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap select-none"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              {action.label}
            </span>
            {/* Icon button */}
            <button
              onClick={() => selectAction(action.type)}
              aria-label={action.label}
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95"
              style={{ background: action.color }}
            >
              <Icon size={15} className="text-white" />
            </button>
          </div>
        );
      })}

      {/* Main FAB trigger */}
      <button
        onClick={() => { setExpanded(v => !v); setForm(null); }}
        aria-label={expanded ? "Close quick add" : "Quick add (Shift+N)"}
        className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          background: "#2563EB",
          boxShadow: "0 4px 20px rgba(37,99,235,0.35), 0 1px 4px rgba(0,0,0,0.12)",
        }}
      >
        <Plus
          size={20}
          className="text-white transition-transform duration-200"
          style={{ transform: expanded ? "rotate(45deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Form modal */}
      {form && (
        <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[18vh]">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setForm(null)}
          />
          <div
            className="relative w-full max-w-sm mx-4 bg-white rounded-2xl overflow-hidden"
            style={{
              boxShadow: "0 24px 64px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
              animation: "fadeScaleIn 180ms cubic-bezier(0.32,0.72,0,1) both",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.08)]">
              <h3 className="text-sm font-semibold text-[#111827]">
                {form === "lead"   && "New Lead"}
                {form === "client" && "New Client"}
                {form === "deal"   && "New Deal"}
                {form === "note"   && "Quick Note"}
              </h3>
              <button
                onClick={() => setForm(null)}
                className="p-1 rounded-md text-[#6B7280] hover:text-[#111827] hover:bg-[rgba(0,0,0,0.04)] transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {form === "lead" && (
                <>
                  <FormInput value={lead.business_name} onChange={v => setLead({ ...lead, business_name: v })} placeholder="Business name *" autoFocus />
                  <FormInput value={lead.email}         onChange={v => setLead({ ...lead, email: v })}         placeholder="Email" type="email" />
                  <FormInput value={lead.phone}         onChange={v => setLead({ ...lead, phone: v })}         placeholder="Phone" />
                  <FormInput value={lead.industry}      onChange={v => setLead({ ...lead, industry: v })}      placeholder="Industry" />
                  <SubmitBtn saving={saving} label="Add Lead"   icon={<Zap size={13} />}       onClick={saveLead}   />
                </>
              )}
              {form === "client" && (
                <>
                  <FormInput value={client.business_name} onChange={v => setClient({ ...client, business_name: v })} placeholder="Business name *" autoFocus />
                  <FormInput value={client.email}         onChange={v => setClient({ ...client, email: v })}         placeholder="Email" type="email" />
                  <FormInput value={client.phone}         onChange={v => setClient({ ...client, phone: v })}         placeholder="Phone" />
                  <SubmitBtn saving={saving} label="Add Client" icon={<UserPlus size={13} />}  onClick={saveClient} />
                </>
              )}
              {form === "deal" && (
                <>
                  <FormInput value={deal.title}  onChange={v => setDeal({ ...deal, title: v })}  placeholder="Deal title *" autoFocus />
                  <FormInput value={deal.amount} onChange={v => setDeal({ ...deal, amount: v })} placeholder="Amount ($)"   type="number" />
                  <SubmitBtn saving={saving} label="Add Deal"   icon={<Briefcase size={13} />}   onClick={saveDeal}   />
                </>
              )}
              {form === "note" && (
                <>
                  <textarea
                    value={note.content}
                    onChange={e => setNote({ content: e.target.value })}
                    placeholder="Write a note..."
                    rows={4}
                    autoFocus
                    className="w-full text-sm text-[#111827] placeholder-[#9CA3AF] bg-[#F9FAFB] border border-[rgba(0,0,0,0.1)] rounded-xl px-3 py-2.5 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[rgba(37,99,235,0.12)] resize-none transition-colors"
                  />
                  <SubmitBtn saving={saving} label="Save Note"  icon={<StickyNote size={13} />} onClick={saveNote}   />
                </>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-5 pb-4 text-center">
              <p className="text-[10px] text-[#9CA3AF]">
                Press <kbd className="px-1 py-0.5 rounded text-[9px] bg-[#F3F4F6] font-mono">Esc</kbd> to close
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe animation */}
      <style>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FormInput({
  value, onChange, placeholder, type = "text", autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full text-sm text-[#111827] placeholder-[#9CA3AF] bg-[#F9FAFB] border border-[rgba(0,0,0,0.1)] rounded-xl px-3 py-2.5 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[rgba(37,99,235,0.12)] transition-colors"
    />
  );
}

function SubmitBtn({
  saving, label, icon, onClick,
}: {
  saving: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
      style={{ background: "#2563EB" }}
    >
      {saving ? <Loader2 size={13} className="animate-spin" /> : icon}
      {saving ? "Saving..." : label}
    </button>
  );
}
