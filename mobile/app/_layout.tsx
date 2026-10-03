import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "../lib/AppContext";
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
  if (typeof deepLink === "string" && deepLink.startsWith("/")) {
    router.push(deepLink as never);
  }
}

export default function RootLayout() {
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
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </AppProvider>
    </SafeAreaProvider>
  );
}
