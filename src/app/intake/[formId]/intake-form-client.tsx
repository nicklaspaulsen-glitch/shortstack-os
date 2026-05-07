"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "radio" | "checkbox";
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface IntakeForm {
  id: string;
  name: string;
  welcome_message: string;
  fields: FormField[];
  brand_color: string;
  ai_qualification: boolean;
}

export default function IntakeFormClient({ formId }: { formId: string }) {
  const [form, setForm] = useState<IntakeForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/intake/${formId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: IntakeForm) => {
        setForm(data);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [formId]);

  const accent = form?.brand_color ?? "#FF2D2D";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/intake/${formId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: contactName || undefined,
          contact_email: contactEmail || undefined,
          contact_phone: contactPhone || undefined,
          responses,
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-16 h-16  bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-2">
          <span className="text-3xl select-none">🔒</span>
        </div>
        <h1 className="text-xl font-semibold text-white/70">Form not found</h1>
        <p className="text-sm text-white/30 max-w-xs">
          This form may have been deactivated or the link is invalid.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
        >
          <CheckCircle2 size={28} style={{ color: accent }} />
        </div>
        <h1 className="text-2xl font-semibold text-white">Thank you!</h1>
        <p className="text-sm text-white/50 max-w-xs leading-relaxed">
          We&#39;ve received your submission and will be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12  mb-4"
            style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
          >
            <ChevronRight size={20} style={{ color: accent }} />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2" style={{ fontFamily: "Satoshi, sans-serif" }}>
            {form.name}
          </h1>
          {form.welcome_message && (
            <p className="text-sm text-white/50 leading-relaxed max-w-sm mx-auto">
              {form.welcome_message}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Contact basics */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-4">
            <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest">Your info</p>
            <Field
              label="Full name"
              type="text"
              value={contactName}
              onChange={setContactName}
              placeholder="Jane Smith"
              accent={accent}
            />
            <Field
              label="Email address"
              type="email"
              value={contactEmail}
              onChange={setContactEmail}
              placeholder="jane@company.com"
              accent={accent}
            />
            <Field
              label="Phone (optional)"
              type="tel"
              value={contactPhone}
              onChange={setContactPhone}
              placeholder="+1 555 000 0000"
              accent={accent}
            />
          </div>

          {/* Custom fields */}
          {form.fields.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-4">
              <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest">A few questions</p>
              {form.fields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  value={responses[field.id] ?? ""}
                  onChange={(v) => setResponses((prev) => ({ ...prev, [field.id]: v }))}
                  accent={accent}
                />
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: accent }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit"
            )}
          </button>

          <p className="text-[10px] text-white/20 text-center">
            Powered by ShortStack OS
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  accent,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accent: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-white/50">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/90 placeholder:text-white/20 outline-none transition-all"
        style={{ "--focus-color": accent } as React.CSSProperties}
        onFocus={(e) => (e.target.style.borderColor = `${accent}60`)}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
      />
    </div>
  );
}

function DynamicField({
  field,
  value,
  onChange,
  accent,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  const inputClass =
    "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/90 placeholder:text-white/20 outline-none transition-all";

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-white/50">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      {field.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={4}
          className={`${inputClass} resize-none`}
          onFocus={(e) => (e.target.style.borderColor = `${accent}60`)}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />
      ) : field.type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={`${inputClass} bg-[#111114]`}
          onFocus={(e) => (e.target.style.borderColor = `${accent}60`)}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        >
          <option value="" disabled>Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.type === "radio" ? (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
              <div
                className="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  borderColor: value === opt ? accent : "rgba(255,255,255,0.2)",
                  background: value === opt ? `${accent}22` : "transparent",
                }}
              >
                {value === opt && (
                  <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
                )}
              </div>
              <input
                type="radio"
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="sr-only"
                required={field.required && !value}
              />
              <span className="text-sm text-white/70">{opt}</span>
            </label>
          ))}
        </div>
      ) : (
        <input
          type={field.type === "phone" ? "tel" : field.type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          className={inputClass}
          onFocus={(e) => (e.target.style.borderColor = `${accent}60`)}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />
      )}
    </div>
  );
}
