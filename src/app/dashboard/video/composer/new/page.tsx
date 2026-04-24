"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

// Convenience route — creates a blank composition and redirects to the editor.
export default function NewComposerPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/video/composer/compositions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Untitled composition" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Create failed");
        if (cancelled) return;
        router.replace(`/dashboard/video/composer/${json.composition.id}/edit`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Create failed";
        setError(msg);
        toast.error(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      {error ? (
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/dashboard/video/composer")}
            className="text-sm underline"
          >
            Back to compositions
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Creating new composition...
        </div>
      )}
    </div>
  );
}
