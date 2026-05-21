import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — ShortStack",
  description: "How ShortStack collects, uses, and protects your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#F3F6FA] py-16 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#D4FF00] mb-8 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M7.5 9L4.5 6l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-[#111827] mb-1">Privacy Policy</h1>
          <p className="text-xs text-[#6B7280]">Last updated: May 10, 2026</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-8 space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">1. Information We Collect</h2>
            <div className="space-y-2 text-sm text-[#374151] leading-relaxed">
              <p>
                <strong className="text-[#111827]">Account Data:</strong> Name, email, password (encrypted),
                business information, and role when you register.
              </p>
              <p>
                <strong className="text-[#111827]">Usage Data:</strong> Pages visited, features used,
                interactions with AI tools, and performance metrics to improve the Service.
              </p>
              <p>
                <strong className="text-[#111827]">Social Media Data:</strong> When you connect social
                accounts, we access account info, content, and analytics strictly as authorized by you
                during the OAuth flow.
              </p>
              <p>
                <strong className="text-[#111827]">Lead Data:</strong> Business information sourced from
                public directories (Google Maps, public websites) at your direction.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">2. How We Use Your Information</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              We use your data to provide and improve the Service, generate AI-powered content and
              recommendations, manage social media on your behalf, send outreach messages you authorize,
              generate reports and analytics, and communicate with you about your account.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">3. Data Storage &amp; Security</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              Data is stored in Supabase (PostgreSQL) with encryption at rest and in transit. Social media
              tokens are stored securely with automatic expiry. Passwords are hashed with bcrypt and never
              stored in plain text. We use HTTPS for all data transmission and enforce row-level security
              to ensure tenant isolation.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">4. AI Processing</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              Content you input may be processed by third-party AI services (Anthropic Claude, OpenAI)
              to generate scripts, recommendations, and other outputs. We do not use your data to train
              AI models. AI-generated content is not stored by third-party providers beyond the request
              lifecycle.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">5. Social Media Permissions</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              When you connect social accounts via OAuth, we only request the permissions needed to
              manage your authorized accounts. You can revoke access at any time from the Integrations
              page or directly from the platform. DM outreach requires explicit opt-in and is disabled
              by default.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">6. Data Sharing</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              We do not sell your data. We share data only with: payment processors (Stripe) for billing,
              AI providers for content generation, social media platforms you authorize, and as required
              by applicable law or legal process.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">7. Your Rights</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              You may: access your personal data, request correction or deletion, export your data,
              revoke social media connections, opt out of AI-powered outreach, and update your privacy
              settings at any time from your account portal. To exercise any of these rights, contact
              us at{" "}
              <a href="mailto:growth@shortstack.work" className="text-[#D4FF00] hover:text-[#AACC00]">
                growth@shortstack.work
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">8. Cookies</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              We use essential cookies for authentication and preferences. We do not use tracking or
              advertising cookies. See our{" "}
              <Link href="/legal/cookies" className="text-[#D4FF00] hover:text-[#AACC00]">
                Cookie Policy
              </Link>{" "}
              for the full list and details.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">9. Data Retention</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              Account data is retained while your account is active. Upon deletion request, personal
              data is removed within 30 days. Anonymized analytics may be retained for service
              improvement purposes.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">10. Contact</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              For privacy questions or data requests, contact{" "}
              <a href="mailto:growth@shortstack.work" className="text-[#D4FF00] hover:text-[#AACC00]">
                growth@shortstack.work
              </a>
              .
            </p>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-8 pt-6 border-t border-[rgba(0,0,0,0.06)] flex flex-wrap gap-5 text-xs text-[#6B7280]">
          <span className="font-medium text-[#111827]">Privacy Policy</span>
          <Link href="/legal/terms" className="hover:text-[#D4FF00] transition-colors">Terms of Service</Link>
          <Link href="/legal/cookies" className="hover:text-[#D4FF00] transition-colors">Cookie Policy</Link>
        </div>
        <p className="mt-4 text-[10px] text-text-muted">ShortStack Agency &middot; shortstack.work</p>
      </div>
    </div>
  );
}
