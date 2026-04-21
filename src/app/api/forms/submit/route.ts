import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fireTrigger } from "@/lib/workflows/trigger-dispatch";

// POST — receive form submissions from embedded forms and create leads
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  let data: Record<string, string>;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    data = {};
    formData.forEach((value, key) => { data[key] = String(value); });
  } else {
    data = await request.json();
  }

  const supabase = createServiceClient();

  // Extract common fields
  const name = data.full_name || data.name || data.your_name || data.business_name || "Unknown";
  const email = data.email || null;
  const phone = data.phone || null;
  const formId = data.form_id || "unknown";

  // Resolve the form owner if a known form_id was submitted so the lead
  // lands in the right tenant's inbox. If unknown or the forms table doesn't
  // exist, leave user_id null so the lead doesn't silently attach to a random
  // tenant. Wrapped in try/catch in case the forms table isn't yet provisioned.
  let formOwnerId: string | null = null;
  if (formId && formId !== "unknown") {
    try {
      const { data: form } = await supabase
        .from("forms")
        .select("user_id, profile_id")
        .eq("id", formId)
        .maybeSingle();
      formOwnerId = (form?.user_id as string | null) || (form?.profile_id as string | null) || null;
    } catch {
      // forms table missing — leave formOwnerId null.
    }
  }

  // Create lead in database (attributed to the form owner so their tenant sees it)
  await supabase.from("leads").insert({
    user_id: formOwnerId,
    business_name: name,
    email,
    phone,
    source: `form:${formId}`,
    status: "new",
    metadata: data,
  });

  // Log the submission
  await supabase.from("trinity_log").insert({
    agent: "lead-engine",
    action_type: "lead_gen",
    description: `Form submission: ${name} (${email || "no email"})`,
    status: "completed",
    user_id: formOwnerId,
    result: { source: "form", form_id: formId, data },
  });

  // Fire the form_submitted workflow trigger. Any trigger on this form
  // (or any trigger with no form_id filter) will auto-run its workflow.
  // Fire-and-forget — doesn't block the form response.
  if (formOwnerId) {
    fireTrigger({
      supabase,
      userId: formOwnerId,
      triggerType: "form_submitted",
      payload: {
        form_id: formId,
        name,
        email,
        phone,
        submitted_at: new Date().toISOString(),
        ...data,
      },
    }).catch((err) =>
      console.error("[forms/submit] fireTrigger failed:", err),
    );
  }

  // Notify on Telegram
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (chatId && botToken) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `New Lead from Form!\n\nName: ${name}\nEmail: ${email || "—"}\nPhone: ${phone || "—"}\nForm: ${formId}`,
      }),
    });
  }

  // Redirect to thank you page or return success
  // Validate redirect_url to prevent open redirects — only allow same-origin or explicitly allowed domains
  const redirectUrl = data.redirect_url;
  if (redirectUrl) {
    try {
      const parsed = new URL(redirectUrl);
      const appHost = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app").hostname;
      // Only allow redirects to our own domain
      if (parsed.hostname === appHost || parsed.hostname.endsWith(`.${appHost}`)) {
        return NextResponse.redirect(redirectUrl);
      }
      // Block external redirects — fall through to thank you page
    } catch {
      // Invalid URL — fall through to thank you page
    }
  }

  // Return a simple thank you page
  return new NextResponse(
    `<!DOCTYPE html><html><head><title>Thank You</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0b0d12;color:#fff;margin:0}div{text-align:center;padding:40px}h1{color:#c8a855;margin-bottom:8px}p{color:#999;font-size:14px}</style></head><body><div><h1>Thank You!</h1><p>We received your information and will be in touch soon.</p></div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
