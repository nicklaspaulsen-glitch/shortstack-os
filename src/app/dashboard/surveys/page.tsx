"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import Modal from "@/components/ui/modal";
import toast from "react-hot-toast";
import {
  ClipboardCheck, Plus, Trash2, GripVertical, Share2,
  BarChart2, Edit2, Copy, Loader, ToggleLeft, X, Star,
  MessageSquare, CheckSquare
} from "lucide-react";

type QuestionType = "text" | "multiple_choice" | "rating" | "yes_no";

interface Question {
  id: string;
  type: QuestionType;
  label: string;
  options?: string[];
  required: boolean;
}

interface Survey {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string;
  questions: Question[];
  is_active: boolean;
  response_count: number;
  created_at: string;
}

const QUESTION_LABELS: Record<QuestionType, string> = {
  text: "Text",
  multiple_choice: "Multiple Choice",
  rating: "Rating (1–5)",
  yes_no: "Yes / No",
};

function newQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    type: "text",
    label: "",
    options: ["Option A", "Option B"],
    required: false,
  };
}

export default function SurveysPage() {
  const supabase = createClient();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"surveys" | "responses">("surveys");
  const [showCreate, setShowCreate] = useState(false);
  const [editSurvey, setEditSurvey] = useState<Survey | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([newQuestion()]);
  const dragIdx = useRef<number | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("surveys")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setSurveys(data as Survey[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setTitle(""); setDescription(""); setQuestions([newQuestion()]);
    setEditSurvey(null); setShowCreate(true);
  }

  function openEdit(s: Survey) {
    setTitle(s.title); setDescription(s.description);
    setQuestions(s.questions.length ? s.questions : [newQuestion()]);
    setEditSurvey(s); setShowCreate(true);
  }

  async function save() {
    if (!title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }
    const slug =
      title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" + Date.now();
    const payload = { title, description, questions, is_active: true };
    const { error } = editSurvey
      ? await supabase.from("surveys").update(payload).eq("id", editSurvey.id)
      : await supabase.from("surveys").insert({
          ...payload, user_id: user.id, slug, response_count: 0,
        });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editSurvey ? "Survey updated" : "Survey created");
    setShowCreate(false);
    load();
  }

  async function deleteSurvey(id: string) {
    if (!confirm("Delete this survey?")) return;
    const { error } = await supabase.from("surveys").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setSurveys(prev => prev.filter(x => x.id !== id));
  }

  async function toggleActive(s: Survey) {
    const { error } = await supabase
      .from("surveys")
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
    if (!error)
      setSurveys(prev =>
        prev.map(x => (x.id === s.id ? { ...x, is_active: !x.is_active } : x))
      );
  }

  function copyLink(s: Survey) {
    const url = `${window.location.origin}/survey/${s.slug}`;
    setShareUrl(url);
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied!"));
  }

  function addQuestion() {
    setQuestions(q => [...q, newQuestion()]);
  }
  function removeQuestion(idx: number) {
    setQuestions(q => q.filter((_, i) => i !== idx));
  }
  function updateQuestion(idx: number, patch: Partial<Question>) {
    setQuestions(q => q.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }
  function addOption(idx: number) {
    setQuestions(q =>
      q.map((x, i) =>
        i === idx
          ? { ...x, options: [...(x.options || []), `Option ${(x.options?.length || 0) + 1}`] }
          : x
      )
    );
  }
  function updateOption(qIdx: number, oIdx: number, val: string) {
    setQuestions(q =>
      q.map((x, i) =>
        i === qIdx ? { ...x, options: x.options?.map((o, j) => (j === oIdx ? val : o)) } : x
      )
    );
  }
  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const reordered = [...questions];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(idx, 0, moved);
    dragIdx.current = idx;
    setQuestions(reordered);
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Surveys"
        subtitle="Build feedback surveys, share links, and track responses."
        icon={<ClipboardCheck size={22} />}
        gradient="sunset"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors border border-white/20"
          >
            <Plus size={15} /> New Survey
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(["surveys", "responses"] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === t
                ? "border-orange-400 text-orange-400"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === "responses" ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/40">
          <BarChart2 size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a survey to view its responses.</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : surveys.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <ClipboardCheck size={40} className="mx-auto mb-4 text-white/20" />
          <p className="text-white/60 mb-4">No surveys yet. Create your first one.</p>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-sm font-medium transition-colors"
          >
            <Plus size={14} className="inline mr-1" /> New Survey
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map(s => (
            <div
              key={s.id}
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.08] p-4 flex items-center gap-4 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2 h-2 rounded-full ${s.is_active ? "bg-green-400" : "bg-white/20"}`}
                  />
                  <span className="font-medium text-white truncate">{s.title}</span>
                </div>
                <p className="text-xs text-white/40 truncate">
                  {s.description || "No description"}
                </p>
                <p className="text-xs text-white/30 mt-1">
                  {s.questions.length} questions · {s.response_count} responses
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(s)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                  title={s.is_active ? "Deactivate" : "Activate"}
                >
                  <ToggleLeft size={16} />
                </button>
                <button
                  onClick={() => copyLink(s)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                  title="Copy share link"
                >
                  <Share2 size={16} />
                </button>
                <button
                  onClick={() => openEdit(s)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => deleteSurvey(s.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title={editSurvey ? "Edit Survey" : "New Survey"}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-400/50"
              placeholder="e.g. Client Satisfaction Survey"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-400/50"
              placeholder="Brief intro for respondents"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white/50">Questions</label>
              <button
                onClick={addQuestion}
                className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={e => onDragOver(e, idx)}
                  className="rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-start gap-2">
                    <GripVertical
                      size={14}
                      className="text-white/20 cursor-grab mt-2 shrink-0"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={q.label}
                          onChange={e => updateQuestion(idx, { label: e.target.value })}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-orange-400/50"
                          placeholder="Question text"
                        />
                        <select
                          value={q.type}
                          onChange={e =>
                            updateQuestion(idx, { type: e.target.value as QuestionType })
                          }
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                        >
                          {(Object.keys(QUESTION_LABELS) as QuestionType[]).map(t => (
                            <option key={t} value={t}>
                              {QUESTION_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                      {q.type === "multiple_choice" && (
                        <div className="space-y-1 pl-1">
                          {q.options?.map((opt, oIdx) => (
                            <input
                              key={oIdx}
                              value={opt}
                              onChange={e => updateOption(idx, oIdx, e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none"
                              placeholder={`Option ${oIdx + 1}`}
                            />
                          ))}
                          <button
                            onClick={() => addOption(idx)}
                            className="text-xs text-white/40 hover:text-white/60"
                          >
                            <Plus size={10} className="inline" /> Add option
                          </button>
                        </div>
                      )}
                      <label className="flex items-center gap-1.5 text-xs text-white/40 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={e => updateQuestion(idx, { required: e.target.checked })}
                          className="accent-orange-400"
                        />
                        Required
                      </label>
                    </div>
                    <button
                      onClick={() => removeQuestion(idx)}
                      className="text-white/20 hover:text-red-400 transition-colors mt-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving && <Loader size={13} className="animate-spin" />}
              {editSurvey ? "Save Changes" : "Create Survey"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Share URL modal */}
      {shareUrl && (
        <Modal isOpen={!!shareUrl} onClose={() => setShareUrl(null)} title="Share Survey">
          <div className="space-y-3">
            <p className="text-sm text-white/60">Share this link with your respondents:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast.success("Copied!");
                }}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
