"use client";

import { useState } from "react";
import {
  Phone, Mail, Plus, Search, X, Check, Trash2,
  Globe, Shield, Copy, Settings, Send, AlertCircle,
  RefreshCw,
  Server
} from "lucide-react";
import PageAI from "@/components/page-ai";

/* ── Types ── */
type MainTab = "phone" | "email";
type NumberType = "local" | "toll-free" | "mobile";
type PhoneStatus = "active" | "suspended";
type EmailStatus = "verified" | "pending";
type SmtpOption = "shortstack" | "custom";

interface PhoneNumber {
  id: string;
  number: string;
  type: NumberType;
  status: PhoneStatus;
  capabilities: ("Voice" | "SMS" | "MMS")[];
  monthlyCost: number;
  purchasedDate: string;
  country: string;
}

interface EmailAddress {
  id: string;
  email: string;
  displayName: string;
  status: EmailStatus;
  provider: string;
  dailyLimit: number;
  sentToday: number;
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
}

/* ── Mock Data ── */
const MOCK_PHONES: PhoneNumber[] = [
  { id: "p1", number: "+1 (555) 234-5678", type: "local", status: "active", capabilities: ["Voice", "SMS", "MMS"], monthlyCost: 1.50, purchasedDate: "2026-03-10", country: "US" },
  { id: "p2", number: "+1 (800) 555-0199", type: "toll-free", status: "active", capabilities: ["Voice", "SMS"], monthlyCost: 2.00, purchasedDate: "2026-02-22", country: "US" },
  { id: "p3", number: "+1 (415) 555-7890", type: "local", status: "suspended", capabilities: ["Voice", "SMS", "MMS"], monthlyCost: 1.50, purchasedDate: "2026-01-15", country: "US" },
];

const MOCK_EMAILS: EmailAddress[] = [
  { id: "e1", email: "outreach@acmecorp.com", displayName: "Acme Outreach", status: "verified", provider: "ShortStack SMTP", dailyLimit: 500, sentToday: 142 },
  { id: "e2", email: "sales@acmecorp.com", displayName: "Acme Sales", status: "verified", provider: "Custom SMTP", dailyLimit: 1000, sentToday: 387 },
  { id: "e3", email: "hello@newbrand.io", displayName: "New Brand", status: "pending", provider: "ShortStack SMTP", dailyLimit: 500, sentToday: 0 },
];

const MOCK_DOMAINS: Domain[] = [
  { id: "d1", domain: "acmecorp.com", verified: true, spf: true, dkim: true, dmarc: true, addedDate: "2026-01-05" },
  { id: "d2", domain: "newbrand.io", verified: false, spf: true, dkim: false, dmarc: false, addedDate: "2026-04-10" },
];

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

const MOCK_AVAILABLE: AvailableNumber[] = [
  { number: "+1 (555) 301-4422", type: "local", monthlyCost: 1.50, capabilities: ["Voice", "SMS", "MMS"] },
  { number: "+1 (555) 301-4455", type: "local", monthlyCost: 1.50, capabilities: ["Voice", "SMS", "MMS"] },
  { number: "+1 (555) 301-4489", type: "local", monthlyCost: 1.50, capabilities: ["Voice", "SMS"] },
  { number: "+1 (800) 555-2200", type: "toll-free", monthlyCost: 2.00, capabilities: ["Voice", "SMS"] },
  { number: "+1 (888) 555-3311", type: "toll-free", monthlyCost: 2.00, capabilities: ["Voice", "SMS", "MMS"] },
];

/* ── Component ── */
export default function PhoneEmailPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("phone");

  /* Phone state */
  const [phones, setPhones] = useState<PhoneNumber[]>(MOCK_PHONES);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyCountry, setBuyCountry] = useState("US");
  const [buyAreaCode, setBuyAreaCode] = useState("");
  const [buyType, setBuyType] = useState<NumberType>("local");
  const [searchResults, setSearchResults] = useState<AvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);

  /* Email state */
  const [emails, setEmails] = useState<EmailAddress[]>(MOCK_EMAILS);
  const [domains, setDomains] = useState<Domain[]>(MOCK_DOMAINS);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [smtpOption, setSmtpOption] = useState<SmtpOption>("shortstack");
  const [customSmtp, setCustomSmtp] = useState({ host: "", port: "587", user: "", pass: "" });
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [newDomain, setNewDomain] = useState("");

  /* ── Stats ── */
  const totalNumbers = phones.length;
  const monthlyCost = phones.reduce((s, p) => s + p.monthlyCost, 0);
  const smsSentThisMonth = 1247;
  const callsThisMonth = 389;

  /* ── Handlers ── */
  const searchNumbers = () => {
    setSearching(true);
    setTimeout(() => {
      const filtered = MOCK_AVAILABLE.filter(n => n.type === buyType);
      setSearchResults(filtered);
      setSearching(false);
    }, 800);
  };

  const purchaseNumber = (num: AvailableNumber) => {
    const newPhone: PhoneNumber = {
      id: `p${Date.now()}`,
      number: num.number,
      type: num.type,
      status: "active",
      capabilities: num.capabilities,
      monthlyCost: num.monthlyCost,
      purchasedDate: new Date().toISOString().split("T")[0],
      country: buyCountry,
    };
    setPhones(prev => [...prev, newPhone]);
    setSearchResults(prev => prev.filter(n => n.number !== num.number));
  };

  const releaseNumber = (id: string) => {
    setPhones(prev => prev.filter(p => p.id !== id));
  };

  const addEmail = () => {
    if (!newEmail.trim()) return;
    const entry: EmailAddress = {
      id: `e${Date.now()}`,
      email: newEmail,
      displayName: newDisplayName || newEmail.split("@")[0],
      status: "pending",
      provider: smtpOption === "shortstack" ? "ShortStack SMTP" : "Custom SMTP",
      dailyLimit: smtpOption === "shortstack" ? 500 : 1000,
      sentToday: 0,
    };
    setEmails(prev => [...prev, entry]);
    setNewEmail("");
    setNewDisplayName("");
    setCustomSmtp({ host: "", port: "587", user: "", pass: "" });
    setShowEmailModal(false);
  };

  const removeEmail = (id: string) => {
    setEmails(prev => prev.filter(e => e.id !== id));
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

  const capBadgeColor = (cap: string) => {
    if (cap === "Voice") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (cap === "SMS") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    return "bg-green-500/10 text-green-400 border-green-500/20";
  };

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Phone size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Phone & Email</h1>
            <p className="text-xs text-muted">Purchase phone numbers and configure email sending addresses for outreach</p>
          </div>
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
          {/* Stats Strip */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Numbers", value: totalNumbers, color: "text-gold" },
              { label: "Monthly Cost", value: `$${monthlyCost.toFixed(2)}`, color: "text-cyan-400" },
              { label: "SMS Sent This Month", value: smsSentThisMonth.toLocaleString(), color: "text-blue-400" },
              { label: "Calls This Month", value: callsThisMonth.toLocaleString(), color: "text-purple-400" },
            ].map((s, i) => (
              <div key={i} className="card p-3 text-center">
                <p className="text-[9px] text-muted uppercase tracking-wider">{s.label}</p>
                <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Phone Numbers</h2>
              <p className="text-[10px] text-muted">Purchase and manage phone numbers for calls and SMS</p>
            </div>
            <button onClick={() => { setShowBuyModal(true); setSearchResults([]); }}
              className="text-[10px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all flex items-center gap-1">
              <Plus size={12} /> Buy New Number
            </button>
          </div>

          {/* Active Numbers Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border text-muted text-left">
                    <th className="p-3 font-medium">Phone Number</th>
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Capabilities</th>
                    <th className="p-3 font-medium">Monthly Cost</th>
                    <th className="p-3 font-medium">Purchased</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {phones.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                      <td className="p-3 font-mono font-medium text-foreground">{p.number}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-gold/10 text-gold border border-gold/20 capitalize">
                          {p.type}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                          p.status === "active"
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}>
                          {p.status}
                        </span>
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
                      <td className="p-3 text-muted">${p.monthlyCost.toFixed(2)}/mo</td>
                      <td className="p-3 text-muted">{p.purchasedDate}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a href="/dashboard/voice-receptionist"
                            className="px-2 py-1 rounded text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-1">
                            <Settings size={10} /> Configure
                          </a>
                          <button onClick={() => releaseNumber(p.id)}
                            className="px-2 py-1 rounded text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-1">
                            <Trash2 size={10} /> Release
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {phones.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted text-xs">
                        No phone numbers yet. Click &quot;Buy New Number&quot; to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Buy Number Modal */}
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

                {/* Search Button */}
                <button onClick={searchNumbers} disabled={searching}
                  className="w-full py-2.5 rounded-lg bg-gold text-black text-xs font-semibold hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {searching ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                  {searching ? "Searching..." : "Search Available Numbers"}
                </button>

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
                            <div className="flex gap-1">
                              {num.capabilities.map(c => (
                                <span key={c} className={`px-1 py-0 rounded text-[7px] font-medium border ${capBadgeColor(c)}`}>{c}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => purchaseNumber(num)}
                          className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-medium border border-green-500/20 hover:bg-green-500/20 transition-all">
                          Purchase
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                    <th className="p-3 font-medium">Provider</th>
                    <th className="p-3 font-medium">Daily Limit</th>
                    <th className="p-3 font-medium">Sent Today</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map(e => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                      <td className="p-3 font-mono font-medium text-foreground">{e.email}</td>
                      <td className="p-3 text-muted">{e.displayName}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                          e.status === "verified"
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                        }`}>
                          {e.status === "verified" ? "Verified" : "Pending"}
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
                            <div className="h-full bg-gold rounded-full transition-all"
                              style={{ width: `${Math.min((e.sentToday / e.dailyLimit) * 100, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button className="px-2 py-1 rounded text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-1">
                            <Send size={10} /> Send Test
                          </button>
                          <button onClick={() => removeEmail(e.id)}
                            className="px-2 py-1 rounded text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-1">
                            <Trash2 size={10} /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {emails.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted text-xs">
                        No email addresses configured. Click &quot;Add Email Address&quot; to get started.
                      </td>
                    </tr>
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

          {/* Add Email Modal */}
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
                <button onClick={addEmail} disabled={!newEmail.trim()}
                  className="w-full py-2.5 rounded-lg bg-gold text-black text-xs font-semibold hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  <Check size={12} /> Verify & Add
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

      <PageAI pageName="Phone & Email" context="phone numbers, Twilio, SMS, voice calls, email sending, SMTP configuration, domain verification, SPF, DKIM, DMARC, outreach, campaigns"
        suggestions={["Buy a local phone number", "Set up email sending", "Verify my domain DNS records", "What DKIM records do I need?"]} />
    </div>
  );
}
