import Link from "next/link";
import { Home, Search } from "lucide-react";

/**
 * Branded 404 for `/dashboard/*` routes. Rendered when a dashboard route
 * calls `notFound()` or when a segment doesn't match any route. Keeps the
 * dashboard chrome in view so the user doesn't feel teleported away.
 */
export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-black mb-3 text-gold">404</p>
        <h1 className="text-lg font-bold text-foreground mb-2">
          Page not found
        </h1>
        <p className="text-xs text-muted mb-6 leading-relaxed">
          We couldn&apos;t find that dashboard page. It may have been moved or
          renamed — check the sidebar or head back to the dashboard home.
        </p>

        <div className="flex items-center justify-center gap-2">
          <Link
            href="/dashboard"
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <Home size={12} />
            Dashboard home
          </Link>
          <Link
            href="/dashboard/crm"
            className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <Search size={12} />
            Open CRM
          </Link>
        </div>
      </div>
    </div>
  );
}
