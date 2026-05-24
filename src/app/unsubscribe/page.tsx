import { CheckCircle, Envelope, XCircle } from "@phosphor-icons/react";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ success?: string; error?: string; email?: string }>;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const params = await searchParams;
  const isSuccess = params.success === "1";
  const isError = !!params.error;
  const email = params.email ? decodeURIComponent(params.email) : null;

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">

        {/* Brand wordmark */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Envelope className="w-5 h-5 text-[#D4FF00]" />
          <span className="text-sm font-semibold text-white/60 tracking-widest uppercase">
            ShortStack
          </span>
        </div>

        {isSuccess && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#D4FF00]/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-[#D4FF00]" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              You&apos;re unsubscribed
            </h1>
            {email && (
              <p className="text-sm text-white/50">
                <span className="font-mono text-white/70">{email}</span> has
                been removed from our mailing list.
              </p>
            )}
            <p className="text-sm text-white/40 leading-relaxed">
              You won&apos;t receive any more emails from us. If this was a
              mistake, you can resubscribe at any time from your account
              settings.
            </p>
          </div>
        )}

        {isError && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              Invalid unsubscribe link
            </h1>
            <p className="text-sm text-white/40 leading-relaxed">
              This link has expired or is not valid. Please use the unsubscribe
              link from your most recent email, or contact us at{" "}
              <a
                href="mailto:growth@shortstack.work"
                className="text-[#D4FF00] hover:underline"
              >
                growth@shortstack.work
              </a>{" "}
              to be removed manually.
            </p>
          </div>
        )}

        {!isSuccess && !isError && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white">Unsubscribe</h1>
            <p className="text-sm text-white/40">
              Use the link from your email to unsubscribe, or contact{" "}
              <a
                href="mailto:growth@shortstack.work"
                className="text-[#D4FF00] hover:underline"
              >
                growth@shortstack.work
              </a>
              .
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-white/8">
          <Link
            href="/"
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            ← Back to ShortStack
          </Link>
        </div>
      </div>
    </div>
  );
}
