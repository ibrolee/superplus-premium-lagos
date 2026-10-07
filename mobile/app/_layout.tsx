import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "../lib/AppContext";
import { AppearanceProvider, useAppearancePreference } from "../lib/appearance";
import { colors } from "../lib/ui";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function openNotificationResponse(response: Notifications.NotificationResponse | null) {
  const deepLink = response?.notification.request.content.data?.deep_link;
  const blocked = ["/blog", "/workouts", "/goal"];
  if (
    typeof deepLink === "string" &&
    deepLink.startsWith("/") &&
    !blocked.some((path) => deepLink.startsWith(path))
  ) {
    router.push(deepLink as never);
  }
}

function AppShell() {
  const { colorScheme } = useAppearancePreference();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      openNotificationResponse,
    );

    void Notifications.getLastNotificationResponseAsync().then(
      openNotificationResponse,
    );

    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <AppProvider>
          <AppShell />
        </AppProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}
