"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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

const RAINBOW = "linear-gradient(90deg, #2563EB, #8b5cf6, #ec4899, #f97316, #2563EB)";

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
      color: "text-[#2563EB]",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="ROI CALCULATOR"
        title="ROI Calculator"
        subtitle="Prove the value of your marketing spend with scenario-based ROI math."
        icon={<Calculator size={22} />}
        gradient="gold"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs column */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-1 glass rounded-xl p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-[#374151]">Inputs</h3>

          {(
            [
              { key: "monthly_leads" as keyof Inputs, label: "Monthly Leads", suffix: "leads", prefix: "" },
              { key: "close_rate" as keyof Inputs, label: "Close Rate", suffix: "%", prefix: "" },
              { key: "avg_deal_size" as keyof Inputs, label: "Avg Deal Size", suffix: "", prefix: "$" },
              { key: "monthly_spend" as keyof Inputs, label: "Monthly Spend", suffix: "", prefix: "$" },
            ]
          ).map(({ key, label, suffix, prefix }) => (
            <div key={key}>
              <label className="block text-xs text-[#9CA3AF] mb-1">{label}</label>
              <div className="flex items-center gap-1">
                {prefix ? <span className="text-[#9CA3AF] text-sm">{prefix}</span> : null}
                <input
                  type="number"
                  value={inputs[key]}
                  min={0}
                  onChange={e => setInput(key, e.target.value)}
                  className="flex-1 glass rounded-lg px-3 py-2 text-[#111827] text-sm focus:outline-none focus:border-[#2563EB] [appearance:textfield]"
                />
                {suffix ? <span className="text-[#9CA3AF] text-sm">{suffix}</span> : null}
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-[rgba(0,0,0,0.08)] space-y-2">
            <label className="block text-xs text-[#9CA3AF]">Save Scenario</label>
            <input
              value={scenarioName}
              onChange={e => setScenarioName(e.target.value)}
              placeholder="Scenario name"
              className="w-full glass rounded-lg px-3 py-2 text-[#111827] text-sm focus:outline-none focus:border-[#2563EB]"
            />
            <button
              onClick={saveScenario}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[rgba(37,99,235,0.12)] hover:bg-[rgba(37,99,235,0.14)] text-[#2563EB] text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
          </div>
        </motion.div>

        {/* Results column */}
        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {metricCards.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className="glass rounded-xl overflow-hidden"
              >
                <div style={{ height: 3, background: RAINBOW, borderRadius: "4px 4px 0 0" }} />
                <div className="p-4">
                  <div className={`mb-2 ${c.color}`}>{c.icon}</div>
                  <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{c.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Sensitivity table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.4 }}
            className="glass rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-[#374151] mb-3">
              Sensitivity: Close Rate ±20%
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#9CA3AF] border-b border-[rgba(0,0,0,0.08)]">
                    <th className="text-left pb-2">Scenario</th>
                    <th className="text-right pb-2">Close Rate</th>
                    <th className="text-right pb-2">Revenue / mo</th>
                    <th className="text-right pb-2">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {SENSITIVITY_OFFSETS.map((offset, i) => {
                    const adjRate = Math.max(0, inputs.close_rate + offset);
                    const r = compute({ ...inputs, close_rate: adjRate });
                    const isBase = offset === 0;
                    return (
                      <motion.tr
                        key={offset}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={`border-b border-[rgba(0,0,0,0.06)] last:border-0 ${
                          isBase ? "text-[#2563EB] font-semibold" : "text-[#6B7280]"
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
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Saved Scenarios */}
      <div>
        <h3 className="text-sm font-semibold text-[#6B7280] mb-3">Saved Scenarios</h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-12 rounded-xl glass animate-pulse" />
            ))}
          </div>
        ) : scenarios.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-6">No saved scenarios yet.</p>
        ) : (
          <div className="space-y-2">
            {scenarios.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className="flex items-center gap-4 glass rounded-xl px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#111827] text-sm truncate">{s.name}</p>
                  <p className="text-xs text-[#9CA3AF]">
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
                    className="text-xs text-[#9CA3AF] hover:text-[#111827] px-2 py-1 rounded border border-[rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.10)] transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteScenario(s.id)}
                    className="text-[#9CA3AF] hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
