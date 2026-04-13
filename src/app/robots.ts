import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/survey"],
      },
    ],
    sitemap: "https://shortstack-os.vercel.app/sitemap.xml",
  };
}
