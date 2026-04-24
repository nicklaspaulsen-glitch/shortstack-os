"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Plus, Pencil, Trash2, Check, X, Loader2, Copy, ToggleLeft, ToggleRight } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { TableSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  billing_interval: string | null;
  is_active: boolean;
  include_in_proposals: boolean;
  sort_order: number;
}

const BILLING_INTERVALS = ["one_time","monthly","quarterly","annually","hourly"];

function formatPrice(cents: number, interval: string | null) {
  const price = `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  if (!interval || interval === "one_time") return price;
  const map: Record<string, string> = { monthly: "/mo", quarterly: "/qtr", annually: "/yr", hourly: "/hr" };
  return `${price}${map[interval] ?? ""}`;
}

interface ServiceFormState {
  name: string;
  description: string;
  price: string;
  billing_interval: string;
  include_in_proposals: boolean;
}

const DEFAULT_FORM: ServiceFormState = {
  name: "", description: "", price: "", billing_interval: "monthly", include_in_proposals: true,
};

function ServiceForm({
  value, onChange, onSubmit, onCancel, saving, submitLabel,
}: {
  value: ServiceFormState;
  onChange: (v: ServiceFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <input className="input flex-1 min-w-[160px] text-sm" placeholder="Service name"
          value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()} autoFocus />
        <div className="flex gap-2">
          <input className="input w-28 text-sm" placeholder="Price" value={value.price}
            onChange={(e) => onChange({ ...value, price: e.target.value })} />
          <select className="input w-28 text-sm" value={value.billing_interval}
            onChange={(e) => onChange({ ...value, billing_interval: e.target.value })}>
            {BILLING_INTERVALS.map((b) => <option key={b} value={b}>{b.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>
      <textarea className="input w-full text-sm h-16 resize-none" placeholder="Description (optional)"
        value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange({ ...value, include_in_proposals: !value.include_in_proposals })}
          className={`text-sm flex items-center gap-1.5 ${value.include_in_proposals ? "text-green-400" : "text-muted"}`}>
          {value.include_in_proposals ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          Include in proposals
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onSubmit} disabled={saving || !value.name.trim()}
          className="btn-primary flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {submitLabel}
        </button>
        <button onClick={onCancel} className="btn-ghost flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg">
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const supabase = createClient();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<ServiceFormState>(DEFAULT_FORM);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ServiceFormState>(DEFAULT_FORM);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("services")
      .select("id, name, description, price_cents, billing_interval, is_active, include_in_proposals, sort_order")
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (error) { toast.error("Failed to load services"); return; }
    setServices(data ?? []);
  }, [supabase]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  function serviceToForm(s: Service): ServiceFormState {
    return {
      name: s.name,
      description: s.description ?? "",
      price: (s.price_cents / 100).toString(),
      billing_interval: s.billing_interval ?? "one_time",
      include_in_proposals: s.include_in_proposals,
    };
  }

  async function handleCreate() {
    if (!createForm.name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }
    const { error } = await supabase.from("services").insert({
      name: createForm.name.trim(),
      description: createForm.description.trim() || null,
      price_cents: Math.round(parseFloat(createForm.price || "0") * 100),
      billing_interval: createForm.billing_interval,
      include_in_proposals: createForm.include_in_proposals,
      is_active: true,
      user_id: user.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Service created"); setCreateForm(DEFAULT_FORM); setShowCreate(false); fetchServices();
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    const { error } = await supabase.from("services").update({
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
      price_cents: Math.round(parseFloat(editForm.price || "0") * 100),
      billing_interval: editForm.billing_interval,
      include_in_proposals: editForm.include_in_proposals,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Service updated"); setEditId(null); fetchServices();
  }

  async function handleToggleActive(s: Service) {
    const { error } = await supabase.from("services").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    setServices((prev) => prev.map((sv) => sv.id === s.id ? { ...sv, is_active: !sv.is_active } : sv));
  }

  async function handleDuplicate(s: Service) {
    setDuplicating(s.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDuplicating(null); return; }
    const { error } = await supabase.from("services").insert({
      name: `${s.name} (copy)`,
      description: s.description,
      price_cents: s.price_cents,
      billing_interval: s.billing_interval,
      include_in_proposals: s.include_in_proposals,
      is_active: true,
      user_id: user.id,
    });
    setDuplicating(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Duplicated"); fetchServices();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this service?")) return;
    setDeleting(id);
    const { error } = await supabase.from("services").delete().eq("id", id);
    setDeleting(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Service deleted");
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Service Catalog"
        subtitle="Define productized services once — attach them to proposals, invoices, and deals."
        icon={<Package size={22} />}
        gradient="blue"
        actions={
          <button onClick={() => setShowCreate((v) => !v)}
            className="btn-primary flex items-center gap-2 text-sm px-3 py-2 rounded-lg">
            <Plus size={16} /> Add Service
          </button>
        }
      />

      {showCreate && (
        <div className="card p-5 border border-white/10">
          <p className="font-semibold text-white text-sm mb-4">New Service</p>
          <ServiceForm value={createForm} onChange={setCreateForm}
            onSubmit={handleCreate} onCancel={() => setShowCreate(false)}
            saving={saving} submitLabel="Create" />
        </div>
      )}

      {loading ? <TableSkeleton rows={5} /> : services.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-4 text-center">
          <Package size={40} className="text-muted opacity-30" />
          <p className="text-white font-semibold">No services yet</p>
          <p className="text-muted text-sm max-w-xs">Build your productized service library to speed up proposals and invoices.</p>
          <button onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2 rounded-lg mt-1">
            <Plus size={15} /> Add first service
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-muted text-xs">
                <th className="text-left px-4 py-3 font-medium">Service</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Price</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">Status</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {services.map((s) =>
                editId === s.id ? (
                  <tr key={s.id} className="bg-white/[0.02]">
                    <td colSpan={4} className="px-4 py-4">
                      <ServiceForm value={editForm} onChange={setEditForm}
                        onSubmit={() => handleUpdate(s.id)} onCancel={() => setEditId(null)}
                        saving={saving} submitLabel="Save" />
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className={`hover:bg-white/[0.02] transition-colors group ${!s.is_active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{s.name}</p>
                      {s.description && <p className="text-muted text-xs mt-0.5 line-clamp-1">{s.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium hidden sm:table-cell">
                      {formatPrice(s.price_cents, s.billing_interval)}
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <button onClick={() => handleToggleActive(s)}
                        className={`text-xs px-2 py-0.5 rounded-full border ${s.is_active ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-white/10 text-muted"}`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button onClick={() => { setEditId(s.id); setEditForm(serviceToForm(s)); }}
                          className="p-1.5 rounded hover:bg-white/10 text-muted hover:text-white" title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDuplicate(s)} disabled={duplicating === s.id}
                          className="p-1.5 rounded hover:bg-white/10 text-muted hover:text-white" title="Duplicate">
                          {duplicating === s.id ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                        </button>
                        <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id}
                          className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400" title="Delete">
                          {deleting === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
