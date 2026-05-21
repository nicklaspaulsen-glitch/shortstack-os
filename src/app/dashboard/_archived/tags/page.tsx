import { redirect } from "next/navigation";

// Tags merged into CRM — tag management lives in /dashboard/crm
export default function TagsRedirect() {
  redirect("/dashboard/crm");
}
