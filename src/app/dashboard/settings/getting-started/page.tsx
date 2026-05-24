"use client";
import { ArrowDown, ArrowSquareOut, ArrowUp, BookOpen, Calendar, CircleNotch, Eye, EyeSlash, FileText, FloppyDisk, Plus, Question, Sparkle, Trash, Users } from "@phosphor-icons/react";

/**
 * Settings → Getting Started doc editor.
 *
 * Per-agency editor for the public /getting-started/[ownerId] page.
 * Sections + FAQ are stored as jsonb but edited as friendly form fields
 * with up/down reorder controls. Drag-drop is deferred to v2.
 */

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MotionPage } from "@/components/motion/motion-page";

// ── Types ────────────────────────────────────────────────────────────────

interface Section {
  title: string;
  body_md: string;
  icon: string;
  links: { label: string; href: string }[];
}

interface Faq {
  q: string;
  a: string;
}

interface GettingStartedDoc {
  hero_title: string;
  hero_subtitle: string | null;
  hero_video_url: string | null;
  contact_email: string | null;
  is_public: boolean;
  sections: Section[];
  faq: Faq[];
}

const ICON_OPTIONS = [
  "Sparkle",
  "Zap",
  "Map",
  "MessageCircle",
  "FolderOpen",
  "Receipt",
  "Calendar",
  "Users",
  "Shield",
  "Star",
  "Settings",
  "BookOpen",
  "Mail",
  "Phone",
  "FileText",
];

// ── Component ────────────────────────────────────────────────────────────

export default function GettingStartedSettingsPage() {
  const [doc, setDoc] = useState<GettingStartedDoc | null>(null);
  const [publicUrl, setPublicUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/getting-started", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = await res.json();
      setDoc(json.doc as GettingStartedDoc);
      setPublicUrl(json.public_url as string);
    } catch (err) {
      console.error("[getting-started] load failed", err);
      toast.error("Failed to load doc");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSave() {
    if (!doc) return;
    setSaving(true);
    try {
      const res = await fetch("/api/getting-started", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `status ${res.status}`);
      }
      toast.success("Doc saved");
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "FloppyDisk failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Section editors ──
  function addSection() {
    if (!doc) return;
    setDoc({
      ...doc,
      sections: [
        ...doc.sections,
        { title: "New section", body_md: "", icon: "Sparkle", links: [] },
      ],
    });
  }

  function updateSection(index: number, next: Partial<Section>) {
    if (!doc) return;
    const sections = doc.sections.map((s, i) => (i === index ? { ...s, ...next } : s));
    setDoc({ ...doc, sections });
  }

  function removeSection(index: number) {
    if (!doc) return;
    setDoc({ ...doc, sections: doc.sections.filter((_, i) => i !== index) });
  }

  function moveSection(index: number, direction: -1 | 1) {
    if (!doc) return;
    const next = [...doc.sections];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDoc({ ...doc, sections: next });
  }

  // ── FAQ editors ──
  function addFaq() {
    if (!doc) return;
    setDoc({ ...doc, faq: [...doc.faq, { q: "New question", a: "" }] });
  }

  function updateFaq(index: number, next: Partial<Faq>) {
    if (!doc) return;
    const faq = doc.faq.map((f, i) => (i === index ? { ...f, ...next } : f));
    setDoc({ ...doc, faq });
  }

  function removeFaq(index: number) {
    if (!doc) return;
    setDoc({ ...doc, faq: doc.faq.filter((_, i) => i !== index) });
  }

  return (
    <MotionPage className="min-h-screen pb-16">{/* -- Getting Started doc command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Settings</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Getting Started doc</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        publicUrl ? (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm hover:border-border-strong transition-colors"
                  >
                    <ArrowSquareOut size={13} /> View public page
                  </a>
                ) : null
      </div>
    </div><div className="px-6 lg:px-10 mt-6 max-w-4xl">
              {loading || !doc ? (
                <div className="flex items-center justify-center py-24 text-text-secondary">
                  <CircleNotch className="w-5 h-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Hero */}
                  <section className=" bg-surface-1 border border-border-subtle p-6">
                    <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-4">
                      Hero
                    </h2>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={doc.hero_title}
                          onChange={(e) => setDoc({ ...doc, hero_title: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Subtitle
                        </label>
                        <input
                          type="text"
                          value={doc.hero_subtitle || ""}
                          onChange={(e) => setDoc({ ...doc, hero_subtitle: e.target.value || null })}
                          className="w-full px-3 py-2.5 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Video URL (Loom, YouTube, Vimeo — optional)
                        </label>
                        <input
                          type="url"
                          value={doc.hero_video_url || ""}
                          onChange={(e) => setDoc({ ...doc, hero_video_url: e.target.value || null })}
                          placeholder="https://www.loom.com/share/..."
                          className="w-full px-3 py-2.5 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Contact email (shown on the page)
                        </label>
                        <input
                          type="email"
                          value={doc.contact_email || ""}
                          onChange={(e) => setDoc({ ...doc, contact_email: e.target.value || null })}
                          placeholder="hello@youragency.com"
                          className="w-full px-3 py-2.5 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Sections */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                        Sections
                      </h2>
                      <button
                        onClick={addSection}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm hover:border-border-strong transition-colors"
                      >
                        <Plus size={13} /> Add section
                      </button>
                    </div>
                    <div className="space-y-3">
                      {doc.sections.map((section, i) => (
                        <SectionEditor
                          key={i}
                          section={section}
                          index={i}
                          isFirst={i === 0}
                          isLast={i === doc.sections.length - 1}
                          onChange={(next) => updateSection(i, next)}
                          onMoveUp={() => moveSection(i, -1)}
                          onMoveDown={() => moveSection(i, 1)}
                          onRemove={() => removeSection(i)}
                        />
                      ))}
                      {doc.sections.length === 0 && (
                        <p className="text-sm text-text-muted text-center py-6 border border-dashed border-border-subtle rounded-lg">
                          No sections yet. Click "Add section" to start.
                        </p>
                      )}
                    </div>
                  </section>

                  {/* FAQ */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                        Frequently asked questions
                      </h2>
                      <button
                        onClick={addFaq}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm hover:border-border-strong transition-colors"
                      >
                        <Plus size={13} /> Add FAQ
                      </button>
                    </div>
                    <div className="space-y-3">
                      {doc.faq.map((f, i) => (
                        <div
                          key={i}
                          className="rounded-xl bg-surface-1 border border-border-subtle p-4 space-y-2"
                        >
                          <div className="flex justify-end">
                            <button
                              onClick={() => removeFaq(i)}
                              className="text-text-muted hover:text-red-400 transition-colors"
                              title="Remove"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={f.q}
                            onChange={(e) => updateFaq(i, { q: e.target.value })}
                            placeholder="Question"
                            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
                          />
                          <textarea
                            value={f.a}
                            onChange={(e) => updateFaq(i, { a: e.target.value })}
                            placeholder="Answer"
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
                          />
                        </div>
                      ))}
                      {doc.faq.length === 0 && (
                        <p className="text-sm text-text-muted text-center py-6 border border-dashed border-border-subtle rounded-lg">
                          No FAQs yet.
                        </p>
                      )}
                    </div>
                  </section>

                  {/* Settings + actions */}
                  <section className=" bg-surface-1 border border-border-subtle p-5 flex items-center justify-between flex-wrap gap-3">
                    <button
                      onClick={() => setDoc({ ...doc, is_public: !doc.is_public })}
                      className="inline-flex items-center gap-2 text-sm text-text-primary"
                    >
                      {doc.is_public ? <Eye size={14} /> : <EyeSlash size={14} />}
                      <span>
                        {doc.is_public
                          ? "Public — anyone with the link can see it"
                          : "Private — only signed-in clients can see it"}
                      </span>
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-lime text-black text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {saving ? <CircleNotch size={14} className="animate-spin" /> : <FloppyDisk size={14} />}
                      FloppyDisk changes
                    </button>
                  </section>
                </div>
              )}
            </div></MotionPage>
  );
}

// ── Section editor sub-component ─────────────────────────────────────────

function SectionEditor({
  section,
  index,
  isFirst,
  isLast,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  section: Section;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (next: Partial<Section>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl bg-surface-1 border border-border-subtle p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-text-muted">#{index + 1}</span>
        <div className="flex gap-1">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-30"
            title="Move up"
          >
            <ArrowUp size={14} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-30"
            title="Move down"
          >
            <ArrowDown size={14} />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-surface-2 transition-colors"
            title="Remove"
          >
            <Trash size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <input
            type="text"
            value={section.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Section title"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
          />
        </div>
        <div>
          <select
            value={section.icon}
            onChange={(e) => onChange({ icon: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
          >
            {ICON_OPTIONS.map((iconName) => (
              <option key={iconName} value={iconName}>
                {iconName}
              </option>
            ))}
          </select>
        </div>
      </div>
      <textarea
        value={section.body_md}
        onChange={(e) => onChange({ body_md: e.target.value })}
        placeholder="Section body (markdown supported)"
        rows={4}
        className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
      />
    </div>
  );
}
