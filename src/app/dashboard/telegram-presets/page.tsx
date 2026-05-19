import { redirect } from "next/navigation";

// Canonical URL is /dashboard/telegram
export default function TelegramPresetsRedirect() {
  redirect("/dashboard/telegram");
}
