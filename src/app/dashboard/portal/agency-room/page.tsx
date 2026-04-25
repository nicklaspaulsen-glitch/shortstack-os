"use client";

import { useEffect, useState } from "react";
import { Users, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAppStore } from "@/lib/store";
import PageHero from "@/components/ui/page-hero";
import ClientRoomCanvas from "@/components/agent-room/client-room-canvas";
import { PageLoading } from "@/components/ui/loading";

// Client-portal "agency room" — Kumospace-style live view of every agent
// working FOR this client. Mirrors the agency-side /dashboard/agent-room
// but scoped to a single client's trinity_log activity.
//
// Auth flow:
//   - Normal client login → resolves the client by `clients.profile_id =
//     auth.uid()`. (Each client account has a 1:1 row in `clients`.)
//   - Admin impersonation flow → `useAppStore.impersonatedClient` is set;
//     we use that client_id directly. Mirrors the pattern used by every
//     other /dashboard/portal/* page.
//
// Empty state: a freshly-onboarded client with zero log activity sees the
// room with all avatars in "idle" state. That's the *correct* visual — it
// reads as "your team is standing by, nothing has run yet today" rather
// than an error. Once the agency triggers an action against the client,
// the relevant avatar lights green.

interface ClientRow {
  id: string;
  business_name: string | null;
}

export default function PortalAgencyRoomPage() {
  const { profile } = useAuth();
  const { impersonatedClient, isImpersonating } = useAppStore();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      try {
        // Same auth pattern as portal/page.tsx — admin impersonation wins,
        // else look up the client owned by this profile.
        let row: ClientRow | null = null;
        if (isImpersonating && impersonatedClient) {
          const { data } = await supabase
            .from("clients")
            .select("id, business_name")
            .eq("id", impersonatedClient.id)
            .maybeSingle();
          row = (data as ClientRow | null) ?? null;
        } else {
          const { data } = await supabase
            .from("clients")
            .select("id, business_name")
            .eq("profile_id", profile.id)
            .maybeSingle();
          row = (data as ClientRow | null) ?? null;
        }
        if (!cancelled) setClient(row);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, impersonatedClient, isImpersonating]);

  if (loading) return <PageLoading />;

  if (!client) {
    // Either logged in as an agency staff member with no impersonation, or a
    // brand-new client account that isn't yet linked to a `clients` row.
    return (
      <div className="fade-in space-y-5 p-6">
        <PageHero
          icon={<Users size={28} />}
          title="Your Agency Room"
          subtitle="Live view of every agent working on your project."
          gradient="gold"
        />
        <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
          <Sparkles className="mx-auto mb-3 text-gold/60" size={32} />
          <h2 className="text-base font-semibold mb-1">Your room isn&apos;t set up yet</h2>
          <p className="text-[12px] text-muted max-w-md mx-auto">
            Once your agency finishes onboarding your account, this view will
            light up with every agent assigned to your project — content,
            outreach, scheduling, reporting, and more.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5 p-6">
      <PageHero
        icon={<Users size={28} />}
        title="Your Agency Room"
        subtitle="Live view of every agent working on your project — their zones, status, and last actions."
        gradient="gold"
      />
      <ClientRoomCanvas
        clientId={client.id}
        clientName={client.business_name}
      />
    </div>
  );
}
