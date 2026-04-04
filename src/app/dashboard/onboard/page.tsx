"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

const SERVICES = [
  "Social Media Management", "Content Marketing", "Video Production",
  "SEO & Content Strategy", "Email Marketing", "Paid Ads (Meta)",
  "Paid Ads (Google)", "Paid Ads (TikTok)", "Website Design & Development",
  "Branding & Creative Design", "AI Receptionist", "AI Chatbot",
  "Automation Workflows", "Lead Generation", "Community Management",
];

const PACKAGES = [
  { name: "Starter", price: "997", description: "Perfect for small businesses getting started", features: ["1 platform", "10 posts/mo", "Basic ads", "Monthly report"] },
  { name: "Growth", price: "2,497", description: "For businesses ready to scale", features: ["3 platforms", "30 posts/mo", "Advanced ads", "Weekly reports", "SEO", "Email marketing"] },
  { name: "Enterprise", price: "4,997", description: "Full-service agency partnership", features: ["All platforms", "Unlimited content", "Full ad management", "Daily reports", "AI systems", "Dedicated team", "Website included"] },
];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    business_name: "", contact_name: "", email: "", phone: "", website: "",
    industry: "", package_tier: "Growth", mrr: "2497", services: [] as string[],
    password: "", create_portal: true, create_invoice: true, setup_zernio: true,
    send_welcome: true, notes: "",
  });

  const updateForm = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleService = (s: string) => {
    const services = form.services.includes(s) ? form.services.filter(x => x !== s) : [...form.services, s];
    updateForm("services", services);
  };

  async function submitOnboarding() {
    setLoading(true);
    try {
      const res = await fetch("/api/clients/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${form.business_name} onboarded successfully!`);
        router.push(`/dashboard/clients/${data.client_id}`);
      } else {
        toast.error(data.error || "Onboarding failed");
      }
    } catch {
      toast.error("Error during onboarding");
    }
    setLoading(false);
  }

  const steps = [
    // Step 0: Client Info
    <div key="info" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Client Information</h2>
      <p className="text-sm text-muted">Basic details about the new client</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-muted mb-1">Business Name *</label>
          <input value={form.business_name} onChange={e => updateForm("business_name", e.target.value)} className="input w-full" required />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Contact Name *</label>
          <input value={form.contact_name} onChange={e => updateForm("contact_name", e.target.value)} className="input w-full" required />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Email *</label>
          <input type="email" value={form.email} onChange={e => updateForm("email", e.target.value)} className="input w-full" required />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Phone</label>
          <input value={form.phone} onChange={e => updateForm("phone", e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Website</label>
          <input value={form.website} onChange={e => updateForm("website", e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Industry</label>
          <input value={form.industry} onChange={e => updateForm("industry", e.target.value)} className="input w-full" placeholder="e.g., Dentist, Lawyer, Gym" />
        </div>
      </div>
    </div>,

    // Step 1: Package Selection
    <div key="package" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Select Package</h2>
      <p className="text-sm text-muted">Choose the right plan for this client</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PACKAGES.map(pkg => (
          <button key={pkg.name} onClick={() => { updateForm("package_tier", pkg.name); updateForm("mrr", pkg.price.replace(",", "")); }}
            className={`p-5 rounded-xl border text-left transition-all ${form.package_tier === pkg.name ? "border-gold bg-gold/10" : "border-border hover:border-gold/30"}`}>
            <p className="font-bold text-lg">{pkg.name}</p>
            <p className="text-2xl font-bold text-gold mt-1">${pkg.price}<span className="text-sm text-muted font-normal">/mo</span></p>
            <p className="text-xs text-muted mt-2">{pkg.description}</p>
            <ul className="mt-3 space-y-1">
              {pkg.features.map((f, i) => (
                <li key={i} className="text-xs flex items-center gap-1.5">
                  <Check size={10} className="text-gold shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <div>
        <label className="block text-sm text-muted mb-1">Custom MRR (if different)</label>
        <input type="number" value={form.mrr} onChange={e => updateForm("mrr", e.target.value)} className="input w-48" />
      </div>
    </div>,

    // Step 2: Services
    <div key="services" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Select Services</h2>
      <p className="text-sm text-muted">What will we be doing for this client?</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {SERVICES.map(s => (
          <button key={s} onClick={() => toggleService(s)}
            className={`p-3 rounded-lg border text-sm text-left transition-all ${form.services.includes(s) ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:border-gold/30 hover:text-white"}`}>
            <span className="flex items-center gap-2">
              {form.services.includes(s) && <Check size={14} />}
              {s}
            </span>
          </button>
        ))}
      </div>
    </div>,

    // Step 3: Setup Options
    <div key="setup" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Setup Options</h2>
      <p className="text-sm text-muted">Configure what to set up automatically</p>
      <div className="space-y-3">
        <label className="flex items-center gap-3 p-3 bg-surface-light rounded-lg cursor-pointer">
          <input type="checkbox" checked={form.create_portal} onChange={e => updateForm("create_portal", e.target.checked)} className="accent-gold" />
          <div>
            <p className="text-sm font-medium">Create Client Portal Access</p>
            <p className="text-xs text-muted">Client can log in to view tasks, invoices, and content</p>
          </div>
        </label>
        {form.create_portal && (
          <div className="ml-8">
            <label className="block text-sm text-muted mb-1">Set client password</label>
            <input type="text" value={form.password} onChange={e => updateForm("password", e.target.value)} className="input w-64" placeholder="Their login password" />
          </div>
        )}
        <label className="flex items-center gap-3 p-3 bg-surface-light rounded-lg cursor-pointer">
          <input type="checkbox" checked={form.create_invoice} onChange={e => updateForm("create_invoice", e.target.checked)} className="accent-gold" />
          <div>
            <p className="text-sm font-medium">Create First Invoice</p>
            <p className="text-xs text-muted">Send invoice for first month via Stripe (7 day payment terms)</p>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 bg-surface-light rounded-lg cursor-pointer">
          <input type="checkbox" checked={form.setup_zernio} onChange={e => updateForm("setup_zernio", e.target.checked)} className="accent-gold" />
          <div>
            <p className="text-sm font-medium">Set Up Social Publishing (Zernio)</p>
            <p className="text-xs text-muted">Create a Zernio profile for auto-publishing to their social accounts</p>
          </div>
        </label>
      </div>
      <div>
        <label className="block text-sm text-muted mb-1">Notes</label>
        <textarea value={form.notes} onChange={e => updateForm("notes", e.target.value)} className="input w-full h-20" placeholder="Anything else to note about this client..." />
      </div>
    </div>,

    // Step 4: Review
    <div key="review" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Review & Launch</h2>
      <p className="text-sm text-muted">Everything looks good? Hit launch to onboard this client.</p>
      <div className="card bg-surface-light">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted">Business:</span> <span className="font-medium">{form.business_name}</span></div>
          <div><span className="text-muted">Contact:</span> <span className="font-medium">{form.contact_name}</span></div>
          <div><span className="text-muted">Email:</span> <span>{form.email}</span></div>
          <div><span className="text-muted">Package:</span> <span className="text-gold font-bold">{form.package_tier} — ${parseInt(form.mrr).toLocaleString()}/mo</span></div>
          <div className="col-span-2"><span className="text-muted">Services:</span> <span>{form.services.join(", ") || "None selected"}</span></div>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2">{form.create_portal ? <Check size={14} className="text-success" /> : <span className="text-muted">—</span>} Portal access {form.create_portal ? "will be created" : "skipped"}</p>
        <p className="flex items-center gap-2">{form.create_invoice ? <Check size={14} className="text-success" /> : <span className="text-muted">—</span>} First invoice {form.create_invoice ? "will be sent" : "skipped"}</p>
        <p className="flex items-center gap-2">{form.setup_zernio ? <Check size={14} className="text-success" /> : <span className="text-muted">—</span>} Zernio profile {form.setup_zernio ? "will be created" : "skipped"}</p>
        <p className="flex items-center gap-2"><Check size={14} className="text-success" /> 8 onboarding tasks will be created</p>
        <p className="flex items-center gap-2"><Check size={14} className="text-success" /> Telegram notification will be sent</p>
      </div>
    </div>,
  ];

  return (
    <div className="fade-in max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
          <UserPlus size={24} className="text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Onboard New Client</h1>
          <p className="text-xs text-muted">Step {step + 1} of {steps.length}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? "bg-gold" : "bg-surface-light"}`} />
        ))}
      </div>

      {/* Step Content */}
      <div className="card">{steps[step]}</div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-30">
          <ArrowLeft size={16} /> Back
        </button>
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(step + 1)} className="btn-primary flex items-center gap-2">
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={submitOnboarding} disabled={loading || !form.business_name || !form.email}
            className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <Sparkles size={16} /> {loading ? "Launching..." : "Launch Onboarding"}
          </button>
        )}
      </div>
    </div>
  );
}
