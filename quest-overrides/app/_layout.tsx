import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import React, { useEffect } from 'react';
import { GameProvider, useGame } from '@/store/game-store';
import { THEMES } from '@/lib/game';
import { syncQuestNotifications } from '@/lib/notifications';
import { refreshQuestAndroidWidget } from '@/lib/android-widget';

function Navigation() {
  const game = useGame(); const c = THEMES[game.theme];
  useEffect(() => {
    if (!game.hydrated) return;
    syncQuestNotifications({ preferences: game.notificationPreferences, campaigns: game.campaigns }).catch(() => undefined);
  }, [game.hydrated, game.notificationPreferences, game.campaigns]);
  useEffect(() => {
    if (!game.hydrated) return;
    refreshQuestAndroidWidget(game).catch(() => undefined);
  }, [game.hydrated, game.campaigns, game.quests, game.dailyPlans, game.momentum]);
  useEffect(() => {
    const openRoute = (response: Notifications.NotificationResponse | null | undefined) => {
      const route = response?.notification.request.content.data?.route;
      if (typeof route === 'string') {
        setTimeout(() => router.push(route as any), 80);
        Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      }
    };
    Notifications.getLastNotificationResponseAsync().then(openRoute).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(openRoute);
    return () => sub.remove();
  }, []);
  return <>
    <StatusBar style={game.theme === 'dark' ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerStyle: { backgroundColor: c.bg }, headerTintColor: c.text, contentStyle: { backgroundColor: c.bg }, headerShadowVisible: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="new-campaign" options={{ title: 'Create Goals', presentation: 'modal' }} />
      <Stack.Screen name="new-quest" options={{ title: 'New Quest', presentation: 'modal' }} />
      <Stack.Screen name="new-reward" options={{ title: 'New Reward', presentation: 'modal' }} />
      <Stack.Screen name="daily-plan" options={{ title: 'Smart Daily Plan' }} />
      <Stack.Screen name="evening-review" options={{ title: 'Evening Review' }} />
      <Stack.Screen name="weekly-review" options={{ title: 'Weekly Review' }} />
      <Stack.Screen name="notification-settings" options={{ title: 'Notifications' }} />
      <Stack.Screen name="widget-settings" options={{ title: 'Home Screen Widget' }} />
      <Stack.Screen name="campaign/[id]" options={{ title: 'Goal' }} />
    </Stack>
  </>;
}
export default function RootLayout() { return <GameProvider><Navigation /></GameProvider>; }