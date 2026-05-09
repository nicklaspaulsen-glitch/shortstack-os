import type { Metadata } from "next";
import AnimatedFeatureGrid from "@/components/landing/animated-feature-grid";
import FAQ from "@/components/landing/faq";
import FeaturesOverview from "@/components/landing/features-overview";
import FinalCTA from "@/components/landing/final-cta";
import Hero from "@/components/landing/hero";
import HowItWorks from "@/components/landing/how-it-works";
import Integrations from "@/components/landing/integrations";
import LandingFooter from "@/components/landing/landing-footer";
import LandingNav from "@/components/landing/landing-nav";
import OriginStory from "@/components/landing/origin-story";
import PainPoints from "@/components/landing/pain-points";
import PricingPreview from "@/components/landing/pricing-preview";
import ReplaceStack from "@/components/landing/replace-stack";
import ScreenshotCarousel from "@/components/landing/screenshot-carousel";
import Testimonials from "@/components/landing/testimonials";
import TrustBar from "@/components/landing/trust-bar";
import WhoItsFor from "@/components/landing/who-its-for";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

export const metadata: Metadata = {
  title: "Trinity — the AI operating system for agencies — ShortStack",
  description: "Scrape leads, automate outreach, manage clients, create content, and scale revenue — all from one AI-powered agency operating system built for modern teams.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    url: SITE_URL,
    title: "Trinity — the AI operating system for agencies — ShortStack",
    description: "Scrape leads, automate outreach, manage clients, create content, and scale revenue — all from one AI-powered agency operating system.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ShortStack — Agency Operating System" }],
    type: "website",
    siteName: "ShortStack",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trinity — the AI operating system for agencies — ShortStack",
    description: "Scrape leads, automate outreach, manage clients, and scale revenue from one AI-powered platform.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

/**
 * Structured data for the marketing landing.
 * Organization + SoftwareApplication (Product) + WebSite graph.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "ShortStack",
      url: SITE_URL,
      logo: `${SITE_URL}/icons/shortstack-logo.png`,
      description: "ShortStack builds Trinity, the AI operating system for modern digital marketing agencies.",
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "ShortStack",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#product`,
      name: "Trinity",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, macOS, Windows",
      description: "Trinity is the all-in-one AI operating system for digital marketing agencies — lead generation, outreach, CRM, content, and client portals.",
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        price: "49",
        url: `${SITE_URL}/pricing`,
      },
    },
  ],
};

/**
 * Public landing page (/).
 *
 * Section order is deliberate and follows a classic trust-build arc:
 *  1. Hero               — promise + primary CTA
 *  2. TrustBar           — stats, credibility at first scroll
 *  3. PainPoints         — "why we built this" — make readers feel seen
 *  4. OriginStory        — human narrative + ShortStack origin
 *  5. FeaturesOverview   — full surface of capabilities
 *  6. HowItWorks         — 3-step explainer to reduce perceived friction
 *  7. ReplaceStack       — concrete tool-replacement math
 *  8. WhoItsFor          — audience segments
 *  9. Integrations       — plays well with existing stack
 * 10. Testimonials       — social proof (placeholder quotes for now)
 * 11. PricingPreview     — 3-plan summary + link to /pricing
 * 12. FAQ                — objection handling
 * 13. FinalCTA           — reiterate offer
 * 14. LandingFooter      — conventional footer
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "#070708" }}>
      {/* JSON-LD structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <LandingNav />
      <Hero />
      <TrustBar />
      <ScreenshotCarousel />
      <AnimatedFeatureGrid />
      <PainPoints />
      <OriginStory />
      <FeaturesOverview />
      <HowItWorks />
      <ReplaceStack />
      <WhoItsFor />
      <Integrations />
      <Testimonials />
      <PricingPreview />
      <FAQ />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
