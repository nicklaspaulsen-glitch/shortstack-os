import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { biometricGate, isBiometricAvailable } from "../lib/biometric";
import { getSupabase } from "../lib/supabase";
import { theme } from "../theme";

interface LoginScreenProps {
  onSignedIn: () => void;
}

type Mode = "signin" | "signup";

export function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setSubmitting(true);
    try {
      const sb = getSupabase();
      const { error: authError } =
        mode === "signin"
          ? await sb.auth.signInWithPassword({ email: email.trim(), password })
          : await sb.auth.signUp({ email: email.trim(), password });

      if (authError) {
        setError(authError.message);
        return;
      }

      // After a successful sign-in, gate behind biometric on devices that
      // support it. Sign-up flows skip the gate (the user just enrolled).
      if (mode === "signin" && (await isBiometricAvailable())) {
        const gate = await biometricGate("Confirm it's you to open ShortStack");
        if (!gate.ok) {
          await sb.auth.signOut();
          setError("Biometric check failed. Try again.");
          return;
        }
      }
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>ShortStack</Text>
        <Text style={styles.tagline}>
          Your agency operating system. On the go.
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@agency.com"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!submitting}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            submitting && styles.buttonDisabled,
            pressed && !submitting && styles.buttonPressed,
          ]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.text} />
          ) : (
            <Text style={styles.buttonText}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
          }}
          disabled={submitting}
          style={styles.swap}
        >
          <Text style={styles.swapText}>
            {mode === "signin"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.spacing.lg,
    justifyContent: "center",
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  brand: {
    color: theme.colors.gold,
    fontSize: theme.font.h1,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  tagline: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    color: theme.colors.text,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: theme.font.body,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.font.small,
    marginTop: theme.spacing.md,
  },
  button: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  buttonPressed: {
    backgroundColor: theme.colors.accentSoft,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    fontWeight: "600",
  },
  swap: {
    marginTop: theme.spacing.lg,
    alignItems: "center",
  },
  swapText: {
    color: theme.colors.accentSoft,
    fontSize: theme.font.small,
  },
});
