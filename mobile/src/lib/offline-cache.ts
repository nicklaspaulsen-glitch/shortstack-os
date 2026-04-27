// Lightweight offline cache for the inbox screen.
// We persist the most recent N conversations + messages in AsyncStorage so
// the inbox renders instantly while a fresh fetch hydrates in the
// background. Last-write-wins; we never queue mutations offline.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_INBOX = "shortstack.inbox.v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface CachedConversation {
  id: string;
  preview: string;
  unread: boolean;
  updatedAt: string;
  channel?: string;
}

interface InboxBlob {
  cachedAt: number;
  conversations: CachedConversation[];
}

export async function readCachedInbox(): Promise<CachedConversation[] | null> {
  const raw = await AsyncStorage.getItem(KEY_INBOX);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as InboxBlob;
    if (Date.now() - parsed.cachedAt > MAX_AGE_MS) {
      await AsyncStorage.removeItem(KEY_INBOX);
      return null;
    }
    return parsed.conversations ?? [];
  } catch {
    await AsyncStorage.removeItem(KEY_INBOX);
    return null;
  }
}

export async function writeCachedInbox(items: CachedConversation[]): Promise<void> {
  const blob: InboxBlob = {
    cachedAt: Date.now(),
    conversations: items.slice(0, 100),
  };
  await AsyncStorage.setItem(KEY_INBOX, JSON.stringify(blob));
}

export async function clearOfflineCache(): Promise<void> {
  await AsyncStorage.multiRemove([KEY_INBOX]);
}
