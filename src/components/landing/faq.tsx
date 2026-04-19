"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left rounded-xl p-5 transition-all"
      style={{
        background: open ? "rgba(200,168,85,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${
          open ? "rgba(200,168,85,0.15)" : "rgba(255,255,255,0.05)"
        }`,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-white">{question}</p>
        <ChevronRight
          size={16}
          className="shrink-0 transition-transform text-gray-500"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
      </div>
      {open && (
        <p className="text-sm text-gray-400 mt-3 leading-relaxed whitespace-pre-line">
          {answer}
        </p>
      )}
    </button>
  );
}

const FAQ_ITEMS = [
  {
    q: `How is ${BRAND.product_name} different from GoHighLevel?`,
    a: `GoHighLevel is a CRM-plus-funnels-plus-marketing tool with agency features bolted on. ${BRAND.product_name} starts from the opposite direction: we're agency operators first. So instead of 100 features that each do 40% of the job, we ship a smaller set of workflows that actually run an agency end-to-end — lead gen, outreach, content generation AND publishing, client portals, proposals, contracts, billing. Our AI agents and content pipeline are native, not add-ons. And our client portals are genuinely brag-worthy, not a 2015-era dashboard.`,
  },
  {
    q: "Is my client data safe?",
    a: `Yes. ${BRAND.product_name} runs on isolated client workspaces with row-level security, encrypted at rest and in transit. Each client's data is scoped so one client can't ever see another's — even inside your own agency. We support SSO on higher plans, and offer data-residency (US / EU) options for Agency plans.`,
  },
  {
    q: "Can I white-label it for my clients?",
    a: `Yes, fully. On Growth and Agency plans you can run client portals on your own custom domain, with your logo, colors, favicon, and sender email. Your clients never see the word "${BRAND.product_name}" unless you want them to.`,
  },
  {
    q: "What if I already use Stripe / Notion / GoHighLevel?",
    a: `Keep them. ${BRAND.product_name} connects into Stripe for billing (so your existing customers and subscriptions carry over), pulls/pushes to Notion databases, and can co-exist with GoHighLevel while you migrate workflows gradually. You don't have to rip-and-replace to get value.`,
  },
  {
    q: "Does it work without my own AI / API keys?",
    a: `Yes. ${BRAND.product_name} includes managed AI credits on every plan — outreach drafting, content generation, voice calls, agent workflows all work out of the box. Power users can plug in their own OpenAI, Anthropic, or ElevenLabs keys on Growth and Agency plans if they want full control and their own billing.`,
  },
  {
    q: "Can I cancel anytime?",
    a: `Yes. No annual lock-ins, no hidden cancellation fees. Monthly plans cancel with one click in Settings → Billing. Your data stays accessible for 30 days after cancellation so you can export everything, and we never sell or use it downstream.`,
  },
  {
    q: "Who owns the data?",
    a: `You do. Always. Leads, clients, content, reports, contracts, and CRM history are yours — we're the processor, not the owner. You can export full CSVs of every dataset at any time, and on Agency plans you can trigger automated daily exports to your own S3 / Google Cloud bucket.`,
  },
  {
    q: "How fast can I get set up?",
    a: `Most agencies are up and running the same afternoon they sign up. Core setup (connecting Stripe, your email, one or two ad platforms, importing clients) takes about an hour. Full workflow migration — your proposals, contracts, outreach sequences, client portals — typically takes 1–2 weeks. We offer white-glove onboarding on Agency plans.`,
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="py-20 md:py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="FAQ"
            title="Questions we get a lot"
            subtitle="Nothing here? Email growth@shortstack.work — real humans answer."
            className="mb-14"
          />
        </Reveal>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <Reveal key={i} delay={0.04 * i}>
              <FAQItem question={item.q} answer={item.a} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
