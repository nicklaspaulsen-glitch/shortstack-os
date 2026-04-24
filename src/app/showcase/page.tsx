import Link from "next/link";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import type { CaseStudy } from "@/lib/showcase/types";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Case studies · Showcase",
  description: "Recent client work — how we drove measurable results for real brands.",
  openGraph: {
    title: "Case studies · Showcase",
    description: "Recent client work — how we drove measurable results for real brands.",
  },
  twitter: { card: "summary_large_image" },
};

interface SearchParams {
  industry?: string;
  service?: string;
}

export default async function PublicShowcaseIndex({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createServiceClient();
  let q = supabase
    .from("case_studies")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(200);
  if (searchParams.industry) q = q.contains("industry_tags", [searchParams.industry]);
  if (searchParams.service) q = q.contains("service_tags", [searchParams.service]);

  const { data } = await q;
  const items: CaseStudy[] = data || [];

  // Gather filter options
  const industries = new Set<string>();
  const services = new Set<string>();
  for (const c of items) {
    for (const t of c.industry_tags || []) industries.add(t);
    for (const t of c.service_tags || []) services.add(t);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Showcase</p>
          <h1 className="mt-2 text-4xl md:text-6xl font-bold tracking-tight">Work we&apos;re proud of.</h1>
          <p className="mt-4 text-white/70 max-w-2xl">
            Real results for real brands — measurable outcomes, honest retros, no hype.
          </p>
        </header>

        {(industries.size > 0 || services.size > 0) && (
          <div className="mb-8 space-y-3 text-xs">
            {industries.size > 0 && (
              <div className="flex flex-wrap gap-2">
                <Link href="/showcase" className={`px-3 py-1 rounded-full border ${!searchParams.industry ? "border-white text-white" : "border-white/20 text-white/60"}`}>All industries</Link>
                {[...industries].sort().map((t) => (
                  <Link
                    key={t}
                    href={`/showcase?industry=${encodeURIComponent(t)}`}
                    className={`px-3 py-1 rounded-full border ${searchParams.industry === t ? "border-white text-white" : "border-white/20 text-white/60 hover:border-white/40"}`}
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
            {services.size > 0 && (
              <div className="flex flex-wrap gap-2">
                <Link href="/showcase" className={`px-3 py-1 rounded-full border ${!searchParams.service ? "border-white text-white" : "border-white/20 text-white/60"}`}>All services</Link>
                {[...services].sort().map((t) => (
                  <Link
                    key={t}
                    href={`/showcase?service=${encodeURIComponent(t)}`}
                    className={`px-3 py-1 rounded-full border ${searchParams.service === t ? "border-white text-white" : "border-white/20 text-white/60 hover:border-white/40"}`}
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <div className="py-24 text-center text-white/50">No published case studies yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((cs) => (
              <Link
                key={cs.id}
                href={`/showcase/${cs.slug}`}
                className="group rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 transition"
              >
                {cs.hero_image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={cs.hero_image_url} alt="" className="w-full aspect-video object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                ) : (
                  <div className="w-full aspect-video bg-gradient-to-br from-white/5 to-white/10" />
                )}
                <div className="p-5">
                  {cs.client_name && (
                    <div className="text-xs uppercase tracking-wider text-primary mb-1">{cs.client_name}</div>
                  )}
                  <h3 className="text-lg font-semibold leading-tight group-hover:text-primary transition">{cs.title}</h3>
                  {cs.subtitle && <p className="mt-1 text-sm text-white/60 line-clamp-2">{cs.subtitle}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
