import { redirect } from "next/navigation";

// Surveys merged into Forms — use /dashboard/forms
export default function SurveysRedirect() {
  redirect("/dashboard/forms");
}
