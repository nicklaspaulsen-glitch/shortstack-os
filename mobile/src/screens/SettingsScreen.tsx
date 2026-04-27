import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { clearOfflineCache } from "../lib/offline-cache";
import {
  registerForPushNotifications,
  unregisterPushToken,
} from "../lib/push";
import { getSupabase } from "../lib/supabase";
import { theme } from "../theme";

interface SettingsScreenProps {
  onSignedOut: () => void;
}

export function SettingsScreen({ onSignedOut }: SettingsScreenProps) {
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      const { data } = await sb.auth.getUser();
      if (!cancelled && data.user?.email) {
        setEmail(data.user.email);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function togglePush(next: boolean) {
    setPushBusy(true);
    setPushMsg(null);
    try {
      if (next) {
        const r = await registerForPushNotifications();
        if (r.ok) {
          setPushOn(true);
          setPushMsg("Push notifications enabled.");
        } else {
          setPushOn(false);
          setPushMsg(r.reason ?? "Could not enable push.");
        }
      } else {
        await unregisterPushToken();
        setPushOn(false);
        setPushMsg("Push notifications disabled.");
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      const sb = getSupabase();
      await sb.auth.signOut();
      await clearOfflineCache();
      onSignedOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Signed in as</Text>
        <Text style={styles.cardValue}>{email || "—"}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.flex1}>
            <Text style={styles.cardLabel}>Push notifications</Text>
            <Text style={styles.cardSub}>
              Get pinged when a client replies, a campaign finishes, or
              an automation needs your attention.
            </Text>
          </View>
          {pushBusy ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <Switch
              value={pushOn}
              onValueChange={togglePush}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
              thumbColor={theme.colors.text}
            />
          )}
        </View>
        {pushMsg && <Text style={styles.cardSub}>{pushMsg}</Text>}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.signOut,
          pressed && styles.signOutPressed,
          signingOut && styles.signOutDisabled,
        ]}
        onPress={signOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : (
          <Text style={styles.signOutText}>Sign out</Text>
        )}
      </Pressable>

      <Text style={styles.footer}>
        ShortStack OS · v0.1.0 · build {new Date().getFullYear()}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  heading: {
    color: theme.colors.text,
    fontSize: theme.font.h2,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  flex1: { flex: 1 },
  cardLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  cardValue: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    marginTop: theme.spacing.xs,
  },
  cardSub: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    marginTop: theme.spacing.sm,
  },
  signOut: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  signOutPressed: {
    opacity: 0.85,
  },
  signOutDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    fontWeight: "600",
  },
  footer: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    textAlign: "center",
    marginTop: theme.spacing.xl,
  },
});
