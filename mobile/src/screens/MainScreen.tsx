import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import { getAppUrl, getSupabase } from "../lib/supabase";
import { theme } from "../theme";

interface MainScreenProps {
  onSignedOut: () => void;
}

export function MainScreen({ onSignedOut }: MainScreenProps) {
  const webRef = useRef<WebView>(null);
  const [tokens, setTokens] = useState<{ access: string; refresh: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      const access = data.session?.access_token;
      const refresh = data.session?.refresh_token;
      if (access && refresh) {
        setTokens({ access, refresh });
      } else {
        onSignedOut();
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [onSignedOut]);

  // Bridge script injected on every navigation. It sets the Supabase
  // session in localStorage if the host hasn't seen it yet — same
  // shape the web app's `@supabase/ssr` client expects to read.
  // We keep this idempotent and small.
  const injectedJS = useMemo(() => {
    if (!tokens) return "";
    const payload = JSON.stringify({
      access_token: tokens.access,
      refresh_token: tokens.refresh,
      // Web client recomputes expiry from the JWT; we just need the tokens.
      expires_at: 0,
      token_type: "bearer",
      user: null,
    });
    return `
      (function () {
        try {
          var k = Object.keys(window.localStorage).find(function (k) {
            return k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > -1;
          });
          var existing = k ? window.localStorage.getItem(k) : null;
          var payload = ${payload};
          if (!existing) {
            window.localStorage.setItem('sb-mobile-auth-token', JSON.stringify(payload));
          }
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'bridge-ready' }));
        } catch (e) {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'bridge-error', message: String(e) }));
        }
        true;
      })();
    `;
  }, [tokens]);

  function onMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string };
      if (data.type === "logout") {
        onSignedOut();
      }
    } catch {
      // Ignore malformed messages from the page.
    }
  }

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        source={{ uri: getAppUrl() }}
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.accent} size="large" />
          </View>
        )}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        decelerationRate="normal"
        allowsBackForwardNavigationGestures
        // We want the WebView to feel native — keep zooming off and
        // hide system scrollbars to match the in-app feel.
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        scalesPageToFit={false}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  web: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  loading: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
