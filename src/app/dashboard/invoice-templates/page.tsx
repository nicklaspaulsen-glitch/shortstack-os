"use client";

import { useState, useEffect, useCallback } from "react";
import { ReceiptText, Plus, Pencil, Trash2, Check, X, Loader2, Eye, Star } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { TableSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface LineItem {
  description: string;
  qty: number;
  unit_price: number;
}

interface InvoiceTemplate {
  id: string;
  name: string;
  line_items: LineItem[];
  tax_rate: number | null;
  notes: string | null;
  is_default: boolean;
}

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcSubtotal(items: LineItem[]) {
  return items.reduce((s, i) => s + i.qty * i.unit_price, 0);
}

/** Inline invoice preview modal */
function PreviewModal({ template, onClose }: { template: InvoiceTemplate; onClose: () => void }) {
  const subtotal = calcSubtotal(template.line_items);
  const taxAmt = subtotal * ((template.tax_rate ?? 0) / 100);
  const total = subtotal + taxAmt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Invoice header */}
        <div className="p-8 border-b border-white/5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold text-white">INVOICE</p>
              <p className="text-muted text-sm mt-1">Template: {template.name}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-muted"><X size={18} /></button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted text-xs uppercase tracking-wider mb-1">Bill To</p>
              <p className="text-white">Client Name</p>
              <p className="text-muted">client@example.com</p>
            </div>
            <div className="text-right">
              <p className="text-muted text-xs uppercase tracking-wider mb-1">Invoice Details</p>
              <p className="text-white">#{new Date().getFullYear()}-001</p>
              <p className="text-muted">Issued: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="p-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-muted text-xs">
                <th className="text-left pb-2 font-medium">Description</th>
                <th className="text-center pb-2 font-medium w-16">Qty</th>
                <th className="text-right pb-2 font-medium w-24">Unit Price</th>
                <th className="text-right pb-2 font-medium w-24">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {template.line_items.map((item, i) => (
                <tr key={i}>
                  <td className="py-3 text-white">{item.description}</td>
                  <td className="py-3 text-center text-muted">{item.qty}</td>
                  <td className="py-3 text-right text-muted">{fmt(item.unit_price)}</td>
                  <td className="py-3 text-right text-white font-medium">{fmt(item.qty * item.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-6 border-t border-white/10 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            {(template.tax_rate ?? 0) > 0 && (
              <div className="flex justify-between text-muted">
                <span>Tax ({template.tax_rate}%)</span><span>{fmt(taxAmt)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-white/10">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
          </div>

          {template.notes && (
            <div className="mt-6 p-4 bg-white/5 rounded-xl text-sm text-muted">
              <p className="text-xs uppercase tracking-wider text-muted mb-1">Notes</p>
              <p>{template.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TemplateForm {
  name: string;
  tax_rate: string;
  notes: string;
  is_default: boolean;
  line_items: LineItem[];
}

const EMPTY_FORM: TemplateForm = {
  name: "", tax_rate: "", notes: "", is_default: false,
  line_items: [{ description: "", qty: 1, unit_price: 0 }],
};

function LineItemsEditor({
  items, onChange,
}: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  function updateItem(i: number, patch: Partial<LineItem>) {
    const next = items.map((it, idx) => idx === i ? { ...it, ...patch } : it);
    onChange(next);
  }
  function addItem() { onChange([...items, { description: "", qty: 1, unit_price: 0 }]); }
  function removeItem(i: number) { onChange(items.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input className="input flex-1 text-sm h-8" placeholder="Description"
            value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} />
          <input className="input w-14 text-sm h-8" placeholder="Qty" type="number" min={1}
            value={item.qty} onChange={(e) => updateItem(i, { qty: parseFloat(e.target.value) || 1 })} />
          <input className="input w-24 text-sm h-8" placeholder="$0.00" type="number" min={0}
            value={item.unit_price} onChange={(e) => updateItem(i, { unit_price: parseFloat(e.target.value) || 0 })} />
          <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
            className="p-1.5 text-muted hover:text-red-400 disabled:opacity-30 mt-0.5"><X size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={addItem}
        className="text-xs text-muted hover:text-white flex items-center gap-1 pt-1">
        <Plus size={13} /> Add line item
      </button>
    </div>
  );
}

export default function InvoiceTemplatesPage() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvoiceTemplate | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<TemplateForm>(EMPTY_FORM);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TemplateForm>(EMPTY_FORM);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("invoice_templates")
      .select("id, name, line_items, tax_rate, notes, is_default")
      .order("is_default", { ascending: false });
    setLoading(false);
    if (error) { toast.error("Failed to load templates"); return; }
    setTemplates(
      (data ?? []).map((t: InvoiceTemplate) => ({
        ...t,
        line_items: Array.isArray(t.line_items) ? t.line_items : [],
      }))
    );
  }, [supabase]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  function formToPayload(f: TemplateForm) {
    return {
      name: f.name.trim(),
      line_items: f.line_items.filter((i) => i.description.trim()),
      tax_rate: parseFloat(f.tax_rate) || null,
      notes: f.notes.trim() || null,
      is_default: f.is_default,
    };
  }

  async function handleCreate() {
    if (!createForm.name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }
    if (createForm.is_default) {
      await supabase.from("invoice_templates").update({ is_default: false }).eq("user_id", user.id);
    }
    const { error } = await supabase.from("invoice_templates").insert({ ...formToPayload(createForm), user_id: user.id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Template created"); setCreateForm(EMPTY_FORM); setShowCreate(false); fetchTemplates();
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (editForm.is_default && user) {
      await supabase.from("invoice_templates").update({ is_default: false }).eq("user_id", user.id).neq("id", id);
    }
    const { error } = await supabase.from("invoice_templates").update(formToPayload(editForm)).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Template updated"); setEditId(null); fetchTemplates();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    setDeleting(id);
    const { error } = await supabase.from("invoice_templates").delete().eq("id", id);
    setDeleting(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Template deleted");
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  function templateToForm(t: InvoiceTemplate): TemplateForm {
    return {
      name: t.name, tax_rate: t.tax_rate?.toString() ?? "",
      notes: t.notes ?? "", is_default: t.is_default,
      line_items: t.line_items.length ? t.line_items : [{ description: "", qty: 1, unit_price: 0 }],
    };
  }

  return (
    <div className="space-y-6">
      {preview && <PreviewModal template={preview} onClose={() => setPreview(null)} />}

      <PageHero
        title="Invoice Templates"
        subtitle="Branded, reusable invoice layouts ready for any client or project."
        icon={<ReceiptText size={22} />}
        gradient="gold"
        actions={
          <button onClick={() => setShowCreate((v) => !v)}
            className="btn-primary flex items-center gap-2 text-sm px-3 py-2 rounded-lg">
            <Plus size={16} /> New Template
          </button>
        }
      />

      {showCreate && (
        <div className="card p-5 border border-white/10 space-y-4">
          <p className="font-semibold text-white text-sm">New Template</p>
          <div className="flex flex-wrap gap-3">
            <input className="input flex-1 min-w-[180px] text-sm" placeholder="Template name"
              value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} autoFocus />
            <input className="input w-24 text-sm" placeholder="Tax %" type="number" min={0} max={100}
              value={createForm.tax_rate} onChange={(e) => setCreateForm({ ...createForm, tax_rate: e.target.value })} />
          </div>
          <div>
            <p className="text-xs text-muted mb-2">Line Items</p>
            <LineItemsEditor items={createForm.line_items}
              onChange={(items) => setCreateForm({ ...createForm, line_items: items })} />
          </div>
          <textarea className="input w-full text-sm h-16 resize-none" placeholder="Notes / payment terms (optional)"
            value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input type="checkbox" checked={createForm.is_default}
              onChange={(e) => setCreateForm({ ...createForm, is_default: e.target.checked })}
              className="accent-yellow-400" />
            Set as default template
          </label>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !createForm.name.trim()}
              className="btn-primary flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
            </button>
            <button onClick={() => setShowCreate(false)}
              className="btn-ghost flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg">
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? <TableSkeleton rows={4} /> : templates.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-4 text-center">
          <ReceiptText size={40} className="text-muted opacity-30" />
          <p className="text-white font-semibold">No invoice templates yet</p>
          <p className="text-muted text-sm max-w-xs">Create reusable templates to spin up invoices in seconds.</p>
          <button onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2 rounded-lg mt-1">
            <Plus size={15} /> Create first template
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) =>
            editId === t.id ? (
              <div key={t.id} className="card p-5 border border-white/10 space-y-4">
                <p className="font-semibold text-white text-sm">Edit Template</p>
                <div className="flex flex-wrap gap-3">
                  <input className="input flex-1 min-w-[180px] text-sm" placeholder="Template name"
                    value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
                  <input className="input w-24 text-sm" placeholder="Tax %" type="number" min={0} max={100}
                    value={editForm.tax_rate} onChange={(e) => setEditForm({ ...editForm, tax_rate: e.target.value })} />
                </div>
                <div>
                  <p className="text-xs text-muted mb-2">Line Items</p>
                  <LineItemsEditor items={editForm.line_items}
                    onChange={(items) => setEditForm({ ...editForm, line_items: items })} />
                </div>
                <textarea className="input w-full text-sm h-16 resize-none" placeholder="Notes"
                  value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                  <input type="checkbox" checked={editForm.is_default}
                    onChange={(e) => setEditForm({ ...editForm, is_default: e.target.checked })}
                    className="accent-yellow-400" />
                  Default template
                </label>
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(t.id)} disabled={saving || !editForm.name.trim()}
                    className="btn-primary flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
                  </button>
                  <button onClick={() => setEditId(null)}
                    className="btn-ghost flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg">
                    <X size={13} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={t.id} className="card p-4 flex items-center gap-4 group hover:border-white/10 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium truncate">{t.name}</p>
                    {t.is_default && (
                      <span className="flex items-center gap-1 text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                        <Star size={9} /> Default
                      </span>
                    )}
                  </div>
                  <p className="text-muted text-xs mt-0.5">
                    {t.line_items.length} line item{t.line_items.length !== 1 ? "s" : ""} ·{" "}
                    Total: {fmt(calcSubtotal(t.line_items) * (1 + (t.tax_rate ?? 0) / 100))}
                    {t.tax_rate ? ` (incl. ${t.tax_rate}% tax)` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setPreview(t)}
                    className="p-1.5 rounded hover:bg-white/10 text-muted hover:text-white" title="Preview">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => { setEditId(t.id); setEditForm(templateToForm(t)); }}
                    className="p-1.5 rounded hover:bg-white/10 text-muted hover:text-white" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                    className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400" title="Delete">
                    {deleting === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
