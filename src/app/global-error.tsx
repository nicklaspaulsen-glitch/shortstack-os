"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ background: "#0b0d12", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", fontFamily: "system-ui, -apple-system, sans-serif" }}>
          <div style={{ textAlign: "center", maxWidth: "28rem" }}>
            <p style={{ fontSize: "3rem", fontWeight: 800, color: "#c8a855", margin: 0 }}>Oops</p>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#f9fafb", marginTop: "0.5rem" }}>Something went wrong</h2>
            <p style={{ fontSize: "0.875rem", color: "#9ca3af", marginTop: "0.5rem", lineHeight: 1.6 }}>
              An unexpected error occurred. Try refreshing the page.
              {error.digest && (
                <span style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginTop: "0.5rem", fontFamily: "monospace" }}>
                  Error ID: {error.digest}
                </span>
              )}
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: "1.5rem",
                padding: "0.625rem 1.5rem",
                borderRadius: "0.75rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                background: "#c8a855",
                color: "#0b0d12",
                border: "none",
                cursor: "pointer",
              }}>
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
