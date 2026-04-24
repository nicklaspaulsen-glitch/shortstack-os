import type { Metadata } from "next";
import LandingNav from "@/components/landing/landing-nav";
import LandingFooter from "@/components/landing/landing-footer";
import AboutHero from "@/components/about/about-hero";
import FounderStory from "@/components/about/founder-story";
import MissionValues from "@/components/about/mission-values";
import StackRow from "@/components/about/stack-row";
import Milestones from "@/components/about/milestones";
import AboutContact from "@/components/about/about-contact";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

export const metadata: Metadata = {
  title: "About ShortStack — the team behind Trinity",
  description:
    "We're a tiny team building the operating system we always wished existed for digital marketing agencies. Made by operators, for operators.",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: "About ShortStack — the team behind Trinity",
    description:
      "We're a tiny team building the operating system we always wished existed for digital marketing agencies.",
    url: `${SITE_URL}/about`,
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: "#0b0d12" }}>
      <LandingNav />
      <AboutHero />
      <FounderStory />
      <MissionValues />
      <StackRow />
      <Milestones />
      <AboutContact />
      <LandingFooter />
    </div>
  );
}
