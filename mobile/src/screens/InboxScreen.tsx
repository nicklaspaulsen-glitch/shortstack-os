import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  CachedConversation,
  readCachedInbox,
  writeCachedInbox,
} from "../lib/offline-cache";
import { getSupabase } from "../lib/supabase";
import { theme } from "../theme";

const PAGE_SIZE = 50;

export function InboxScreen() {
  const [items, setItems] = useState<CachedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const sb = getSupabase();
      const { data, error: dbError } = await sb
        .from("conversations")
        .select("id, last_message_preview, has_unread, updated_at, channel")
        .order("updated_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (dbError) {
        // We don't want to wipe the local cache on transient errors —
        // that's the whole point of offline support.
        setError(dbError.message);
        setStale(true);
        return;
      }

      const mapped: CachedConversation[] = (data ?? []).map((row) => ({
        id: String(row.id),
        preview: String(row.last_message_preview ?? ""),
        unread: Boolean(row.has_unread),
        updatedAt: String(row.updated_at ?? new Date().toISOString()),
        channel: row.channel ? String(row.channel) : undefined,
      }));
      setItems(mapped);
      setStale(false);
      await writeCachedInbox(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setStale(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readCachedInbox();
      if (!cancelled && cached && cached.length > 0) {
        setItems(cached);
        setLoading(false);
        setStale(true); // until network confirms
      }
      load(cached === null || cached.length === 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {stale && (
        <View style={styles.staleBanner}>
          <Text style={styles.staleText}>
            {error ? `Showing cached inbox — ${error}` : "Showing cached inbox..."}
          </Text>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(false);
            }}
            tintColor={theme.colors.accent}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => <Row item={item} />}
        contentContainerStyle={items.length === 0 ? styles.emptyWrap : undefined}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Inbox is empty</Text>
            <Text style={styles.emptyText}>
              You're all caught up. New conversations will appear here.
            </Text>
          </View>
        )}
      />
    </View>
  );
}

interface RowProps {
  item: CachedConversation;
}

function Row({ item }: RowProps) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowMain}>
        <Text style={styles.rowPreview} numberOfLines={2}>
          {item.preview || "(no preview)"}
        </Text>
        <View style={styles.rowMeta}>
          {item.channel && <Text style={styles.channelTag}>{item.channel}</Text>}
          <Text style={styles.rowTime}>{relative(item.updatedAt)}</Text>
        </View>
      </View>
      {item.unread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

function relative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  center: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  staleBanner: {
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  staleText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.bg,
  },
  rowPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  rowMain: {
    flex: 1,
  },
  rowPreview: {
    color: theme.colors.text,
    fontSize: theme.font.body,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  channelTag: {
    color: theme.colors.accentSoft,
    fontSize: theme.font.small,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  rowTime: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.gold,
    marginLeft: theme.spacing.md,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.font.h3,
    fontWeight: "600",
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    marginTop: theme.spacing.sm,
    textAlign: "center",
  },
});
