import Link from "next/link";

export const metadata = {
  title: "Terms of Service — ShortStack",
  description: "The terms governing your use of the ShortStack platform.",
};

export default function TermsOfServicePage() {
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
          <h1 className="text-2xl font-bold text-[#111827] mb-1">Terms of Service</h1>
          <p className="text-xs text-[#6B7280]">Last updated: May 10, 2026</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-8 space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">1. Acceptance of Terms</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              By accessing or using ShortStack (&ldquo;the Service&rdquo;), you agree to be bound by
              these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, you may not use the
              Service. These Terms form a binding legal agreement between you and ShortStack Agency
              (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">2. The Service</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              ShortStack is a multi-tenant agency operating system that provides AI-powered tools for
              lead management, social media management, outreach automation, voice cloning, content
              creation, and client reporting. Features are gated by subscription tier and may change
              over time as we improve the platform.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">3. Account Registration</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              You must register an account to use ShortStack. You agree to provide accurate, current,
              and complete information and to keep it up to date. You are responsible for safeguarding
              your login credentials and for all activity under your account. Notify us immediately at{" "}
              <a href="mailto:growth@shortstack.work" className="text-[#D4FF00] hover:text-[#AACC00]">
                growth@shortstack.work
              </a>{" "}
              if you suspect unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">4. Subscription &amp; Billing</h2>
            <div className="space-y-2 text-sm text-[#374151] leading-relaxed">
              <p>
                Access to paid features requires a current subscription. Subscriptions are billed
                monthly or annually in advance via Stripe. All fees are non-refundable except where
                required by law or as explicitly stated in our refund policy.
              </p>
              <p>
                We reserve the right to change pricing with 30 days&apos; notice. Continued use of
                the Service after a price change constitutes acceptance of the new pricing. Failed
                payments will result in a grace period of 7 days before access is suspended.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">5. Acceptable Use</h2>
            <p className="text-sm text-[#374151] leading-relaxed mb-3">
              You agree not to use the Service to:
            </p>
            <ul className="space-y-1.5 text-sm text-[#374151] list-disc list-inside">
              <li>Send unsolicited commercial messages in violation of CAN-SPAM, TCPA, or GDPR</li>
              <li>Scrape, harvest, or collect data from third-party platforms without authorization</li>
              <li>Distribute malware, phishing content, or other harmful material</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation</li>
              <li>Reverse-engineer, decompile, or extract our proprietary source code</li>
              <li>Resell or sublicense access to the Service without written permission</li>
              <li>Engage in any activity that violates applicable federal, state, or local law</li>
            </ul>
            <p className="mt-3 text-sm text-[#374151]">
              Violation of this section may result in immediate termination of your account without refund.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">6. AI-Generated Content</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              The Service uses AI models (Anthropic Claude, OpenAI) to generate content on your behalf.
              You are solely responsible for reviewing, editing, and approving all AI-generated content
              before it is sent, posted, or used. We do not warrant that AI-generated content is accurate,
              complete, or suitable for any particular purpose. You own the output of AI generation for
              content you initiate, subject to the terms of the underlying model providers.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">7. Voice Cloning &amp; Audio</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              By uploading a voice sample, you confirm you have the legal right to use that voice for
              commercial purposes and have obtained any required consent. Cloning another person&apos;s
              voice without their consent is prohibited and may constitute a violation of applicable
              law. We reserve the right to remove voice profiles that appear to violate this section.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">8. Data &amp; Privacy</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              Your use of the Service is subject to our{" "}
              <Link href="/legal/privacy" className="text-[#D4FF00] hover:text-[#AACC00]">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference. You are responsible for ensuring
              that any personal data you process through the Service is handled in compliance with
              applicable data protection law, including the GDPR where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">9. Intellectual Property</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              ShortStack and its licensors own all rights, title, and interest in the Service,
              including all software, designs, trademarks, and documentation. You retain ownership
              of content you upload. By uploading content, you grant us a limited license to process
              and display it for the purpose of providing the Service.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">10. Social Media Integrations</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              When you connect third-party social media platforms, you agree to the terms of those
              platforms in addition to these Terms. We are not responsible for platform policy changes,
              API deprecations, or enforcement actions by third-party platforms. We will make reasonable
              efforts to notify you of material changes to our integration capabilities.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">11. Disclaimer of Warranties</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
              IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
              WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">12. Limitation of Liability</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SHORTSTACK WILL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
              REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR YOUR
              USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS WILL NOT EXCEED THE AMOUNT YOU PAID US IN
              THE 12 MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">13. Termination</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              You may cancel your account at any time from the Settings page. We reserve the right
              to suspend or terminate your account for violation of these Terms, non-payment, or
              activity that poses risk to the Service or other users. Upon termination, your access
              to the Service will cease and your data will be deleted per our retention policy.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">14. Changes to Terms</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              We may update these Terms from time to time. We will notify you of material changes by
              email or in-app notice at least 14 days before the changes take effect. Continued use
              of the Service after the effective date constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">15. Governing Law</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              These Terms are governed by the laws of the State of Delaware, without regard to its
              conflict of law provisions. Any disputes arising under these Terms will be resolved
              through binding arbitration or in the courts of competent jurisdiction in Delaware.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#111827] mb-3">16. Contact</h2>
            <p className="text-sm text-[#374151] leading-relaxed">
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:growth@shortstack.work" className="text-[#D4FF00] hover:text-[#AACC00]">
                growth@shortstack.work
              </a>
              .
            </p>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-8 pt-6 border-t border-[rgba(0,0,0,0.06)] flex flex-wrap gap-5 text-xs text-[#6B7280]">
          <Link href="/legal/privacy" className="hover:text-[#D4FF00] transition-colors">Privacy Policy</Link>
          <span className="font-medium text-[#111827]">Terms of Service</span>
          <Link href="/legal/cookies" className="hover:text-[#D4FF00] transition-colors">Cookie Policy</Link>
        </div>
        <p className="mt-4 text-[10px] text-text-muted">ShortStack Agency &middot; shortstack.work</p>
      </div>
    </div>
  );
}
