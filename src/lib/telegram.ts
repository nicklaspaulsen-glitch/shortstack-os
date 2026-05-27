// Lightweight ops-channel Telegram notifier. Reads TELEGRAM_CHAT_ID and
// TELEGRAM_BOT_TOKEN at call time (not module level — see CLAUDE.md "No
// module-level env-var reads that throw"). Soft-fails when either is unset
// so callers can fire-and-forget without guarding.
//
// Used by webhook handlers (billing, retention, etc.) and crons that want
// a one-line ops nudge. Behavior-equivalent to the inline pattern this
// helper replaces — silent .catch keeps the original non-blocking semantics.
export async function notifyOps(text: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch((err) => console.warn("[telegram] notifyOps failed:", err));
}
