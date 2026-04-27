// Push notification registration — Expo push tokens.
//
// Flow:
//   1. Request permission (POST_NOTIFICATIONS on Android 13+, alert on iOS).
//   2. Pull the Expo push token (requires an EAS projectId).
//   3. POST it to /api/mobile/push-tokens with the user's bearer token.
//      The backend stores one row per (user, platform, token).
//
// We tolerate every step failing — push is a bonus, not a requirement.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getAppUrl, getSupabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface RegisterResult {
  ok: boolean;
  reason?: string;
  token?: string;
}

export async function registerForPushNotifications(): Promise<RegisterResult> {
  if (!Device.isDevice) {
    return { ok: false, reason: "Push only works on physical devices." };
  }

  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "ShortStack",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#7a5cff",
      });
    } catch (err) {
      console.warn("[mobile/push] channel setup failed:", err);
    }
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    return { ok: false, reason: "Notification permission denied." };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId || projectId === "REPLACE_WITH_EAS_PROJECT_ID") {
    return {
      ok: false,
      reason: "EAS projectId is not configured. Run `eas init` to provision one.",
    };
  }

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    token = result.data;
  } catch (err) {
    return {
      ok: false,
      reason: `Failed to get Expo push token: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const sent = await sendTokenToBackend(token);
  if (!sent.ok) {
    return { ok: false, reason: sent.reason, token };
  }
  return { ok: true, token };
}

interface BackendAck {
  ok: boolean;
  reason?: string;
}

async function sendTokenToBackend(expoPushToken: string): Promise<BackendAck> {
  const sb = getSupabase();
  const { data: sessionData } = await sb.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { ok: false, reason: "Not signed in." };
  }

  const url = `${getAppUrl().replace(/\/$/, "")}/api/mobile/push-tokens`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token: expoPushToken,
        platform: Platform.OS,
        device_name: Device.deviceName ?? null,
        os_version: Device.osVersion ?? null,
        app_version: Constants.expoConfig?.version ?? null,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function unregisterPushToken(): Promise<void> {
  // We deliberately leave the token row in place — backend can clean
  // up stale tokens after delivery failures. This is just a local hint
  // that the user opted out; we revoke server-side via /api/mobile/push-tokens DELETE.
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return;

  const url = `${getAppUrl().replace(/\/$/, "")}/api/mobile/push-tokens`;
  try {
    await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    console.warn("[mobile/push] unregister failed:", err);
  }
}
