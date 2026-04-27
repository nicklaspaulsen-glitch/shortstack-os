import { defineManifest } from "@crxjs/vite-plugin";

// Manifest V3 only. Chrome and Edge are the only supported targets — V2 is
// deprecated. We intentionally keep host_permissions narrow: LinkedIn for
// content scraping, ShortStack for API calls + reading the auth cookie.
export default defineManifest({
  manifest_version: 3,
  name: "ShortStack Prospector",
  short_name: "ShortStack",
  version: "1.0.0",
  description: "Save prospects to ShortStack CRM with one click from LinkedIn.",
  permissions: ["activeTab", "storage", "cookies"],
  host_permissions: [
    "https://www.linkedin.com/*",
    "https://app.shortstack.work/*",
  ],
  action: {
    default_popup: "src/popup/index.html",
    default_icon: {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://www.linkedin.com/*"],
      js: ["src/content/index.ts"],
      css: ["src/content/content.css"],
      run_at: "document_idle",
    },
  ],
  options_page: "src/options/index.html",
  icons: {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
});
