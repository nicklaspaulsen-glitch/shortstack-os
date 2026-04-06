import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-mesh py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-xs text-gold hover:text-gold-light mb-8 inline-block">Back to Dashboard</Link>
        <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-xs text-muted mb-8">Last updated: April 6, 2026</p>

        <div className="space-y-6 text-sm text-muted leading-relaxed">
          <section>
            <h2 className="text-sm font-semibold text-white mb-2">1. Information We Collect</h2>
            <p><strong className="text-white">Account Data:</strong> Name, email, password (encrypted), business information, and role.</p>
            <p className="mt-1"><strong className="text-white">Usage Data:</strong> Pages visited, features used, interactions with AI tools, and performance metrics.</p>
            <p className="mt-1"><strong className="text-white">Social Media Data:</strong> When you connect social accounts, we access account info, content, and analytics as authorized by you.</p>
            <p className="mt-1"><strong className="text-white">Lead Data:</strong> Business information scraped from public sources (Google Maps, public websites).</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white mb-2">2. How We Use Your Information</h2>
            <p>We use your data to: provide and improve the Service, generate AI-powered content and recommendations, manage social media on your behalf, send outreach messages you authorize, generate reports and analytics, and communicate with you about your account.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white mb-2">3. Data Storage & Security</h2>
            <p>Data is stored in Supabase (PostgreSQL) with encryption at rest. Social media tokens are stored securely and expire after 60 days. We use HTTPS for all data transmission. Passwords are hashed and never stored in plain text.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white mb-2">4. AI Processing</h2>
            <p>Content you input may be processed by third-party AI services (Anthropic Claude, OpenAI) to generate scripts, recommendations, and other outputs. We do not use your data to train AI models. AI-generated content is not stored by third-party providers beyond the request lifecycle.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white mb-2">5. Social Media Permissions</h2>
            <p>When you connect social accounts via OAuth, we only request permissions needed to manage your accounts. You can revoke access at any time from the Socials page or directly from the platform. DM outreach requires explicit opt-in and is off by default.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white mb-2">6. Data Sharing</h2>
            <p>We do not sell your data. We share data only with: payment processors (Stripe) for billing, AI providers for content generation, social media platforms you authorize, and as required by law.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white mb-2">7. Your Rights</h2>
            <p>You can: access your data, request deletion of your account and data, export your data, revoke social media connections, opt out of AI-powered outreach, and update your privacy settings at any time from your portal.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white mb-2">8. Cookies</h2>
            <p>We use essential cookies for authentication and preferences (theme, sound settings). We do not use tracking cookies or third-party advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white mb-2">9. Data Retention</h2>
            <p>Account data is retained while your account is active. Upon deletion request, data is removed within 30 days. Anonymized analytics may be retained for service improvement.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white mb-2">10. Contact</h2>
            <p>For privacy questions or data requests, contact growth@shortstack.work.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border/20 text-center">
          <p className="text-[10px] text-muted">ShortStack Agency | shortstack.work</p>
        </div>
      </div>
    </div>
  );
}
