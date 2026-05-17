import { redirect } from "next/navigation";

// Telegram presets merged into Telegram Bot page — use /dashboard/telegram-bot
export default function TelegramPresetsRedirect() {
  redirect("/dashboard/telegram-bot");
}
