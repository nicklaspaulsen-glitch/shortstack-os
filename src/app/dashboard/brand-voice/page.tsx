"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Mic, Sparkles, Plus, Trash2, Check, X, Copy,
  ToggleLeft, ToggleRight, Sliders, BookOpen,
  AlertCircle, CheckCircle, Type, Shield,
  ChevronDown, ChevronRight, Search, Wand2,
  FileText, Users, Star, Loader, Eye,
  ThumbsUp, ThumbsDown, Volume2, Palette
} from "lucide-react";
import toast from "react-hot-toast";
import EmptyState from "@/components/empty-state";
import PageHero from "@/components/ui/page-hero";
import { BookOpen as BookOpenIcon } from "lucide-react";

interface VoiceProfile {
  id: string;
  clientName: string;
  active: boolean;
  preset: string;
  toneSliders: {
    formalCasual: number;
    seriousPlayful: number;
    technicalSimple: number;
    reservedEnthusiastic: number;
    authorityFriendly: number;
  };
  samples: string[];
  dos: string[];
  donts: string[];
  approvedTerms: string[];
  bannedWords: string[];
  competitorNames: string[];
  guidelines: string;
}

const VOICE_PRESETS = [
  { key: "professional", label: "Professional", icon: <Shield size={14} />, sliders: { formalCasual: 25, seriousPlayful: 30, technicalSimple: 40, reservedEnthusiastic: 35, authorityFriendly: 30 } },
  { key: "friendly", label: "Friendly", icon: <ThumbsUp size={14} />, sliders: { formalCasual: 70, seriousPlayful: 65, technicalSimple: 60, reservedEnthusiastic: 75, authorityFriendly: 80 } },
  { key: "bold", label: "Bold", icon: <Volume2 size={14} />, sliders: { formalCasual: 55, seriousPlayful: 50, technicalSimple: 45, reservedEnthusiastic: 85, authorityFriendly: 40 } },
  { key: "luxury", label: "Luxury", icon: <Star size={14} />, sliders: { formalCasual: 15, seriousPlayful: 20, technicalSimple: 50, reservedEnthusiastic: 40, authorityFriendly: 25 } },
  { key: "technical", label: "Technical", icon: <FileText size={14} />, sliders: { formalCasual: 20, seriousPlayful: 25, technicalSimple: 15, reservedEnthusiastic: 30, authorityFriendly: 35 } },
  { key: "youthful", label: "Youthful", icon: <Sparkles size={14} />, sliders: { formalCasual: 85, seriousPlayful: 80, technicalSimple: 75, reservedEnthusiastic: 90, authorityFriendly: 70 } },
];

const INITIAL_PROFILES: VoiceProfile[] = [];

export default function BrandVoicePage() {
  useAuth();
  const supabase = createClient();

  const [profiles, setProfiles] = useState<VoiceProfile[]>(INITIAL_PROFILES);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [tab, setTab] = useState<"editor" | "samples" | "vocabulary" | "checker">("editor");
  const [newSample, setNewSample] = useState("");
  const [newDo, setNewDo] = useState("");
  const [newDont, setNewDont] = useState("");
  const [newApproved, setNewApproved] = useState("");
  const [newBanned, setNewBanned] = useState("");
  const [newCompetitor, setNewCompetitor] = useState("");
  const [checkerText, setCheckerText] = useState("");
  const [checkerResult, setCheckerResult] = useState<{ score: number; issues: string[]; suggestions: string[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [enhancing, setEnhancing] = useState<string | null>(null);

  void supabase;

  const profile = profiles.find(p => p.id === selectedProfile);
  const filteredProfiles = profiles.filter(p =>
    p.clientName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const updateProfile = (updates: Partial<VoiceProfile>) => {
    setProfiles(prev => prev.map(p => p.id === selectedProfile ? { ...p, ...updates } : p));
  };

  const updateSlider = (key: keyof VoiceProfile["toneSliders"], value: number) => {
    if (!profile) return;
    updateProfile({ toneSliders: { ...profile.toneSliders, [key]: value } });
  };

  const applyPreset = (presetKey: string) => {
    const preset = VOICE_PRESETS.find(p => p.key === presetKey);
    if (!preset) return;
    updateProfile({ preset: presetKey, toneSliders: { ...preset.sliders } });
    setShowPresetMenu(false);
    toast.success(`Applied "${preset.label}" preset`);
  };

  const toggleActive = (id: string) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
    const p = profiles.find(pr => pr.id === id);
    toast.success(`${p?.clientName} voice profile ${p?.active ? "deactivated" : "activated"}`);
  };

  const addItem = (field: "samples" | "dos" | "donts" | "approvedTerms" | "bannedWords" | "competitorNames", value: string, setter: (v: string) => void) => {
    if (!value.trim() || !profile) return;
    updateProfile({ [field]: [...(profile[field] as string[]), value.trim()] });
    setter("");
    toast.success("Added");
  };

  const removeItem = (field: "samples" | "dos" | "donts" | "approvedTerms" | "bannedWords" | "competitorNames", index: number) => {
    if (!profile) return;
    updateProfile({ [field]: (profile[field] as string[]).filter((_, i) => i !== index) });
  };

  const generateGuidelines = async () => {
    if (!profile) return;
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1500));
    const guidelines = `## Brand Voice Guidelines for ${profile.clientName}

**Tone:** ${profile.toneSliders.formalCasual > 50 ? "Casual and approachable" : "Formal and polished"}
**Energy:** ${profile.toneSliders.reservedEnthusiastic > 50 ? "Enthusiastic and energetic" : "Reserved and measured"}
**Complexity:** ${profile.toneSliders.technicalSimple > 50 ? "Simple and accessible" : "Technical and detailed"}

**Key Principles:**
${profile.dos.map(d => `- DO: ${d}`).join("\n")}
${profile.donts.map(d => `- DON'T: ${d}`).join("\n")}

**Vocabulary:**
- Approved terms: ${profile.approvedTerms.join(", ")}
- Avoid: ${profile.bannedWords.join(", ")}

**Writing Samples That Define This Voice:**
${profile.samples.map((s, i) => `${i + 1}. "${s}"`).join("\n")}`;

    updateProfile({ guidelines });
    setGenerating(false);
    toast.success("Voice guidelines generated!");
  };

  const checkVoiceConsistency = async () => {
    if (!checkerText.trim() || !profile) return;
    setChecking(true);
    await new Promise(r => setTimeout(r, 1200));

    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 85;

    profile.bannedWords.forEach(word => {
      if (checkerText.toLowerCase().includes(word.toLowerCase())) {
        issues.push(`Contains banned word: "${word}"`);
        score -= 15;
      }
    });
    profile.competitorNames.forEach(name => {
      if (checkerText.toLowerCase().includes(name.toLowerCase())) {
        issues.push(`References competitor: "${name}"`);
        score -= 10;
      }
    });
    if (profile.toneSliders.formalCasual < 40 && /!{2,}|lol|omg|gonna|wanna/i.test(checkerText)) {
      issues.push("Informal language detected — does not match formal voice profile");
      score -= 10;
    }
    if (profile.toneSliders.formalCasual > 60 && /herein|pursuant|aforementioned/i.test(checkerText)) {
      issues.push("Overly formal language detected — does not match casual voice profile");
      score -= 10;
    }

    if (issues.length === 0) suggestions.push("Text aligns well with the brand voice profile");
    if (profile.approvedTerms.some(t => checkerText.toLowerCase().includes(t.toLowerCase()))) {
      suggestions.push("Good use of approved brand terminology");
      score = Math.min(100, score + 5);
    } else {
      suggestions.push("Consider incorporating approved brand terms for stronger alignment");
    }

    setCheckerResult({ score: Math.max(0, Math.min(100, score)), issues, suggestions });
    setChecking(false);
    toast.success("Voice check complete!");
  };

  const addNewProfile = () => {
    if (!newProfileName.trim()) return;
    const newId = String(Date.now());
    const newProfile: VoiceProfile = {
      id: newId, clientName: newProfileName.trim(), active: true, preset: "professional",
      toneSliders: { formalCasual: 50, seriousPlayful: 50, technicalSimple: 50, reservedEnthusiastic: 50, authorityFriendly: 50 },
      samples: [], dos: [], donts: [], approvedTerms: [], bannedWords: [], competitorNames: [], guidelines: "",
    };
    setProfiles(prev => [...prev, newProfile]);
    setSelectedProfile(newId);
    setNewProfileName("");
    setShowNewProfile(false);
    toast.success(`Created voice profile for "${newProfile.clientName}"`);
  };

  const enhanceText = async (text: string, context: string, setter: (v: string) => void, key: string) => {
    if (!text.trim()) return;
    setEnhancing(key);
    try {
      const res = await fetch("/api/copywriter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, context }),
      });
      const data = await res.json();
      if (data.text) { setter(data.text); toast.success("Enhanced!"); }
      else toast.error("AI enhancement failed");
    } catch { toast.error("AI enhancement failed"); }
    setEnhancing(null);
  };

  const SLIDER_CONFIG = [
    { key: "formalCasual" as const, left: "Formal", right: "Casual" },
    { key: "seriousPlayful" as const, left: "Serious", right: "Playful" },
    { key: "technicalSimple" as const, left: "Technical", right: "Simple" },
    { key: "reservedEnthusiastic" as const, left: "Reserved", right: "Enthusiastic" },
    { key: "authorityFriendly" as const, left: "Authoritative", right: "Friendly" },
  ];

  const TABS = [
    { key: "editor" as const, label: "Voice Editor", icon: <Sliders size={14} /> },
    { key: "samples" as const, label: "Samples & Rules", icon: <BookOpen size={14} /> },
    { key: "vocabulary" as const, label: "Vocabulary", icon: <Type size={14} /> },
    { key: "checker" as const, label: "Voice Checker", icon: <CheckCircle size={14} /> },
  ];

  return (
    <div className="fade-in space-y-6">
      <PageHero
        icon={<BookOpenIcon size={28} />}
        title="Brand Voice Manager"
        subtitle="Define & enforce brand voice for every client."
        gradient="blue"
        actions={
          <button onClick={() => setShowNewProfile(true)} className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1">
            <Plus size={14} /> New Profile
          </button>
        }
      />

      {showNewProfile && (
        <div className="card border border-gold/20">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-gold" />
            <span className="text-sm font-semibold">Create New Voice Profile</span>
          </div>
          <div className="flex gap-2">
            <input
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              placeholder="Client / Brand name..."
              className="input flex-1 text-xs"
              onKeyDown={e => e.key === "Enter" && addNewProfile()}
            />
            <button onClick={addNewProfile} className="btn-primary text-xs">Create</button>
            <button onClick={() => setShowNewProfile(false)} className="btn-ghost text-xs"><X size={14} /></button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar - Profile List */}
        <div className="col-span-12 md:col-span-3 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Search profiles..."
              className="input text-xs pl-8 w-full"
            />
          </div>
          {filteredProfiles.length === 0 && profiles.length === 0 && (
            <EmptyState
              icon={<Mic size={24} />}
              title="No brand voice profiles"
              description="Create one from a website URL"
              actionLabel="New Profile"
              onAction={() => setShowNewProfile(true)}
            />
          )}
          <div className="space-y-2">
            {filteredProfiles.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedProfile(p.id)}
                className={`card cursor-pointer transition-all ${p.id === selectedProfile ? "border border-gold/40 bg-gold/5" : "hover:border-white/10"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">{p.clientName}</p>
                    <p className="text-[10px] text-muted capitalize">{p.preset} voice</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); toggleActive(p.id); }}
                    className="text-muted hover:text-white transition-colors"
                  >
                    {p.active
                      ? <ToggleRight size={20} className="text-green-400" />
                      : <ToggleLeft size={20} className="text-muted" />
                    }
                  </button>
                </div>
                {!p.active && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted mt-1 inline-block">Inactive</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="col-span-12 md:col-span-9 space-y-4">
          {profile ? (
            <>
              {/* Tabs */}
              <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      tab === t.key ? "bg-gold/20 text-gold" : "text-muted hover:text-white"
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Voice Editor Tab */}
              {tab === "editor" && (
                <div className="space-y-4">
                  {/* Preset Selector */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Palette size={16} className="text-gold" />
                        <span className="text-sm font-semibold">Voice Preset</span>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setShowPresetMenu(!showPresetMenu)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs hover:border-gold/30 transition-colors"
                        >
                          {VOICE_PRESETS.find(p => p.key === profile.preset)?.icon}
                          <span className="capitalize">{profile.preset}</span>
                          <ChevronDown size={12} />
                        </button>
                        {showPresetMenu && (
                          <div className="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl z-10 min-w-[160px]">
                            {VOICE_PRESETS.map(p => (
                              <button
                                key={p.key}
                                onClick={() => applyPreset(p.key)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors ${
                                  profile.preset === p.key ? "text-gold" : "text-white"
                                }`}
                              >
                                {p.icon} {p.label}
                                {profile.preset === p.key && <Check size={12} className="ml-auto" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {VOICE_PRESETS.map(p => (
                        <button
                          key={p.key}
                          onClick={() => applyPreset(p.key)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                            profile.preset === p.key
                              ? "bg-gold/20 text-gold border border-gold/30"
                              : "bg-white/5 text-muted hover:text-white border border-white/10"
                          }`}
                        >
                          {p.icon} {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tone Sliders */}
                  <div className="card">
                    <div className="flex items-center gap-2 mb-4">
                      <Sliders size={16} className="text-gold" />
                      <span className="text-sm font-semibold">Tone Sliders</span>
                    </div>
                    <div className="space-y-4">
                      {SLIDER_CONFIG.map(s => (
                        <div key={s.key}>
                          <div className="flex justify-between text-[10px] text-muted mb-1">
                            <span>{s.left}</span>
                            <span>{s.right}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={profile.toneSliders[s.key]}
                            onChange={e => updateSlider(s.key, Number(e.target.value))}
                            className="w-full accent-gold h-1.5"
                          />
                          <div className="text-center text-[10px] text-muted mt-0.5">{profile.toneSliders[s.key]}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Guidelines */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Wand2 size={16} className="text-gold" />
                        <span className="text-sm font-semibold">AI-Generated Guidelines</span>
                      </div>
                      <button
                        onClick={generateGuidelines}
                        disabled={generating}
                        className="btn-primary text-xs flex items-center gap-1"
                      >
                        {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {generating ? "Generating..." : "Generate"}
                      </button>
                    </div>
                    {profile.guidelines ? (
                      <div className="relative">
                        <pre className="text-xs text-muted whitespace-pre-wrap bg-white/5 rounded-lg p-3 max-h-60 overflow-y-auto">{profile.guidelines}</pre>
                        <button
                          onClick={() => { navigator.clipboard.writeText(profile.guidelines); toast.success("Copied to clipboard"); }}
                          className="absolute top-2 right-2 p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted">Click Generate to create AI voice guidelines based on your samples and settings.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Samples & Rules Tab */}
              {tab === "samples" && (
                <div className="space-y-4">
                  {/* Writing Samples */}
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen size={16} className="text-gold" />
                      <span className="text-sm font-semibold">Writing Style Samples</span>
                    </div>
                    <p className="text-[10px] text-muted mb-3">Paste example content that represents this brand&apos;s voice</p>
                    <div className="space-y-2 mb-3">
                      {profile.samples.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded bg-white/5 group">
                          <Eye size={12} className="text-muted mt-0.5 shrink-0" />
                          <p className="text-xs text-muted flex-1">&quot;{s}&quot;</p>
                          <button onClick={() => removeItem("samples", i)} className="text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <textarea
                          value={newSample}
                          onChange={e => setNewSample(e.target.value)}
                          placeholder="Paste a writing sample..."
                          className="input text-xs w-full min-h-[60px] resize-none"
                        />
                        <button
                          onClick={() => enhanceText(newSample, `Polish this writing sample for the "${profile?.clientName}" brand voice profile. Keep the core message but improve clarity, tone, and impact.`, setNewSample, "sample")}
                          disabled={!newSample.trim() || enhancing === "sample"}
                          className="flex items-center gap-1 text-[10px] text-gold/70 hover:text-gold transition-colors disabled:opacity-40"
                        >
                          {enhancing === "sample" ? <Loader size={10} className="animate-spin" /> : <Sparkles size={10} />}
                          AI Enhance
                        </button>
                      </div>
                      <button onClick={() => addItem("samples", newSample, setNewSample)} className="btn-primary text-xs self-end">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Do's */}
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <ThumbsUp size={16} className="text-green-400" />
                      <span className="text-sm font-semibold">Do&apos;s</span>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {profile.dos.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-green-500/5 group">
                          <Check size={12} className="text-green-400 shrink-0" />
                          <span className="text-xs flex-1">{d}</span>
                          <button onClick={() => removeItem("dos", i)} className="text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newDo}
                        onChange={e => setNewDo(e.target.value)}
                        placeholder="Add a guideline..."
                        className="input text-xs flex-1"
                        onKeyDown={e => e.key === "Enter" && addItem("dos", newDo, setNewDo)}
                      />
                      <button onClick={() => addItem("dos", newDo, setNewDo)} className="btn-primary text-xs"><Plus size={14} /></button>
                    </div>
                  </div>

                  {/* Don'ts */}
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <ThumbsDown size={16} className="text-red-400" />
                      <span className="text-sm font-semibold">Don&apos;ts</span>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {profile.donts.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-red-500/5 group">
                          <X size={12} className="text-red-400 shrink-0" />
                          <span className="text-xs flex-1">{d}</span>
                          <button onClick={() => removeItem("donts", i)} className="text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newDont}
                        onChange={e => setNewDont(e.target.value)}
                        placeholder="Add a restriction..."
                        className="input text-xs flex-1"
                        onKeyDown={e => e.key === "Enter" && addItem("donts", newDont, setNewDont)}
                      />
                      <button onClick={() => addItem("donts", newDont, setNewDont)} className="btn-primary text-xs"><Plus size={14} /></button>
                    </div>
                  </div>
                </div>
              )}

              {/* Vocabulary Tab */}
              {tab === "vocabulary" && (
                <div className="space-y-4">
                  {/* Approved Terms */}
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle size={16} className="text-green-400" />
                      <span className="text-sm font-semibold">Approved Terms</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {profile.approvedTerms.map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] group">
                          {t}
                          <button onClick={() => removeItem("approvedTerms", i)} className="opacity-0 group-hover:opacity-100 transition-all hover:text-red-400">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newApproved}
                        onChange={e => setNewApproved(e.target.value)}
                        placeholder="Add approved term..."
                        className="input text-xs flex-1"
                        onKeyDown={e => e.key === "Enter" && addItem("approvedTerms", newApproved, setNewApproved)}
                      />
                      <button onClick={() => addItem("approvedTerms", newApproved, setNewApproved)} className="btn-primary text-xs"><Plus size={14} /></button>
                    </div>
                  </div>

                  {/* Banned Words */}
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle size={16} className="text-red-400" />
                      <span className="text-sm font-semibold">Banned Words</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {profile.bannedWords.map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] group">
                          {t}
                          <button onClick={() => removeItem("bannedWords", i)} className="opacity-0 group-hover:opacity-100 transition-all hover:text-white">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newBanned}
                        onChange={e => setNewBanned(e.target.value)}
                        placeholder="Add banned word..."
                        className="input text-xs flex-1"
                        onKeyDown={e => e.key === "Enter" && addItem("bannedWords", newBanned, setNewBanned)}
                      />
                      <button onClick={() => addItem("bannedWords", newBanned, setNewBanned)} className="btn-primary text-xs"><Plus size={14} /></button>
                    </div>
                  </div>

                  {/* Competitor Names */}
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield size={16} className="text-yellow-400" />
                      <span className="text-sm font-semibold">Competitor Names to Avoid</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {profile.competitorNames.map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-[10px] group">
                          {t}
                          <button onClick={() => removeItem("competitorNames", i)} className="opacity-0 group-hover:opacity-100 transition-all hover:text-red-400">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newCompetitor}
                        onChange={e => setNewCompetitor(e.target.value)}
                        placeholder="Add competitor name..."
                        className="input text-xs flex-1"
                        onKeyDown={e => e.key === "Enter" && addItem("competitorNames", newCompetitor, setNewCompetitor)}
                      />
                      <button onClick={() => addItem("competitorNames", newCompetitor, setNewCompetitor)} className="btn-primary text-xs"><Plus size={14} /></button>
                    </div>
                  </div>
                </div>
              )}

              {/* Voice Checker Tab */}
              {tab === "checker" && (
                <div className="space-y-4">
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle size={16} className="text-gold" />
                      <span className="text-sm font-semibold">Voice Consistency Checker</span>
                    </div>
                    <p className="text-[10px] text-muted mb-3">
                      Paste any text to check if it matches the &quot;{profile.clientName}&quot; brand voice
                    </p>
                    <textarea
                      value={checkerText}
                      onChange={e => setCheckerText(e.target.value)}
                      placeholder="Paste content here to check voice consistency..."
                      className="input text-xs w-full min-h-[100px] resize-none mb-1"
                    />
                    <button
                      onClick={() => enhanceText(checkerText, `Rewrite this text to match the "${profile?.clientName}" brand voice. Tone: ${profile?.toneSliders.formalCasual && profile.toneSliders.formalCasual > 50 ? "casual" : "formal"}. ${profile?.dos.length ? `Do: ${profile.dos.join(", ")}` : ""} ${profile?.donts.length ? `Don't: ${profile.donts.join(", ")}` : ""}`, setCheckerText, "checker")}
                      disabled={!checkerText.trim() || enhancing === "checker"}
                      className="flex items-center gap-1 text-[10px] text-gold/70 hover:text-gold transition-colors disabled:opacity-40 mb-3"
                    >
                      {enhancing === "checker" ? <Loader size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      AI Rewrite to Match Voice
                    </button>
                    <button
                      onClick={checkVoiceConsistency}
                      disabled={checking || !checkerText.trim()}
                      className="btn-primary text-xs flex items-center gap-1"
                    >
                      {checking ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {checking ? "Analyzing..." : "Check Voice Consistency"}
                    </button>
                  </div>

                  {checkerResult && (
                    <div className="card">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold">Results</span>
                        <div className={`text-lg font-bold ${
                          checkerResult.score >= 80 ? "text-green-400" :
                          checkerResult.score >= 50 ? "text-yellow-400" : "text-red-400"
                        }`}>
                          {checkerResult.score}/100
                        </div>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 mb-4">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            checkerResult.score >= 80 ? "bg-green-400" :
                            checkerResult.score >= 50 ? "bg-yellow-400" : "bg-red-400"
                          }`}
                          style={{ width: `${checkerResult.score}%` }}
                        />
                      </div>
                      {checkerResult.issues.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider mb-1.5">Issues Found</p>
                          {checkerResult.issues.map((issue, i) => (
                            <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-red-500/5 mb-1">
                              <AlertCircle size={12} className="text-red-400 shrink-0" />
                              <span className="text-xs text-red-300">{issue}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {checkerResult.suggestions.length > 0 && (
                        <div>
                          <p className="text-[10px] text-green-400 font-semibold uppercase tracking-wider mb-1.5">Suggestions</p>
                          {checkerResult.suggestions.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-green-500/5 mb-1">
                              <ChevronRight size={12} className="text-green-400 shrink-0" />
                              <span className="text-xs text-green-300">{s}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="card text-center py-12">
              <Mic size={32} className="text-muted mx-auto mb-3" />
              <p className="text-sm text-muted">Select a voice profile to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
