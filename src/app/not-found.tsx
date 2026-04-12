import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#0b0d12" }}
    >
      <div className="text-center max-w-md">
        <p
          className="text-7xl font-black mb-3"
          style={{ color: "#C9A84C" }}
        >
          404
        </p>
        <h1
          className="text-xl font-bold mb-2"
          style={{ color: "#F9FAFB" }}
        >
          Page Not Found
        </h1>
        <p
          className="text-sm mb-8 leading-relaxed"
          style={{ color: "#9CA3AF" }}
        >
          Looks like this page took a detour. It might have been moved,
          deleted, or maybe it never existed in the first place.
        </p>

        <Link
          href="/"
          className="inline-block px-6 py-2.5 text-sm font-medium rounded-lg transition-colors"
          style={{
            background: "#C9A84C",
            color: "#FFFFFF",
          }}
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
