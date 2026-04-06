import Link from "next/link";

const RELEASES = [
  {
    version: "1.2.0",
    date: "April 6, 2026",
    tag: "Latest",
    changes: [
      { type: "new", text: "Script Lab — advanced AI script generator with 6 frameworks (PAS, AIDA, Hook-Story-Offer, etc)" },
      { type: "new", text: "Viral Content Research — analyze competitor videos, find patterns, identify opportunities" },
      { type: "new", text: "AI Social Media Manager with autopilot mode" },
      { type: "new", text: "Analytics Dashboard with 6 interactive charts (leads, revenue, sources, industries, outreach)" },
      { type: "new", text: "Outreach Logs — full visibility into every DM, email, and call" },
      { type: "new", text: "AI Insights Engine — auto-generates 6 personalized recommendations per client" },
      { type: "new", text: "DM Automations — 8 ManyChat-style templates (welcome, comment-to-DM, lead capture, promos)" },
      { type: "new", text: "Proposal Generator — AI writes branded PDF proposals for prospects" },
      { type: "new", text: "Email Cold Outreach — AI-personalized emails sent through GHL" },
      { type: "new", text: "GHL Cold Calling integration" },
      { type: "new", text: "Instagram Comment-to-DM automation (Meta API compliant)" },
      { type: "new", text: "Review Management with AI response suggestions" },
      { type: "new", text: "Email Templates — 8 pre-built templates for client communication" },
      { type: "new", text: "Competitor Spy Tool — AI analyzes competitor social, SEO, ads, content" },
      { type: "new", text: "White-Label Settings — custom branding per client" },
      { type: "new", text: "Content Calendar with AI-powered 30-day planning" },
      { type: "new", text: "Client self-onboarding form (replaces empty state)" },
      { type: "new", text: "Notifications bell with real-time Supabase subscriptions" },
      { type: "new", text: "Weekly Client Reports — auto-generated PDF with AI summary" },
      { type: "new", text: "Stripe invoice payments — clients pay from portal" },
      { type: "new", text: "Webhook triggers for Zapier/Make.com" },
      { type: "new", text: "4 theme colors: Midnight, Light, Ocean, Ember" },
      { type: "new", text: "Demo mode with sample data for prospects" },
      { type: "new", text: "Onboarding tour — 6-step guided walkthrough" },
      { type: "new", text: "Midjourney prompt generator for thumbnails, ads, graphics" },
      { type: "improved", text: "ElevenLabs AI voice for Trinity (natural human voice)" },
      { type: "improved", text: "Soothing SFX — water drops, wind chimes, soft tones" },
      { type: "improved", text: "Compact sidebar with grouped sections" },
      { type: "improved", text: "Full mobile responsive layout" },
      { type: "improved", text: "Loading skeletons instead of spinners" },
      { type: "improved", text: "Error boundaries catch React crashes gracefully" },
      { type: "fixed", text: "Health monitor: auth errors show as 'credentials need refresh' not 'down'" },
      { type: "fixed", text: "Middleware no longer blocks TTS, OAuth, license endpoints" },
      { type: "fixed", text: "Vercel build compatibility (iterator, type errors)" },
    ],
  },
  {
    version: "1.1.0",
    date: "April 6, 2026",
    changes: [
      { type: "new", text: "License system with Stripe + Supabase validation" },
      { type: "new", text: "AI Workflow Agent — conversational automation builder" },
      { type: "new", text: "Auto-update notification system in Electron" },
      { type: "new", text: "Admin profile switcher (view as / manage / create login)" },
      { type: "new", text: "Client privacy settings (DM outreach opt-in)" },
      { type: "new", text: "Full client portal: Overview, Content, Calendar, Reports, Billing, Support, Settings" },
      { type: "new", text: "Social account OAuth connection (Meta, TikTok, Google, LinkedIn)" },
      { type: "new", text: "9 AI Service Agents matching shortstack.work services" },
      { type: "new", text: "500-lead test scraper endpoint" },
      { type: "improved", text: "Premium login page with password reset + eye toggle" },
      { type: "fixed", text: "System health false alarms — unconfigured integrations hidden" },
      { type: "fixed", text: "Supabase email confirmation bypassed (auto-confirm on signup)" },
    ],
  },
  {
    version: "1.0.0",
    date: "April 6, 2026",
    changes: [
      { type: "new", text: "UI redesign — dark navy theme, gradients, compact layout" },
      { type: "new", text: "Electron desktop app with license activation" },
      { type: "new", text: "Stripe products: Starter $997, Growth $2,497, Enterprise $4,997" },
      { type: "new", text: "100+ API endpoints, 15 dashboard pages" },
      { type: "new", text: "Trinity AI voice assistant" },
      { type: "new", text: "Lead scraper (Google Places + Facebook)" },
      { type: "new", text: "Lead engine with DM outreach controls" },
      { type: "new", text: "Client management with contracts + invoicing" },
      { type: "new", text: "Content AI with PDF script generation" },
      { type: "new", text: "System health monitor for 20 integrations" },
    ],
  },
];

const TYPE_COLORS: Record<string, string> = {
  new: "bg-success/10 text-success",
  improved: "bg-accent/10 text-accent",
  fixed: "bg-warning/10 text-warning",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-mesh py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-xs text-gold hover:text-gold-light mb-8 inline-block">Back to Dashboard</Link>
        <h1 className="text-2xl font-bold text-white mb-1">Changelog</h1>
        <p className="text-xs text-muted mb-8">Everything new in ShortStack OS</p>

        <div className="space-y-8">
          {RELEASES.map((release, i) => (
            <div key={i} className="relative">
              {/* Version header */}
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-lg font-bold text-gold">v{release.version}</h2>
                {release.tag && (
                  <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-medium">{release.tag}</span>
                )}
                <span className="text-xs text-muted">{release.date}</span>
              </div>

              {/* Changes */}
              <div className="space-y-1.5 pl-4 border-l-2 border-border/30">
                {release.changes.map((change, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 mt-0.5 ${TYPE_COLORS[change.type]}`}>
                      {change.type}
                    </span>
                    <p className="text-xs text-muted">{change.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border/20 text-center">
          <p className="text-[10px] text-muted">ShortStack OS | shortstack.work</p>
        </div>
      </div>
    </div>
  );
}
