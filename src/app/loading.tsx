import LoadingMark from "@/components/brand/loading-mark";

/**
 * Root-level Suspense fallback. Used by Next.js while route-level data is
 * resolving. Centered LoadingMark on the OLED base — feels intentional,
 * never "AI loading spinner" generic.
 */
export default function RootLoading() {
  return (
    <div className="min-h-screen w-full bg-bg-base flex items-center justify-center px-6">
      <LoadingMark size="md" />
    </div>
  );
}
