import type { MetadataRoute } from "next";

/**
 * Public sitemap. Next auto-serves this at /sitemap.xml.
 *
 * Only PUBLIC, indexable routes should appear here. Authed dashboard
 * routes and tokenized client-facing routes (survey, portal) are
 * deliberately excluded.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
  const now = new Date();

  return [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/demo`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/book`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
