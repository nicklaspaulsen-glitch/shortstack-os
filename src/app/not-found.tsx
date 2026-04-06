import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-mesh">
      <div className="text-center">
        <p className="text-6xl font-black text-gold mb-2">404</p>
        <h1 className="text-lg font-bold text-white mb-1">Page not found</h1>
        <p className="text-xs text-muted mb-6 max-w-xs mx-auto">The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/dashboard" className="btn-primary text-xs px-6 py-2.5 inline-block">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
