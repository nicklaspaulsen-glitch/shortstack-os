import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import LogoPickerPage from "@/app/dashboard/logo-picker/page";

/**
 * /admin/brand-picker
 *
 * Admin-only mirror of /dashboard/logo-picker. Gated at the server boundary
 * so non-admins never see the page chrome, then re-uses the client component
 * which already handles admin affordances (Apply permanently / Revert).
 */
export default async function AdminBrandPickerPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/admin/brand-picker");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "founder") {
    redirect("/dashboard");
  }

  return <LogoPickerPage />;
}
