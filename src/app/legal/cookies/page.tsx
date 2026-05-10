import Link from "next/link";

export const metadata = {
  title: "Cookie Policy — ShortStack",
  description: "What cookies ShortStack uses and why.",
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[#F3F6FA] py-16 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#2563EB] mb-8 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M7.5 9L4.5 6l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-[#111827] mb-1">Cookie Policy</h1>
          <p className="text-xs text-[#6B7280]">Last updated: May 10, 2026</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-8 space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">1. What Are Cookies</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              Cookies are small text files stored on your device when you visit a website. They help
              the site remember your preferences and improve your experience across sessions. We use
              cookies and similar technologies (such as localStorage) to operate the ShortStack platform.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">2. Cookies We Use</h2>
            <p className="text-sm text-[#374151] leading-relaxed mb-4">
              ShortStack uses only <strong className="text-[#111827]">essential cookies</strong>. We do
              not use advertising, tracking, or analytics cookies.
            </p>

            <div className="overflow-x-auto rounded-lg border border-[rgba(0,0,0,0.08)]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-4 text-[#111827] font-medium">Cookie / Storage Key</th>
                    <th className="text-left py-2.5 px-4 text-[#111827] font-medium">Purpose</th>
                    <th className="text-left py-2.5 px-4 text-[#111827] font-medium whitespace-nowrap">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(0,0,0,0.05)]">
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-[#2563EB]">sb-*-auth-token</td>
                    <td className="py-2.5 px-4 text-[#374151]">Supabase authentication — keeps you logged in</td>
                    <td className="py-2.5 px-4 text-[#6B7280] whitespace-nowrap">1 hr (auto-refreshed)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-[#2563EB]">cookie-consent</td>
                    <td className="py-2.5 px-4 text-[#374151]">Records acknowledgement of this notice</td>
                    <td className="py-2.5 px-4 text-[#6B7280] whitespace-nowrap">Persistent (localStorage)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-[#2563EB]">tour_completed</td>
                    <td className="py-2.5 px-4 text-[#374151]">Remembers whether you finished the onboarding tour</td>
                    <td className="py-2.5 px-4 text-[#6B7280] whitespace-nowrap">Persistent (localStorage)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-[#2563EB]">advanced-mode-*</td>
                    <td className="py-2.5 px-4 text-[#374151]">Saves your advanced vs. guided wizard preference per page</td>
                    <td className="py-2.5 px-4 text-[#6B7280] whitespace-nowrap">Persistent (localStorage)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-[#2563EB]">sidebar-*</td>
                    <td className="py-2.5 px-4 text-[#374151]">Saves sidebar collapse / expand state</td>
                    <td className="py-2.5 px-4 text-[#6B7280] whitespace-nowrap">Persistent (localStorage)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">3. Third-Party Services</h2>
            <p className="text-sm text-[#374151] leading-relaxed mb-3">
              The following third-party services may set their own cookies or use similar technologies
              as part of their operation:
            </p>
            <ul className="space-y-2 text-sm text-[#374151]">
              <li>
                <strong className="text-[#111827]">Supabase</strong> — authentication and database.
                Session cookies are scoped to our domain.
              </li>
              <li>
                <strong className="text-[#111827]">Stripe</strong> — payment processing. Stripe may
                set cookies on checkout pages to prevent fraud.
              </li>
              <li>
                <strong className="text-[#111827]">Vercel</strong> — hosting infrastructure. Edge
                cache tokens may be set for performance.
              </li>
            </ul>
            <p className="mt-3 text-sm text-[#374151]">
              We do <strong className="text-[#111827]">not</strong> use Google Analytics, Meta Pixel,
              HubSpot, Intercom, or any advertising network cookies.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">4. Managing Your Cookies</h2>
            <p className="text-sm text-[#374151] leading-relaxed mb-3">
              Because we only use essential cookies, disabling them will prevent ShortStack from working
              correctly. You can manage cookies through your browser settings:
            </p>
            <ul className="space-y-1.5 text-sm text-[#374151]">
              <li><strong className="text-[#111827]">Chrome:</strong> Settings &rarr; Privacy and security &rarr; Cookies and other site data</li>
              <li><strong className="text-[#111827]">Firefox:</strong> Settings &rarr; Privacy &amp; Security &rarr; Cookies and Site Data</li>
              <li><strong className="text-[#111827]">Safari:</strong> Preferences &rarr; Privacy &rarr; Manage Website Data</li>
              <li><strong className="text-[#111827]">Edge:</strong> Settings &rarr; Cookies and site permissions &rarr; Cookies and site data</li>
            </ul>
            <p className="mt-3 text-sm text-[#374151]">
              You can also clear localStorage via your browser&apos;s developer tools
              (Application &rarr; Storage &rarr; Clear site data).
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">5. Changes to This Policy</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              We may update this cookie policy when we add new features or integrations. The
              &ldquo;Last updated&rdquo; date at the top reflects when the policy was last revised.
              Continued use of ShortStack after any changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">6. Contact</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              Questions about our cookie use? Email{" "}
              <a href="mailto:growth@shortstack.work" className="text-[#2563EB] hover:text-[#1D4ED8]">
                growth@shortstack.work
              </a>{" "}
              or see our{" "}
              <Link href="/legal/privacy" className="text-[#2563EB] hover:text-[#1D4ED8]">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-8 pt-6 border-t border-[rgba(0,0,0,0.06)] flex flex-wrap gap-5 text-xs text-[#6B7280]">
          <Link href="/legal/privacy" className="hover:text-[#2563EB] transition-colors">Privacy Policy</Link>
          <Link href="/legal/terms" className="hover:text-[#2563EB] transition-colors">Terms of Service</Link>
          <span className="font-medium text-[#111827]">Cookie Policy</span>
        </div>
        <p className="mt-4 text-[10px] text-[#9CA3AF]">ShortStack Agency &middot; shortstack.work</p>
      </div>
    </div>
  );
}
