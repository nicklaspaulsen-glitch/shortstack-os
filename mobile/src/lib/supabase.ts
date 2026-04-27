import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// Hybrid storage: Supabase reads/writes session JSON via this adapter.
// We prefer SecureStore (Keychain on iOS, EncryptedSharedPreferences on
// Android) for the access + refresh tokens, but Supabase serializes the
// whole session as one blob keyed by `sb-<project>-auth-token`. Some
// Android devices have a 2 KB cap per SecureStore entry, so we fall
// back to AsyncStorage when the payload is too large.
//
// The SDK uses string keys, so we route by key prefix:
//   - sb-*-auth-token  -> SecureStore (auth blob, sensitive)
//   - everything else  -> AsyncStorage
const SECURE_STORE_VALUE_LIMIT = 2048;

interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const hybridStorage: StorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (key.includes("auth-token")) {
      try {
        const v = await SecureStore.getItemAsync(key.replace(/[^A-Za-z0-9._-]/g, "_"));
        if (v) return v;
      } catch {
        // SecureStore unavailable on this device — fall through to async storage.
      }
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (key.includes("auth-token") && value.length <= SECURE_STORE_VALUE_LIMIT) {
      try {
        await SecureStore.setItemAsync(key.replace(/[^A-Za-z0-9._-]/g, "_"), value);
        return;
      } catch {
        // Fall back to AsyncStorage.
      }
    }
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (key.includes("auth-token")) {
      try {
        await SecureStore.deleteItemAsync(key.replace(/[^A-Za-z0-9._-]/g, "_"));
      } catch {
        // best-effort
      }
    }
    await AsyncStorage.removeItem(key);
  },
};

interface ExtraConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  appUrl?: string;
}

function readExtra(): ExtraConfig {
  const cfg = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
  return cfg;
}

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const extra = readExtra();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl;
  // The anon key is intentionally bundled — it is the public-side key
  // and Supabase RLS is what actually enforces access.
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? "";

  if (!url) {
    throw new Error(
      "[mobile] Supabase URL missing. Set EXPO_PUBLIC_SUPABASE_URL or expo.extra.supabaseUrl in app.json."
    );
  }
  if (!anonKey) {
    throw new Error(
      "[mobile] Supabase anon key missing. Set EXPO_PUBLIC_SUPABASE_ANON_KEY at build time."
    );
  }

  _client = createClient(url, anonKey, {
    auth: {
      storage: hybridStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

export function getAppUrl(): string {
  const extra = readExtra();
  return process.env.EXPO_PUBLIC_APP_URL ?? extra.appUrl ?? "https://app.shortstack.work";
}
