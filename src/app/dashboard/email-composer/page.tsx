"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail, Send, Sparkles, Bold, Italic, Link2, List,
  Image as ImageIcon, Save, Monitor, Smartphone, Code,
  Clock, Eye, AlertTriangle, CheckCircle, Copy, Type,
  Paperclip, Palette, Hash, MousePointerClick,
  X, Plus, Calendar, Loader2, Wand2, TrendingUp, Users,
  Info
} from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/modal";
import { GmailIcon, OutlookIcon } from "@/components/ui/platform-icons";
import PageHero from "@/components/ui/page-hero";
import CreationWizard, { type WizardStep } from "@/components/creation-wizard";
import { trackGeneration } from "@/lib/track-generation";
import { Wizard, AdvancedToggle, useAdvancedMode, type WizardStepDef } from "@/components/ui/wizard";

interface SubjectVariant {
  subject: string;
  predicted_open_rate: number;
  reason: string;
}

type ComposeMode = "write" | "improve" | "shorten" | "lengthen" | "tone";
type ComposeTone = "professional" | "friendly" | "casual" | "urgent" | "persuasive";

type MainTab = "compose" | "templates" | "preview" | "spam-check" | "scheduler" | "signatures";

const TEMPLATE_GALLERY: { id: string; name: string; category: string; subject: string; preview: string }[] = [];

const VARIABLES = [
  { tag: "{first_name}", label: "First Name", example: "John" },
  { tag: "{last_name}", label: "Last Name", example: "Smith" },
  { tag: "{business_name}", label: "Business", example: "Bright Smile Dental" },
  { tag: "{company}", label: "Company", example: "ShortStack" },
  { tag: "{industry}", label: "Industry", example: "Dental" },
  { tag: "{city}", label: "City", example: "Miami" },
  { tag: "{website}", label: "Website", example: "brightsmile.com" },
  { tag: "{link}", label: "Custom Link", example: "https://..." },
  { tag: "{amount}", label: "Amount", example: "$2,497" },
  { tag: "{date}", label: "Date", example: "April 14, 2026" },
  { tag: "{sender_name}", label: "Sender Name", example: "Your Name" },
  { tag: "{calendar_link}", label: "Calendar", example: "https://cal.com/..." },
];

export default function EmailComposerPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("compose");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [showHtml, setShowHtml] = useState(false);
  const [linkTracking, setLinkTracking] = useState(true);
  const [templateCategory, setTemplateCategory] = useState("all");
  const [showVarPanel, setShowVarPanel] = useState(false);
  const [showSubjectAI, setShowSubjectAI] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [scheduledTime, setScheduledTime] = useState("");

  const [email, setEmail] = useState({
    to: "",
    subject: "",
    body: "",
    fromName: "",
    fromEmail: "",
    replyTo: "",
  });
  // SMTP is the default — it's the recommended path (branded Resend send).
  // Gmail/Outlook require the user to have connected a personal OAuth account.
  const [provider, setProvider] = useState<"gmail" | "outlook" | "smtp">("smtp");

  // OAuth connection state for Gmail/Outlook — used to gate the send with a
  // "Connect X" CTA instead of silently failing.
  const [connectedProviders, setConnectedProviders] = useState<{
    gmail: boolean;
    outlook: boolean;
  }>({ gmail: false, outlook: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/social/connect", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const accounts: Array<{ platform?: string; is_active?: boolean }> = data?.accounts || [];
        const hasActive = (plat: string) =>
          accounts.some(a =>
            typeof a.platform === "string" &&
            a.platform.toLowerCase() === plat &&
            a.is_active !== false,
          );
        if (!cancelled) {
          setConnectedProviders({
            gmail: hasActive("gmail"),
            outlook: hasActive("outlook"),
          });
        }
      } catch {
        // Best-effort — if we can't resolve connection state we still show the
        // CTA (safer to prompt than to let a send silently fail).
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── AI state ── */
  const [showAiWrite, setShowAiWrite] = useState(false);
  const [aiWriting, setAiWriting] = useState(false);
  const [aiImproving, setAiImproving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMode, setAiMode] = useState<ComposeMode>("write");
  const [aiTone, setAiTone] = useState<ComposeTone>("professional");
  const [aiAudience, setAiAudience] = useState("");
  const [aiLength, setAiLength] = useState<"short" | "medium" | "long">("medium");

  const [showSubjectVariants, setShowSubjectVariants] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [subjectVariants, setSubjectVariants] = useState<SubjectVariant[]>([]);
  const [subjectIdeas, setSubjectIdeas] = useState<string[]>([]);

  /* ── Creation wizard ── */
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);

  /* ── Guided Mode ↔ Advanced Mode ── */
  const [advancedMode, setAdvancedMode] = useAdvancedMode("email-composer");
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedKind, setGuidedKind] = useState<"welcome" | "promo" | "follow-up" | "cold-outreach">("welcome");
  const [guidedAudience, setGuidedAudience] = useState("");
  const [guidedDirection, setGuidedDirection] = useState("");
  const [guidedGenerating, setGuidedGenerating] = useState(false);

  /* ── Send state ── */
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  async function handleSend(opts?: { testMode?: boolean }) {
    const testMode = opts?.testMode ?? false;
    const toAddress = email.to.trim();

    if (!toAddress) {
      toast.error("Add a recipient email first");
      return;
    }
    if (!isValidEmail(toAddress)) {
      toast.error("Recipient email looks invalid");
      return;
    }
    if (!email.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!email.body.trim()) {
      toast.error("Write a body first");
      return;
    }
    // Block sends via Gmail/Outlook when the user hasn't connected OAuth —
    // the API would accept the request but the personal-inbox path would
    // silently fall through to SMTP, which is surprising. Surface the real
    // missing step instead.
    if (provider === "gmail" && !connectedProviders.gmail) {
      toast.error("Connect Gmail first to send from your personal inbox");
      return;
    }
    if (provider === "outlook" && !connectedProviders.outlook) {
      toast.error("Connect Outlook first to send from your personal inbox");
      return;
    }
    const fromEmailTrimmed = email.fromEmail.trim();
    if (fromEmailTrimmed && !isValidEmail(fromEmailTrimmed)) {
      toast.error("From email looks invalid");
      return;
    }

    const setter = testMode ? setSendingTest : setSending;
    setter(true);
    try {
      const htmlBody = email.body.includes("<") && email.body.includes(">")
        ? email.body
        : `<div style="font-family:sans-serif;white-space:pre-wrap;">${email.body
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</div>`;

      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toAddress,
          subject: email.subject.trim(),
          body: htmlBody,
          provider,
          from_name: email.fromName.trim() || undefined,
          from_email: fromEmailTrimmed || undefined,
          reply_to: email.replyTo.trim() || undefined,
          test_mode: testMode,
        }),
      });

      let data: { success?: boolean; error?: string; subject?: string } = {};
      try {
        data = await res.json();
      } catch {
        // non-JSON response
      }

      if (!res.ok || data.success === false) {
        const msg = data.error || `Send failed (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }

      toast.success(testMode ? "Test email sent" : "Email sent");
      trackGeneration({
        category: "email",
        title: email.subject.slice(0, 120) || "Email sent",
        source_tool: "Email Composer",
        content_preview: email.body.slice(0, 200),
        metadata: { sent: true, provider, test: testMode },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error — email not sent");
    } finally {
      setter(false);
    }
  }

  async function handleAiCompose(mode: ComposeMode) {
    if (mode === "write" && !aiPrompt.trim()) {
      toast.error("Describe what you want to write");
      return;
    }
    if (mode !== "write" && !email.body.trim()) {
      toast.error("Write or paste email content first");
      return;
    }
    setAiWriting(true);
    try {
      const res = await fetch("/api/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt: aiPrompt.trim() || undefined,
          existing_email: mode === "write" ? undefined : email.body,
          tone: aiTone,
          audience: aiAudience.trim() || undefined,
          length: aiLength,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "AI write failed");
        return;
      }
      setEmail(prev => ({
        ...prev,
        // Only overwrite subject if the user hasn't typed one yet.
        // Preserves user-entered subjects from being silently replaced by AI.
        subject: prev.subject.trim() ? prev.subject : (data.subject || prev.subject),
        body: data.body || prev.body,
      }));
      const finalSubject = email.subject.trim() || data.subject || "";
      const finalBody = data.body || email.body;
      if (finalBody) {
        trackGeneration({
          category: "email",
          title: (finalSubject || aiPrompt.trim() || "Email draft").slice(0, 120),
          source_tool: "Email Composer",
          content_preview: String(finalBody).slice(0, 200),
          metadata: { mode, tone: aiTone, length: aiLength, ai: true },
        });
      }
      toast.success("Email generated");
      setShowAiWrite(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI write failed");
    } finally {
      setAiWriting(false);
    }
  }

  async function handleAiImprove() {
    if (!email.body.trim()) {
      toast.error("Write or paste email content first");
      return;
    }
    setAiImproving(true);
    try {
      const res = await fetch("/api/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "improve",
          existing_email: email.body,
          tone: aiTone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "AI improve failed");
        return;
      }
      setEmail(prev => ({
        ...prev,
        subject: prev.subject.trim() ? prev.subject : (data.subject || prev.subject),
        body: data.body || prev.body,
      }));
      const finalSubject = email.subject.trim() || data.subject || "";
      const finalBody = data.body || email.body;
      if (finalBody) {
        trackGeneration({
          category: "email",
          title: (finalSubject || "Improved email").slice(0, 120),
          source_tool: "Email Composer",
          content_preview: String(finalBody).slice(0, 200),
          metadata: { mode: "improve", tone: aiTone, ai: true },
        });
      }
      toast.success("Email improved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI improve failed");
    } finally {
      setAiImproving(false);
    }
  }

  async function handleSubjectIdeas() {
    if (!email.body.trim()) {
      toast.error("Write the email body first");
      return;
    }
    setShowSubjectAI(true);
    setLoadingVariants(true);
    setSubjectIdeas([]);
    try {
      const res = await fetch("/api/emails/subject-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: email.body, audience: aiAudience.trim() || undefined, count: 5 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't generate subjects");
        return;
      }
      const variants: SubjectVariant[] = data.variants || [];
      setSubjectIdeas(variants.map((v: SubjectVariant) => v.subject));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Subject ideas failed");
    } finally {
      setLoadingVariants(false);
    }
  }

  async function handleGenerateSubjectVariants() {
    if (!email.body.trim()) {
      toast.error("Write the email body first");
      return;
    }
    setShowSubjectVariants(true);
    setLoadingVariants(true);
    setSubjectVariants([]);
    try {
      const res = await fetch("/api/emails/subject-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: email.body, audience: aiAudience.trim() || undefined, count: 5 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't generate subjects");
        return;
      }
      setSubjectVariants(data.variants || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Subject variants failed");
    } finally {
      setLoadingVariants(false);
    }
  }

  const wordCount = email.body.split(/\s+/).filter(Boolean).length;
  const charCount = email.body.length;

  const spamChecks = [
    { rule: "No spam trigger words", pass: !email.body.toLowerCase().includes("free money") && !email.body.toLowerCase().includes("act now"), weight: 20 },
    { rule: "Subject line under 60 chars", pass: email.subject.length < 60 && email.subject.length > 0, weight: 15 },
    { rule: "Has personalization tags", pass: email.body.includes("{"), weight: 15 },
    { rule: "No excessive caps", pass: email.body === email.body || (email.body.replace(/[^A-Z]/g, "").length / email.body.length) < 0.3, weight: 10 },
    { rule: "Body length 50-300 words", pass: wordCount >= 50 && wordCount <= 300, weight: 10 },
    { rule: "Has clear CTA", pass: email.body.toLowerCase().includes("call") || email.body.toLowerCase().includes("chat") || email.body.toLowerCase().includes("link"), weight: 10 },
    { rule: "From name is set", pass: email.fromName.length > 0, weight: 10 },
    { rule: "Link tracking enabled", pass: linkTracking, weight: 5 },
    { rule: "Reply-to address set", pass: email.replyTo.length > 0, weight: 5 },
  ];
  const spamScore = spamChecks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);

  const filteredTemplates = TEMPLATE_GALLERY.filter(t =>
    templateCategory === "all" || t.category === templateCategory
  );

  /* ── Wizard steps ── */
  const GOAL_AUDIENCE_HINTS: Record<string, string> = {
    welcome: "New signups who created an account in the last 48 hours",
    newsletter: "Engaged subscribers who open at least 1 in 3 emails",
    launch: "Existing customers and warm leads interested in new releases",
    "abandoned-cart": "Shoppers who added items to cart but didn't check out",
    reengagement: "Users who haven't opened or logged in for 30+ days",
    promotional: "Deal-hunters and price-sensitive buyers in your list",
  };

  const wizardSteps: WizardStep[] = [
    {
      id: "goal",
      title: "What's the goal of this email?",
      description: "Pick the template that best matches what you want to say.",
      icon: <Mail size={16} />,
      field: {
        type: "chip-select",
        key: "goals",
        options: [
          { value: "welcome", label: "Welcome" },
          { value: "newsletter", label: "Newsletter" },
          { value: "launch", label: "Product launch" },
          { value: "abandoned-cart", label: "Abandoned cart" },
          { value: "reengagement", label: "Re-engagement" },
          { value: "promotional", label: "Promotional" },
        ],
      },
    },
    {
      id: "audience",
      title: "Who are you sending this to?",
      description: "Describe your audience so the AI can write in a voice they'll relate to.",
      icon: <Sparkles size={16} />,
      field: {
        type: "text",
        key: "audience",
        placeholder: "e.g., SaaS founders who signed up for a free trial",
      },
      aiHelper: {
        label: "Suggest audience from my CRM",
        onClick: async (d) => {
          try {
            // Try a CRM audiences endpoint if present
            const res = await fetch("/api/crm/audiences", { method: "GET" }).catch(() => null);
            if (res && res.ok) {
              const data = await res.json();
              const first = Array.isArray(data?.audiences) ? data.audiences[0] : data?.audience;
              const val = typeof first === "string" ? first : first?.description || first?.name;
              if (val) {
                toast.success("Audience suggested from CRM");
                return { audience: val };
              }
            }
            // Fallback: heuristic based on selected goal
            const goals = Array.isArray(d.goals) ? (d.goals as string[]) : [];
            const goal = goals[0] || "newsletter";
            const hint = GOAL_AUDIENCE_HINTS[goal];
            if (hint) {
              toast.success("Audience suggested");
              return { audience: hint };
            }
            toast.error("No audience data available");
            return {};
          } catch {
            toast.error("Couldn't load audience — unchanged");
            return {};
          }
        },
      },
    },
    {
      id: "subject",
      title: "Subject line",
      description: "Hook them in the inbox — or let AI draft one for you.",
      icon: <Type size={16} />,
      field: {
        type: "text",
        key: "subject",
        placeholder: "e.g., Your 14-day trial starts now",
      },
      aiHelper: {
        label: "Generate subject line",
        onClick: async (d) => {
          try {
            const goals = Array.isArray(d.goals) ? (d.goals as string[]) : [];
            const goal = goals[0] || "newsletter";
            const audience = typeof d.audience === "string" ? d.audience : "";
            const bodyDirection = typeof d.bodyDirection === "string" ? d.bodyDirection : "";

            // Prefer the subject-variants endpoint when we have body direction
            if (bodyDirection.trim()) {
              const res = await fetch("/api/emails/subject-variants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: bodyDirection, audience: audience || undefined, count: 3 }),
              });
              if (res.ok) {
                const data = await res.json();
                const first: SubjectVariant | undefined = Array.isArray(data?.variants) ? data.variants[0] : undefined;
                if (first?.subject) {
                  toast.success("Subject generated");
                  return { subject: first.subject };
                }
              }
            }
            // Fallback: use enhance-prompt
            const seed = `Write a single compelling email subject line (under 55 characters) for a ${goal} email${audience ? ` targeting ${audience}` : ""}. Return ONLY the subject line, no quotes, no prefix.`;
            const res = await fetch("/api/ai/enhance-prompt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: seed, type: "content" }),
            });
            if (!res.ok) {
              toast.error("Couldn't generate subject line");
              return {};
            }
            const data = await res.json();
            const subject = ((data?.enhanced as string | undefined) || "").split("\n")[0].trim().replace(/^["']|["']$/g, "");
            if (!subject) {
              toast.error("No subject returned");
              return {};
            }
            toast.success("Subject generated");
            return { subject };
          } catch {
            toast.error("Network error — subject unchanged");
            return {};
          }
        },
      },
    },
    {
      id: "bodyDirection",
      title: "What should the email say?",
      description: "A few bullet points are fine — the AI will write the full email for you.",
      icon: <Wand2 size={16} />,
      field: {
        type: "textarea",
        key: "bodyDirection",
        placeholder: "Key points to cover, the CTA, any must-include details...",
      },
      aiHelper: {
        label: "Draft the body",
        onClick: async (d) => {
          const direction = typeof d.bodyDirection === "string" ? d.bodyDirection.trim() : "";
          if (!direction) {
            toast.error("Add a short direction first (one line is fine)");
            return {};
          }
          try {
            const goals = Array.isArray(d.goals) ? (d.goals as string[]) : [];
            const goal = goals[0] || "newsletter";
            const audience = typeof d.audience === "string" ? d.audience : "";
            const prompt = `Write a ${goal} email. ${audience ? `Audience: ${audience}. ` : ""}Direction: ${direction}`;
            const res = await fetch("/api/emails/compose", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode: "write",
                prompt,
                tone: "professional",
                audience: audience || undefined,
                length: "medium",
              }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              toast.error(err?.error || "Couldn't draft the body");
              return {};
            }
            const data = await res.json();
            const body = (data?.body as string | undefined)?.trim();
            const subject = (data?.subject as string | undefined)?.trim();
            if (!body) {
              toast.error("No body returned");
              return {};
            }
            toast.success("Draft ready");
            // Merge subject only if user hasn't already set one
            const patch: Record<string, unknown> = { bodyDirection: body };
            if (subject && !(d.subject && String(d.subject).trim())) {
              patch.subject = subject;
            }
            return patch;
          } catch {
            toast.error("Network error — body unchanged");
            return {};
          }
        },
      },
    },
  ];

  async function handleWizardComplete(data: Record<string, unknown>) {
    const goals = Array.isArray(data.goals) ? (data.goals as string[]) : [];
    const goal = goals[0] || "newsletter";
    const audienceVal = typeof data.audience === "string" ? data.audience.trim() : "";
    const subject = typeof data.subject === "string" ? data.subject.trim() : "";
    const bodyDirection = typeof data.bodyDirection === "string" ? data.bodyDirection.trim() : "";

    if (!bodyDirection) {
      toast.error("Body direction or draft is required");
      return;
    }

    setWizardSubmitting(true);
    try {
      // If the body direction already looks like a written email (has greeting, multiple lines),
      // use it directly; otherwise, have the compose API generate the full email.
      const looksLikeDraft = bodyDirection.length > 300 && /\n/.test(bodyDirection);

      let finalSubject = subject;
      let finalBody = bodyDirection;

      if (!looksLikeDraft) {
        const prompt = `Write a ${goal} email. ${audienceVal ? `Audience: ${audienceVal}. ` : ""}Direction: ${bodyDirection}`;
        const res = await fetch("/api/emails/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "write",
            prompt,
            tone: "professional",
            audience: audienceVal || undefined,
            length: "medium",
          }),
        });
        if (res.ok) {
          const out = await res.json();
          if (out?.body) finalBody = out.body;
          if (!finalSubject && out?.subject) finalSubject = out.subject;
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err?.error || "Couldn't generate email — using your direction as the body");
        }
      }

      // If we still don't have a subject, quietly derive one
      if (!finalSubject) {
        finalSubject = bodyDirection.split("\n")[0].slice(0, 80);
      }

      setEmail(prev => ({
        ...prev,
        subject: finalSubject,
        body: finalBody,
      }));
      trackGeneration({
        category: "email",
        title: finalSubject.slice(0, 120) || "Email draft",
        source_tool: "Email Composer",
        content_preview: finalBody.slice(0, 200),
        metadata: { goal, audience: audienceVal || undefined, wizard: true },
      });
      if (audienceVal) setAiAudience(audienceVal);
      setActiveTab("compose");
      setWizardOpen(false);
      toast.success("Email ready in the composer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wizard failed");
    } finally {
      setWizardSubmitting(false);
    }
  }

  /* ─── Guided Mode: draft an email and drop it into the composer ─── */
  async function handleGuidedGenerate() {
    const direction = guidedDirection.trim();
    if (!direction) {
      toast.error("Tell us what the email should say");
      return;
    }
    setGuidedGenerating(true);
    try {
      const kindPhrase: Record<typeof guidedKind, string> = {
        welcome: "welcome",
        promo: "promotional",
        "follow-up": "follow-up",
        "cold-outreach": "cold outreach",
      };
      const prompt = `Write a ${kindPhrase[guidedKind]} email. ${
        guidedAudience.trim() ? `Audience: ${guidedAudience.trim()}. ` : ""
      }Direction: ${direction}`;
      const res = await fetch("/api/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "write",
          prompt,
          tone: guidedKind === "cold-outreach" ? "persuasive" : "professional",
          audience: guidedAudience.trim() || undefined,
          length: "medium",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "AI write failed");
        return;
      }
      const subject = (data.subject as string | undefined) || direction.split("\n")[0].slice(0, 80);
      const body = (data.body as string | undefined) || direction;
      setEmail(prev => ({
        ...prev,
        subject,
        body,
      }));
      if (guidedAudience.trim()) setAiAudience(guidedAudience.trim());
      trackGeneration({
        category: "email",
        title: subject.slice(0, 120) || "Email draft",
        source_tool: "Email Composer",
        content_preview: body.slice(0, 200),
        metadata: { kind: guidedKind, audience: guidedAudience.trim() || undefined, wizard: true, guided: true },
      });
      toast.success("Email ready in the composer");
      setAdvancedMode(true);
      setActiveTab("compose");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGuidedGenerating(false);
    }
  }

  /* ─── Guided steps ─── */
  const guidedSteps: WizardStepDef[] = [
    {
      id: "kind",
      title: "What kind of email?",
      description: "Different goals, different voices — we'll pick a tone that fits.",
      icon: <Mail size={18} />,
      component: (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {([
            { id: "welcome" as const, label: "Welcome", desc: "First hello for new signups" },
            { id: "promo" as const, label: "Promo", desc: "Offers, sales, limited time" },
            { id: "follow-up" as const, label: "Follow-up", desc: "Gentle nudge or check-in" },
            { id: "cold-outreach" as const, label: "Cold outreach", desc: "Breaking the ice" },
          ]).map(k => {
            const sel = guidedKind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setGuidedKind(k.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  sel
                    ? "border-gold bg-gold/10 shadow-lg shadow-gold/10"
                    : "border-border hover:border-gold/30 bg-surface-light"
                }`}
              >
                <p className="text-sm font-semibold">{k.label}</p>
                <p className="text-[10px] text-muted mt-1">{k.desc}</p>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      id: "audience-goal",
      title: "Who's it for + the goal",
      description: "A single line about the reader plus what you want them to do — AI takes it from there.",
      icon: <Users size={18} />,
      canProceed: guidedDirection.trim().length > 0,
      component: (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1.5 font-semibold">
              Audience <span className="text-muted/60 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={guidedAudience}
              onChange={e => setGuidedAudience(e.target.value)}
              placeholder="e.g., SaaS founders on a free trial"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1.5 font-semibold">
              What should it say? / CTA
            </label>
            <textarea
              value={guidedDirection}
              onChange={e => setGuidedDirection(e.target.value)}
              placeholder="Key points to cover, must-include details, what the reader should do next…"
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none"
              autoFocus
            />
          </div>
        </div>
      ),
    },
    {
      id: "review",
      title: "Ready to draft?",
      description: "We'll write the subject and body. You can tweak every line in Advanced mode before sending.",
      icon: <Wand2 size={18} />,
      component: (
        <div className="card bg-gold/[0.04] border-gold/20 space-y-2">
          <p className="text-sm">
            <span className="text-muted capitalize">{guidedKind} email</span>
            {guidedAudience.trim() && (
              <>
                {" · "}
                <span>for {guidedAudience.trim()}</span>
              </>
            )}
          </p>
          <p className="text-[11px] text-muted leading-relaxed whitespace-pre-wrap">
            {guidedDirection || <span className="italic">(no direction yet)</span>}
          </p>
        </div>
      ),
    },
  ];

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "compose", label: "Compose", icon: <Mail size={14} /> },
    { key: "templates", label: "Templates", icon: <Copy size={14} /> },
    { key: "preview", label: "Preview", icon: <Eye size={14} /> },
    { key: "spam-check", label: "Spam Check", icon: <AlertTriangle size={14} /> },
    { key: "scheduler", label: "Schedule", icon: <Calendar size={14} /> },
    { key: "signatures", label: "Signatures", icon: <Palette size={14} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Mail size={28} />}
        title="Email Composer"
        subtitle="Emails that open and convert. AI drafts subject lines, bodies, and send times."
        gradient="blue"
        actions={
          <>
            <AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />
            {advancedMode && (
              <>
                <button
                  onClick={() => setWizardOpen(true)}
                  className="relative group flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black shadow-lg shadow-gold/30 hover:shadow-gold/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Sparkles size={12} className="animate-pulse" />
                  New with AI
                  <span className="ml-1 text-[8px] uppercase bg-black/20 px-1.5 py-0.5 rounded-full font-semibold tracking-wide">Recommended</span>
                </button>
                <button
                  onClick={() => { setEmail({ to: "", subject: "", body: "", fromName: email.fromName, fromEmail: email.fromEmail, replyTo: email.replyTo }); setActiveTab("compose"); toast.success("Blank email ready"); }}
                  className="px-3 py-1.5 rounded-lg bg-transparent border border-white/20 text-white text-xs font-medium hover:bg-white/10 transition-all flex items-center gap-1.5"
                >
                  <Plus size={12} /> Blank
                </button>
                <button onClick={() => { setAiMode("write"); setShowAiWrite(true); }} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all flex items-center gap-1.5" disabled={aiWriting}>
                  {aiWriting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI Write
                </button>
                <button onClick={handleAiImprove} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all flex items-center gap-1.5" disabled={aiImproving}>
                  {aiImproving ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} AI Improve
                </button>
                <button onClick={handleGenerateSubjectVariants} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all flex items-center gap-1.5" disabled={loadingVariants}>
                  {loadingVariants ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12} />} Subject Variants
                </button>
                <button
                  onClick={() => handleSend()}
                  disabled={sending}
                  className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} {sending ? "Sending..." : "Send"}
                </button>
              </>
            )}
          </>
        }
      />

      {/* Guided Mode — 3-step AI email drafter */}
      {!advancedMode && (
        <Wizard
          steps={guidedSteps}
          activeIdx={guidedStep}
          onStepChange={setGuidedStep}
          finishLabel={guidedGenerating ? "Drafting…" : "Draft email"}
          busy={guidedGenerating}
          onFinish={handleGuidedGenerate}
          onCancel={() => setAdvancedMode(true)}
          cancelLabel="Advanced mode"
        />
      )}

      {/* Creation Wizard */}
      <CreationWizard
        open={wizardOpen}
        title="Compose Email with AI"
        subtitle="4 quick steps — AI handles subject + body"
        icon={<Mail size={18} />}
        submitLabel={wizardSubmitting ? "Generating..." : "Create Email"}
        steps={wizardSteps}
        initialData={{
          goals: [] as string[],
          audience: aiAudience,
          subject: email.subject,
          bodyDirection: email.body,
        }}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />

      {advancedMode && (<>
      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ===== COMPOSE TAB ===== */}
      {activeTab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            {/* Recipient + From */}
            <div className="card space-y-2">
              {/* Email Provider Selector */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-[9px] text-muted uppercase tracking-wider">Send via</label>
                  <span
                    className="inline-flex text-muted/70 hover:text-gold cursor-help"
                    title="SMTP = brand blasts, Gmail/Outlook = personal 1:1s"
                    aria-label="SMTP = brand blasts, Gmail/Outlook = personal 1:1s"
                  >
                    <Info size={10} />
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {([
                    { id: "smtp" as const, label: "SMTP", icon: <Mail size={12} /> },
                    { id: "gmail" as const, label: "Gmail", icon: <GmailIcon size={14} /> },
                    { id: "outlook" as const, label: "Outlook", icon: <OutlookIcon size={14} /> },
                  ]).map(p => (
                    <button key={p.id} onClick={() => setProvider(p.id)}
                      className={`flex-1 text-[10px] py-1.5 rounded-lg border capitalize transition-all flex items-center justify-center gap-1.5 ${
                        provider === p.id ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted"
                      }`}>
                      {p.icon} {p.label}
                      {p.id === "smtp" && (
                        <span className="ml-1 text-[7px] uppercase font-semibold tracking-wide px-1 py-px rounded bg-gold/20 text-gold border border-gold/30">
                          Recommended
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {/* Contextual help per provider — explains WHY you'd pick each one */}
                <p className="text-[9px] text-muted mt-1.5 leading-relaxed">
                  {provider === "smtp" && (
                    "Branded send via your verified domain. Best for most outreach. Tracking, webhooks, unlimited volume."
                  )}
                  {provider === "gmail" && (
                    "Send from your personal Gmail. Best for 1:1 personal replies. Requires Google OAuth connection."
                  )}
                  {provider === "outlook" && (
                    "Send from your personal Outlook. Best for 1:1 personal replies. Requires Microsoft OAuth connection."
                  )}
                </p>
                {/* OAuth-gating CTA — if Gmail/Outlook is picked but not connected,
                    show a "Connect" link to /dashboard/integrations instead of
                    letting the send silently fall through. */}
                {provider === "gmail" && !connectedProviders.gmail && (
                  <div className="mt-2 flex items-center justify-between gap-2 p-2 rounded-lg border border-amber-400/30 bg-amber-400/5">
                    <p className="text-[10px] text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle size={10} /> Gmail isn't connected yet — the send will fail.
                    </p>
                    <Link
                      href="/dashboard/integrations"
                      className="text-[10px] px-2 py-1 rounded-md bg-amber-400/15 border border-amber-400/30 text-amber-300 hover:bg-amber-400/25 transition-all font-semibold"
                    >
                      Connect Gmail
                    </Link>
                  </div>
                )}
                {provider === "outlook" && !connectedProviders.outlook && (
                  <div className="mt-2 flex items-center justify-between gap-2 p-2 rounded-lg border border-amber-400/30 bg-amber-400/5">
                    <p className="text-[10px] text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle size={10} /> Outlook isn't connected yet — the send will fail.
                    </p>
                    <Link
                      href="/dashboard/integrations"
                      className="text-[10px] px-2 py-1 rounded-md bg-amber-400/15 border border-amber-400/30 text-amber-300 hover:bg-amber-400/25 transition-all font-semibold"
                    >
                      Connect Outlook
                    </Link>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">To</label>
                  <input value={email.to} onChange={e => setEmail({ ...email, to: e.target.value })} className="input w-full text-xs" placeholder="Recipient email or select from list..." />
                </div>
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">From name</label>
                  <input
                    value={email.fromName}
                    onChange={e => setEmail({ ...email, fromName: e.target.value })}
                    className="input w-full text-xs"
                    placeholder="e.g. Nicklas at ShortStack"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">From email</label>
                  <input
                    type="email"
                    value={email.fromEmail}
                    onChange={e => setEmail({ ...email, fromEmail: e.target.value })}
                    className="input w-full text-xs"
                    placeholder="growth@yourdomain.com (uses verified domain if blank)"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Reply-To</label>
                  <input value={email.replyTo} onChange={e => setEmail({ ...email, replyTo: e.target.value })} className="input w-full text-xs" placeholder="replies@yourdomain.com" />
                </div>
              </div>
            </div>

            {/* Subject + AI Subject Line Generator */}
            <div className="relative">
              <input value={email.subject} onChange={e => setEmail({ ...email, subject: e.target.value })}
                className="input w-full text-sm font-medium pr-24" placeholder="Subject line..." />
              <button onClick={handleSubjectIdeas} disabled={loadingVariants}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20 transition-all flex items-center gap-1">
                {loadingVariants ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />} AI Ideas
              </button>
            </div>
            {showSubjectAI && (
              <div className="card border-gold/10 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-gold mb-2">AI Subject Line Suggestions</p>
                {loadingVariants && (
                  <div className="flex items-center gap-2 text-[9px] text-muted py-2">
                    <Loader2 size={10} className="animate-spin" /> Generating...
                  </div>
                )}
                {!loadingVariants && subjectIdeas.length === 0 && (
                  <p className="text-[9px] text-muted text-center py-2">No AI suggestions yet. Write the email body first.</p>
                )}
                {subjectIdeas.map((idea, i) => (
                  <button key={i} onClick={() => { setEmail({ ...email, subject: idea }); setShowSubjectAI(false); }}
                    className="block w-full text-left text-[10px] p-2 rounded hover:bg-gold/5 transition-all text-muted hover:text-foreground">
                    {idea}
                  </button>
                ))}
              </div>
            )}

            {/* Rich Text Toolbar */}
            <div className="flex items-center gap-1 p-1.5 rounded-lg bg-surface-light border border-border">
              {[
                { icon: <Bold size={12} />, label: "Bold" },
                { icon: <Italic size={12} />, label: "Italic" },
                { icon: <Link2 size={12} />, label: "Link" },
                { icon: <List size={12} />, label: "List" },
                { icon: <ImageIcon size={12} />, label: "Image" },
                { icon: <Type size={12} />, label: "Heading" },
              ].map(tool => (
                <button key={tool.label} className="p-2 rounded text-muted hover:text-foreground hover:bg-white/5 transition-colors" title={tool.label}>
                  {tool.icon}
                </button>
              ))}
              <div className="w-px h-4 bg-border mx-1" />
              <button onClick={() => setShowVarPanel(!showVarPanel)} className="p-2 rounded text-muted hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-1" title="Insert Variable">
                <Hash size={12} /> <span className="text-[9px]">Variables</span>
              </button>
              <div className="w-px h-4 bg-border mx-1" />
              <button onClick={() => setShowHtml(!showHtml)} className={`p-2 rounded transition-colors flex items-center gap-1 ${showHtml ? "text-gold bg-gold/10" : "text-muted hover:text-foreground hover:bg-white/5"}`}>
                <Code size={12} /> <span className="text-[9px]">HTML</span>
              </button>
              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-1 text-[9px] text-muted cursor-pointer">
                  <MousePointerClick size={9} />
                  <span>Link Tracking</span>
                  <button onClick={() => setLinkTracking(!linkTracking)}
                    className={`w-6 h-3 rounded-full ml-1 ${linkTracking ? "bg-gold" : "bg-surface"}`}>
                    <div className={`w-2.5 h-2.5 bg-white rounded-full mt-px ${linkTracking ? "ml-3" : "ml-0.5"}`} />
                  </button>
                </label>
              </div>
            </div>

            {/* Variable Insertion Panel */}
            {showVarPanel && (
              <div className="card border-gold/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-gold">Insert Variable</p>
                  <button onClick={() => setShowVarPanel(false)} className="text-muted hover:text-foreground"><X size={12} /></button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {VARIABLES.map(v => (
                    <button key={v.tag} onClick={() => setEmail(prev => ({ ...prev, body: prev.body + " " + v.tag }))}
                      className="text-left p-2 rounded bg-surface-light border border-border hover:border-gold/20 transition-all">
                      <p className="text-[9px] font-mono text-gold">{v.tag}</p>
                      <p className="text-[8px] text-muted">{v.label} ({v.example})</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Body Editor / HTML Source */}
            {showHtml ? (
              <textarea value={`<html><body><p>${email.body.replace(/\n/g, "</p><p>")}</p></body></html>`}
                className="input w-full text-xs font-mono leading-relaxed" style={{ minHeight: 300, resize: "vertical" }}
                readOnly />
            ) : (
              <textarea value={email.body} onChange={e => setEmail({ ...email, body: e.target.value })}
                className="input w-full text-sm leading-relaxed" style={{ minHeight: 300, resize: "vertical" }}
                placeholder="Write your email here..." />
            )}

            {/* Attachment Manager */}
            <div className="card p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold flex items-center gap-1.5"><Paperclip size={10} /> Attachments ({attachments.length})</p>
                <button onClick={() => setAttachments(prev => [...prev, `file_${prev.length + 1}.pdf`])}
                  className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20 flex items-center gap-1">
                  <Plus size={9} /> Add
                </button>
              </div>
              {attachments.length === 0 ? (
                <p className="text-[9px] text-muted text-center py-3">No attachments. Click Add to attach files.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-light border border-border text-[9px]">
                      <Paperclip size={9} className="text-muted" />
                      <span>{file}</span>
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-muted hover:text-red-400"><X size={8} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3 text-[10px] text-muted">
                <span>From: {email.fromName}</span>
                <span>{wordCount} words</span>
                <span>{charCount} chars</span>
                <span className={`flex items-center gap-1 ${spamScore >= 80 ? "text-green-400" : spamScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                  <AlertTriangle size={9} /> Spam score: {spamScore}/100
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    try {
                      const key = "email-composer-draft";
                      localStorage.setItem(key, JSON.stringify({ ...email, provider, savedAt: Date.now() }));
                      toast.success("Draft saved locally");
                    } catch {
                      toast.error("Couldn't save draft");
                    }
                  }}
                  className="btn-ghost text-xs flex items-center gap-1"
                >
                  <Save size={12} /> Draft
                </button>
                <button
                  onClick={() => handleSend({ testMode: true })}
                  disabled={sendingTest || sending}
                  className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sendingTest ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  {sendingTest ? "Sending..." : "Test Send"}
                </button>
                <button
                  onClick={() => handleSend()}
                  disabled={sending || sendingTest}
                  className="btn-primary text-xs flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            {/* Quick stats */}
            <div className="card">
              <h3 className="text-[10px] font-semibold mb-2 uppercase tracking-wider text-muted">Composer Stats</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className="text-sm font-bold text-gold">{wordCount}</p>
                  <p className="text-[8px] text-muted">Words</p>
                </div>
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className="text-sm font-bold">{VARIABLES.filter(v => email.body.includes(v.tag)).length}</p>
                  <p className="text-[8px] text-muted">Variables</p>
                </div>
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className="text-sm font-bold">{attachments.length}</p>
                  <p className="text-[8px] text-muted">Attachments</p>
                </div>
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className={`text-sm font-bold ${spamScore >= 80 ? "text-green-400" : "text-yellow-400"}`}>{spamScore}%</p>
                  <p className="text-[8px] text-muted">Spam Score</p>
                </div>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="card">
              <h3 className="text-[10px] font-semibold mb-2 uppercase tracking-wider text-muted">Quick Templates</h3>
              <div className="space-y-1">
                {TEMPLATE_GALLERY.length === 0 && (
                  <p className="text-[9px] text-muted text-center py-3">No templates yet.</p>
                )}
                {TEMPLATE_GALLERY.slice(0, 6).map(t => (
                  <button key={t.id} onClick={() => setEmail(prev => ({ ...prev, subject: t.subject, body: t.preview }))}
                    className="w-full text-left p-2 rounded-lg text-[10px] transition-all hover:bg-white/[0.03] border border-border">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-muted truncate">{t.subject}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TEMPLATE GALLERY ===== */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {["all", "Outreach", "Value", "Sales", "Onboarding", "Client", "Billing", "Retention", "Promo"].map(c => (
              <button key={c} onClick={() => setTemplateCategory(c)}
                className={`text-[10px] px-3 py-1.5 rounded-lg ${
                  templateCategory === c ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
                }`}>{c}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {filteredTemplates.length === 0 && (
              <div className="col-span-5 text-center py-12 text-muted text-xs">No templates yet.</div>
            )}
            {filteredTemplates.map(t => (
              <button key={t.id} onClick={() => { setEmail(prev => ({ ...prev, subject: t.subject, body: t.preview })); setActiveTab("compose"); }}
                className="text-left p-3 rounded-xl bg-surface-light border border-border hover:border-gold/10 transition-all">
                <p className="text-[10px] font-semibold">{t.name}</p>
                <p className="text-[9px] text-gold mt-0.5">{t.category}</p>
                <p className="text-[9px] text-muted mt-1 line-clamp-2">{t.subject}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== PREVIEW MODE ===== */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPreviewMode("desktop")}
              className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                previewMode === "desktop" ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
              }`}><Monitor size={12} /> Desktop</button>
            <button onClick={() => setPreviewMode("mobile")}
              className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                previewMode === "mobile" ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
              }`}><Smartphone size={12} /> Mobile</button>
          </div>
          <div className="flex justify-center">
            <div className={`bg-[#1a1c23] rounded-lg shadow-2xl overflow-hidden ${previewMode === "desktop" ? "w-full max-w-2xl" : "w-[375px]"}`}>
              <div className="bg-surface p-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] text-muted font-mono">Inbox</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm font-semibold text-white mb-1">{email.subject || "No subject"}</p>
                <p className="text-[10px] text-muted mb-4">From: {email.fromName} &lt;{email.fromEmail || email.replyTo}&gt;</p>
                <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                  {email.body.replace(/\{first_name\}/g, "John").replace(/\{business_name\}/g, "Bright Smile Dental").replace(/\{industry\}/g, "dental").replace(/\{company\}/g, "ShortStack").replace(/\{city\}/g, "Miami")}
                </div>
                {attachments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-[10px] text-muted mb-2">Attachments ({attachments.length})</p>
                    <div className="flex gap-2">
                      {attachments.map((f, i) => (
                        <div key={i} className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-[9px] text-muted">
                          <Paperclip size={8} /> {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SPAM SCORE CHECKER ===== */}
      {activeTab === "spam-check" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card text-center p-6">
              <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center mx-auto mb-3 ${
                spamScore >= 80 ? "border-green-400" : spamScore >= 50 ? "border-yellow-400" : "border-red-400"
              }`}>
                <div>
                  <p className={`text-3xl font-bold ${spamScore >= 80 ? "text-green-400" : spamScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>{spamScore}</p>
                  <p className="text-[9px] text-muted">/ 100</p>
                </div>
              </div>
              <h3 className="text-sm font-semibold">Spam Score</h3>
              <p className={`text-[10px] mt-1 ${spamScore >= 80 ? "text-green-400" : spamScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                {spamScore >= 80 ? "Excellent - Safe to send" : spamScore >= 50 ? "Fair - Review suggestions" : "Poor - High spam risk"}
              </p>
            </div>
            <div className="card col-span-1 lg:col-span-2">
              <h3 className="text-sm font-semibold mb-3">Deliverability Checklist</h3>
              <div className="space-y-2">
                {spamChecks.map((check, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-surface-light">
                    <div className="flex items-center gap-2 text-[10px]">
                      {check.pass ? <CheckCircle size={12} className="text-green-400" /> : <AlertTriangle size={12} className="text-red-400" />}
                      <span>{check.rule}</span>
                    </div>
                    <span className={`text-[9px] font-bold ${check.pass ? "text-green-400" : "text-red-400"}`}>
                      {check.pass ? `+${check.weight}` : `0/${check.weight}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SCHEDULE ===== */}
      {activeTab === "scheduler" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar size={14} className="text-gold" /> Schedule Send
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Date & Time</label>
                  <input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="input w-full text-xs" />
                </div>
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Timezone</label>
                  <select className="input w-full text-xs">
                    <option>America/New_York (ET)</option>
                    <option>America/Chicago (CT)</option>
                    <option>America/Los_Angeles (PT)</option>
                    <option>Europe/London (GMT)</option>
                    <option>Europe/Stockholm (CET)</option>
                  </select>
                </div>
                <button
                  onClick={() => {
                    if (!scheduledTime) {
                      toast.error("Pick a date & time first");
                      return;
                    }
                    if (!email.to.trim() || !email.subject.trim() || !email.body.trim()) {
                      toast.error("Fill recipient, subject, and body first");
                      return;
                    }
                    toast.success("Scheduling arrives soon — send now for instant delivery");
                  }}
                  className="btn-primary w-full text-xs flex items-center justify-center gap-1.5"
                >
                  <Clock size={12} /> Schedule Email
                </button>
              </div>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Optimal Send Times</h3>
              <p className="text-[10px] text-muted mb-3">Based on your audience engagement data</p>
              <div className="space-y-2">
                <p className="text-center text-[10px] text-muted py-4">No engagement data yet. Send times will be suggested once you have audience data.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== AI WRITE MODAL ===== */}
      <Modal isOpen={showAiWrite} onClose={() => setShowAiWrite(false)} title="Write Email with AI" size="lg">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">What should this email be about?</label>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={4}
              className="input w-full text-xs" placeholder="e.g. Follow up with a dental practice owner we called last week about a lead generation trial..." />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Tone</label>
              <select value={aiTone} onChange={e => setAiTone(e.target.value as ComposeTone)} className="input w-full text-xs">
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
                <option value="urgent">Urgent</option>
                <option value="persuasive">Persuasive</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Length</label>
              <select value={aiLength} onChange={e => setAiLength(e.target.value as "short" | "medium" | "long")} className="input w-full text-xs">
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Audience</label>
              <input value={aiAudience} onChange={e => setAiAudience(e.target.value)} className="input w-full text-xs" placeholder="e.g. SMB owners" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={() => setShowAiWrite(false)} className="btn-ghost text-xs">Cancel</button>
            <button onClick={() => handleAiCompose(aiMode)} disabled={aiWriting} className="btn-primary text-xs flex items-center gap-1.5">
              {aiWriting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== SUBJECT VARIANTS MODAL ===== */}
      <Modal isOpen={showSubjectVariants} onClose={() => setShowSubjectVariants(false)} title="Subject Line Variants (Ranked)" size="lg">
        <div className="space-y-2">
          {loadingVariants && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted py-8">
              <Loader2 size={14} className="animate-spin" /> Scoring variants...
            </div>
          )}
          {!loadingVariants && subjectVariants.length === 0 && (
            <p className="text-xs text-muted text-center py-8">No variants yet.</p>
          )}
          {!loadingVariants && subjectVariants.map((v, i) => (
            <button key={i} onClick={() => { setEmail({ ...email, subject: v.subject }); setShowSubjectVariants(false); toast.success("Subject applied"); }}
              className="block w-full text-left p-3 rounded-lg bg-surface-light border border-border hover:border-gold/30 transition-all">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{v.subject}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 font-bold">{v.predicted_open_rate.toFixed(0)}% open</span>
              </div>
              <p className="text-[10px] text-muted">{v.reason}</p>
            </button>
          ))}
        </div>
      </Modal>

      {/* ===== SIGNATURE BUILDER ===== */}
      {activeTab === "signatures" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Palette size={14} className="text-gold" /> Signature Builder
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card space-y-3">
              <h4 className="text-xs font-semibold">Edit Signature</h4>
              <input className="input w-full text-xs" placeholder="Full Name" defaultValue="" />
              <input className="input w-full text-xs" placeholder="Title" defaultValue="" />
              <input className="input w-full text-xs" placeholder="Phone" defaultValue="" />
              <input className="input w-full text-xs" placeholder="Email" defaultValue="" />
              <input className="input w-full text-xs" placeholder="Website" defaultValue="" />
              <input className="input w-full text-xs" placeholder="Calendar link" defaultValue="" />
              <button className="btn-primary w-full text-xs">Save Signature</button>
            </div>
            <div className="card">
              <h4 className="text-xs font-semibold mb-3">Preview</h4>
              <div className="p-4 rounded-lg bg-[#1a1c23]">
                <div className="border-t-2 border-amber-500 pt-3">
                  <p className="text-sm font-bold text-gray-500 italic">No signature configured</p>
                  <p className="text-[10px] text-gray-500">Fill in the fields to preview your signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
