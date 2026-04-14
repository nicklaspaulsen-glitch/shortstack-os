import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

const ZERNIO_API_BASE = "https://api.zernio.com/v1";
const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;

// Helper to call Zernio API
async function zernioFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${ZERNIO_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ZERNIO_API_KEY}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zernio API error (${res.status}): ${err}`);
  }
  return res.json();
}

// Ensure a Zernio profile exists for the client, create if not
async function ensureZernioProfile(clientId: string, supabase: ReturnType<typeof createServerSupabase>) {
  // Check if client already has a zernio_profile_id
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, zernio_profile_id")
    .eq("id", clientId)
    .single();

  if (!client) throw new Error("Client not found");

  if (client.zernio_profile_id) {
    return client.zernio_profile_id;
  }

  // Create a new Zernio profile
  const profile = await zernioFetch("/profiles", {
    method: "POST",
    body: JSON.stringify({
      name: client.business_name || `Client ${clientId}`,
      external_id: clientId,
    }),
  });

  // Store the profile ID on the client record
  await supabase
    .from("clients")
    .update({ zernio_profile_id: profile.id })
    .eq("id", clientId);

  return profile.id;
}

// POST: Create Zernio profile and/or initiate OAuth connection for a platform
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ZERNIO_API_KEY) {
    return NextResponse.json({ error: "Zernio API key not configured" }, { status: 500 });
  }

  try {
    const { client_id, platform, callback_url } = await request.json();

    if (!client_id || !platform) {
      return NextResponse.json({ error: "client_id and platform are required" }, { status: 400 });
    }

    // Verify ownership
    const access = await verifyClientAccess(supabase, user.id, client_id);
    if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Ensure profile exists
    const profileId = await ensureZernioProfile(client_id, supabase);

    // Initiate OAuth connection for the platform
    const connection = await zernioFetch(`/profiles/${profileId}/connect/${platform}`, {
      method: "POST",
      body: JSON.stringify({
        callback_url: callback_url || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/integrations?connected=${platform}`,
      }),
    });

    return NextResponse.json({
      success: true,
      oauth_url: connection.oauth_url,
      profile_id: profileId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Zernio POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: Fetch connected accounts from Zernio for a client
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ZERNIO_API_KEY) {
    return NextResponse.json({ error: "Zernio API key not configured" }, { status: 500 });
  }

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  // Verify ownership
  const getAccess = await verifyClientAccess(supabase, user.id, clientId);
  if (getAccess.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // Get the client's Zernio profile ID
    const { data: client } = await supabase
      .from("clients")
      .select("zernio_profile_id")
      .eq("id", clientId)
      .single();

    if (!client?.zernio_profile_id) {
      return NextResponse.json({ accounts: [] });
    }

    // Fetch accounts from Zernio
    const data = await zernioFetch(`/profiles/${client.zernio_profile_id}/accounts`);

    // Sync Zernio accounts to local social_accounts table
    const zernioAccounts = data.accounts || [];
    for (const account of zernioAccounts) {
      const { data: existing } = await supabase
        .from("social_accounts")
        .select("id")
        .eq("client_id", clientId)
        .eq("platform", account.platform)
        .eq("account_id", account.id)
        .single();

      if (!existing) {
        await supabase.from("social_accounts").insert({
          client_id: clientId,
          platform: account.platform,
          account_name: account.name || account.username || account.platform,
          account_id: account.id,
          is_active: account.status === "connected",
          metadata: {
            oauth: true,
            zernio: true,
            connected_at: new Date().toISOString(),
            connected_by: user.id,
          },
        });
      } else {
        await supabase.from("social_accounts").update({
          account_name: account.name || account.username || account.platform,
          is_active: account.status === "connected",
          metadata: {
            oauth: true,
            zernio: true,
            synced_at: new Date().toISOString(),
          },
        }).eq("id", existing.id);
      }
    }

    return NextResponse.json({ accounts: zernioAccounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Zernio GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Disconnect a platform account via Zernio
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ZERNIO_API_KEY) {
    return NextResponse.json({ error: "Zernio API key not configured" }, { status: 500 });
  }

  try {
    const { client_id, account_id, local_account_id } = await request.json();

    // Verify ownership
    const delAccess = await verifyClientAccess(supabase, user.id, client_id);
    if (delAccess.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get client's Zernio profile
    const { data: client } = await supabase
      .from("clients")
      .select("zernio_profile_id")
      .eq("id", client_id)
      .single();

    if (client?.zernio_profile_id && account_id) {
      // Disconnect on Zernio side
      await zernioFetch(`/profiles/${client.zernio_profile_id}/accounts/${account_id}`, {
        method: "DELETE",
      });
    }

    // Deactivate locally
    if (local_account_id) {
      await supabase
        .from("social_accounts")
        .update({ is_active: false })
        .eq("id", local_account_id);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Zernio DELETE error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
