import Link from "next/link";

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#070708] py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-xs text-[#6366F1] hover:text-[#A78BFA] mb-8 inline-block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground mb-2">Cookie Policy</h1>
        <p className="text-xs text-muted mb-8">Last updated: May 7, 2026</p>

        <div className="space-y-6 text-sm text-muted leading-relaxed">
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">1. What Are Cookies</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. They help the site
              remember your preferences and improve your experience across sessions. We use cookies and similar
              technologies (such as localStorage) to operate the ShortStack platform.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">2. Cookies We Use</h2>
            <p className="mb-3">ShortStack uses only <strong className="text-foreground">essential cookies</strong>. We do not use advertising, tracking, or analytics cookies.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-foreground font-medium">Cookie / Storage Key</th>
                    <th className="text-left py-2 pr-4 text-foreground font-medium">Purpose</th>
                    <th className="text-left py-2 text-foreground font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-2 pr-4 font-mono text-[#A78BFA]">sb-*-auth-token</td>
                    <td className="py-2 pr-4">Supabase authentication session — keeps you logged in</td>
                    <td className="py-2">1 hour (refreshed automatically)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-[#A78BFA]">cookie-consent</td>
                    <td className="py-2 pr-4">Records that you acknowledged this cookie notice</td>
                    <td className="py-2">Persistent (localStorage)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-[#A78BFA]">tour_completed</td>
                    <td className="py-2 pr-4">Remembers whether you completed the onboarding tour</td>
                    <td className="py-2">Persistent (localStorage)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-[#A78BFA]">advanced-mode-*</td>
                    <td className="py-2 pr-4">Saves your preference for advanced vs. guided wizard mode per page</td>
                    <td className="py-2">Persistent (localStorage)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-[#A78BFA]">sidebar-*</td>
                    <td className="py-2 pr-4">Saves sidebar collapse / expand state</td>
                    <td className="py-2">Persistent (localStorage)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">3. Third-Party Services</h2>
            <p className="mb-2">
              We use the following third-party services that may set their own cookies or use similar technologies
              as part of their operation:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-foreground">Supabase</strong> — authentication and database. Session cookies are scoped to our domain.</li>
              <li><strong className="text-foreground">Stripe</strong> — payment processing. Stripe may set cookies on our checkout pages to prevent fraud.</li>
              <li><strong className="text-foreground">Vercel</strong> — hosting infrastructure. Edge cache tokens may be set for performance.</li>
            </ul>
            <p className="mt-2">
              We do <strong className="text-foreground">not</strong> use Google Analytics, Meta Pixel, HubSpot,
              Intercom, or any advertising network cookies.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">4. Managing Your Cookies</h2>
            <p className="mb-2">
              Because we only use essential cookies, disabling them will prevent ShortStack from working correctly.
              You can manage cookies through your browser settings:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-foreground">Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
              <li><strong className="text-foreground">Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
              <li><strong className="text-foreground">Safari:</strong> Preferences → Privacy → Manage Website Data</li>
              <li><strong className="text-foreground">Edge:</strong> Settings → Cookies and site permissions → Cookies and site data</li>
            </ul>
            <p className="mt-2">
              You can also clear localStorage and session cookies by using your browser&apos;s developer tools
              (Application → Storage → Clear site data).
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">5. Changes to This Policy</h2>
            <p>
              We may update this cookie policy when we add new features or integrations. The &quot;Last updated&quot;
              date at the top of this page reflects when the policy was last changed. Continued use of ShortStack
              after any changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">6. Contact</h2>
            <p>
              Questions about our cookie use? Email{" "}
              <a href="mailto:privacy@shortstack.work" className="text-[#6366F1] hover:text-[#A78BFA]">
                privacy@shortstack.work
              </a>
              {" "}or visit our{" "}
              <Link href="/privacy" className="text-[#6366F1] hover:text-[#A78BFA]">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex gap-6 text-xs text-muted">
          <Link href="/privacy" className="hover:text-[#6366F1]">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-[#6366F1]">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}
