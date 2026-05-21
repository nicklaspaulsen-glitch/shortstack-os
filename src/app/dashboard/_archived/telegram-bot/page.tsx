import { redirect } from "next/navigation";

// Canonical URL is /dashboard/telegram
export default function TelegramBotRedirect() {
  redirect("/dashboard/telegram");
}
