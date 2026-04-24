import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Public sitemap. Next auto-serves this at /sitemap.xml.
 *
 * Only PUBLIC, indexable routes should appear here. Authed dashboard
 * routes and tokenized client-facing routes (survey, portal) are
 * deliberately excluded.
 *
 * Also includes the /showcase index and every published /showcase/[slug].
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/demo`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/book`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/showcase`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
  ];

  // Pull published case studies (non-fatal if Supabase is unreachable).
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("case_studies")
      .select("slug, updated_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(1000);

    if (Array.isArray(data)) {
      for (const cs of data) {
        staticRoutes.push({
          url: `${baseUrl}/showcase/${cs.slug}`,
          lastModified: cs.updated_at ? new Date(cs.updated_at) : now,
          changeFrequency: "monthly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // Swallow — sitemap should still serve the static routes on DB error.
  }

  return staticRoutes;
}
