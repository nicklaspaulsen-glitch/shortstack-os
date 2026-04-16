"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Phone, Mail, Plus, Search, X, Check, Trash2,
  Globe, Shield, Copy, Settings, Send, AlertCircle,
  RefreshCw, Server, Activity, Zap, TrendingUp,
  BarChart3, Users
} from "lucide-react";
import PageAI from "@/components/page-ai";

/* ── Types ── */
type MainTab = "phone" | "email";
type NumberType = "local" | "toll-free" | "mobile";
type PhoneStatus = "active" | "suspended" | "warming";
type EmailStatus = "verified" | "pending" | "warming";
type SmtpOption = "shortstack" | "custom";
type WarmupStage = "new" | "warming" | "ramping" | "full";
type PhoneSource = "pool" | "client";
type PurchaseTarget = "pool" | "client";

interface PoolPhone {
  id: string;
  number: string;
  label?: string;
  type: NumberType;
  status: PhoneStatus;
  capabilities: ("Voice" | "SMS" | "MMS")[];
  monthlyCost: number;
  purchasedDate: string;
  country: string;
  source: PhoneSource;
  assignedTo?: string;       // client name or undefined for pool
  assignedClientId?: string;
  dailyLimit: number;
  sentToday: number;
  warmupStage: WarmupStage;
}

interface PoolEmail {
  id: string;
  email: string;
  displayName: string;
  status: EmailStatus;
  provider: string;
  dailyLimit: number;
  sentToday: number;
  warmupStage: WarmupStage;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
}

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  addedDate: string;
}

interface AvailableNumber {
  number: string;
  type: NumberType;
  monthlyCost: number;
  capabilities: ("Voice" | "SMS" | "MMS")[];
  locality?: string;
  region?: string;
}

interface RotationStats {
  rotationActive: boolean;
  phones: { active: number; totalCapacity: number; usedToday: number };
  emails: { active: number; totalCapacity: number; usedToday: number };
}

const COUNTRIES = [
  { code: "US", name: "United States", flag: "US" },
  { code: "CA", name: "Canada", flag: "CA" },
  { code: "UK", name: "United Kingdom", flag: "UK" },
  { code: "AU", name: "Australia", flag: "AU" },
];

const NUMBER_TYPES: { value: NumberType; label: string; cost: number }[] = [
  { value: "local", label: "Local", cost: 1.50 },
  { value: "toll-free", label: "Toll-Free", cost: 2.00 },
  { value: "mobile", label: "Mobile", cost: 1.50 },
];

const WARMUP_BADGE: Record<WarmupStage, { label: string; class: string }> = {
  new:     { label: "New",     class: "bg-red-500/10 text-red-400 border-red-500/20" },
  warming: { label: "Warming", class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  ramping: { label: "Ramping", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  full:    { label: "Full",    class: "bg-green-500/10 text-green-400 border-green-500/20" },
};

/* ── Component ── */
export default function PhoneEmailPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("phone");

  /* ── Pool / unified state ── */
  const [poolPhones, setPoolPhones] = useState<PoolPhone[]>([]);
  const [poolEmails, setPoolEmails] = useState<PoolEmail[]>([]);
  const [rotationStats, setRotationStats] = useState<RotationStats | null>(null);

  /* Phone buy modal state */
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyCountry, setBuyCountry] = useState("US");
  const [buyAreaCode, setBuyAreaCode] = useState("");
  const [buyType, setBuyType] = useState<NumberType>("local");
  const [searchResults, setSearchResults] = useState<AvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseTarget, setPurchaseTarget] = useState<PurchaseTarget>("pool");

  /* Manual phone add modal */
  const [showManualPhoneModal, setShowManualPhoneModal] = useState(false);
  const [manualPhone, setManualPhone] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [manualType, setManualType] = useState<NumberType>("local");
  const [manualAdding, setManualAdding] = useState(false);

  /* Client state for purchase assignment */
  const [clients, setClients] = useState<{id: string; business_name: string; twilio_phone_number?: string}[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  /* Loading */
  const [loading, setLoading] = useState(true);

  /* Email state */
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [smtpOption, setSmtpOption] = useState<SmtpOption>("shortstack");
  const [customSmtp, setCustomSmtp] = useState({ host: "", port: "587", user: "", pass: "" });
  const [emailAdding, setEmailAdding] = useState(false);

  /* Domain state */
  const [domains, setDomains] = useState<Domain[]>([]);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [newDomain, setNewDomain] = useState("");

  /* ── Data Fetching ── */
  const fetchPoolPhones = useCallback(async () => {
    try {
      const res = await fetch("/api/senders/phones");
      const data = await res.json();
      return (data.phones || []).map((p: any) => ({
        id: p.id || `pool-${p.phone_number}`,
        number: p.phone_number || p.number,
        label: p.label,
        type: (p.type || "local") as NumberType,
        status: (p.status || "active") as PhoneStatus,
        capabilities: p.capabilities || ["Voice", "SMS"],
        monthlyCost: p.monthly_cost ?? 1.50,
        purchasedDate: p.created_at ? new Date(p.created_at).toISOString().split("T")[0] : "",
        country: p.country || "US",
        source: "pool" as PhoneSource,
        assignedTo: p.assigned_to_name || undefined,
        assignedClientId: p.assigned_to_client_id || undefined,
        dailyLimit: p.daily_limit ?? 100,
        sentToday: p.sent_today ?? 0,
        warmupStage: (p.warmup_stage || "new") as WarmupStage,
      }));
    } catch {
      return [];
    }
  }, []);

  const fetchClientPhones = useCallback(async () => {
    try {
      const res = await fetch("/api/twilio/numbers");
      const data = await res.json();
      return (data.numbers || []).map((p: any) => ({
        id: p.id || `twilio-${p.number}`,
        number: p.number,
        label: undefined,
        type: (p.type || "local") as NumberType,
        status: (p.status || "active") as PhoneStatus,
        capabilities: p.capabilities || ["Voice", "SMS"],
        monthlyCost: p.monthlyCost ?? 1.50,
        purchasedDate: p.purchasedDate || "",
        country: p.country || "US",
        source: "client" as PhoneSource,
        assignedTo: p.clientName || p.assigned_to || undefined,
        assignedClientId: p.clientId || undefined,
        dailyLimit: p.dailyLimit ?? p.daily_limit ?? 200,
        sentToday: p.sentToday ?? p.sent_today ?? 0,
        warmupStage: (p.warmupStage || p.warmup_stage || "full") as WarmupStage,
      }));
    } catch {
      return [];
    }
  }, []);

  const fetchPoolEmails = useCallback(async () => {
    try {
      const res = await fetch("/api/senders/emails");
      const data = await res.json();
      return (data.emails || []).map((e: any) => ({
        id: e.id || `email-${e.email}`,
        email: e.email,
        displayName: e.display_name || e.displayName || e.email.split("@")[0],
        status: (e.status || "pending") as EmailStatus,
        provider: e.provider || e.smtp_provider || "ShortStack SMTP",
        dailyLimit: e.daily_limit ?? e.dailyLimit ?? 500,
        sentToday: e.sent_today ?? e.sentToday ?? 0,
        warmupStage: (e.warmup_stage || e.warmupStage || "new") as WarmupStage,
        smtpHost: e.smtp_host,
        smtpPort: e.smtp_port,
        smtpUser: e.smtp_user,
      }));
    } catch {
      return [];
    }
  }, []);

  const fetchRotationStats = useCallback(async () => {
    try {
      const res = await fetch("/api/senders/stats");
      const data = await res.json();
      setRotationStats({
        rotationActive: data.rotation_active ?? data.rotationActive ?? true,
        phones: {
          active: data.phones?.active ?? 0,
          totalCapacity: data.phones?.total_capacity ?? data.phones?.totalCapacity ?? 0,
          usedToday: data.phones?.used_today ?? data.phones?.usedToday ?? 0,
        },
        emails: {
          active: data.emails?.active ?? 0,
          totalCapacity: data.emails?.total_capacity ?? data.emails?.totalCapacity ?? 0,
          usedToday: data.emails?.used_today ?? data.emails?.usedToday ?? 0,
        },
      });
    } catch {
      // Compute from local data as fallback
      setRotationStats(null);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      setClients(data.clients || []);
    } catch { /* ignore */ }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [pool, client, emails] = await Promise.all([
      fetchPoolPhones(),
      fetchClientPhones(),
      fetchPoolEmails(),
    ]);
    // Merge phones, dedup by number
    const seen = new Set<string>();
    const merged: PoolPhone[] = [];
    for (const p of [...pool, ...client]) {
      const key = p.number.replace(/\D/g, "");
      if (!seen.has(key)) { seen.add(key); merged.push(p); }
    }
    setPoolPhones(merged);
    setPoolEmails(emails);
    setLoading(false);
  }, [fetchPoolPhones, fetchClientPhones, fetchPoolEmails]);

  useEffect(() => {
    loadAll();
    fetchClients();
    fetchRotationStats();
  }, [loadAll, fetchClients, fetchRotationStats]);

  /* ── Computed stats (fallback when API stats unavailable) ── */
  const computedStats: RotationStats = rotationStats ?? {
    rotationActive: poolPhones.length > 1 || poolEmails.length > 1,
    phones: {
      active: poolPhones.filter(p => p.status === "active" || p.status === "warming").length,
      totalCapacity: poolPhones.reduce((s, p) => s + p.dailyLimit, 0),
      usedToday: poolPhones.reduce((s, p) => s + p.sentToday, 0),
    },
    emails: {
      active: poolEmails.filter(e => e.status === "verified" || e.status === "warming").length,
      totalCapacity: poolEmails.reduce((s, e) => s + e.dailyLimit, 0),
      usedToday: poolEmails.reduce((s, e) => s + e.sentToday, 0),
    },
  };

  const totalPhoneCapacity = computedStats.phones.totalCapacity;
  const totalEmailCapacity = computedStats.emails.totalCapacity;
  const totalCapacity = totalPhoneCapacity + totalEmailCapacity;
  const totalUsed = computedStats.phones.usedToday + computedStats.emails.usedToday;
  const totalRemaining = totalCapacity - totalUsed;

  /* ── Handlers ── */
  const searchNumbers = async () => {
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(`/api/twilio/provision?country=${buyCountry}&area_code=${buyAreaCode}`);
      const data = await res.json();
      if (data.error) { setSearchError(data.error); setSearchResults([]); setSearching(false); return; }
      setSearchResults((data.numbers || []).map((n: any) => ({
        number: n.phone,
        type: buyType,
        monthlyCost: NUMBER_TYPES.find(t => t.value === buyType)?.cost || 1.50,
        capabilities: ["Voice", "SMS"] as ("Voice" | "SMS" | "MMS")[],
        locality: n.locality,
        region: n.region,
      })));
    } catch { setSearchError("Failed to search. Check Twilio configuration."); }
    setSearching(false);
  };

  const purchaseNumber = async (_num: AvailableNumber) => {
    if (purchaseTarget === "client" && !selectedClientId) {
      setPurchaseError("Select a client to assign this number to");
      return;
    }
    setPurchasing(true);
    setPurchaseError("");
    try {
      const res = await fetch("/api/twilio/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: purchaseTarget === "client" ? selectedClientId : undefined,
          area_code: buyAreaCode,
          country: buyCountry,
        }),
      });
      const data = await res.json();
      if (data.error) { setPurchaseError(data.error); setPurchasing(false); return; }

      // If adding to pool, also register with the senders API
      if (purchaseTarget === "pool") {
        try {
          await fetch("/api/senders/phones", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone_number: data.phone || data.number || _num.number,
              type: buyType,
              label: `Pool - ${buyAreaCode || buyCountry}`,
              country: buyCountry,
            }),
          });
        } catch { /* pool registration best-effort */ }
      }

      // Refresh everything
      await loadAll();
      await fetchClients();
      await fetchRotationStats();
      setShowBuyModal(false);
      setSearchResults([]);
    } catch { setPurchaseError("Purchase failed. Try again."); }
    setPurchasing(false);
  };

  const addManualPhone = async () => {
    if (!manualPhone.trim()) return;
    setManualAdding(true);
    try {
      const res = await fetch("/api/senders/phones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: manualPhone,
          type: manualType,
          label: manualLabel || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) { setManualAdding(false); return; }
      await loadAll();
      await fetchRotationStats();
      setManualPhone("");
      setManualLabel("");
      setManualType("local");
      setShowManualPhoneModal(false);
    } catch { /* ignore */ }
    setManualAdding(false);
  };

  const releaseNumber = async (phone: PoolPhone) => {
    // Remove from pool API
    try {
      await fetch(`/api/senders/phones/${phone.id}`, { method: "DELETE" });
    } catch { /* ignore */ }
    setPoolPhones(prev => prev.filter(p => p.id !== phone.id));
    fetchRotationStats();
  };

  const addEmail = async () => {
    if (!newEmail.trim()) return;
    setEmailAdding(true);
    try {
      const res = await fetch("/api/senders/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          display_name: newDisplayName || newEmail.split("@")[0],
          provider: smtpOption === "shortstack" ? "ShortStack SMTP" : "Custom SMTP",
          daily_limit: smtpOption === "shortstack" ? 500 : 1000,
          smtp_host: smtpOption === "custom" ? customSmtp.host : undefined,
          smtp_port: smtpOption === "custom" ? customSmtp.port : undefined,
          smtp_user: smtpOption === "custom" ? customSmtp.user : undefined,
          smtp_pass: smtpOption === "custom" ? customSmtp.pass : undefined,
        }),
      });
      const data = await res.json();
      if (!data.error) {
        await loadAll();
        await fetchRotationStats();
      }
    } catch { /* ignore */ }
    setNewEmail("");
    setNewDisplayName("");
    setCustomSmtp({ host: "", port: "587", user: "", pass: "" });
    setShowEmailModal(false);
    setEmailAdding(false);
  };

  const removeEmail = async (email: PoolEmail) => {
    try {
      await fetch(`/api/senders/emails/${email.id}`, { method: "DELETE" });
    } catch { /* ignore */ }
    setPoolEmails(prev => prev.filter(e => e.id !== email.id));
    fetchRotationStats();
  };

  const addDomain = () => {
    if (!newDomain.trim()) return;
    const entry: Domain = {
      id: `d${Date.now()}`,
      domain: newDomain,
      verified: false,
      spf: false,
      dkim: false,
      dmarc: false,
      addedDate: new Date().toISOString().split("T")[0],
    };
    setDomains(prev => [...prev, entry]);
    setNewDomain("");
    setShowDomainModal(false);
  };

  const removeDomain = (id: string) => {
    setDomains(prev => prev.filter(d => d.id !== id));
  };

  /* ── Helpers ── */
  const capBadgeColor = (cap: string) => {
    if (cap === "Voice") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (cap === "SMS") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    return "bg-green-500/10 text-green-400 border-green-500/20";
  };

  const pct = (used: number, total: number) => total > 0 ? Math.min((used / total) * 100, 100) : 0;

  const pctBarColor = (used: number, total: number) => {
    const p = pct(used, total);
    if (p > 85) return "bg-red-500";
    if (p > 60) return "bg-yellow-500";
    return "bg-gold";
  };

  const clientsWithoutPhone = clients.filter(c => !c.twilio_phone_number);

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Phone size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Sender Management</h1>
            <p className="text-xs text-muted">Manage your phone & email sender pool with smart rotation for outreach campaigns</p>
          </div>
        </div>
      </div>

      {/* ════════════════════ ROTATION STATS CARD ════════════════════ */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-gold" />
            <span className="text-xs font-semibold">Smart Rotation</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium border ${
              computedStats.rotationActive
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
            }`}>
              {computedStats.rotationActive ? "Active" : "Inactive"}
            </span>
          </div>
          <button onClick={() => { loadAll(); fetchRotationStats(); }}
            className="text-[10px] px-2 py-1 rounded-lg text-muted hover:text-foreground border border-border hover:border-gold/20 transition-all flex items-center gap-1">
            <RefreshCw size={10} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total pool capacity */}
          <div className="p-3 rounded-lg bg-background border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 size={11} className="text-gold" />
              <span className="text-[9px] text-muted uppercase tracking-wider">Total Capacity</span>
            </div>
            <p className="text-lg font-bold text-gold">{totalCapacity.toLocaleString()}</p>
            <p className="text-[9px] text-muted">msgs/day across all senders</p>
          </div>

          {/* Used today */}
          <div className="p-3 rounded-lg bg-background border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={11} className="text-cyan-400" />
              <span className="text-[9px] text-muted uppercase tracking-wider">Used Today</span>
            </div>
            <p className="text-lg font-bold text-cyan-400">{totalUsed.toLocaleString()}</p>
            <div className="mt-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pctBarColor(totalUsed, totalCapacity)}`}
                style={{ width: `${pct(totalUsed, totalCapacity)}%` }} />
            </div>
          </div>

          {/* Phone senders */}
          <div className="p-3 rounded-lg bg-background border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Phone size={11} className="text-purple-400" />
              <span className="text-[9px] text-muted uppercase tracking-wider">Phone Senders</span>
            </div>
            <p className="text-lg font-bold text-purple-400">{computedStats.phones.active}</p>
            <p className="text-[9px] text-muted">
              {computedStats.phones.usedToday.toLocaleString()} / {computedStats.phones.totalCapacity.toLocaleString()} used
            </p>
          </div>

          {/* Email senders */}
          <div className="p-3 rounded-lg bg-background border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Mail size={11} className="text-blue-400" />
              <span className="text-[9px] text-muted uppercase tracking-wider">Email Senders</span>
            </div>
            <p className="text-lg font-bold text-blue-400">{computedStats.emails.active}</p>
            <p className="text-[9px] text-muted">
              {computedStats.emails.usedToday.toLocaleString()} / {computedStats.emails.totalCapacity.toLocaleString()} used
            </p>
          </div>
        </div>

        {/* Remaining capacity bar */}
        <div className="flex items-center gap-3 text-[10px]">
          <Zap size={11} className="text-gold shrink-0" />
          <span className="text-muted shrink-0">Remaining today:</span>
          <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-green-500/70 rounded-full transition-all"
              style={{ width: `${pct(totalRemaining, totalCapacity)}%` }} />
          </div>
          <span className="font-semibold text-green-400 shrink-0">{totalRemaining.toLocaleString()}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border pb-px">
        {([
          { key: "phone" as MainTab, label: "Phone Numbers", icon: Phone },
          { key: "email" as MainTab, label: "Email Addresses", icon: Mail },
        ]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium whitespace-nowrap transition-all ${
              activeTab === t.key ? "text-gold border-b-2 border-gold" : "text-muted hover:text-foreground"
            }`}>
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════ PHONE NUMBERS TAB ════════════════════ */}
      {activeTab === "phone" && (
        <div className="space-y-4">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Phone Numbers</h2>
              <p className="text-[10px] text-muted">Pool &amp; client-assigned numbers for calls and SMS outreach</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowManualPhoneModal(true); setManualPhone(""); setManualLabel(""); setManualType("local"); }}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-background text-foreground border border-border hover:border-gold/20 transition-all flex items-center gap-1">
                <Plus size={12} /> Add Existing Number
              </button>
              <button onClick={() => { setShowBuyModal(true); setSearchResults([]); setSearchError(""); setPurchaseError(""); setSelectedClientId(""); setPurchaseTarget("pool"); }}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all flex items-center gap-1">
                <Plus size={12} /> Buy New Number
              </button>
            </div>
          </div>

          {/* Active Numbers Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border text-muted text-left">
                    <th className="p-3 font-medium">Phone Number</th>
                    <th className="p-3 font-medium">Assigned To</th>
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Warmup</th>
                    <th className="p-3 font-medium">Daily Limit</th>
                    <th className="p-3 font-medium">Sent Today</th>
                    <th className="p-3 font-medium">Capabilities</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted text-xs">
                          <RefreshCw size={14} className="animate-spin" />
                          Loading phone numbers...
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {poolPhones.map(p => (
                        <tr key={p.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                          <td className="p-3">
                            <div>
                              <span className="font-mono font-medium text-foreground">{p.number}</span>
                              {p.label && <span className="block text-[9px] text-muted mt-0.5">{p.label}</span>}
                            </div>
                          </td>
                          <td className="p-3">
                            {p.assignedTo ? (
                              <span className="flex items-center gap-1 text-foreground">
                                <Users size={10} className="text-muted" /> {p.assignedTo}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                Pool
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-gold/10 text-gold border border-gold/20 capitalize">
                              {p.type}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                              p.status === "active"
                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                : p.status === "warming"
                                ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium border ${WARMUP_BADGE[p.warmupStage].class}`}>
                              {WARMUP_BADGE[p.warmupStage].label}
                            </span>
                          </td>
                          <td className="p-3 text-muted">{p.dailyLimit.toLocaleString()}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-foreground">{p.sentToday.toLocaleString()}</span>
                              <div className="flex-1 max-w-[50px] h-1.5 bg-border rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${pctBarColor(p.sentToday, p.dailyLimit)}`}
                                  style={{ width: `${pct(p.sentToday, p.dailyLimit)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {p.capabilities.map(c => (
                                <span key={c} className={`px-1.5 py-0.5 rounded text-[8px] font-medium border ${capBadgeColor(c)}`}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a href="/dashboard/voice-receptionist"
                                className="px-2 py-1 rounded text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-1">
                                <Settings size={10} /> Configure
                              </a>
                              <button onClick={() => releaseNumber(p)}
                                className="px-2 py-1 rounded text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-1">
                                <Trash2 size={10} /> Release
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {poolPhones.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-muted text-xs">
                            No phone numbers yet. Click &quot;Buy New Number&quot; or &quot;Add Existing Number&quot; to get started.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Buy Number Modal ── */}
          {showBuyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="card w-full max-w-lg p-5 space-y-4 mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Phone size={14} className="text-gold" /> Buy New Phone Number
                  </h3>
                  <button onClick={() => setShowBuyModal(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
                </div>

                {/* Country Selector */}
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Country</label>
                  <div className="grid grid-cols-4 gap-2">
                    {COUNTRIES.map(c => (
                      <button key={c.code} onClick={() => setBuyCountry(c.code)}
                        className={`p-2 rounded-lg text-[10px] font-medium border transition-all text-center ${
                          buyCountry === c.code
                            ? "border-gold/30 bg-gold/10 text-gold"
                            : "border-border text-muted hover:text-foreground"
                        }`}>
                        <span className="block text-sm mb-0.5">{c.flag}</span>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Area Code */}
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Area Code (optional)</label>
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input value={buyAreaCode} onChange={e => setBuyAreaCode(e.target.value)}
                      placeholder="e.g. 415, 212, 310..."
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-xs focus:border-gold/50 focus:outline-none transition-all" />
                  </div>
                </div>

                {/* Number Type */}
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Number Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {NUMBER_TYPES.map(t => (
                      <button key={t.value} onClick={() => setBuyType(t.value)}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          buyType === t.value
                            ? "border-gold/30 bg-gold/10 text-gold"
                            : "border-border text-muted hover:text-foreground"
                        }`}>
                        <span className="block text-[11px] font-medium">{t.label}</span>
                        <span className="block text-[9px] mt-0.5 opacity-70">${t.cost.toFixed(2)}/mo</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assignment Target: Pool vs Client */}
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Assign To</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPurchaseTarget("pool")}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        purchaseTarget === "pool"
                          ? "border-gold/30 bg-gold/10"
                          : "border-border hover:border-border"
                      }`}>
                      <span className={`block text-[11px] font-medium ${purchaseTarget === "pool" ? "text-gold" : "text-foreground"}`}>
                        Add to Pool
                      </span>
                      <span className="block text-[9px] text-muted mt-0.5">Smart rotation across campaigns</span>
                    </button>
                    <button onClick={() => setPurchaseTarget("client")}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        purchaseTarget === "client"
                          ? "border-gold/30 bg-gold/10"
                          : "border-border hover:border-border"
                      }`}>
                      <span className={`block text-[11px] font-medium ${purchaseTarget === "client" ? "text-gold" : "text-foreground"}`}>
                        Assign to Client
                      </span>
                      <span className="block text-[9px] text-muted mt-0.5">Dedicated number for one client</span>
                    </button>
                  </div>
                </div>

                {/* Client Assignment (only when target=client) */}
                {purchaseTarget === "client" && (
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Select Client</label>
                    {clientsWithoutPhone.length === 0 ? (
                      <p className="text-[10px] text-yellow-400 p-2 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                        No clients without a phone number. Add clients first or release existing numbers.
                      </p>
                    ) : (
                      <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:border-gold/50 focus:outline-none transition-all">
                        <option value="">Select a client...</option>
                        {clientsWithoutPhone.map(c => (
                          <option key={c.id} value={c.id}>{c.business_name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Search Button */}
                <button onClick={searchNumbers} disabled={searching}
                  className="w-full py-2.5 rounded-lg bg-gold text-black text-xs font-semibold hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {searching ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                  {searching ? "Searching..." : "Search Available Numbers"}
                </button>

                {/* Error Display */}
                {searchError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
                    <AlertCircle size={14} /> {searchError}
                  </div>
                )}

                {purchaseError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
                    <AlertCircle size={14} /> {purchaseError}
                  </div>
                )}

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted">{searchResults.length} numbers found</p>
                    {searchResults.map((num, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-gold/20 transition-all">
                        <div>
                          <p className="text-xs font-mono font-medium">{num.number}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-muted capitalize">{num.type}</span>
                            <span className="text-[9px] text-muted">${num.monthlyCost.toFixed(2)}/mo</span>
                            {num.locality && <span className="text-[9px] text-muted">{num.locality}, {num.region}</span>}
                            <div className="flex gap-1">
                              {num.capabilities.map(c => (
                                <span key={c} className={`px-1 py-0 rounded text-[7px] font-medium border ${capBadgeColor(c)}`}>{c}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => purchaseNumber(num)}
                          disabled={purchasing || (purchaseTarget === "client" && !selectedClientId)}
                          className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-medium border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50">
                          {purchasing ? "Purchasing..." : purchaseTarget === "pool" ? "Add to Pool" : "Purchase"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Manual Add Phone Modal ── */}
          {showManualPhoneModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="card w-full max-w-md p-5 space-y-4 mx-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Phone size={14} className="text-gold" /> Add Existing Number
                  </h3>
                  <button onClick={() => setShowManualPhoneModal(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
                </div>

                <p className="text-[10px] text-muted">
                  Add a phone number already provisioned elsewhere (e.g., brought from another service) to the rotation pool.
                </p>

                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Phone Number</label>
                  <input value={manualPhone} onChange={e => setManualPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:border-gold/50 focus:outline-none transition-all" />
                </div>

                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Label (optional)</label>
                  <input value={manualLabel} onChange={e => setManualLabel(e.target.value)}
                    placeholder="e.g. Outreach Line 1, Sales Pool..."
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:border-gold/50 focus:outline-none transition-all" />
                </div>

                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Number Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {NUMBER_TYPES.map(t => (
                      <button key={t.value} onClick={() => setManualType(t.value)}
                        className={`p-2 rounded-lg border text-center transition-all text-[10px] font-medium ${
                          manualType === t.value
                            ? "border-gold/30 bg-gold/10 text-gold"
                            : "border-border text-muted hover:text-foreground"
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={addManualPhone} disabled={!manualPhone.trim() || manualAdding}
                  className="w-full py-2.5 rounded-lg bg-gold text-black text-xs font-semibold hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {manualAdding ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  {manualAdding ? "Adding..." : "Add to Pool"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ EMAIL ADDRESSES TAB ════════════════════ */}
      {activeTab === "email" && (
        <div className="space-y-4">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Email Sending</h2>
              <p className="text-[10px] text-muted">Configure email addresses for outreach and campaigns</p>
            </div>
            <button onClick={() => setShowEmailModal(true)}
              className="text-[10px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all flex items-center gap-1">
              <Plus size={12} /> Add Email Address
            </button>
          </div>

          {/* Email Addresses Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border text-muted text-left">
                    <th className="p-3 font-medium">Email</th>
                    <th className="p-3 font-medium">Display Name</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Warmup</th>
                    <th className="p-3 font-medium">Provider</th>
                    <th className="p-3 font-medium">Daily Limit</th>
                    <th className="p-3 font-medium">Sent Today</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted text-xs">
                          <RefreshCw size={14} className="animate-spin" />
                          Loading email senders...
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {poolEmails.map(e => (
                        <tr key={e.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                          <td className="p-3 font-mono font-medium text-foreground">{e.email}</td>
                          <td className="p-3 text-muted">{e.displayName}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                              e.status === "verified"
                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                : e.status === "warming"
                                ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                            }`}>
                              {e.status === "verified" ? "Verified" : e.status === "warming" ? "Warming" : "Pending"}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium border ${WARMUP_BADGE[e.warmupStage].class}`}>
                              {WARMUP_BADGE[e.warmupStage].label}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="flex items-center gap-1 text-muted">
                              <Server size={10} /> {e.provider}
                            </span>
                          </td>
                          <td className="p-3 text-muted">{e.dailyLimit.toLocaleString()}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-foreground">{e.sentToday.toLocaleString()}</span>
                              <div className="flex-1 max-w-[60px] h-1.5 bg-border rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${pctBarColor(e.sentToday, e.dailyLimit)}`}
                                  style={{ width: `${pct(e.sentToday, e.dailyLimit)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button className="px-2 py-1 rounded text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-1">
                                <Send size={10} /> Send Test
                              </button>
                              <button onClick={() => removeEmail(e)}
                                className="px-2 py-1 rounded text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-1">
                                <Trash2 size={10} /> Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {poolEmails.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-muted text-xs">
                            No email addresses configured. Click &quot;Add Email Address&quot; to get started.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Domain Verification Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Shield size={14} className="text-gold" /> Domain Verification
              </h2>
              <button onClick={() => setShowDomainModal(true)}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all flex items-center gap-1">
                <Plus size={12} /> Add Domain
              </button>
            </div>
            <p className="text-[10px] text-muted">Verify your sending domains to improve deliverability and avoid spam filters</p>

            {domains.map(d => (
              <div key={d.id} className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-gold" />
                    <span className="text-xs font-semibold">{d.domain}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                      d.verified
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                    }`}>
                      {d.verified ? "Verified" : "Pending Verification"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted">Added {d.addedDate}</span>
                    <button onClick={() => removeDomain(d.id)}
                      className="text-muted hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* DNS Records */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "SPF", ok: d.spf, record: `v=spf1 include:shortstack.io ~all` },
                    { label: "DKIM", ok: d.dkim, record: `shortstack._domainkey.${d.domain}` },
                    { label: "DMARC", ok: d.dmarc, record: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${d.domain}` },
                  ].map(rec => (
                    <div key={rec.label} className={`p-2.5 rounded-lg border transition-all ${
                      rec.ok ? "border-green-500/20 bg-green-500/5" : "border-yellow-500/20 bg-yellow-500/5"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold">{rec.label}</span>
                        {rec.ok
                          ? <Check size={11} className="text-green-400" />
                          : <AlertCircle size={11} className="text-yellow-400" />
                        }
                      </div>
                      <div className="flex items-center gap-1">
                        <code className="text-[8px] text-muted bg-background px-1.5 py-0.5 rounded flex-1 truncate">{rec.record}</code>
                        <button className="text-muted hover:text-foreground shrink-0" onClick={() => navigator.clipboard.writeText(rec.record)}>
                          <Copy size={9} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {domains.length === 0 && (
              <div className="card p-6 text-center text-muted text-xs">
                No domains added. Add a domain to configure SPF, DKIM, and DMARC records.
              </div>
            )}
          </div>

          {/* ── Add Email Modal ── */}
          {showEmailModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="card w-full max-w-lg p-5 space-y-4 mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Mail size={14} className="text-gold" /> Add Email Address
                  </h3>
                  <button onClick={() => setShowEmailModal(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
                </div>

                {/* Email Input */}
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Email Address</label>
                  <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    placeholder="outreach@yourdomain.com"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:border-gold/50 focus:outline-none transition-all" />
                </div>

                {/* Display Name */}
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Display Name</label>
                  <input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)}
                    placeholder="Your Company Name"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:border-gold/50 focus:outline-none transition-all" />
                </div>

                {/* SMTP Option */}
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">SMTP Provider</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setSmtpOption("shortstack")}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        smtpOption === "shortstack"
                          ? "border-gold/30 bg-gold/10"
                          : "border-border hover:border-border"
                      }`}>
                      <span className={`block text-[11px] font-medium ${smtpOption === "shortstack" ? "text-gold" : "text-foreground"}`}>
                        ShortStack SMTP
                      </span>
                      <span className="block text-[9px] text-muted mt-0.5">Included in plan - 500/day</span>
                    </button>
                    <button onClick={() => setSmtpOption("custom")}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        smtpOption === "custom"
                          ? "border-gold/30 bg-gold/10"
                          : "border-border hover:border-border"
                      }`}>
                      <span className={`block text-[11px] font-medium ${smtpOption === "custom" ? "text-gold" : "text-foreground"}`}>
                        Custom SMTP
                      </span>
                      <span className="block text-[9px] text-muted mt-0.5">Your own server - higher limits</span>
                    </button>
                  </div>
                </div>

                {/* Custom SMTP Fields */}
                {smtpOption === "custom" && (
                  <div className="space-y-3 p-3 rounded-lg border border-border bg-background/50">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">SMTP Host</label>
                        <input value={customSmtp.host} onChange={e => setCustomSmtp(p => ({ ...p, host: e.target.value }))}
                          placeholder="smtp.gmail.com"
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:border-gold/50 focus:outline-none transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Port</label>
                        <input value={customSmtp.port} onChange={e => setCustomSmtp(p => ({ ...p, port: e.target.value }))}
                          placeholder="587"
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:border-gold/50 focus:outline-none transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Username</label>
                      <input value={customSmtp.user} onChange={e => setCustomSmtp(p => ({ ...p, user: e.target.value }))}
                        placeholder="your-email@gmail.com"
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:border-gold/50 focus:outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Password</label>
                      <input type="password" value={customSmtp.pass} onChange={e => setCustomSmtp(p => ({ ...p, pass: e.target.value }))}
                        placeholder="App password or SMTP password"
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:border-gold/50 focus:outline-none transition-all" />
                    </div>
                  </div>
                )}

                {/* Add Button */}
                <button onClick={addEmail} disabled={!newEmail.trim() || emailAdding}
                  className="w-full py-2.5 rounded-lg bg-gold text-black text-xs font-semibold hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {emailAdding ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                  {emailAdding ? "Adding..." : "Verify & Add"}
                </button>
              </div>
            </div>
          )}

          {/* Add Domain Modal */}
          {showDomainModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="card w-full max-w-md p-5 space-y-4 mx-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Globe size={14} className="text-gold" /> Add Domain
                  </h3>
                  <button onClick={() => setShowDomainModal(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Domain Name</label>
                  <input value={newDomain} onChange={e => setNewDomain(e.target.value)}
                    placeholder="yourdomain.com"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:border-gold/50 focus:outline-none transition-all" />
                </div>
                <p className="text-[9px] text-muted">
                  After adding, you will need to configure SPF, DKIM, and DMARC DNS records with your domain registrar.
                </p>
                <button onClick={addDomain} disabled={!newDomain.trim()}
                  className="w-full py-2.5 rounded-lg bg-gold text-black text-xs font-semibold hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  <Plus size={12} /> Add Domain
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <PageAI pageName="Sender Management" context="phone numbers, Twilio, SMS, voice calls, email sending, SMTP configuration, domain verification, SPF, DKIM, DMARC, outreach, campaigns, sender rotation, warmup, daily limits, pool management"
        suggestions={["Buy a local phone number", "Add an existing number to the pool", "Set up email sending", "How does smart rotation work?"]} />
    </div>
  );
}
