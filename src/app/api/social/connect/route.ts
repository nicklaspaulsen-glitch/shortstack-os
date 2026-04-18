import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

/*
 * Social Media Account Connection — Connect client social accounts via Zernio OAuth
 *
 * social_connections table schema:
 *   id              (uuid, primary key)
 *   user_id         (uuid, FK to auth.users)
 *   platform        (text) -- instagram, facebook, tiktok, linkedin, twitter
 *   platform_user_id (text)
 *   username        (text)
 *   access_token    (text, encrypted)
 *   refresh_token   (text, nullable)
 *   connected_at    (timestamptz)
 *   expires_at      (timestamptz, nullable)
 *   status          (text default 'active') -- active, expired, revoked
 *
 * NOTE: The app currently uses the social_accounts table with similar columns.
 * The social_connections schema above is the canonical reference for new deployments.
 */

const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;

// POST: Connect a social account (manual or initiate Zernio OAuth)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { client_id, platform, account_name, account_id, access_token, refresh_token, action } = body;

  if (!platform) {
    return NextResponse.json({ error: "platform is required" }, { status: 400 });
  }

  // Verify ownership if client_id is provided.
  // If client_id is missing/null, the user is connecting an AGENCY-LEVEL social account
  // (their own social presence, not a client's). That's allowed for any authenticated user.
  if (client_id) {
    const access = await verifyClientAccess(supabase, user.id, client_id);
    if (access.denied) {
      return NextResponse.json({
        error: "You don't own this client. Try connecting without selecting a client (agency-level), or switch to a client you manage.",
      }, { status: 403 });
    }
  }

  // If action is "zernio_oauth", redirect to Zernio OAuth flow
  if (action === "zernio_oauth") {
    if (!ZERNIO_API_KEY) {
      return NextResponse.json({
        error: "Zernio API key not configured. Add ZERNIO_API_KEY to your environment variables.",
        zernio_not_configured: true,
      }, { status: 400 });
    }

    try {
      const zernioRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/social/zernio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id,
          platform,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/social-manager?connected=${platform}`,
        }),
      });

      // If the internal call fails, call Zernio directly
      if (!zernioRes.ok) {
        const zernioApiBase = "https://api.zernio.com/v1";

        // Determine the Zernio profile to use
        // - If client_id: the client's Zernio profile (create if missing)
        // - If no client_id: the agency's own Zernio profile (create under profiles.zernio_profile_id)
        let profileId: string | null = null;
        let profileName: string;
        let externalId: string;

        if (client_id) {
          const { data: client } = await supabase
            .from("clients")
            .select("id, business_name, zernio_profile_id")
            .eq("id", client_id)
            .single();
          profileId = client?.zernio_profile_id || null;
          profileName = client?.business_name || `Client ${client_id}`;
          externalId = String(client_id);
        } else {
          // Agency-level: use or create the user's own Zernio profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, company_name, zernio_profile_id")
            .eq("id", user.id)
            .single();
          profileId = profile?.zernio_profile_id || null;
          profileName = profile?.company_name || profile?.full_name || `Agency ${user.id.slice(0, 8)}`;
          externalId = String(user.id);
        }

        if (!profileId) {
          const profileRes = await fetch(`${zernioApiBase}/profiles`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ZERNIO_API_KEY}`,
            },
            body: JSON.stringify({
              name: profileName,
              external_id: externalId,
            }),
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            profileId = profileData.id;
            if (client_id) {
              await supabase.from("clients").update({ zernio_profile_id: profileId }).eq("id", client_id);
            } else {
              await supabase.from("profiles").update({ zernio_profile_id: profileId }).eq("id", user.id);
            }
          } else {
            const errText = await profileRes.text();
            return NextResponse.json({
              error: `Zernio profile creation failed: ${errText.slice(0, 200)}`,
              status: profileRes.status,
            }, { status: 502 });
          }
        }

        if (profileId) {
          const connectRes = await fetch(`${zernioApiBase}/profiles/${profileId}/connect/${platform}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ZERNIO_API_KEY}`,
            },
            body: JSON.stringify({
              callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/social-manager?connected=${platform}`,
            }),
          });

          if (connectRes.ok) {
            const connectData = await connectRes.json();
            return NextResponse.json({
              success: true,
              oauth_url: connectData.oauth_url,
              profile_id: profileId,
            });
          }
        }

        return NextResponse.json({ error: "Failed to initiate Zernio OAuth" }, { status: 500 });
      }

      const data = await zernioRes.json();
      return NextResponse.json(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Zernio OAuth initiation error:", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Standard manual connection flow
  // Check if already connected
  const { data: existing } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("client_id", client_id)
    .eq("platform", platform)
    .single();

  if (existing) {
    // Update existing connection
    await supabase.from("social_accounts").update({
      account_name, account_id,
      access_token: access_token || null,
      refresh_token: refresh_token || null,
      is_active: true,
      token_expires_at: access_token ? new Date(Date.now() + 60 * 86400000).toISOString() : null,
      metadata: { connected_at: new Date().toISOString(), connected_by: user.id, source: "manual" },
    }).eq("id", existing.id);
  } else {
    // Create new connection
    await supabase.from("social_accounts").insert({
      client_id, platform, account_name, account_id,
      access_token: access_token || null,
      refresh_token: refresh_token || null,
      is_active: true,
      token_expires_at: access_token ? new Date(Date.now() + 60 * 86400000).toISOString() : null,
      metadata: { connected_at: new Date().toISOString(), connected_by: user.id, source: "manual" },
    });
  }

  // Also setup Zernio profile if not exists
  const { data: zernioProfile } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("client_id", client_id)
    .eq("platform", "zernio")
    .single();

  if (!zernioProfile) {
    const { data: client } = await supabase.from("clients").select("business_name").eq("id", client_id).single();
    if (client) {
      await supabase.from("social_accounts").insert({
        client_id, platform: "zernio", account_name: client.business_name,
        is_active: true, metadata: { auto_created: true },
      });
    }
  }

  return NextResponse.json({ success: true, platform, account_name });
}

// GET: All connected accounts for a client, with Zernio status enrichment
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");
  const includeZernioStatus = request.nextUrl.searchParams.get("zernio") === "true";

  // If no client_id, get current user's client
  let id = clientId;
  if (!id) {
    const { data: client } = await supabase.from("clients").select("id").eq("profile_id", user.id).single();
    id = client?.id;
  }

  if (!id) return NextResponse.json({ accounts: [], zernio_configured: !!ZERNIO_API_KEY });

  const { data } = await supabase
    .from("social_accounts")
    .select("id, platform, account_name, account_id, is_active, created_at, token_expires_at, metadata")
    .eq("client_id", id)
    .not("platform", "in", "(ai_bot_config,white_label_config,zernio)")
    .order("platform");

  // Enrich with status based on token expiry
  const accounts = (data || []).map(account => {
    let status: "active" | "expired" | "revoked" = "active";
    if (!account.is_active) {
      status = "revoked";
    } else if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
      status = "expired";
    }
    return { ...account, status };
  });

  // Optionally sync with Zernio to get fresh status
  let zernioAccounts: Array<{ platform: string; status: string; name?: string; username?: string; id?: string }> = [];
  if (includeZernioStatus && ZERNIO_API_KEY) {
    try {
      const { data: client } = await supabase
        .from("clients")
        .select("zernio_profile_id")
        .eq("id", id)
        .single();

      if (client?.zernio_profile_id) {
        const zRes = await fetch(`https://api.zernio.com/v1/profiles/${client.zernio_profile_id}/accounts`, {
          headers: { Authorization: `Bearer ${ZERNIO_API_KEY}` },
        });
        if (zRes.ok) {
          const zData = await zRes.json();
          zernioAccounts = zData.accounts || [];
        }
      }
    } catch {
      // Zernio sync is best-effort
    }
  }

  return NextResponse.json({
    accounts,
    zernio_accounts: zernioAccounts,
    zernio_configured: !!ZERNIO_API_KEY,
  });
}

// DELETE: Disconnect an account (local + Zernio)
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { account_id, client_id, zernio_account_id } = await request.json();

  // Deactivate locally
  if (account_id) {
    await supabase.from("social_accounts").update({ is_active: false }).eq("id", account_id);
  }

  // Also disconnect on Zernio if we have the info
  if (ZERNIO_API_KEY && client_id && zernio_account_id) {
    try {
      const { data: client } = await supabase
        .from("clients")
        .select("zernio_profile_id")
        .eq("id", client_id)
        .single();

      if (client?.zernio_profile_id) {
        await fetch(`https://api.zernio.com/v1/profiles/${client.zernio_profile_id}/accounts/${zernio_account_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${ZERNIO_API_KEY}` },
        });
      }
    } catch {
      // Best-effort Zernio disconnect
    }
  }

  return NextResponse.json({ success: true });
}
