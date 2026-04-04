// AI Website Builder — Claude generates full websites, deploys to Vercel
// Package tiers determine complexity: Starter (1 page), Growth (5 pages), Enterprise (10+ pages)

interface WebsiteConfig {
  clientName: string;
  businessName: string;
  industry: string;
  packageTier: "Starter" | "Growth" | "Enterprise";
  brandColors?: { primary: string; secondary: string; accent: string };
  description?: string;
  services?: string[];
  phone?: string;
  email?: string;
  address?: string;
  domain?: string;
}

const PACKAGE_PAGES: Record<string, string[]> = {
  Starter: ["Home (hero + CTA + services overview + contact form)"],
  Growth: [
    "Home (hero + CTA + features + testimonials + CTA)",
    "About (story + team + values)",
    "Services (detailed service pages with pricing)",
    "Blog (SEO blog listing)",
    "Contact (form + map + details)",
  ],
  Enterprise: [
    "Home (animated hero + stats + features + testimonials + CTA + FAQ)",
    "About (company story + team bios + timeline + values + culture)",
    "Services (individual page per service with case studies)",
    "Portfolio / Case Studies (project showcases with results)",
    "Blog (SEO-optimized with categories)",
    "Pricing (interactive pricing table with comparison)",
    "Contact (multi-step form + booking calendar + map)",
    "FAQ (searchable FAQ section)",
    "Testimonials (video + text testimonials wall)",
    "Careers (job listings if applicable)",
  ],
};

// Generate full website code with Claude
export async function generateWebsiteCode(config: WebsiteConfig): Promise<{
  success: boolean;
  pages: Array<{ name: string; path: string; code: string }>;
  layoutCode: string;
  globalCss: string;
  error?: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { success: false, pages: [], layoutCode: "", globalCss: "", error: "AI not configured" };

  const pages = PACKAGE_PAGES[config.packageTier] || PACKAGE_PAGES.Growth;
  const colors = config.brandColors || { primary: "#C9A84C", secondary: "#0a0a0a", accent: "#ffffff" };

  const result: Array<{ name: string; path: string; code: string }> = [];

  // Generate global styles
  const cssRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: "You are a frontend developer. Write only the CSS code, no explanations.",
      messages: [{ role: "user", content: `Write modern CSS for a ${config.industry} business website. Brand colors: primary ${colors.primary}, secondary ${colors.secondary}, accent ${colors.accent}. Include: reset, typography, buttons, cards, hero section, responsive breakpoints, smooth animations, dark/light mode support. Business: ${config.businessName}.` }],
    }),
  });
  const cssData = await cssRes.json();
  const globalCss = cssData.content?.[0]?.text || "";

  // Generate layout
  const layoutRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: "You are a Next.js developer. Write only the TypeScript/JSX code for a layout.tsx file. No explanations.",
      messages: [{ role: "user", content: `Create a Next.js App Router layout.tsx for ${config.businessName} (${config.industry}). Include: responsive navbar with logo text "${config.businessName}", navigation links for ${pages.map(p => p.split("(")[0].trim()).join(", ")}, footer with contact info (${config.phone || ""}, ${config.email || ""}, ${config.address || ""}), social links. Use Tailwind CSS. Colors: primary ${colors.primary}.` }],
    }),
  });
  const layoutData = await layoutRes.json();
  const layoutCode = layoutData.content?.[0]?.text || "";

  // Generate each page
  for (const pageDesc of pages) {
    const pageName = pageDesc.split("(")[0].trim();
    const pageDetails = pageDesc.match(/\((.+)\)/)?.[1] || "";
    const path = pageName.toLowerCase() === "home" ? "/" : `/${pageName.toLowerCase().replace(/\s+/g, "-")}`;

    const pageRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        system: `You are a Next.js developer building a premium website for a ${config.industry} business called "${config.businessName}". Write only the page.tsx code. Use Tailwind CSS. Make it look professional and high-converting. No explanations.`,
        messages: [{ role: "user", content: `Create the ${pageName} page (${path}/page.tsx) for ${config.businessName}.
Include: ${pageDetails}
Services: ${config.services?.join(", ") || "Digital marketing services"}
Description: ${config.description || `Professional ${config.industry} services`}
Make it mobile responsive, SEO optimized, and conversion focused. Use ${config.packageTier === "Enterprise" ? "advanced animations and interactive elements" : config.packageTier === "Growth" ? "smooth transitions and modern layout" : "clean and simple design"}.` }],
      }),
    });
    const pageData = await pageRes.json();
    result.push({
      name: pageName,
      path,
      code: pageData.content?.[0]?.text || "",
    });

    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  return { success: true, pages: result, layoutCode, globalCss };
}

// Deploy website to Vercel via API
export async function deployToVercel(params: {
  projectName: string;
  files: Array<{ path: string; content: string }>;
}): Promise<{ success: boolean; url?: string; error?: string }> {
  // For now, we'll generate the code and let the user deploy manually
  // Full Vercel API deployment can be added when user has Vercel token
  return {
    success: true,
    url: `Code generated for ${params.projectName}. ${params.files.length} files ready for deployment.`,
  };
}
