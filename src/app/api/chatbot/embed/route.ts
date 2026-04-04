import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Chatbot Embed Code Generator — Creates embeddable chat widget for client websites
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, bot_name, primary_color, position, welcome_message } = await request.json();

  let clientName = "Business";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name").eq("id", client_id).single();
    if (client) clientName = client.business_name;
  }

  const name = bot_name || "Assistant";
  const color = primary_color || "#C9A84C";
  const pos = position || "bottom-right";
  const welcome = welcome_message || `Hi! Welcome to ${clientName}. How can I help you today?`;

  const embedCode = `<!-- ${clientName} Chat Widget - Powered by ShortStack -->
<div id="ss-chat-widget"></div>
<script>
(function() {
  var w = document.createElement('div');
  w.id = 'ss-chat-container';
  w.innerHTML = \`
    <style>
      #ss-chat-btn { position: fixed; ${pos === "bottom-left" ? "left: 24px" : "right: 24px"}; bottom: 24px; width: 56px; height: 56px; border-radius: 50%; background: ${color}; border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 9999; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
      #ss-chat-btn:hover { transform: scale(1.1); }
      #ss-chat-btn svg { width: 24px; height: 24px; fill: white; }
      #ss-chat-box { position: fixed; ${pos === "bottom-left" ? "left: 24px" : "right: 24px"}; bottom: 90px; width: 360px; height: 480px; background: #111; border: 1px solid #333; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.4); z-index: 9999; display: none; flex-direction: column; overflow: hidden; font-family: -apple-system, sans-serif; }
      #ss-chat-box.open { display: flex; }
      .ss-header { background: ${color}20; padding: 12px 16px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #333; }
      .ss-header-name { color: white; font-weight: 600; font-size: 14px; }
      .ss-header-status { color: #22c55e; font-size: 10px; }
      .ss-messages { flex: 1; overflow-y: auto; padding: 16px; }
      .ss-msg { margin-bottom: 12px; }
      .ss-msg-bot { background: #1a1a1a; color: #ddd; padding: 10px 14px; border-radius: 16px 16px 16px 4px; font-size: 13px; max-width: 80%; line-height: 1.4; }
      .ss-msg-user { background: ${color}; color: #000; padding: 10px 14px; border-radius: 16px 16px 4px 16px; font-size: 13px; max-width: 80%; margin-left: auto; line-height: 1.4; }
      .ss-input-area { padding: 12px; border-top: 1px solid #333; display: flex; gap: 8px; }
      .ss-input { flex: 1; background: #1a1a1a; border: 1px solid #333; border-radius: 20px; padding: 8px 16px; color: white; font-size: 13px; outline: none; }
      .ss-input:focus { border-color: ${color}50; }
      .ss-send { width: 36px; height: 36px; border-radius: 50%; background: ${color}; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      .ss-send svg { width: 16px; height: 16px; fill: black; }
    </style>
    <button id="ss-chat-btn" onclick="document.getElementById('ss-chat-box').classList.toggle('open')">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </button>
    <div id="ss-chat-box">
      <div class="ss-header">
        <div style="width:32px;height:32px;border-radius:50%;background:${color}30;display:flex;align-items:center;justify-content:center;color:${color};font-weight:bold;font-size:12px;">${name[0]}</div>
        <div>
          <div class="ss-header-name">${name}</div>
          <div class="ss-header-status">● Online</div>
        </div>
      </div>
      <div class="ss-messages" id="ss-msgs">
        <div class="ss-msg"><div class="ss-msg-bot">${welcome}</div></div>
      </div>
      <div class="ss-input-area">
        <input class="ss-input" id="ss-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter')ssChat()">
        <button class="ss-send" onclick="ssChat()"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
      </div>
    </div>
  \`;
  document.body.appendChild(w);

  window.ssChat = function() {
    var input = document.getElementById('ss-input');
    var msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    var msgs = document.getElementById('ss-msgs');
    msgs.innerHTML += '<div class="ss-msg"><div class="ss-msg-user">' + msg + '</div></div>';
    msgs.scrollTop = msgs.scrollHeight;
    msgs.innerHTML += '<div class="ss-msg"><div class="ss-msg-bot" style="opacity:0.5">Typing...</div></div>';
    // Replace with your API endpoint
    setTimeout(function() {
      msgs.lastChild.remove();
      msgs.innerHTML += '<div class="ss-msg"><div class="ss-msg-bot">Thanks for reaching out! One of our team members will get back to you shortly. In the meantime, feel free to call us or check our services.</div></div>';
      msgs.scrollTop = msgs.scrollHeight;
    }, 1500);
  };
})();
</script>`;

  return NextResponse.json({
    success: true,
    embed_code: embedCode,
    preview_html: `<!DOCTYPE html><html><head><title>${clientName} - Chat Preview</title></head><body style="background:#0a0a0a;min-height:100vh;">${embedCode}</body></html>`,
  });
}
