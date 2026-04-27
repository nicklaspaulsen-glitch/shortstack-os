import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { InboxScreen } from "./src/screens/InboxScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { MainScreen } from "./src/screens/MainScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { getSupabase } from "./src/lib/supabase";
import { theme } from "./src/theme";

type AuthStatus = "loading" | "signed-in" | "signed-out";

const Tab = createBottomTabNavigator();

export default function App() {
  const [auth, setAuth] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    const sb = getSupabase();

    (async () => {
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      setAuth(data.session ? "signed-in" : "signed-out");
    })();

    const sub = sb.auth.onAuthStateChange((_event, session) => {
      setAuth(session ? "signed-in" : "signed-out");
    });

    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  if (auth === "loading") {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  if (auth === "signed-out") {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <LoginScreen onSignedIn={() => setAuth("signed-in")} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTitleStyle: { color: theme.colors.text },
          headerTintColor: theme.colors.text,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
          tabBarActiveTintColor: theme.colors.gold,
          tabBarInactiveTintColor: theme.colors.textMuted,
        }}
      >
        <Tab.Screen
          name="Home"
          options={{
            title: "ShortStack",
            tabBarIcon: ({ color, size }) => <TabIcon glyph="◆" color={color} size={size} />,
          }}
        >
          {() => <MainScreen onSignedOut={() => setAuth("signed-out")} />}
        </Tab.Screen>
        <Tab.Screen
          name="Inbox"
          component={InboxScreen}
          options={{
            tabBarIcon: ({ color, size }) => <TabIcon glyph="✉" color={color} size={size} />,
          }}
        />
        <Tab.Screen
          name="Settings"
          options={{
            tabBarIcon: ({ color, size }) => <TabIcon glyph="⚙" color={color} size={size} />,
          }}
        >
          {() => <SettingsScreen onSignedOut={() => setAuth("signed-out")} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

interface TabIconProps {
  glyph: string;
  color: string;
  size: number;
}

function TabIcon({ glyph, color, size }: TabIconProps) {
  return <Text style={{ color, fontSize: size }}>{glyph}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  loading: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
