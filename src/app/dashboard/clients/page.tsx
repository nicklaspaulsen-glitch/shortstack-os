"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Client, Contract, Invoice } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import Modal from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Users, DollarSign, FileText, Plus, Search, Heart, ArrowUpRight,
  UserPlus, Download, CreditCard, RefreshCw, ExternalLink, Loader, Zap,
  Tag, Check, ChevronDown, ChevronRight, Mail, Phone, Eye,
  Filter, ArrowUpDown, LayoutGrid, LayoutList, AlertTriangle,
  Clock, CheckCircle, XCircle, StickyNote, Columns
} from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import PageHero from "@/components/ui/page-hero";
import CollapsibleStats from "@/components/ui/collapsible-stats";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import { MotionPage } from "@/components/motion/motion-page";

// --- Types for new features ---
type ClientTag = { label: string; color: string };
type SortField = "business_name" | "mrr" | "health_score" | "created_at" | "last_activity";
type SortDir = "asc" | "desc";
type ViewMode = "table" | "card";

const TAG_PRESETS: ClientTag[] = [
  { label: "VIP", color: "#C9A84C" },
  { label: "At Risk", color: "#f43f5e" },
  { label: "New", color: "#38bdf8" },
  { label: "Enterprise", color: "#8b5cf6" },
  { label: "Growing", color: "#10b981" },
  { label: "Needs Attention", color: "#f59e0b" },
];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showInviteModal, setShowInviteModal] = useState<Client | null>(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState<Client | null>(null);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"clients" | "contracts" | "invoices" | "billing">("clients");
  const supabase = createClient();
  const router = useRouter();

  // --- New feature state ---
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortField, setSortField] = useState<SortField>("business_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [clientTags, setClientTags] = useState<Record<string, ClientTag[]>>({});
  const [clientNotes, setClientNotes] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterTag, setFilterTag] = useState("");
  const [filterMrrMin, setFilterMrrMin] = useState("");
  const [filterMrrMax, setFilterMrrMax] = useState("");
  // Quick activity chips: "recent" = touched in last 7d, "stale" = no touch in 30d
  const [activityFilter, setActivityFilter] = useState<"all" | "recent" | "stale">("all");
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareClients, setCompareClients] = useState<string[]>([]);
  const [hoveredClient, setHoveredClient] = useState<string | null>(null);
  const [showTagModal, setShowTagModal] = useState<string | null>(null);
  // Admin / founder god-mode: when the API reports role admin/founder we
  // get the platform-wide list. Toggle scope=mine to see only the caller's
  // own agency. Stored locally so the choice persists across re-renders.
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [scope, setScope] = useState<"all" | "mine">("all");

  // codex round-1: use a ref-box so fetchData reads `cancelled.current`
  // at await-resume time rather than from a stale snapshot parameter.
  useEffect(() => {
    const cancelled = { current: false };
    fetchData(cancelled).catch((err: unknown) => {
      if (!cancelled.current) console.error("[Clients] fetchData error:", err);
    });
    return () => { cancelled.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function fetchData(cancelled: { current: boolean } = { current: false }) {
    try {
      setLoading(true);
      // Fetch clients via the authenticated server API route.
      // Browser-side supabase queries sometimes race with the access token
      // hydration in auth-context, which caused the list to render empty
      // when the user was actually scoped to rows owned by their profile.
      // The server route reads the session from cookies and scopes by the
      // effective agency owner — so it works reliably on first mount.
      // For admin/founder, the API returns ALL clients across the
      // platform unless we pass ?scope=mine.
      const clientsUrl = scope === "mine" ? "/api/clients?scope=mine" : "/api/clients";
      const [clientsRes, contractsRes, invoicesRes] = await Promise.all([
        fetch(clientsUrl, { cache: "no-store" }),
        supabase.from("contracts").select("*").order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      ]);

      if (cancelled.current) return;

      let clientsData: Client[] = [];
      if (clientsRes.ok) {
        const json = await clientsRes.json();
        clientsData = json.clients || [];
        if (json.role) setCallerRole(json.role);
      } else {
        console.error("[Clients] /api/clients failed:", clientsRes.status);
        toast.error("Couldn't load clients — try refreshing.");
      }

      if (contractsRes.error || invoicesRes.error) {
        console.error("[Clients] fetchData error:", contractsRes.error || invoicesRes.error);
        toast.error("Couldn't load some client data — try refreshing.");
      }
      setClients(clientsData);
      setContracts(contractsRes.data || []);
      setInvoices(invoicesRes.data || []);
    } catch (err) {
      if (!cancelled.current) {
        console.error("[Clients] fetchData error:", err);
        toast.error("Failed to load clients — try refreshing.");
      }
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }

  // Memoize — these aggregates ran on every re-render otherwise (every
  // keystroke in filter inputs, every hover state change, etc.).
  const { activeClients, totalMRR, avgHealth } = useMemo(() => {
    const active = clients.filter((c) => c.is_active);
    const mrr = active.reduce((sum, c) => sum + (c.mrr || 0), 0);
    const health = active.length > 0
      ? Math.round(active.reduce((sum, c) => sum + c.health_score, 0) / active.length)
      : 0;
    return { activeClients: active, totalMRR: mrr, avgHealth: health };
  }, [clients]);

  // --- Client status pill (derived) ---
  // Maps a client's real state to one of 4 buckets the table visualises
  // with a color bar + pill: active, paused, churned, trial.
  type LifecycleStatus = "active" | "paused" | "churned" | "trial";
  const getLifecycleStatus = useCallback((c: Client): LifecycleStatus => {
    const rec = c as Client & { cancelled_at?: string | null };
    if (rec.cancelled_at) return "churned";
    if (!c.is_active) return "paused";
    // "trial" if no paid subscription AND contract not yet signed
    if (!c.stripe_subscription_id && c.contract_status !== "signed") return "trial";
    return "active";
  }, []);
  const STATUS_STYLES: Record<LifecycleStatus, { bar: string; pill: string; label: string }> = {
    active:  { bar: "bg-success", pill: "bg-success/10 text-success border-success/30", label: "Active" },
    paused:  { bar: "bg-warning", pill: "bg-warning/10 text-warning border-warning/30", label: "Paused" },
    churned: { bar: "bg-danger",  pill: "bg-danger/10 text-danger border-danger/30",   label: "Churned" },
    trial:   { bar: "bg-info",    pill: "bg-info/10 text-info border-info/30",         label: "Trial" },
  };

  // --- Feature 1: Client Health Score helper ---
  const getHealthColor = (score: number) => {
    if (score > 75) return "text-success";
    if (score > 50) return "text-warning";
    return "text-danger";
  };
  const getHealthBg = (score: number) => {
    if (score > 75) return "bg-success";
    if (score > 50) return "bg-warning";
    return "bg-danger";
  };
  const getHealthLabel = (score: number) => {
    if (score > 75) return "Healthy";
    if (score > 50) return "Needs Attention";
    return "At Risk";
  };

  // --- Feature 6: Revenue Breakdown per client ---
  const getClientRevenue = useCallback((clientId: string) => {
    const clientInvoices = invoices.filter(i => i.client_id === clientId);
    const totalPaid = clientInvoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
    const outstanding = clientInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + i.amount, 0);
    const client = clients.find(c => c.id === clientId);
    return { mrr: client?.mrr || 0, totalPaid, outstanding };
  }, [invoices, clients]);

  // --- Feature 7: Contract Status per client ---
  const getContractStatus = useCallback((clientId: string) => {
    const clientContracts = contracts.filter(c => c.client_id === clientId);
    if (clientContracts.length === 0) return { status: "none", daysLeft: 0, warning: false };
    const active = clientContracts.find(c => c.status === "signed");
    if (!active) return { status: "expired", daysLeft: 0, warning: true };
    if (active.end_date) {
      const daysLeft = Math.ceil((new Date(active.end_date).getTime() - Date.now()) / 86400000);
      return { status: daysLeft < 0 ? "expired" : "active", daysLeft, warning: daysLeft <= 30 && daysLeft > 0 };
    }
    return { status: "active", daysLeft: 999, warning: false };
  }, [contracts]);

  // --- Feature 13: Onboarding Progress ---
  const getOnboardingProgress = useCallback((client: Client) => {
    let steps = 0;
    let completed = 0;
    // Check steps
    steps++; if (client.email) completed++;
    steps++; if (client.phone) completed++;
    steps++; if (client.website) completed++;
    steps++; if (client.services && client.services.length > 0) completed++;
    steps++; if (client.package_tier) completed++;
    steps++; if (client.stripe_customer_id) completed++;
    steps++; if (client.contract_status === "signed") completed++;
    steps++; if (client.profile_id) completed++;
    return Math.round((completed / steps) * 100);
  }, []);

  // --- Feature 14: Next Action Due (mock) ---
  const getNextAction = useCallback((client: Client) => {
    if (!client.stripe_customer_id) return { action: "Connect Stripe", type: "billing", urgent: false };
    if (client.contract_status !== "signed") return { action: "Send contract", type: "contract", urgent: true };
    if (!client.profile_id) return { action: "Set up portal access", type: "portal", urgent: false };
    if (client.health_score < 50) return { action: "Schedule check-in call", type: "call", urgent: true };
    const contractInfo = getContractStatus(client.id);
    if (contractInfo.warning) return { action: `Renew contract (${contractInfo.daysLeft}d)`, type: "contract", urgent: true };
    return { action: "Monthly review", type: "review", urgent: false };
  }, [getContractStatus]);

  // --- Feature 3: Tag Management ---
  const toggleTag = useCallback((clientId: string, tag: ClientTag) => {
    setClientTags(prev => {
      const current = prev[clientId] || [];
      const exists = current.find(t => t.label === tag.label);
      if (exists) {
        return { ...prev, [clientId]: current.filter(t => t.label !== tag.label) };
      }
      return { ...prev, [clientId]: [...current, tag] };
    });
  }, []);

  // --- Feature 8: Client Notes ---
  const saveNote = useCallback((clientId: string) => {
    setClientNotes(prev => ({ ...prev, [clientId]: noteText }));
    setEditingNote(null);
    setNoteText("");
    toast.success("Note saved");
  }, [noteText]);

  // --- Feature 4: Bulk Actions ---
  const toggleSelectClient = useCallback((clientId: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }, []);
  const selectAllClients = useCallback(() => {
    if (selectedClients.size === filteredAndSortedClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredAndSortedClients.map(c => c.id)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClients.size]);

  const handleBulkAction = useCallback(async (action: string) => {
    const count = selectedClients.size;
    if (count === 0) { toast.error("No clients selected"); return; }
    const selected = clients.filter(c => selectedClients.has(c.id));
    switch (action) {
      case "export":
        handleExportCSV(selected);
        setSelectedClients(new Set());
        break;
      case "tag":
        toast(`Open a client's tag menu to tag them (${count} selected).`, { icon: "💡" });
        break;
      case "email": {
        const emails = selected.map(c => c.email).filter(Boolean);
        if (emails.length === 0) { toast.error("No emails on selected clients"); return; }
        // mailto: with a BCC list is the reliable cross-client path here —
        // no extra backend/ESP integration required to get bulk compose.
        window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}`;
        toast.success(`Opening mail draft for ${emails.length} client${emails.length === 1 ? "" : "s"}`);
        break;
      }
      case "sms": {
        const phones = selected.map(c => c.phone).filter((p): p is string => !!p);
        if (phones.length === 0) { toast.error("No phone numbers on selected clients"); return; }
        // sms: URIs: multi-recipient support is spotty on desktop. Copy the
        // list so the user can paste it into their preferred channel.
        await navigator.clipboard.writeText(phones.join(", "));
        toast.success(`Copied ${phones.length} phone number${phones.length === 1 ? "" : "s"} to clipboard`);
        break;
      }
      case "deactivate": {
        if (!confirm(`Deactivate ${count} client${count === 1 ? "" : "s"}? They'll be marked inactive but not deleted.`)) return;
        const ids = Array.from(selectedClients);
        const { error } = await supabase
          .from("clients")
          .update({ is_active: false })
          .in("id", ids);
        if (error) {
          toast.error(error.message || "Failed to deactivate clients");
          return;
        }
        toast.success(`${count} client${count === 1 ? "" : "s"} deactivated`);
        setSelectedClients(new Set());
        fetchData();
        break;
      }
      case "delete": {
        if (!confirm(`Delete ${count} client${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
        const ids = Array.from(selectedClients);
        const { error } = await supabase
          .from("clients")
          .delete()
          .in("id", ids);
        if (error) {
          toast.error(error.message || "Failed to delete clients");
          return;
        }
        toast.success(`${count} client${count === 1 ? "" : "s"} deleted`);
        setSelectedClients(new Set());
        fetchData();
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClients, clients, supabase]);

  // --- Feature 10: Export CSV ---
  const handleExportCSV = useCallback((exportClients: Client[]) => {
    const headers = ["Business Name", "Contact", "Email", "Phone", "Industry", "Package", "MRR", "Health Score", "Status", "Created"];
    const rows = exportClients.map(c => [
      c.business_name, c.contact_name, c.email, c.phone || "", c.industry || "",
      c.package_tier || "", c.mrr?.toString() || "0", c.health_score?.toString() || "0",
      c.is_active ? "Active" : "Inactive", c.created_at || ""
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${exportClients.length} clients`);
  }, []);

  // --- Feature 9: Advanced Filters + Feature 11: Sort ---
  const industries = useMemo(() => {
    const set = new Set(clients.map(c => c.industry).filter((v): v is string => !!v));
    return Array.from(set).sort();
  }, [clients]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    Object.values(clientTags).forEach(tags => tags.forEach(t => set.add(t.label)));
    return Array.from(set);
  }, [clientTags]);

  // Pull the most recent timestamp we have for each client (for "last activity" sort/filter).
  // updated_at is written whenever a row is mutated; fall back to created_at.
  const getLastActivity = useCallback((c: Client) => {
    const rec = c as Client & { updated_at?: string | null };
    return new Date(rec.updated_at || c.created_at || 0).getTime();
  }, []);

  const filteredAndSortedClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const WEEK = 7 * 86400 * 1000;
    const MONTH = 30 * 86400 * 1000;

    const result = clients.filter((c) => {
      // Fuzzy text search across name, contact, email, phone, company/industry
      if (q) {
        const hay = [
          c.business_name, c.contact_name, c.email, c.phone || "", c.industry || "", c.website || "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Status filter
      if (filterStatus === "active" && !c.is_active) return false;
      if (filterStatus === "inactive" && c.is_active) return false;
      // Industry filter
      if (filterIndustry && c.industry !== filterIndustry) return false;
      // MRR range
      if (filterMrrMin && c.mrr < parseFloat(filterMrrMin)) return false;
      if (filterMrrMax && c.mrr > parseFloat(filterMrrMax)) return false;
      // Tag filter
      if (filterTag) {
        const tags = clientTags[c.id] || [];
        if (!tags.find(t => t.label === filterTag)) return false;
      }
      // Activity chip filter
      if (activityFilter !== "all") {
        const last = getLastActivity(c);
        const age = now - last;
        if (activityFilter === "recent" && age > WEEK) return false;
        if (activityFilter === "stale" && age < MONTH) return false;
      }
      return true;
    });

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "business_name": cmp = a.business_name.localeCompare(b.business_name); break;
        case "mrr": cmp = (a.mrr || 0) - (b.mrr || 0); break;
        case "health_score": cmp = a.health_score - b.health_score; break;
        case "created_at": cmp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(); break;
        case "last_activity": cmp = getLastActivity(a) - getLastActivity(b); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [clients, searchQuery, filterStatus, filterIndustry, filterMrrMin, filterMrrMax, filterTag, clientTags, sortField, sortDir, activityFilter, getLastActivity]);

  // Keep backward compat alias
  const filteredClients = filteredAndSortedClients;

  // --- Feature 12: Client Comparison ---
  const toggleCompare = useCallback((clientId: string) => {
    setCompareClients(prev => {
      if (prev.includes(clientId)) return prev.filter(id => id !== clientId);
      if (prev.length >= 4) { toast.error("Max 4 clients for comparison"); return prev; }
      return [...prev, clientId];
    });
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }, [sortField]);

  async function addClient(formData: FormData) {
    const businessName = (formData.get("business_name") as string || "").trim();
    const contactName = (formData.get("contact_name") as string || "").trim();
    const email = (formData.get("email") as string || "").trim();
    const mrrRaw = formData.get("mrr") as string;
    const mrr = parseFloat(mrrRaw) || 0;

    if (!businessName) { toast.error("Business name is required"); return; }
    if (!contactName) { toast.error("Contact name is required"); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (mrr < 0) { toast.error("MRR cannot be negative"); return; }

    const { error } = await supabase.from("clients").insert({
      business_name: businessName,
      contact_name: contactName,
      email,
      phone: formData.get("phone"),
      website: formData.get("website"),
      industry: formData.get("industry"),
      package_tier: formData.get("package_tier"),
      mrr,
      services: (formData.get("services") as string)?.split(",").map((s) => s.trim()).filter(Boolean) || [],
    });
    if (error) {
      toast.error(error.message || "Failed to add client");
    } else {
      toast.success("Client added");
      setShowAddModal(false);
      fetchData();
    }
  }

  async function syncStripeCustomer(clientId: string) {
    setBillingLoading(`sync-${clientId}`);
    try {
      const res = await fetch("/api/billing/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.exists ? "Stripe customer verified" : "Stripe customer created");
        fetchData();
      } else {
        toast.error(data.error || "Failed to sync");
      }
    } catch { toast.error("Error syncing Stripe customer"); }
    setBillingLoading(null);
  }

  async function createSubscription(clientId: string, amount: number, description: string, interval: string) {
    setBillingLoading(`sub-${clientId}`);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, amount, description, interval }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        toast.success("Checkout link created!");
        navigator.clipboard.writeText(data.checkout_url);
        toast.success("Checkout URL copied to clipboard — send it to the client");
      } else {
        toast.error(data.error || "Failed to create subscription");
      }
    } catch { toast.error("Error creating subscription"); }
    setBillingLoading(null);
  }

  async function openBillingPortal(clientId: string) {
    setBillingLoading(`portal-${clientId}`);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();
      if (data.portal_url) {
        window.open(data.portal_url, "_blank");
      } else {
        toast.error(data.error || "Failed to open portal");
      }
    } catch { toast.error("Error opening billing portal"); }
    setBillingLoading(null);
  }

  const clientsWithStripe = clients.filter(c => c.stripe_customer_id);
  const clientsWithSubs = clients.filter(c => c.stripe_subscription_id);
  const paidInvoices = invoices.filter(i => i.status === "paid");
  const overdueInvoices = invoices.filter(i => i.status === "overdue");

  if (loading) return (
    <div className="space-y-4">
      <PageHero
        icon={<Users size={22} />}
        title="Client Portal"
        subtitle="Manage clients, contracts, and invoices."
        gradient="gold"
      />
      <TableSkeleton rows={8} />
    </div>
  );

  return (
    <MotionPage className="space-y-4">
      <PageHero
        icon={<Users size={22} />}
        title="Client Portal"
        subtitle={
          callerRole === "admin" || callerRole === "founder"
            ? scope === "all"
              ? `Showing all ${clients.length} clients across the platform.`
              : "Showing clients for your agency only."
            : "Manage clients, contracts, and invoices."
        }
        gradient="gold"
        actions={
          <div className="flex items-center gap-2">
            {(callerRole === "admin" || callerRole === "founder") && (
              <div className="flex items-center bg-white/10 border border-white/20 rounded-xl p-0.5">
                <button
                  onClick={() => setScope("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    scope === "all" ? "bg-white text-black" : "text-white/70 hover:text-white"
                  }`}
                  title="See every client across every agency"
                >
                  All clients
                </button>
                <button
                  onClick={() => setScope("mine")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    scope === "mine" ? "bg-white text-black" : "text-white/70 hover:text-white"
                  }`}
                  title="See only the clients you personally added"
                >
                  Mine
                </button>
              </div>
            )}
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/20 text-white text-sm font-medium hover:bg-white/25 transition-all">
              <Plus size={16} /> Add Client
            </button>
          </div>
        }
      />

      {/* Stats — collapsible (state persists) */}
      <CollapsibleStats
        storageKey="clients"
        icon={<Users size={14} className="text-gold" />}
        title="Client Stats"
        summary={
          <>
            <span><span className="text-foreground font-semibold">{activeClients.length}</span> active</span>
            <span className="opacity-30">·</span>
            <span>MRR <span className="text-gold font-semibold">{formatCurrency(totalMRR)}</span></span>
            <span className="opacity-30">·</span>
            <span>Health <span className={avgHealth > 75 ? "text-success font-semibold" : avgHealth > 50 ? "text-warning font-semibold" : "text-danger font-semibold"}>{avgHealth}%</span></span>
            <span className="opacity-30">·</span>
            <span><span className="text-foreground font-semibold">{contracts.filter((c) => c.status === "signed").length}</span> contracts</span>
          </>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active Clients" value={activeClients.length} icon={<Users size={18} />} />
          <StatCard label="Total MRR" value={formatCurrency(totalMRR)} icon={<DollarSign size={18} />} />
          <StatCard label="Avg Health Score" value={`${avgHealth}%`} icon={<Heart size={18} />} changeType={avgHealth > 75 ? "positive" : avgHealth > 50 ? "neutral" : "negative"} />
          <StatCard label="Active Contracts" value={contracts.filter((c) => c.status === "signed").length} icon={<FileText size={18} />} />
        </div>
      </CollapsibleStats>

      {/* Tabs (sticky) */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {(["clients", "contracts", "invoices", "billing"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-all flex items-center gap-1.5 ${
              tab === t ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}
          >
            {t === "billing" && <CreditCard size={14} />}
            {t}
          </button>
        ))}
      </div>

      {/* Enhanced Clients Tab Toolbar */}
      {tab === "clients" && (
        <div className="space-y-3">
          {/* Search + Controls Row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-full pl-10"
              />
            </div>

            {/* Feature 9: Advanced Filters Toggle */}
            <button onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary text-xs flex items-center gap-1.5 ${showFilters ? "bg-gold/10 text-gold border-gold/30" : ""}`}>
              <Filter size={14} /> Filters
              {(filterIndustry || filterStatus !== "all" || filterTag || filterMrrMin || filterMrrMax) && (
                <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              )}
            </button>

            {/* Feature 11: Sort Options */}
            <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5">
              <span className="text-[10px] text-muted px-1.5">Sort:</span>
              {([
                { field: "business_name" as SortField, label: "Name" },
                { field: "mrr" as SortField, label: "MRR" },
                { field: "health_score" as SortField, label: "Health" },
                { field: "created_at" as SortField, label: "Joined" },
                { field: "last_activity" as SortField, label: "Activity" },
              ]).map(s => (
                <button key={s.field} onClick={() => handleSort(s.field)}
                  className={`px-2 py-1 text-[10px] rounded-md transition-all flex items-center gap-0.5 ${
                    sortField === s.field ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
                  }`}>
                  {s.label}
                  {sortField === s.field && (
                    <ArrowUpDown size={8} className={sortDir === "desc" ? "rotate-180" : ""} />
                  )}
                </button>
              ))}
            </div>

            {/* Feature 15: View Mode Toggle */}
            <div className="flex items-center gap-0.5 bg-surface rounded-lg p-0.5">
              <button onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "table" ? "bg-gold text-black" : "text-muted hover:text-foreground"}`}>
                <LayoutList size={14} />
              </button>
              <button onClick={() => setViewMode("card")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "card" ? "bg-gold text-black" : "text-muted hover:text-foreground"}`}>
                <LayoutGrid size={14} />
              </button>
            </div>

            {/* Feature 10: Export */}
            <button onClick={() => handleExportCSV(filteredClients)}
              className="btn-secondary text-xs flex items-center gap-1.5">
              <Download size={14} /> Export
            </button>

            {/* Feature 12: Compare button */}
            {compareClients.length >= 2 && (
              <button onClick={() => setShowCompareModal(true)}
                className="btn-primary text-xs flex items-center gap-1.5">
                <Columns size={14} /> Compare ({compareClients.length})
              </button>
            )}
          </div>

          {/* Activity quick-filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted">Quick:</span>
            {([
              { key: "all" as const, label: "All", color: "bg-surface text-muted" },
              { key: "recent" as const, label: "Active this week", color: "bg-success/10 text-success border-success/30" },
              { key: "stale" as const, label: "Stale >30d", color: "bg-warning/10 text-warning border-warning/30" },
            ]).map(chip => (
              <button
                key={chip.key}
                onClick={() => setActivityFilter(chip.key)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                  activityFilter === chip.key
                    ? chip.color + " border"
                    : "bg-surface text-muted border-border hover:border-gold/30"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Feature 9: Advanced Filters Panel */}
          {showFilters && (
            <div className="card p-3">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Status</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
                    className="input w-full text-xs">
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Industry</label>
                  <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}
                    className="input w-full text-xs">
                    <option value="">All Industries</option>
                    {industries.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">MRR Min</label>
                  <input type="number" value={filterMrrMin} onChange={e => setFilterMrrMin(e.target.value)}
                    placeholder="$0" className="input w-full text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">MRR Max</label>
                  <input type="number" value={filterMrrMax} onChange={e => setFilterMrrMax(e.target.value)}
                    placeholder="No limit" className="input w-full text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Tag</label>
                  <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
                    className="input w-full text-xs">
                    <option value="">All Tags</option>
                    {allTags.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                <span className="text-[10px] text-muted">{filteredClients.length} clients matched</span>
                <button onClick={() => { setFilterIndustry(""); setFilterStatus("all"); setFilterTag(""); setFilterMrrMin(""); setFilterMrrMax(""); }}
                  className="text-[10px] text-gold hover:underline">Clear all filters</button>
              </div>
            </div>
          )}

          {/* Feature 4: Bulk Actions Bar */}
          {selectedClients.size > 0 && (
            <div className="card p-2.5 flex items-center gap-3 bg-gold/5 border-gold/20 flex-wrap">
              <span className="text-xs font-medium">{selectedClients.size} selected</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => handleBulkAction("email")} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                  <Mail size={10} /> Email
                </button>
                <button onClick={() => handleBulkAction("sms")} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                  <Phone size={10} /> SMS
                </button>
                <button onClick={() => handleBulkAction("export")} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                  <Download size={10} /> Export
                </button>
                <button onClick={() => handleBulkAction("tag")} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                  <Tag size={10} /> Bulk Tag
                </button>
                <button onClick={() => handleBulkAction("deactivate")} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1 text-warning">
                  <XCircle size={10} /> Deactivate
                </button>
                <button onClick={() => handleBulkAction("delete")} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1 text-danger">
                  <XCircle size={10} /> Delete
                </button>
              </div>
              <button onClick={() => setSelectedClients(new Set())} className="text-[10px] text-muted hover:text-foreground ml-auto">
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}

      {/* Feature 15: Card View */}
      {tab === "clients" && viewMode === "card" && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
        >
          {filteredClients.map(c => {
            const revenue = getClientRevenue(c.id);
            const contractInfo = getContractStatus(c.id);
            const onboarding = getOnboardingProgress(c);
            const nextAction = getNextAction(c);
            const tags = clientTags[c.id] || [];

            const status = getLifecycleStatus(c);
            const statusStyles = STATUS_STYLES[status];
            // Border accent follows the lifecycle status so the card and table tell the same story
            const accentClass =
              status === "active"  ? "card-accent-green"   :
              status === "paused"  ? "card-accent-warning" :
              status === "churned" ? "card-accent-danger"  :
              "card-accent-gold"; // trial
            return (
              <motion.div key={c.id} className={`card card-accent ${accentClass} p-4 hover:border-gold/30 transition-all cursor-pointer group relative`}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
                }}
                whileHover={{ y: -4 }}
                onClick={() => router.push(`/dashboard/clients/${c.id}`)}
                onMouseEnter={() => setHoveredClient(c.id)}
                onMouseLeave={() => setHoveredClient(null)}>

                {/* Feature 4: Selection checkbox */}
                <div className="absolute top-3 left-3" onClick={e => e.stopPropagation()}>
                  <button onClick={() => toggleSelectClient(c.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      selectedClients.has(c.id) ? "bg-gold border-gold text-black" : "border-border hover:border-gold/50"
                    }`}>
                    {selectedClients.has(c.id) && <Check size={10} />}
                  </button>
                </div>

                {/* Feature 12: Compare toggle */}
                <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                  <button onClick={() => toggleCompare(c.id)}
                    className={`text-[9px] px-1.5 py-0.5 rounded transition-all ${
                      compareClients.includes(c.id) ? "bg-gold/20 text-gold" : "text-muted hover:text-foreground"
                    }`}>
                    <Columns size={10} />
                  </button>
                </div>

                {/* Feature 1: Health indicator */}
                <div className="flex items-start gap-3 mb-3 mt-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                    c.health_score > 75 ? "bg-success/10 text-success" : c.health_score > 50 ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
                  }`}>
                    {c.health_score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{c.business_name}</p>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium border ${statusStyles.pill}`}>
                        {statusStyles.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted">{c.contact_name}</p>
                  </div>
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {tags.map(t => (
                      <span key={t.label} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: t.color + "18", color: t.color }}>{t.label}</span>
                    ))}
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <p className="text-[9px] text-muted">MRR</p>
                    <p className="text-xs font-bold text-gold">{formatCurrency(c.mrr)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-muted">Total Paid</p>
                    <p className="text-xs font-bold">{formatCurrency(revenue.totalPaid)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-muted">Outstanding</p>
                    <p className={`text-xs font-bold ${revenue.outstanding > 0 ? "text-danger" : "text-muted"}`}>
                      {formatCurrency(revenue.outstanding)}
                    </p>
                  </div>
                </div>

                {/* Feature 13: Onboarding Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-muted">Onboarding</span>
                    <span className="text-[9px] font-mono font-medium">{onboarding}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-light rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${onboarding >= 100 ? "bg-success" : onboarding >= 60 ? "bg-gold" : "bg-warning"}`}
                      style={{ width: `${onboarding}%` }} />
                  </div>
                </div>

                {/* Feature 7: Contract status + Feature 14: Next action */}
                <div className="flex items-center justify-between text-[10px] border-t border-border pt-2">
                  <div className="flex items-center gap-1.5">
                    {contractInfo.warning ? (
                      <span className="text-warning flex items-center gap-0.5"><AlertTriangle size={10} /> {contractInfo.daysLeft}d left</span>
                    ) : (
                      <StatusBadge status={c.is_active ? "active" : "inactive"} />
                    )}
                  </div>
                  <span className={`flex items-center gap-0.5 ${nextAction.urgent ? "text-warning" : "text-muted"}`}>
                    <Clock size={9} /> {nextAction.action}
                  </span>
                </div>

                {/* Feature 2: Quick Actions on hover */}
                {hoveredClient === c.id && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface/95 to-transparent p-3 pt-6 rounded-b-xl flex items-center justify-center gap-2"
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => window.open(`mailto:${c.email}`)} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                      <Mail size={10} /> Email
                    </button>
                    <button onClick={() => c.phone && window.open(`tel:${c.phone}`)} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                      <Phone size={10} /> Call
                    </button>
                    <button onClick={() => router.push(`/dashboard/clients/${c.id}`)} className="btn-primary text-[10px] px-2 py-1 flex items-center gap-1">
                      <Eye size={10} /> View
                    </button>
                    <button onClick={() => setShowTagModal(c.id)} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                      <Tag size={10} />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
          {filteredClients.length === 0 && (
            <div className="col-span-full card">
              <EmptyState
                type="no-clients"
                title={clients.length === 0 ? "No clients yet" : "No clients match your filters"}
                description={clients.length === 0 ? "Add your first client to start tracking contracts, invoices, and health scores." : "Try adjusting filters or clearing your search."}
                action={clients.length === 0 ? (
                  <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs flex items-center gap-1.5">
                    <Plus size={12} /> Add Client
                  </button>
                ) : undefined}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* Enhanced Table View */}
      {tab === "clients" && viewMode === "table" && (
        <div className="space-y-0">
          <DataTable
            columns={[
              { key: "select", label: (
                <button onClick={selectAllClients} className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  selectedClients.size === filteredClients.length && filteredClients.length > 0 ? "bg-gold border-gold text-black" : "border-border hover:border-gold/50"
                }`}>
                  {selectedClients.size === filteredClients.length && filteredClients.length > 0 && <Check size={10} />}
                </button>
              ) as unknown as string, render: (c: Client) => (
                <div onClick={e => e.stopPropagation()}>
                  <button onClick={() => toggleSelectClient(c.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      selectedClients.has(c.id) ? "bg-gold border-gold text-black" : "border-border hover:border-gold/50"
                    }`}>
                    {selectedClients.has(c.id) && <Check size={10} />}
                  </button>
                </div>
              )},
              { key: "business_name", label: "Business", render: (c: Client) => {
                const status = getLifecycleStatus(c);
                const styles = STATUS_STYLES[status];
                return (
                  <div className="flex items-stretch gap-2">
                    {/* Status-colored left bar (acts as the "row" accent since DataTable rows don't support className per-row) */}
                    <div className={`w-1 rounded-full shrink-0 ${styles.bar}`} title={styles.label} />
                    {/* Feature 1: Health indicator dot */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${getHealthBg(c.health_score)}`}
                      title={getHealthLabel(c.health_score)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium">{c.business_name}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${styles.pill}`}>
                          {styles.label}
                        </span>
                        {/* Feature 3: Tags inline */}
                        {(clientTags[c.id] || []).map(t => (
                          <span key={t.label} className="text-[8px] px-1 py-0 rounded-full font-medium"
                            style={{ background: t.color + "18", color: t.color }}>{t.label}</span>
                        ))}
                      </div>
                      <p className="text-xs text-muted">{c.contact_name}</p>
                    </div>
                  </div>
                );
              }},
              { key: "services", label: "Services", render: (c: Client) => (
                <div className="flex flex-wrap gap-1">
                  {(c.services || []).slice(0, 3).map((s, i) => (
                    <span key={i} className="badge bg-surface-light text-xs">{s}</span>
                  ))}
                </div>
              )},
              { key: "package_tier", label: "Package", render: (c: Client) => (
                <span className="text-gold font-medium">{c.package_tier || "-"}</span>
              )},
              { key: "mrr", label: "MRR", render: (c: Client) => {
                const rev = getClientRevenue(c.id);
                return (
                  <div>
                    <p className="font-medium">{formatCurrency(c.mrr)}</p>
                    {rev.outstanding > 0 && <p className="text-[9px] text-danger">{formatCurrency(rev.outstanding)} due</p>}
                  </div>
                );
              }},
              { key: "contract_status", label: "Contract", render: (c: Client) => {
                const info = getContractStatus(c.id);
                return (
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={c.contract_status} />
                    {info.warning && <AlertTriangle size={10} className="text-warning" />}
                  </div>
                );
              }},
              { key: "health_score", label: "Health", render: (c: Client) => (
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-surface-light rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getHealthBg(c.health_score)}`}
                      style={{ width: `${c.health_score}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${getHealthColor(c.health_score)}`}>{c.health_score}%</span>
                </div>
              )},
              { key: "onboarding", label: "Setup", render: (c: Client) => {
                const pct = getOnboardingProgress(c);
                return (
                  <div className="flex items-center gap-1.5">
                    <div className="w-10 bg-surface-light rounded-full h-1.5">
                      <div className={`h-full rounded-full ${pct >= 100 ? "bg-success" : "bg-gold"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted">{pct}%</span>
                  </div>
                );
              }},
              { key: "next_action", label: "Next Action", render: (c: Client) => {
                const action = getNextAction(c);
                return (
                  <span className={`text-[10px] flex items-center gap-1 ${action.urgent ? "text-warning font-medium" : "text-muted"}`}>
                    {action.urgent ? <AlertTriangle size={9} /> : <Clock size={9} />}
                    {action.action}
                  </span>
                );
              }},
              { key: "actions", label: "", render: (c: Client) => (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  {/* Feature 2: Quick Actions */}
                  <button onClick={() => window.open(`mailto:${c.email}`)} className="p-1 rounded hover:bg-surface-light text-muted hover:text-foreground transition-colors" title="Email">
                    <Mail size={12} />
                  </button>
                  <button onClick={() => c.phone && window.open(`tel:${c.phone}`)} className="p-1 rounded hover:bg-surface-light text-muted hover:text-foreground transition-colors" title="Call">
                    <Phone size={12} />
                  </button>
                  <button onClick={() => setShowTagModal(c.id)} className="p-1 rounded hover:bg-surface-light text-muted hover:text-foreground transition-colors" title="Tags">
                    <Tag size={12} />
                  </button>
                  <button onClick={() => { setEditingNote(c.id); setNoteText(clientNotes[c.id] || ""); }} className="p-1 rounded hover:bg-surface-light text-muted hover:text-foreground transition-colors" title="Notes">
                    <StickyNote size={12} />
                  </button>
                  <button onClick={() => toggleCompare(c.id)}
                    className={`p-1 rounded hover:bg-surface-light transition-colors ${compareClients.includes(c.id) ? "text-gold" : "text-muted hover:text-foreground"}`} title="Compare">
                    <Columns size={12} />
                  </button>
                  {/* Feature 5: Expand row for activity timeline */}
                  <button onClick={() => setExpandedRow(expandedRow === c.id ? null : c.id)}
                    className="p-1 rounded hover:bg-surface-light text-muted hover:text-foreground transition-colors" title="Activity">
                    {expandedRow === c.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                </div>
              )},
            ]}
            data={filteredClients}
            onRowClick={(c) => router.push(`/dashboard/clients/${c.id}`)}
            emptyMessage="No clients match your filters."
          />

          {/* Feature 5: Expanded Activity Timeline */}
          {expandedRow && (() => {
            const client = clients.find(c => c.id === expandedRow);
            if (!client) return null;
            const revenue = getClientRevenue(expandedRow);
            const note = clientNotes[expandedRow];
            return (
              <div className="card p-4 -mt-1 rounded-t-none border-t-0 bg-surface-light/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Activity Timeline */}
                  <div>
                    <h4 className="text-[10px] text-muted uppercase tracking-wider mb-2">Recent Activity</h4>
                    <div className="space-y-2">
                      {[
                        { action: "Invoice sent", time: "2 hours ago", icon: <FileText size={10} className="text-info" /> },
                        { action: "Content published", time: "1 day ago", icon: <CheckCircle size={10} className="text-success" /> },
                        { action: "Meeting scheduled", time: "3 days ago", icon: <Phone size={10} className="text-purple-400" /> },
                        { action: "Contract signed", time: "1 week ago", icon: <FileText size={10} className="text-gold" /> },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                          <div className="w-5 h-5 rounded-full bg-surface flex items-center justify-center shrink-0">{item.icon}</div>
                          <span className="flex-1">{item.action}</span>
                          <span className="text-muted">{item.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Revenue Breakdown */}
                  <div>
                    <h4 className="text-[10px] text-muted uppercase tracking-wider mb-2">Revenue Breakdown</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Monthly Recurring</span>
                        <span className="font-bold text-gold">{formatCurrency(revenue.mrr)}/mo</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Total Paid</span>
                        <span className="font-bold text-success">{formatCurrency(revenue.totalPaid)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Outstanding</span>
                        <span className={`font-bold ${revenue.outstanding > 0 ? "text-danger" : "text-muted"}`}>{formatCurrency(revenue.outstanding)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                        <span className="text-muted">Est. Lifetime Value</span>
                        <span className="font-bold">{formatCurrency(revenue.mrr * 18)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <h4 className="text-[10px] text-muted uppercase tracking-wider mb-2">Notes</h4>
                    {note ? (
                      <div className="text-xs bg-surface rounded-lg p-2.5">
                        <p>{note}</p>
                        <button onClick={() => { setEditingNote(expandedRow); setNoteText(note); }}
                          className="text-[10px] text-gold hover:underline mt-2">Edit note</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingNote(expandedRow); setNoteText(""); }}
                        className="text-xs text-muted hover:text-foreground flex items-center gap-1">
                        <Plus size={12} /> Add a note
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Contracts Table */}
      {tab === "contracts" && (
        <DataTable
          columns={[
            { key: "title", label: "Contract" },
            { key: "client_id", label: "Client", render: (c: Contract) => clients.find((cl) => cl.id === c.client_id)?.business_name || "-" },
            { key: "value", label: "Value", render: (c: Contract) => c.value ? formatCurrency(c.value) : "-" },
            { key: "status", label: "Status", render: (c: Contract) => <StatusBadge status={c.status} /> },
            { key: "start_date", label: "Start", render: (c: Contract) => c.start_date ? formatDate(c.start_date) : "-" },
            { key: "end_date", label: "End", render: (c: Contract) => c.end_date ? formatDate(c.end_date) : "-" },
            { key: "document_url", label: "Doc", render: (c: Contract) => c.document_url ? (
              <a href={c.document_url} target="_blank" rel="noopener" className="text-gold"><ArrowUpRight size={16} /></a>
            ) : "-" },
          ]}
          data={contracts}
          emptyMessage="No contracts yet."
        />
      )}

      {/* Invoices Table */}
      {tab === "invoices" && (
        <DataTable
          columns={[
            { key: "description", label: "Description", render: (inv: Invoice) => inv.description || "Invoice" },
            { key: "client_id", label: "Client", render: (inv: Invoice) => clients.find((c) => c.id === inv.client_id)?.business_name || "-" },
            { key: "amount", label: "Amount", render: (inv: Invoice) => formatCurrency(inv.amount) },
            { key: "status", label: "Status", render: (inv: Invoice) => <StatusBadge status={inv.status} /> },
            { key: "due_date", label: "Due", render: (inv: Invoice) => inv.due_date ? formatDate(inv.due_date) : "-" },
            { key: "paid_at", label: "Paid", render: (inv: Invoice) => inv.paid_at ? formatDate(inv.paid_at) : "-" },
          ]}
          data={invoices}
          emptyMessage="No invoices yet."
        />
      )}

      {/* Billing Tab */}
      {tab === "billing" && (
        <div className="space-y-4">
          {/* Billing Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3">
              <p className="text-[10px] text-muted uppercase tracking-wider">Stripe Customers</p>
              <p className="text-xl font-bold mt-1">{clientsWithStripe.length}<span className="text-xs text-muted font-normal">/{clients.length}</span></p>
            </div>
            <div className="card p-3">
              <p className="text-[10px] text-muted uppercase tracking-wider">Active Subs</p>
              <p className="text-xl font-bold text-success mt-1">{clientsWithSubs.length}</p>
            </div>
            <div className="card p-3">
              <p className="text-[10px] text-muted uppercase tracking-wider">Paid Invoices</p>
              <p className="text-xl font-bold text-success mt-1">{paidInvoices.length}</p>
            </div>
            <div className="card p-3">
              <p className="text-[10px] text-muted uppercase tracking-wider">Overdue</p>
              <p className={`text-xl font-bold mt-1 ${overdueInvoices.length > 0 ? "text-danger" : "text-muted"}`}>{overdueInvoices.length}</p>
            </div>
          </div>

          {/* Client Billing Cards */}
          <div className="space-y-2">
            {activeClients.map(client => {
              const clientInvoices = invoices.filter(i => i.client_id === client.id);
              const paidTotal = clientInvoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
              const hasStripe = !!client.stripe_customer_id;
              const hasSub = !!client.stripe_subscription_id;

              return (
                <div key={client.id} className="card p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        hasSub ? "bg-success/10 text-success" : hasStripe ? "bg-warning/10 text-warning" : "bg-surface-light text-muted"
                      }`}>
                        {hasSub ? <Zap size={14} /> : <CreditCard size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{client.business_name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted">
                          {hasStripe ? (
                            <span className="text-success flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-success inline-block" /> Stripe connected</span>
                          ) : (
                            <span className="text-muted flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-muted inline-block" /> No Stripe</span>
                          )}
                          {hasSub && <span className="text-gold">Subscribed</span>}
                          {client.mrr > 0 && <span>{formatCurrency(client.mrr)}/mo</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="text-right hidden md:block">
                        <p className="text-muted text-[10px]">Total Paid</p>
                        <p className="font-medium">{formatCurrency(paidTotal)}</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-muted text-[10px]">Invoices</p>
                        <p className="font-medium">{clientInvoices.length}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!hasStripe && (
                          <button onClick={() => syncStripeCustomer(client.id)}
                            disabled={billingLoading === `sync-${client.id}`}
                            className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                            {billingLoading === `sync-${client.id}` ? <Loader size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                            Connect Stripe
                          </button>
                        )}
                        {hasStripe && !hasSub && (
                          <button onClick={() => setShowSubscribeModal(client)}
                            className="btn-primary text-[10px] px-2 py-1 flex items-center gap-1">
                            <Zap size={10} /> Subscribe
                          </button>
                        )}
                        {hasStripe && (
                          <button onClick={() => openBillingPortal(client.id)}
                            disabled={billingLoading === `portal-${client.id}`}
                            className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                            {billingLoading === `portal-${client.id}` ? <Loader size={10} className="animate-spin" /> : <ExternalLink size={10} />}
                            Portal
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {activeClients.length === 0 && (
              <div className="card p-8 text-center text-muted text-sm">No active clients</div>
            )}
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Client" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); addClient(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">Business Name *</label>
              <input name="business_name" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Contact Name *</label>
              <input name="contact_name" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Email *</label>
              <input name="email" type="email" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Phone</label>
              <input name="phone" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Website</label>
              <input name="website" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Industry</label>
              <input name="industry" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Package Tier</label>
              <select name="package_tier" className="input w-full">
                <option value="">Select...</option>
                <option value="Starter">Starter</option>
                <option value="Growth">Growth</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">MRR ($)</label>
              <input name="mrr" type="number" step="0.01" className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Services (comma separated)</label>
            <input name="services" className="input w-full" placeholder="Social Media, Ads, Website" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Client</button>
          </div>
        </form>
      </Modal>

      {/* Client Detail Modal */}
      <Modal
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title={selectedClient?.business_name || "Client Details"}
        size="xl"
      >
        {selectedClient && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted">Contact</p>
                <p className="font-medium">{selectedClient.contact_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Email</p>
                <p>{selectedClient.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Phone</p>
                <p>{selectedClient.phone || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Package</p>
                <p className="text-gold font-medium">{selectedClient.package_tier || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">MRR</p>
                <p className="font-bold">{formatCurrency(selectedClient.mrr)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Health Score</p>
                <p className={selectedClient.health_score > 75 ? "text-success" : selectedClient.health_score > 50 ? "text-warning" : "text-danger"}>
                  {selectedClient.health_score}%
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted mb-2">Services</p>
              <div className="flex flex-wrap gap-2">
                {(selectedClient.services || []).map((s, i) => (
                  <span key={i} className="badge bg-gold/10 text-gold">{s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted mb-2">Contract Status</p>
              <StatusBadge status={selectedClient.contract_status} />
            </div>
            {/* Stripe Billing */}
            <div className="pt-2">
              <p className="text-xs text-muted mb-2">Billing</p>
              <div className="flex flex-wrap gap-2">
                {!selectedClient.stripe_customer_id ? (
                  <button onClick={() => syncStripeCustomer(selectedClient.id)}
                    disabled={billingLoading === `sync-${selectedClient.id}`}
                    className="btn-secondary text-xs flex items-center gap-1.5">
                    {billingLoading === `sync-${selectedClient.id}` ? <Loader size={14} className="animate-spin" /> : <CreditCard size={14} />}
                    Connect to Stripe
                  </button>
                ) : (
                  <>
                    <span className="badge bg-success/10 text-success text-xs flex items-center gap-1">
                      <CreditCard size={12} /> Stripe Connected
                    </span>
                    {!selectedClient.stripe_subscription_id && (
                      <button onClick={() => { setSelectedClient(null); setShowSubscribeModal(selectedClient); }}
                        className="btn-primary text-xs flex items-center gap-1.5">
                        <Zap size={14} /> Create Subscription
                      </button>
                    )}
                    {selectedClient.stripe_subscription_id && (
                      <span className="badge bg-gold/10 text-gold text-xs flex items-center gap-1">
                        <Zap size={12} /> Subscribed
                      </span>
                    )}
                    <button onClick={() => openBillingPortal(selectedClient.id)}
                      disabled={billingLoading === `portal-${selectedClient.id}`}
                      className="btn-secondary text-xs flex items-center gap-1.5">
                      {billingLoading === `portal-${selectedClient.id}` ? <Loader size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                      Billing Portal
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              <button onClick={() => { setSelectedClient(null); setShowInviteModal(selectedClient); }}
                className={`flex items-center gap-2 ${selectedClient.profile_id ? "btn-secondary" : "btn-primary"}`}>
                <UserPlus size={16} /> {selectedClient.profile_id ? "Reset Password" : "Give Portal Access"}
              </button>
              <button onClick={async () => {
                const tid = "contract-gen";
                toast.loading("Generating contract...", { id: tid });
                try {
                  const res = await fetch("/api/contracts/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ client_id: selectedClient.id }),
                  });
                  if (res.ok) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url;
                    a.download = `${selectedClient.business_name}_contract.pdf`; a.click();
                    // Free the object URL once the browser starts the download so we
                    // don't leak blob memory on every contract generation.
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    toast.success("Contract downloaded!", { id: tid });
                  } else { toast.error("Failed to generate contract", { id: tid }); }
                } catch {
                  toast.error("Failed to generate contract", { id: tid });
                }
              }} className="btn-secondary flex items-center gap-2">
                <Download size={16} /> Generate Contract PDF
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Invite Client to Portal Modal */}
      <Modal isOpen={!!showInviteModal} onClose={() => setShowInviteModal(null)} title={showInviteModal?.profile_id ? "Reset Client Password" : "Give Client Portal Access"}>
        {showInviteModal && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const hasPortal = !!showInviteModal.profile_id;
            toast.loading(hasPortal ? "Updating password..." : "Creating account...");
            const res = await fetch("/api/clients/invite", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: fd.get("email"),
                full_name: fd.get("full_name"),
                password: fd.get("password"),
                client_id: showInviteModal.id,
                update_existing: hasPortal,
              }),
            });
            toast.dismiss();
            const data = await res.json();
            if (data.success) {
              toast.success(hasPortal ? "Password updated!" : "Client account created! They can now log in.");
              setShowInviteModal(null);
              fetchData();
            } else {
              toast.error(data.error || "Failed");
            }
          }} className="space-y-4">
            <p className="text-sm text-muted">
              {showInviteModal.profile_id
                ? <>Update password for <span className="text-gold font-medium">{showInviteModal.business_name}</span>. They already have portal access.</>
                : <>Create a login for <span className="text-gold font-medium">{showInviteModal.business_name}</span> so they can access their portal.</>
              }
            </p>
            <div>
              <label className="block text-sm text-muted mb-1">Full Name *</label>
              <input name="full_name" className="input w-full" defaultValue={showInviteModal.contact_name} required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Email *</label>
              <input name="email" type="email" className="input w-full" defaultValue={showInviteModal.email} required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Password *</label>
              <input name="password" type="text" className="input w-full" placeholder="Set their initial password" required minLength={6} />
            </div>
            <div className="bg-surface-light rounded-lg p-3 text-xs text-muted">
              The client will be able to log in at shortstack.work and see: their active services, task checklist, invoices, contracts, and deliverables.
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowInviteModal(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary flex items-center gap-2">
                <UserPlus size={16} /> {showInviteModal.profile_id ? "Update Password" : "Create Account"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create Subscription Modal */}
      <Modal isOpen={!!showSubscribeModal} onClose={() => setShowSubscribeModal(null)} title="Create Subscription">
        {showSubscribeModal && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const amount = parseFloat(fd.get("amount") as string);
            if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
            await createSubscription(
              showSubscribeModal.id,
              amount,
              (fd.get("description") as string) || "",
              (fd.get("interval") as string) || "month",
            );
            setShowSubscribeModal(null);
          }} className="space-y-4">
            <p className="text-sm text-muted">
              Set up recurring billing for <span className="text-gold font-medium">{showSubscribeModal.business_name}</span>.
              This creates a Stripe Checkout link you can send to the client.
            </p>
            <div>
              <label className="block text-sm text-muted mb-1">Amount (USD) *</label>
              <input name="amount" type="number" step="0.01" min="1" className="input w-full"
                defaultValue={showSubscribeModal.mrr || ""} placeholder="e.g. 1500" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Description</label>
              <input name="description" className="input w-full"
                defaultValue={`${showSubscribeModal.business_name} — ${showSubscribeModal.package_tier || "Growth"} Package`}
                placeholder="Service description shown on invoice" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Billing Interval</label>
              <select name="interval" className="input w-full">
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <div className="bg-surface-light rounded-lg p-3 text-xs text-muted">
              A Stripe Checkout link will be generated and copied to your clipboard. Send it to the client to complete payment setup.
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowSubscribeModal(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={!!billingLoading} className="btn-primary flex items-center gap-2">
                {billingLoading ? <Loader size={14} className="animate-spin" /> : <CreditCard size={16} />}
                Create Checkout Link
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Feature 3: Tag Management Modal */}
      <Modal isOpen={!!showTagModal} onClose={() => setShowTagModal(null)} title="Manage Tags">
        {showTagModal && (() => {
          const client = clients.find(c => c.id === showTagModal);
          const currentTags = clientTags[showTagModal] || [];
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Assign tags to <span className="text-gold font-medium">{client?.business_name}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {TAG_PRESETS.map(tag => {
                  const isActive = currentTags.find(t => t.label === tag.label);
                  return (
                    <button key={tag.label} onClick={() => toggleTag(showTagModal, tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                        isActive ? "border-transparent" : "border-border hover:border-gold/30"
                      }`}
                      style={isActive ? { background: tag.color + "22", color: tag.color, borderColor: tag.color + "44" } : {}}>
                      {isActive && <Check size={10} className="inline mr-1" />}
                      {tag.label}
                    </button>
                  );
                })}
              </div>
              {currentTags.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] text-muted mb-2">Active tags:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentTags.map(t => (
                      <span key={t.label} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: t.color + "18", color: t.color }}>
                        {t.label}
                        <button onClick={() => toggleTag(showTagModal, t)} className="hover:opacity-70">
                          <XCircle size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={() => setShowTagModal(null)} className="btn-primary text-sm">Done</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Feature 8: Note Editing Modal */}
      <Modal isOpen={!!editingNote} onClose={() => setEditingNote(null)} title="Client Notes">
        {editingNote && (() => {
          const client = clients.find(c => c.id === editingNote);
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Notes for <span className="text-gold font-medium">{client?.business_name}</span>
              </p>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                className="input w-full h-32 resize-none"
                placeholder="Add notes about this client..."
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => setEditingNote(null)} className="btn-secondary">Cancel</button>
                <button onClick={() => saveNote(editingNote)} className="btn-primary flex items-center gap-2">
                  <StickyNote size={14} /> Save Note
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Feature 12: Client Comparison Modal */}
      <Modal isOpen={showCompareModal} onClose={() => setShowCompareModal(false)} title="Client Comparison" size="xl">
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-[10px] text-muted font-medium uppercase tracking-wider w-32">Metric</th>
                  {compareClients.map(id => {
                    const c = clients.find(cl => cl.id === id);
                    return (
                      <th key={id} className="text-center py-2 text-[10px] font-medium">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${getHealthBg(c?.health_score || 0)}`} />
                          {c?.business_name || "Unknown"}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Health Score", getValue: (c: Client) => `${c.health_score}%`, isBest: (vals: number[]) => Math.max(...vals) },
                  { label: "MRR", getValue: (c: Client) => formatCurrency(c.mrr), isBest: (vals: number[]) => Math.max(...vals), getNum: (c: Client) => c.mrr },
                  { label: "Package", getValue: (c: Client) => c.package_tier || "-" },
                  { label: "Services", getValue: (c: Client) => (c.services || []).length.toString() },
                  { label: "Contract", getValue: (c: Client) => c.contract_status || "-" },
                  { label: "Status", getValue: (c: Client) => c.is_active ? "Active" : "Inactive" },
                  { label: "Onboarding", getValue: (c: Client) => `${getOnboardingProgress(c)}%`, getNum: (c: Client) => getOnboardingProgress(c) },
                  { label: "Total Paid", getValue: (c: Client) => formatCurrency(getClientRevenue(c.id).totalPaid), getNum: (c: Client) => getClientRevenue(c.id).totalPaid },
                  { label: "Outstanding", getValue: (c: Client) => formatCurrency(getClientRevenue(c.id).outstanding) },
                  { label: "Est. CLV", getValue: (c: Client) => formatCurrency(c.mrr * 18), getNum: (c: Client) => c.mrr * 18 },
                ].map(row => {
                  const clientObjs = compareClients.map(id => clients.find(cl => cl.id === id)).filter(Boolean) as Client[];
                  const nums = row.getNum ? clientObjs.map(c => row.getNum!(c)) : [];
                  const bestVal = nums.length > 0 ? Math.max(...nums) : -1;
                  return (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-2 text-muted font-medium">{row.label}</td>
                      {clientObjs.map((c) => {
                        const val = row.getValue(c);
                        const isBest = row.getNum && row.getNum(c) === bestVal && nums.filter(n => n === bestVal).length === 1;
                        return (
                          <td key={c.id} className={`py-2 text-center ${isBest ? "text-gold font-bold" : ""}`}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center pt-2">
            <button onClick={() => { setCompareClients([]); setShowCompareModal(false); }}
              className="text-xs text-muted hover:text-foreground">Clear comparison</button>
            <button onClick={() => setShowCompareModal(false)} className="btn-primary text-sm">Done</button>
          </div>
        </div>
      </Modal>
    </MotionPage>
  );
}
