import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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

  // Create lead in database
  await supabase.from("leads").insert({
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
    result: { source: "form", form_id: formId, data },
  });

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
  const redirectUrl = data.redirect_url;
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl);
  }

  // Return a simple thank you page
  return new NextResponse(
    `<!DOCTYPE html><html><head><title>Thank You</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0b0d12;color:#fff;margin:0}div{text-align:center;padding:40px}h1{color:#c8a855;margin-bottom:8px}p{color:#999;font-size:14px}</style></head><body><div><h1>Thank You!</h1><p>We received your information and will be in touch soon.</p></div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
