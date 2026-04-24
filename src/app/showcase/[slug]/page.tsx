import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import Markdown from "@/lib/showcase/markdown";
import type { CaseStudy, CaseStudyAsset } from "@/lib/showcase/types";
import ViewLogger from "./_view-logger";
import Lightbox from "./_lightbox";

export const revalidate = 3600;

async function load(slug: string): Promise<{ cs: CaseStudy; assets: CaseStudyAsset[] } | null> {
  const supabase = createServiceClient();
  const { data: cs } = await supabase
    .from("case_studies")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();
  if (!cs) return null;
  const { data: assets } = await supabase
    .from("case_study_assets")
    .select("*")
    .eq("case_study_id", cs.id)
    .order("position", { ascending: true });
  return { cs: cs as CaseStudy, assets: (assets as CaseStudyAsset[]) || [] };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const loaded = await load(params.slug);
  if (!loaded) return { title: "Not found" };
  const cs = loaded.cs;
  const title = cs.seo_title || `${cs.title} · Case Study`;
  const description = cs.seo_description || cs.summary || cs.subtitle || "";
  const image = cs.og_image_url || cs.hero_image_url || undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function PublicCaseStudy({ params }: { params: { slug: string } }) {
  const loaded = await load(params.slug);
  if (!loaded) notFound();
  const { cs, assets } = loaded;

  const images = assets.filter((a) => a.asset_type === "image");

  return (
    <div className="min-h-screen bg-black text-white">
      <ViewLogger slug={cs.slug} />

      {/* Hero */}
      <section className="relative">
        {cs.hero_video_url ? (
          <video
            src={cs.hero_video_url}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-[70vh] object-cover"
          />
        ) : cs.hero_image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={cs.hero_image_url} alt="" className="w-full h-[70vh] object-cover" />
        ) : (
          <div className="w-full h-[60vh] bg-gradient-to-br from-white/5 to-white/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-16">
          <div className="max-w-4xl mx-auto">
            {cs.client_name && (
              <p className="text-sm uppercase tracking-[0.2em] text-primary">{cs.client_name}</p>
            )}
            <h1 className="mt-2 text-4xl md:text-6xl font-bold tracking-tight">{cs.title}</h1>
            {cs.subtitle && <p className="mt-4 text-xl text-white/80 max-w-2xl">{cs.subtitle}</p>}
          </div>
        </div>
      </section>

      {/* Client + summary */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        {(cs.client_logo_url || cs.client_name) && (
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-white/10">
            {cs.client_logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={cs.client_logo_url} alt={cs.client_name || "Client"} className="h-12 w-auto" />
            )}
            {cs.client_name && <div className="text-lg font-semibold">{cs.client_name}</div>}
          </div>
        )}

        {cs.summary && (
          <p className="text-xl md:text-2xl leading-relaxed text-white/85">{cs.summary}</p>
        )}
      </section>

      {/* Metrics */}
      {Array.isArray(cs.metrics) && cs.metrics.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cs.metrics.map((m, i) => (
              <div key={i} className="p-6 rounded-2xl border border-white/10 bg-white/5">
                <div className="text-4xl md:text-5xl font-bold">{m.value}</div>
                <div className="mt-2 text-sm text-white/60">{m.label}</div>
                {m.delta && <div className="mt-1 text-xs text-emerald-300">{m.delta}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Body */}
      {cs.body_markdown && (
        <section className="max-w-3xl mx-auto px-6 py-12">
          <article className="prose prose-invert prose-lg max-w-none text-white/90">
            <Markdown source={cs.body_markdown} />
          </article>
        </section>
      )}

      {/* Gallery */}
      {assets.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Gallery</h2>
          <Lightbox images={images} assets={assets} />
        </section>
      )}

      {/* Testimonial */}
      {cs.testimonial && (
        <section className="max-w-3xl mx-auto px-6 py-16">
          <div className="p-8 rounded-2xl border border-white/10 bg-white/5">
            <p className="text-xl md:text-2xl leading-relaxed italic">&ldquo;{cs.testimonial}&rdquo;</p>
            <div className="mt-6 flex items-center gap-3">
              {cs.testimonial_avatar_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={cs.testimonial_avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
              )}
              <div>
                {cs.testimonial_author && <div className="font-semibold">{cs.testimonial_author}</div>}
                {cs.testimonial_role && <div className="text-sm text-white/60">{cs.testimonial_role}</div>}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Service chips */}
      {(cs.service_tags?.length || cs.industry_tags?.length) > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex flex-wrap gap-2">
            {cs.service_tags?.map((t) => (
              <Link
                key={`s-${t}`}
                href={`/showcase?service=${encodeURIComponent(t)}`}
                className="px-3 py-1 rounded-full border border-white/20 text-xs text-white/70 hover:border-white/40"
              >
                {t}
              </Link>
            ))}
            {cs.industry_tags?.map((t) => (
              <Link
                key={`i-${t}`}
                href={`/showcase?industry=${encodeURIComponent(t)}`}
                className="px-3 py-1 rounded-full border border-white/20 text-xs text-white/70 hover:border-white/40"
              >
                {t}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Want results like these?</h2>
        <p className="mt-4 text-white/70">Tell us about your brand — we&apos;ll send back a plan within a week.</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/book" className="px-6 py-3 rounded-lg bg-primary text-black font-semibold">
            Book a call
          </Link>
          <Link href="/showcase" className="px-6 py-3 rounded-lg border border-white/20 font-semibold">
            More case studies
          </Link>
        </div>
      </section>
    </div>
  );
}
