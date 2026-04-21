"use client";

import { useState, useEffect, useCallback, useRef, DragEvent, ChangeEvent, FormEvent } from "react";
import {
  Zap, MessageSquare, Search, Phone, Mail, Star,
  TrendingUp, Users, Target, ArrowDownRight,
  CheckCircle, AlertTriangle, Tag, Upload, Download, Flame,
  Clock, UserPlus, BarChart3,
  RefreshCw, Bell, Layers, GitBranch, Loader, ChevronLeft, ChevronRight as ChevronRightIcon,
  X, FileSpreadsheet, Check
} from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import Link from "next/link";

type MainTab = "leads" | "scoring" | "routing" | "attribution" | "nurture" | "enrichment" | "funnel" | "tags";

interface Lead {
  id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  status: string | null;
  lead_score: number | null;
  website: string | null;
  google_rating: number | null;
  review_count: number | null;
  address: string | null;
  scraped_at: string | null;
  source_url: string | null;
  category: string | null;
}

// ---- CSV helpers ----
const CSV_COLUMNS = ["business_name","email","phone","industry","city","state","source","status","website"] as const;

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

function buildExportCSV(leads: Lead[]): string {
  const headers = ["Business Name","Email","Phone","Industry","City","State","Source","Status","Website","Score","Google Rating","Reviews"];
  const escape = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = leads.map(l => [
    l.business_name, l.email, l.phone, l.industry, l.city, l.state,
    l.source, l.status, l.website, l.lead_score, l.google_rating, l.review_count
  ].map(escape).join(","));
  return [headers.join(","), ...rows].join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const INDUSTRY_OPTIONS = [
  "Dental","Chiropractic","Med Spa","Real Estate","HVAC","Plumbing",
  "Roofing","Legal","Fitness","Restaurant","Salon","Auto Repair",
  "Marketing","E-commerce","Construction","Insurance","Financial Services",
  "Healthcare","Education","Technology","Other"
];

const SOURCE_OPTIONS = ["Manual","Referral","Website","Social Media","Cold Outreach","Google Maps","CSV Import"];
const STATUS_OPTIONS = ["new","contacted","qualified","booked","converted","lost"];

// ====================== IMPORT CSV MODAL ======================
function ImportCSVModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) { setError("Only .csv files are accepted"); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) { setError("CSV is empty or could not be parsed"); return; }
      setRows(parsed);
      // Auto-map columns
      const csvHeaders = Object.keys(parsed[0]);
      const map: Record<string, string> = {};
      CSV_COLUMNS.forEach(col => {
        const match = csvHeaders.find(h => h === col || h.replace(/\s+/g, "_") === col);
        if (match) map[col] = match;
      });
      setColumnMap(map);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function doImport() {
    setStep("importing");
    const mapped = rows.map(row => {
      const obj: Record<string, string> = {};
      CSV_COLUMNS.forEach(col => {
        const csvCol = columnMap[col];
        if (csvCol) obj[col] = row[csvCol] || "";
      });
      return obj;
    });
    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: mapped }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult({ imported: data.imported, skipped: data.skipped });
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  }

  const previewRows = rows.slice(0, 5);
  const csvHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-2xl p-5 space-y-4 mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Upload size={14} className="text-gold" /> Import CSV</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-muted hover:text-foreground"><X size={14} /></button>
        </div>

        {/* Upload step */}
        {step === "upload" && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              dragOver ? "border-gold bg-gold/5" : "border-border hover:border-gold/30"
            }`}
          >
            <FileSpreadsheet size={32} className="mx-auto mb-3 text-muted" />
            <p className="text-xs font-medium mb-1">Drag & drop a CSV file here</p>
            <p className="text-[10px] text-muted">or click to browse</p>
            <p className="text-[9px] text-muted mt-3">Expected columns: business_name, email, phone, industry, city, state, source, status, website</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          </div>
        )}

        {/* Preview step */}
        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-xs text-muted">{rows.length} rows found. Showing first {Math.min(5, rows.length)}:</p>

            {/* Column mapping */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Column Mapping</p>
              <div className="grid grid-cols-2 gap-2">
                {CSV_COLUMNS.map(col => (
                  <div key={col} className="flex items-center gap-2">
                    <span className="text-[10px] w-28 text-muted">{col}</span>
                    <select
                      value={columnMap[col] || ""}
                      onChange={e => setColumnMap(m => ({ ...m, [col]: e.target.value }))}
                      className="input text-[10px] flex-1"
                    >
                      <option value="">-- skip --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {columnMap[col] && <Check size={10} className="text-green-400 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="border-b border-border">
                    {csvHeaders.map(h => (
                      <th key={h} className="text-left p-1.5 text-muted font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {csvHeaders.map(h => (
                        <td key={h} className="p-1.5 max-w-[120px] truncate">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => { setStep("upload"); setRows([]); }} className="btn-secondary text-xs">Back</button>
              <button onClick={doImport} className="btn-primary text-xs flex items-center gap-1.5">
                <Upload size={12} /> Import {rows.length} Leads
              </button>
            </div>
          </div>
        )}

        {/* Importing step */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader size={24} className="animate-spin text-gold" />
            <p className="text-xs text-muted">Importing {rows.length} leads...</p>
          </div>
        )}

        {/* Done step */}
        {step === "done" && result && (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-400/10 flex items-center justify-center mx-auto">
              <CheckCircle size={24} className="text-green-400" />
            </div>
            <p className="text-sm font-semibold">Import Complete</p>
            <div className="flex justify-center gap-6 text-xs">
              <div><span className="text-green-400 font-bold text-lg">{result.imported}</span><p className="text-muted text-[9px]">Imported</p></div>
              <div><span className="text-yellow-400 font-bold text-lg">{result.skipped}</span><p className="text-muted text-[9px]">Skipped</p></div>
            </div>
            <button onClick={() => { onSuccess(); onClose(); }} className="btn-primary text-xs mt-2">Done</button>
          </div>
        )}

        {error && <p className="text-red-400 text-[10px]">{error}</p>}
      </div>
    </div>
  );
}

// ====================== ADD LEAD MODAL ======================
function AddLeadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    business_name: "", email: "", phone: "", industry: "", city: "", state: "",
    source: "Manual", status: "new", website: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.business_name.trim()) { setError("Business name is required"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add lead");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg p-5 space-y-4 mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2"><UserPlus size={14} className="text-gold" /> Add Lead</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-muted hover:text-foreground"><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Business Name */}
          <div>
            <label className="text-[10px] text-muted block mb-1">Business Name <span className="text-red-400">*</span></label>
            <input value={form.business_name} onChange={e => set("business_name", e.target.value)} className="input w-full text-xs" placeholder="Acme Corp" />
          </div>

          {/* Email + Phone row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted block mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="input w-full text-xs" placeholder="hello@acme.com" />
            </div>
            <div>
              <label className="text-[10px] text-muted block mb-1">Phone</label>
              <input value={form.phone} onChange={e => set("phone", e.target.value)} className="input w-full text-xs" placeholder="+1 555 123 4567" />
            </div>
          </div>

          {/* Industry dropdown */}
          <div>
            <label className="text-[10px] text-muted block mb-1">Industry</label>
            <select value={form.industry} onChange={e => set("industry", e.target.value)} className="input w-full text-xs">
              <option value="">Select industry...</option>
              {INDUSTRY_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          {/* City + State row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted block mb-1">City</label>
              <input value={form.city} onChange={e => set("city", e.target.value)} className="input w-full text-xs" placeholder="Miami" />
            </div>
            <div>
              <label className="text-[10px] text-muted block mb-1">State</label>
              <input value={form.state} onChange={e => set("state", e.target.value)} className="input w-full text-xs" placeholder="FL" />
            </div>
          </div>

          {/* Source + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted block mb-1">Source</label>
              <select value={form.source} onChange={e => set("source", e.target.value)} className="input w-full text-xs">
                {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted block mb-1">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)} className="input w-full text-xs">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="text-[10px] text-muted block mb-1">Website</label>
            <input value={form.website} onChange={e => set("website", e.target.value)} className="input w-full text-xs" placeholder="https://acme.com" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] text-muted block mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} className="input w-full text-xs resize-none" rows={3} placeholder="Any additional info..." />
          </div>

          {error && <p className="text-red-400 text-[10px]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary text-xs flex items-center gap-1.5">
              {submitting ? <Loader size={12} className="animate-spin" /> : <UserPlus size={12} />}
              {submitting ? "Adding..." : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ====================== MAIN PAGE ======================
export default function LeadEnginePage() {
  const [activeTab, setActiveTab] = useState<MainTab>("leads");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [hotAlerts, setHotAlerts] = useState(true);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  // Modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Real data state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const LIMIT = 50;

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: LIMIT.toString() });
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);
      if (industryFilter) params.set("industry", industryFilter);

      const res = await fetch(`/api/leads?${params}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setLeads(data.leads || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, statusFilter, industryFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, industryFilter]);

  // Export handler — fetches ALL leads, builds CSV, triggers download
  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/leads?page=1&limit=10000&export=true`);
      if (!res.ok) throw new Error("Failed to fetch leads for export");
      const data = await res.json();
      const allLeads: Lead[] = data.leads || [];
      if (allLeads.length === 0) { toast.error("No leads to export."); return; }
      const csv = buildExportCSV(allLeads);
      const date = new Date().toISOString().split("T")[0];
      downloadCSV(csv, `leads-export-${date}.csv`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed. Check console for details.");
    } finally {
      setExporting(false);
    }
  }

  const industries = Array.from(new Set(leads.map(l => l.industry).filter(Boolean))) as string[];
  const totalLeads = totalCount;
  const hotLeads = leads.filter(l => (l.lead_score ?? 0) >= 80).length;
  const qualifiedLeads = leads.filter(l => l.status === "qualified" || l.status === "booked").length;
  const convertedLeads = leads.filter(l => l.status === "converted").length;
  const totalPages = Math.ceil(totalCount / LIMIT);

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "leads", label: "All Leads", icon: <Users size={14} /> },
    { key: "scoring", label: "Lead Scoring", icon: <Target size={14} /> },
    { key: "routing", label: "Smart Routing", icon: <GitBranch size={14} /> },
    { key: "attribution", label: "Source Attribution", icon: <BarChart3 size={14} /> },
    { key: "nurture", label: "Nurture Sequences", icon: <Mail size={14} /> },
    { key: "enrichment", label: "Enrichment", icon: <Zap size={14} /> },
    { key: "funnel", label: "Conversion Funnel", icon: <TrendingUp size={14} /> },
    { key: "tags", label: "Tags & Alerts", icon: <Tag size={14} /> },
  ];

  return (
    <div className="fade-in space-y-6">
      {/* Modals */}
      {showImportModal && <ImportCSVModal onClose={() => setShowImportModal(false)} onSuccess={fetchLeads} />}
      {showAddModal && <AddLeadModal onClose={() => setShowAddModal(false)} onSuccess={fetchLeads} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <Zap size={24} className="text-gold" />
            </div>
            Lead Engine
          </h1>
          <p className="text-muted text-sm">Automated lead scoring, routing, enrichment & nurture</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImportModal(true)} className="btn-secondary text-xs flex items-center gap-1.5"><Upload size={12} /> Import CSV</button>
          <button onClick={handleExport} disabled={exporting} className="btn-secondary text-xs flex items-center gap-1.5">
            {exporting ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
            {exporting ? "Exporting..." : "Export"}
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs flex items-center gap-1.5"><UserPlus size={12} /> Add Lead</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Total Leads", value: totalLeads, icon: <Users size={12} />, color: "text-gold" },
          { label: "Hot Leads", value: hotLeads, icon: <Flame size={12} />, color: "text-red-400" },
          { label: "Qualified", value: qualifiedLeads, icon: <CheckCircle size={12} />, color: "text-green-400" },
          { label: "Converted", value: convertedLeads, icon: <Star size={12} />, color: "text-purple-400" },
          { label: "Avg Score", value: totalLeads > 0 ? Math.round(leads.reduce((s, l) => s + (l.lead_score ?? 0), 0) / leads.length || 0) : 0, icon: <Target size={12} />, color: "text-blue-400" },
          { label: "Conv Rate", value: `${totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0}%`, icon: <TrendingUp size={12} />, color: "text-gold" },
        ].map((stat, i) => (
          <div key={i} className="card text-center p-3">
            <div className={`w-7 h-7 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-white/5 ${stat.color}`}>{stat.icon}</div>
            <p className="text-lg font-bold">{stat.value}</p>
            <p className="text-[9px] text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ===== ALL LEADS TAB ===== */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="text" placeholder="Search leads..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input w-full pl-9 text-xs" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-xs">
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="booked">Booked</option>
              <option value="converted">Converted</option>
            </select>
            <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)} className="input text-xs">
              <option value="">All Industries</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          {/* Lead Table */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-12 text-[9px] text-muted uppercase tracking-wider font-semibold py-2 px-3">
              <span className="col-span-3">Business</span>
              <span className="col-span-2">Contact</span>
              <span>Source</span>
              <span className="text-center">Score</span>
              <span>Status</span>
              <span className="text-center">Rating</span>
              <span className="col-span-2">Location</span>
              <span className="text-center">Actions</span>
            </div>
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader size={20} className="animate-spin text-gold" />
              </div>
            )}
            {!loading && leads.length === 0 && (
              <EmptyState
                type="no-leads"
                title="No Leads Yet"
                description="Start building your pipeline by scraping leads from Google Maps, importing a CSV, or adding them manually."
                action={
                  <Link href="/dashboard/scraper" className="btn-primary text-xs inline-flex items-center gap-1.5">
                    Start Finding Leads
                  </Link>
                }
              />
            )}
            {!loading && leads.map(lead => (
              <div key={lead.id}>
                <div onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                  className="grid grid-cols-12 items-center py-2.5 px-3 rounded-lg bg-surface-light border border-border hover:border-gold/10 transition-all cursor-pointer text-[10px]">
                  <div className="col-span-3">
                    <p className="text-xs font-semibold">{lead.business_name}</p>
                    <p className="text-[9px] text-muted">{lead.industry || "Unknown"} | {lead.city || "N/A"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted flex items-center gap-1 truncate"><Mail size={9} /> {lead.email || "---"}</p>
                    <p className="text-muted flex items-center gap-1"><Phone size={9} /> {lead.phone || "---"}</p>
                  </div>
                  <span className="text-muted">{lead.source || "---"}</span>
                  <div className="text-center">
                    <span className={`font-bold ${(lead.lead_score ?? 0) >= 80 ? "text-green-400" : (lead.lead_score ?? 0) >= 50 ? "text-yellow-400" : "text-red-400"}`}>{lead.lead_score ?? "—"}</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full w-fit ${
                    lead.status === "converted" ? "bg-purple-400/10 text-purple-400" :
                    lead.status === "booked" ? "bg-green-400/10 text-green-400" :
                    lead.status === "qualified" ? "bg-blue-400/10 text-blue-400" :
                    lead.status === "contacted" || lead.status === "called" ? "bg-yellow-400/10 text-yellow-400" :
                    lead.status === "replied" ? "bg-emerald-400/10 text-emerald-400" :
                    "bg-white/5 text-muted"
                  }`}>{lead.status || "new"}</span>
                  <div className="text-center flex items-center justify-center gap-0.5">
                    {lead.google_rating ? (
                      <>
                        <Star size={9} className="text-gold" />
                        <span>{lead.google_rating}</span>
                        <span className="text-muted">({lead.review_count ?? 0})</span>
                      </>
                    ) : (
                      <span className="text-muted">---</span>
                    )}
                  </div>
                  <div className="col-span-2 text-muted truncate">
                    {[lead.city, lead.state].filter(Boolean).join(", ") || "---"}
                  </div>
                  <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={lead.phone ? `tel:${lead.phone}` : undefined}
                      onClick={(e) => { if (!lead.phone) { e.preventDefault(); toast.error("No phone number"); } }}
                      className={`p-1 rounded hover:bg-white/5 text-muted hover:text-gold ${!lead.phone ? "opacity-40 cursor-not-allowed" : ""}`}
                      title={lead.phone || "No phone"}
                    ><Phone size={10} /></a>
                    <a
                      href={lead.email ? `mailto:${lead.email}` : undefined}
                      onClick={(e) => { if (!lead.email) { e.preventDefault(); toast.error("No email"); } }}
                      className={`p-1 rounded hover:bg-white/5 text-muted hover:text-gold ${!lead.email ? "opacity-40 cursor-not-allowed" : ""}`}
                      title={lead.email || "No email"}
                    ><Mail size={10} /></a>
                    <Link
                      href="/dashboard/dm-controller"
                      className="p-1 rounded hover:bg-white/5 text-muted hover:text-gold"
                      title="DM via DM Controller"
                    ><MessageSquare size={10} /></Link>
                  </div>
                </div>
                {/* Engagement Timeline */}
                {expandedLead === lead.id && (
                  <div className="ml-4 mt-2 mb-3 p-3 rounded-lg bg-surface border border-border">
                    <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5"><Clock size={10} /> Engagement Timeline</h4>
                    <div className="text-center py-4 text-muted text-[9px]">No engagement data yet.</div>
                    {/* Qualification Checklist */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5"><CheckCircle size={10} /> Qualification Checklist</h4>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { item: "Has phone number", check: !!lead.phone },
                          { item: "Has email", check: !!lead.email },
                          { item: "Website found", check: !!lead.website },
                          { item: "Rating 4.0+", check: (lead.google_rating ?? 0) >= 4.0 },
                          { item: "Has address", check: !!lead.address },
                          { item: "Score 70+", check: (lead.lead_score ?? 0) >= 70 },
                        ].map((q, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[9px]">
                            {q.check ? <CheckCircle size={9} className="text-green-400" /> : <div className="w-2.5 h-2.5 rounded border border-muted" />}
                            <span className={q.check ? "" : "text-muted"}>{q.item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-3">
              <p className="text-[10px] text-muted">
                Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, totalCount)} of {totalCount.toLocaleString()} leads
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-border hover:border-gold/20 disabled:opacity-30 transition-all">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-mono text-muted">
                  {page} / {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-border hover:border-gold/20 disabled:opacity-30 transition-all">
                  <ChevronRightIcon size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Duplicate Detection */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Layers size={14} className="text-yellow-400" /> Duplicate Detection
            </h3>
            <div className="text-center py-8 text-muted text-xs">No duplicates detected.</div>
          </div>
        </div>
      )}

      {/* ===== LEAD SCORING MATRIX ===== */}
      {activeTab === "scoring" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Scoring Rules */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Target size={14} className="text-gold" /> Scoring Matrix
              </h3>
              <div className="space-y-1.5">
                {[
                  { factor: "Has phone number", points: "+15", category: "Data" },
                  { factor: "Has email", points: "+10", category: "Data" },
                  { factor: "Google rating 4.5+", points: "+20", category: "Quality" },
                  { factor: "50+ reviews", points: "+15", category: "Quality" },
                  { factor: "Opened email", points: "+10", category: "Engagement" },
                  { factor: "Clicked link", points: "+15", category: "Engagement" },
                  { factor: "Replied to DM", points: "+25", category: "Engagement" },
                  { factor: "Visited website", points: "+5", category: "Engagement" },
                  { factor: "Booked call", points: "+30", category: "Intent" },
                  { factor: "No response 7d", points: "-10", category: "Decay" },
                  { factor: "Bounced email", points: "-20", category: "Data" },
                  { factor: "Unsubscribed", points: "-50", category: "Disqualify" },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-surface-light text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-muted">{r.category}</span>
                      <span>{r.factor}</span>
                    </div>
                    <span className={`font-bold ${r.points.startsWith("+") ? "text-green-400" : "text-red-400"}`}>{r.points}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Score Distribution */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Score Distribution</h3>
              <div className="space-y-3">
                {[
                  { range: "90-100 (Hot)", count: 0, pct: 0, color: "bg-red-400" },
                  { range: "70-89 (Warm)", count: 0, pct: 0, color: "bg-orange-400" },
                  { range: "50-69 (Lukewarm)", count: 0, pct: 0, color: "bg-yellow-400" },
                  { range: "0-49 (Cold)", count: 0, pct: 0, color: "bg-blue-400" },
                ].map((d, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>{d.range}</span>
                      <span className="text-muted">{d.count} leads ({d.pct}%)</span>
                    </div>
                    <div className="w-full bg-surface-light rounded-full h-2">
                      <div className={`${d.color} rounded-full h-2`} style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Hot Lead Alerts */}
              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                  <Bell size={12} className="text-red-400" /> Hot Lead Alerts
                </h4>
                <div className="space-y-1.5">
                  {leads.filter(l => (l.lead_score ?? 0) >= 80).map(lead => (
                    <div key={lead.id} className="flex items-center justify-between p-2 rounded bg-red-400/5 border border-red-400/10 text-[10px]">
                      <div className="flex items-center gap-2">
                        <Flame size={10} className="text-red-400" />
                        <span className="font-semibold">{lead.business_name}</span>
                        <span className="text-muted">Score: {lead.lead_score}</span>
                      </div>
                      <Link href={`/dashboard/crm?leadId=${lead.id}`} className="text-[9px] px-2 py-0.5 rounded bg-gold/10 text-gold hover:bg-gold/20">Open in CRM</Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SMART ROUTING ===== */}
      {activeTab === "routing" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <GitBranch size={14} className="text-gold" /> Smart Lead Routing Rules
          </h3>
          <div className="space-y-2">
            {[
              { condition: "Score >= 80", action: "Assign to Nicklas (Closer)", priority: "High", active: true },
              { condition: "Industry = Dental", action: "Route to Dental specialist queue", priority: "Medium", active: true },
              { condition: "Source = Referral", action: "Priority queue + auto-call within 1hr", priority: "High", active: true },
              { condition: "City = Miami", action: "Assign to local rep", priority: "Low", active: false },
              { condition: "No phone number", action: "Route to email nurture sequence", priority: "Medium", active: true },
              { condition: "Score < 30", action: "Add to cold storage (revisit in 30d)", priority: "Low", active: true },
            ].map((rule, i) => (
              <div key={i} className={`card p-4 flex items-center justify-between ${!rule.active ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${rule.priority === "High" ? "bg-red-400" : rule.priority === "Medium" ? "bg-yellow-400" : "bg-blue-400"}`} />
                  <div>
                    <p className="text-xs font-semibold">If: {rule.condition}</p>
                    <p className="text-[10px] text-muted">Then: {rule.action}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                    rule.priority === "High" ? "bg-red-400/10 text-red-400" : rule.priority === "Medium" ? "bg-yellow-400/10 text-yellow-400" : "bg-blue-400/10 text-blue-400"
                  }`}>{rule.priority}</span>
                  <div className={`w-8 h-4 rounded-full ${rule.active ? "bg-gold" : "bg-surface-light"}`}>
                    <div className={`w-3 h-3 bg-white rounded-full mt-0.5 ${rule.active ? "ml-4" : "ml-0.5"}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== SOURCE ATTRIBUTION ===== */}
      {activeTab === "attribution" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 size={14} className="text-gold" /> Lead Source Attribution
          </h3>
          <div className="text-center py-12 text-muted text-xs">No source attribution data yet.</div>
        </div>
      )}

      {/* ===== NURTURE SEQUENCES ===== */}
      {activeTab === "nurture" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail size={14} className="text-gold" /> Lead Nurture Sequences
          </h3>
          <div className="text-center py-12 text-muted text-xs">No nurture sequences configured yet.</div>
        </div>
      )}

      {/* ===== ENRICHMENT ===== */}
      {activeTab === "enrichment" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap size={14} className="text-gold" /> Lead Enrichment Panel
            </h3>
            <button
              onClick={() => toast("Bulk enrichment coming soon — needs API")}
              className="btn-primary text-xs flex items-center gap-1.5"
            ><RefreshCw size={12} /> Enrich All Missing</button>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Fully Enriched", value: 0, total: totalLeads, color: "text-green-400" },
              { label: "Partial Data", value: 0, total: totalLeads, color: "text-yellow-400" },
              { label: "Missing Email", value: 0, total: totalLeads, color: "text-red-400" },
              { label: "Missing Phone", value: 0, total: totalLeads, color: "text-red-400" },
            ].map((s, i) => (
              <div key={i} className="card text-center p-3">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-muted">{s.label}</p>
                <p className="text-[8px] text-muted">of {s.total} leads</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {leads.length === 0 && (
              <div className="text-center py-8 text-muted text-xs">No leads to enrich yet.</div>
            )}
            {leads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border text-[10px]">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    lead.email && lead.phone ? "bg-green-400/10" : "bg-yellow-400/10"
                  }`}>
                    {lead.email && lead.phone ? <CheckCircle size={12} className="text-green-400" /> : <AlertTriangle size={12} className="text-yellow-400" />}
                  </div>
                  <div>
                    <p className="font-semibold">{lead.business_name}</p>
                    <p className="text-[9px] text-muted">{lead.industry || "Unknown"} | {lead.city || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <span className={lead.email ? "text-green-400" : "text-red-400"}>{lead.email ? "Email" : "No email"}</span>
                    <span className={lead.phone ? "text-green-400" : "text-red-400"}>{lead.phone ? "Phone" : "No phone"}</span>
                    <span className={lead.website ? "text-green-400" : "text-red-400"}>{lead.website ? "Website" : "No site"}</span>
                  </div>
                  <button
                    onClick={() => toast("Per-lead enrichment coming soon — needs API")}
                    className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20"
                  >Enrich</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CONVERSION FUNNEL ===== */}
      {activeTab === "funnel" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp size={14} className="text-gold" /> Lead Conversion Funnel
          </h3>
          <div className="flex flex-col items-center gap-2">
            {[
              { stage: "Total Leads Scraped", count: 0, pct: 0, color: "bg-blue-400" },
              { stage: "Contacted (DM/Email/Call)", count: 0, pct: 0, color: "bg-purple-400" },
              { stage: "Replied / Engaged", count: 0, pct: 0, color: "bg-yellow-400" },
              { stage: "Qualified (Score 70+)", count: 0, pct: 0, color: "bg-orange-400" },
              { stage: "Booked Discovery Call", count: 0, pct: 0, color: "bg-green-400" },
              { stage: "Converted to Client", count: 0, pct: 0, color: "bg-gold" },
            ].map((s, i) => (
              <div key={i} className="w-full max-w-2xl">
                <div className="flex items-center justify-between mb-1 text-[10px]">
                  <span className="font-semibold">{s.stage}</span>
                  <span className="text-muted">{s.count} ({s.pct}%)</span>
                </div>
                <div className="w-full bg-surface-light rounded-full h-6 overflow-hidden">
                  <div className={`${s.color} h-6 rounded-full flex items-center justify-center`} style={{ width: `${s.pct}%` }}>
                    {s.pct > 15 && <span className="text-[8px] font-bold text-black">{s.count}</span>}
                  </div>
                </div>
                {i < 5 && (
                  <div className="flex justify-center my-1">
                    <ArrowDownRight size={12} className="text-muted/30" />
                    <span className="text-[8px] text-muted ml-1">
                      {i === 0 ? "0% contact rate" : i === 1 ? "0% reply rate" : i === 2 ? "0% qualify rate" : i === 3 ? "0% book rate" : "0% close rate"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== TAGS & ALERTS ===== */}
      {activeTab === "tags" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Lead Tagging System */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Tag size={14} className="text-gold" /> Lead Tagging System
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {["high-value", "responsive", "warm", "needs-nurture", "follow-up", "hot", "referral", "decision-maker", "client", "upsell", "no-budget", "competitor-user"].map(tag => (
                  <span key={tag} className="text-[9px] px-2 py-1 rounded-full bg-gold/10 text-gold border border-gold/20 cursor-pointer hover:bg-gold/20 transition-all">{tag}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} className="input flex-1 text-xs" placeholder="Create new tag..." />
                <button
                  onClick={() => toast("Custom tags coming soon — needs API")}
                  className="btn-primary text-xs px-3"
                >Add</button>
              </div>
            </div>
            {/* Hot Lead Alerts Config */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Bell size={14} className="text-red-400" /> Hot Lead Alert Settings
                </h3>
                <button onClick={() => setHotAlerts(!hotAlerts)}
                  className={`w-10 h-5 rounded-full transition-all flex items-center ${hotAlerts ? "bg-gold justify-end" : "bg-surface-light justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full mx-0.5 shadow" />
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { trigger: "Lead score reaches 80+", channel: "Slack + Email", active: true },
                  { trigger: "Lead replies to outreach", channel: "Slack + Push", active: true },
                  { trigger: "Lead books a call", channel: "Slack + SMS", active: true },
                  { trigger: "Lead visits pricing page", channel: "Slack", active: false },
                ].map((alert, i) => (
                  <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg bg-surface-light text-[10px] ${!alert.active ? "opacity-50" : ""}`}>
                    <div>
                      <p className="font-semibold">{alert.trigger}</p>
                      <p className="text-[9px] text-muted">Notify via: {alert.channel}</p>
                    </div>
                    <div className={`w-6 h-3 rounded-full ${alert.active ? "bg-green-400" : "bg-surface"}`}>
                      <div className={`w-2.5 h-2.5 bg-white rounded-full mt-px ${alert.active ? "ml-3" : "ml-0.5"}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
