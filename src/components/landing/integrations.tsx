"use client";

import {
  Calendar,
  CreditCard,
  Database,
  FileText,
  Globe,
  Mail,
  MessageSquare,
  Mic,
  Phone,
  Search,
  Send,
  Share2,
  Sparkles,
  Video,
} from "lucide-react";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

const INTEGRATIONS = [
  { name: "Stripe", icon: CreditCard, category: "Billing" },
  { name: "Meta Ads", icon: Share2, category: "Ads" },
  { name: "Google Ads", icon: Search, category: "Ads" },
  { name: "TikTok Ads", icon: Video, category: "Ads" },
  { name: "Google Business", icon: Globe, category: "Local SEO" },
  { name: "LinkedIn", icon: MessageSquare, category: "Social" },
  { name: "Zernio", icon: Send, category: "Social Publishing" },
  { name: "ElevenLabs", icon: Mic, category: "AI Voice" },
  { name: "Calendly", icon: Calendar, category: "Scheduling" },
  { name: "Notion", icon: FileText, category: "Docs" },
  { name: "Gmail / Outlook", icon: Mail, category: "Email" },
  { name: "Twilio", icon: Phone, category: "SMS & Calls" },
  { name: "OpenAI / Anthropic", icon: Sparkles, category: "AI Models" },
  { name: "Supabase", icon: Database, category: "Data" },
];

export default function Integrations() {
  return (
    <section
      className="py-20 md:py-28 px-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
    >
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="Plays well with everything"
            title="Keep the tools you love. Replace the ones you don't."
            subtitle={`${BRAND.product_name} connects to the platforms agencies actually run on. Native integrations ship with the product — no paying for a third-party iPaaS to glue it together.`}
            className="mb-14"
          />
        </Reveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {INTEGRATIONS.map((integration, i) => (
            <Reveal key={integration.name} delay={0.03 * i}>
              <div
                className="rounded-xl p-4 h-full text-center transition-all duration-300 hover:-translate-y-0.5 flex flex-col items-center justify-center gap-2"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  minHeight: 110,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(200,168,85,0.08)" }}
                >
                  <integration.icon
                    size={18}
                    style={{ color: "#c8a855" }}
                  />
                </div>
                <p className="text-xs font-semibold text-white">
                  {integration.name}
                </p>
                <p className="text-[10px] text-gray-500">
                  {integration.category}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <p className="text-center text-xs text-gray-500 mt-8">
            …and new integrations ship every month. Need one? Tell us — we
            build the ones our customers actually ask for.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
