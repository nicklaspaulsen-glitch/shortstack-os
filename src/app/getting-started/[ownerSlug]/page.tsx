import { BookOpen, Calendar, CaretRight, ChatCircle, Envelope, FileText, FolderOpen, Gear, Lightning, MapTrifold, Phone, Receipt, Shield, Sparkle, Star, Users } from "@phosphor-icons/react";
/**
 * Public-facing /getting-started/[ownerSlug] page.
 *
 * Server-rendered with ISR (60s revalidate). No auth required — uses the
 * anon Supabase client and the `getting_started_public_read` RLS policy
 * to fetch only `is_public = true` rows.
 *
 * Rendered with the agency's branding (logo + brand color) pulled from
 * white_label_config alongside the doc itself.
 */

import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { loadPublicGettingStartedDoc } from "@/lib/email-templates/getting-started";
import type { GettingStartedSection, GettingStartedFaq } from "@/lib/email-templates/types";

// ISR — generated on first request, cached for 60s.
// We deliberately do NOT set `dynamic = "force-static"` here because the
// `[ownerSlug]` segment has no `generateStaticParams` (slugs are user IDs,
// unbounded), so Next.js can't pre-render every possible path at build
// time. Letting Next default the strategy + setting `revalidate` gives us
// proper ISR (lazy generate on first hit, cache for 60s) without crashing
// the build during page-data collection.
export const revalidate = 60;

interface BrandingPayload {
  agency_name: string;
  brand_color: string | null;
  logo_url: string | null;
  support_email: string | null;
}

const ICON_MAP: Record<string, typeof Sparkle> = {
  Sparkle,
  Lightning,
  MapTrifold: MapTrifold,
  ChatCircle,
  FolderOpen,
  Receipt,
  Calendar,
  Users,
  Shield,
  Star,
  Gear,
  BookOpen,
  Envelope,
  Phone,
  FileText,
};

interface PageProps {
  params: { ownerSlug: string };
}

async function fetchData(ownerSlug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const doc = await loadPublicGettingStartedDoc(anon, ownerSlug);
  if (!doc) return null;

  const { data: wl } = await anon
    .from("white_label_config")
    .select("brand_name, company_name, logo_url, primary_color, support_email")
    .eq("user_id", ownerSlug)
    .maybeSingle();

  const branding: BrandingPayload = {
    agency_name: wl?.brand_name || wl?.company_name || "Your Agency",
    brand_color: wl?.primary_color || null,
    logo_url: wl?.logo_url || null,
    support_email: wl?.support_email || doc.contact_email || null,
  };

  return { doc, branding };
}

export default async function GettingStartedPage({ params }: PageProps) {
  const data = await fetchData(params.ownerSlug);
  if (!data) {
    notFound();
  }
  const { doc, branding } = data;

  const brandColor = branding.brand_color || "#5E5BFF";
  const heroTitle = renderInline(doc.hero_title, { agency_name: branding.agency_name });
  const heroSubtitle = doc.hero_subtitle
    ? renderInline(doc.hero_subtitle, { agency_name: branding.agency_name })
    : null;

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logo_url}
                alt={branding.agency_name}
                className="h-9 w-auto"
              />
            ) : (
              <span
                className="text-lg font-bold tracking-tight"
                style={{ color: brandColor }}
              >
                {branding.agency_name}
              </span>
            )}
          </div>
          {branding.support_email && (
            <a
              href={`mailto:${branding.support_email}`}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              {branding.support_email}
            </a>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            {heroTitle}
          </h1>
          {heroSubtitle && (
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              {heroSubtitle}
            </p>
          )}

          {doc.hero_video_url && (
            <div
              className="mt-10  overflow-hidden border border-slate-200 shadow-sm aspect-video"
              style={{ borderColor: `${brandColor}20` }}
            >
              <VideoEmbed url={doc.hero_video_url} />
            </div>
          )}
        </div>
      </section>

      {/* Sections grid */}
      {doc.sections.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 gap-5">
            {doc.sections.map((section, i) => (
              <SectionCard
                key={i}
                section={section}
                agencyName={branding.agency_name}
                brandColor={brandColor}
              />
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      {doc.faq.length > 0 && (
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="max-w-3xl mx-auto px-6 py-16">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mb-8">
              Common questions
            </h2>
            <div className="space-y-3">
              {doc.faq.map((f, i) => (
                <FaqItem key={i} item={f} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-10 flex items-center justify-between flex-wrap gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} {branding.agency_name}
          </p>
          {branding.support_email && (
            <a
              href={`mailto:${branding.support_email}`}
              className="text-sm font-medium hover:underline"
              style={{ color: brandColor }}
            >
              Contact us
            </a>
          )}
        </div>
      </footer>
    </main>
  );
}

// ── Section card ─────────────────────────────────────────────────────────

function SectionCard({
  section,
  agencyName,
  brandColor,
}: {
  section: GettingStartedSection;
  agencyName: string;
  brandColor: string;
}) {
  const Icon = ICON_MAP[section.icon] || Sparkle;

  return (
    <article className="group  border border-slate-200 bg-white p-6 hover:shadow-md transition-shadow">
      <div
        className="inline-flex w-10 h-10 items-center justify-center rounded-xl mb-4"
        style={{ background: `${brandColor}15`, color: brandColor }}
      >
        <Icon size={20} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">
        {renderInline(section.title, { agency_name: agencyName })}
      </h3>
      <div
        className="text-slate-600 leading-relaxed text-[15px] [&_strong]:text-slate-900"
        // Markdown rendered server-side via a tiny safe renderer (see renderMarkdownSafe).
        // Output is HTML-escaped first, then a constrained set of inline tokens
        // get unescaped — no script/style/event handlers can survive.
        dangerouslySetInnerHTML={{
          __html: renderMarkdownSafe(section.body_md, { agency_name: agencyName }),
        }}
      />
      {section.links.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {section.links.map((link, i) => (
            <li key={i}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                style={{ color: brandColor }}
              >
                {link.label}
                <CaretRight size={13} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

// ── FAQ item (server component, plain disclosure-style) ──────────────────

function FaqItem({ item }: { item: GettingStartedFaq }) {
  return (
    <details className="rounded-xl bg-white border border-slate-200 px-5 py-4 group">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-semibold text-slate-900">
        <span>{item.q}</span>
        <CaretRight
          size={16}
          className="text-text-muted transition-transform group-open:rotate-90"
        />
      </summary>
      <p className="mt-3 text-slate-600 leading-relaxed">{item.a}</p>
    </details>
  );
}

// ── Video embed (Loom / YouTube / Vimeo / direct) ────────────────────────

function VideoEmbed({ url }: { url: string }) {
  const embedUrl = toEmbedUrl(url);
  if (!embedUrl) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center h-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
      >
        Watch the intro video
      </a>
    );
  }
  return (
    <iframe
      src={embedUrl}
      title="Intro video"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="w-full h-full border-0"
    />
  );
}

function toEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    // Loom: https://www.loom.com/share/<id>
    if (host.endsWith("loom.com")) {
      const id = parsed.pathname.replace(/^\/share\//, "").split("/")[0];
      if (id) return `https://www.loom.com/embed/${id}`;
    }
    // YouTube: https://www.youtube.com/watch?v=<id> or https://youtu.be/<id>
    if (host.endsWith("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host.endsWith("youtu.be")) {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    // Vimeo: https://vimeo.com/<id>
    if (host.endsWith("vimeo.com")) {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

// ── Tiny safe markdown / template renderers ─────────────────────────────

/**
 * Server-side renderer for inline {{var}} only. Returns plain text, no HTML.
 */
function renderInline(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

/**
 * Tiny safe markdown renderer.
 *
 * 1. Escape ALL HTML (so user-supplied content can never inject tags).
 * 2. Substitute {{vars}}.
 * 3. Re-introduce a constrained set of formatting markers:
 *    - **bold** → <strong>
 *    - *italic* → <em>
 *    - `code` → <code>
 *    - \n\n → paragraph breaks
 *    - \n → <br>
 *
 * No links, no images, no raw HTML — links go through the explicit
 * `links` array on each section so the URL set is auditable.
 */
function renderMarkdownSafe(md: string, vars: Record<string, string>): string {
  if (!md) return "";
  // 1. Escape HTML.
  let out = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // 2. Substitute vars (after escaping so vars themselves can't inject).
  out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = vars[key] || "";
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  });

  // 3. Inline formatting markers.
  out = out
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // 4. Paragraph breaks + line breaks.
  const paragraphs = out
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return paragraphs;
}
