"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";
import {
  Calculator, Save, Trash2, Loader,
  TrendingUp, DollarSign, Target, Clock
} from "lucide-react";

interface Inputs {
  monthly_leads: number;
  close_rate: number;
  avg_deal_size: number;
  monthly_spend: number;
}

interface Results {
  monthly_revenue: number;
  roi: number;
  cac: number;
  ltv: number;
  payback_months: number;
}

interface Scenario {
  id: string;
  name: string;
  monthly_leads: number;
  close_rate: number;
  avg_deal_size: number;
  monthly_spend: number;
  roi: number | null;
  cac: number | null;
  ltv: number | null;
  payback_months: number | null;
  created_at: string;
}

const DEFAULT_INPUTS: Inputs = {
  monthly_leads: 100,
  close_rate: 20,
  avg_deal_size: 5000,
  monthly_spend: 3000,
};

function compute(inputs: Inputs): Results {
  const { monthly_leads, close_rate, avg_deal_size, monthly_spend } = inputs;
  const closed = monthly_leads * (close_rate / 100);
  const monthly_revenue = closed * avg_deal_size;
  const roi = monthly_spend > 0 ? ((monthly_revenue - monthly_spend) / monthly_spend) * 100 : 0;
  const cac = closed > 0 ? monthly_spend / closed : 0;
  const ltv = avg_deal_size * 3;
  const payback_months =
    monthly_revenue > 0 ? monthly_spend / monthly_revenue : 0;
  return { monthly_revenue, roi, cac, ltv, payback_months };
}

function fmtN(n: number | null | undefined, decimals = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(n);
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

const SENSITIVITY_OFFSETS = [-20, -10, 0, 10, 20];

export default function RoiCalculatorPage() {
  const supabase = createClient();
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const [results, setResults] = useState<Results>(compute(DEFAULT_INPUTS));
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioName, setScenarioName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setResults(compute(inputs));
  }, [inputs]);

  async function loadScenarios() {
    setLoading(true);
    const { data } = await supabase
      .from("roi_scenarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setScenarios(data as Scenario[]);
    setLoading(false);
  }

  useEffect(() => {
    loadScenarios();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveScenario() {
    if (!scenarioName.trim()) { toast.error("Enter a scenario name"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }
    const { error } = await supabase.from("roi_scenarios").insert({
      profile_id: user.id,
      name: scenarioName,
      monthly_leads: inputs.monthly_leads,
      close_rate: inputs.close_rate,
      avg_deal_size: inputs.avg_deal_size,
      monthly_spend: inputs.monthly_spend,
      roi: results.roi,
      cac: results.cac,
      ltv: results.ltv,
      payback_months: results.payback_months,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Scenario saved");
    setScenarioName("");
    loadScenarios();
  }

  async function deleteScenario(id: string) {
    if (!confirm("Delete this scenario?")) return;
    await supabase.from("roi_scenarios").delete().eq("id", id);
    setScenarios(s => s.filter(x => x.id !== id));
    toast.success("Deleted");
  }

  function loadScenario(s: Scenario) {
    setInputs({
      monthly_leads: s.monthly_leads,
      close_rate: s.close_rate,
      avg_deal_size: s.avg_deal_size,
      monthly_spend: s.monthly_spend,
    });
    toast.success(`Loaded: ${s.name}`);
  }

  function setInput(key: keyof Inputs, val: string) {
    setInputs(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));
  }

  const metricCards = [
    {
      label: "Monthly Revenue",
      value: fmtUSD(results.monthly_revenue),
      icon: <DollarSign size={18} />,
      color: "text-green-400",
    },
    {
      label: "ROI",
      value: fmtN(results.roi) + "%",
      icon: <TrendingUp size={18} />,
      color: results.roi >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "CAC",
      value: fmtUSD(results.cac),
      icon: <Target size={18} />,
      color: "text-blue-400",
    },
    {
      label: "Payback Period",
      value: results.payback_months > 0 ? fmtN(results.payback_months) + " mo" : "—",
      icon: <Clock size={18} />,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        title="ROI Calculator"
        subtitle="Prove the value of your marketing spend with scenario-based ROI math."
        icon={<Calculator size={22} />}
        gradient="ocean"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs column */}
        <div className="lg:col-span-1 rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/80">Inputs</h3>

          {(
            [
              { key: "monthly_leads" as keyof Inputs, label: "Monthly Leads", suffix: "leads", prefix: "" },
              { key: "close_rate" as keyof Inputs, label: "Close Rate", suffix: "%", prefix: "" },
              { key: "avg_deal_size" as keyof Inputs, label: "Avg Deal Size", suffix: "", prefix: "$" },
              { key: "monthly_spend" as keyof Inputs, label: "Monthly Spend", suffix: "", prefix: "$" },
            ]
          ).map(({ key, label, suffix, prefix }) => (
            <div key={key}>
              <label className="block text-xs text-white/50 mb-1">{label}</label>
              <div className="flex items-center gap-1">
                {prefix ? <span className="text-white/40 text-sm">{prefix}</span> : null}
                <input
                  type="number"
                  value={inputs[key]}
                  min={0}
                  onChange={e => setInput(key, e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/50 [appearance:textfield]"
                />
                {suffix ? <span className="text-white/40 text-sm">{suffix}</span> : null}
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-white/10 space-y-2">
            <label className="block text-xs text-white/50">Save Scenario</label>
            <input
              value={scenarioName}
              onChange={e => setScenarioName(e.target.value)}
              placeholder="Scenario name"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400/50"
            />
            <button
              onClick={saveScenario}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
          </div>
        </div>

        {/* Results column */}
        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {metricCards.map(c => (
              <div key={c.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className={`mb-2 ${c.color}`}>{c.icon}</div>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-white/40 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Sensitivity table */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-3">
              Sensitivity: Close Rate ±20%
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40 border-b border-white/10">
                    <th className="text-left pb-2">Scenario</th>
                    <th className="text-right pb-2">Close Rate</th>
                    <th className="text-right pb-2">Revenue / mo</th>
                    <th className="text-right pb-2">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {SENSITIVITY_OFFSETS.map(offset => {
                    const adjRate = Math.max(0, inputs.close_rate + offset);
                    const r = compute({ ...inputs, close_rate: adjRate });
                    const isBase = offset === 0;
                    return (
                      <tr
                        key={offset}
                        className={`border-b border-white/5 last:border-0 ${
                          isBase ? "text-cyan-300 font-semibold" : "text-white/70"
                        }`}
                      >
                        <td className="py-1.5">
                          {isBase ? "Base" : `${offset > 0 ? "+" : ""}${offset}%`}
                        </td>
                        <td className="text-right">{adjRate.toFixed(1)}%</td>
                        <td className="text-right">{fmtUSD(r.monthly_revenue)}</td>
                        <td
                          className={`text-right ${
                            r.roi >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {fmtN(r.roi)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Scenarios */}
      <div>
        <h3 className="text-sm font-semibold text-white/60 mb-3">Saved Scenarios</h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : scenarios.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-6">No saved scenarios yet.</p>
        ) : (
          <div className="space-y-2">
            {scenarios.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{s.name}</p>
                  <p className="text-xs text-white/40">
                    {s.monthly_leads} leads · {s.close_rate}% close · {fmtUSD(s.avg_deal_size)} deal · {fmtUSD(s.monthly_spend)}/mo spend
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-sm font-semibold ${
                      (s.roi ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {fmtN(s.roi)}% ROI
                  </span>
                  <button
                    onClick={() => loadScenario(s)}
                    className="text-xs text-white/40 hover:text-white px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteScenario(s.id)}
                    className="text-white/20 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
