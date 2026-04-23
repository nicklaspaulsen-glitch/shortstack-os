import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  loadJobAsCaller,
  setServiceStatus,
  setServiceDone,
  setServiceFailed,
} from "@/lib/domains/hub-job";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Chat sub-task: generate a unique widget token for this domain and
 * compose the embed script the client can paste into their site.
 *
 * No external service dependency — purely a DB row + a generated script.
 * That makes this the one sub-task that should never fail in normal
 * operation, and it's a nice fast win for the "all-green" progress page.
 */

function generateToken(): string {
  // 32 bytes → 64 hex chars. Prefix so ops can tell at a glance it's a
  // widget token and not some other secret.
  return `cw_${randomBytes(24).toString("hex")}`;
}

function embedScript(domain: string, token: string, baseUrl: string): string {
  return `<!-- ShortStack Chat Widget for ${domain} -->
<script>
  (function() {
    var s = document.createElement('script');
    s.src = '${baseUrl}/widget/chat.js';
    s.async = true;
    s.dataset.token = '${token}';
    s.dataset.domain = '${domain}';
    document.head.appendChild(s);
  })();
</script>`;
}

export async function POST(request: NextRequest) {
  let body: { job_id?: string; domain?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { job_id: jobId, domain } = body;
  if (!jobId || !domain) {
    return NextResponse.json({ error: "job_id and domain required" }, { status: 400 });
  }

  const loaded = await loadJobAsCaller(jobId);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  const { ownerId } = loaded;

  await setServiceStatus(jobId, "chat", "in_progress");

  try {
    const svc = createServiceClient();

    // Re-use an existing widget for this (profile, domain) pair so rerunning
    // doesn't leak tokens. Users can rotate manually from the widgets page.
    const { data: existing } = await svc
      .from("chat_widgets")
      .select("id, token, embed_script")
      .eq("profile_id", ownerId)
      .eq("domain", domain)
      .maybeSingle();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    let token = existing?.token;
    let embed = existing?.embed_script;

    if (!existing) {
      token = generateToken();
      embed = embedScript(domain, token, baseUrl);
      const { error } = await svc.from("chat_widgets").insert({
        profile_id: ownerId,
        domain,
        token,
        embed_script: embed,
      });
      if (error) {
        await setServiceFailed(jobId, "chat", error.message);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    await setServiceDone(jobId, "chat", {
      token,
      embed_script: embed,
      domain,
      install_instructions:
        `Paste the embed script above into the <head> of ${domain} — or, if the site is built with ShortStack's website builder, it's auto-installed.`,
    });

    return NextResponse.json({ ok: true, token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setServiceFailed(jobId, "chat", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
