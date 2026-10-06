import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { THEMES } from '@/lib/game';
import { useGame } from '@/store/game-store';

const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;
export default function TabsLayout() {
  const game = useGame(); const c = THEMES[game.theme];
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: c.bg2, borderTopColor: c.border, height: 72, paddingTop: 7 }, tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.muted, tabBarLabelStyle: { fontWeight: '700', fontSize: 11 } }}>
    <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('flash') }} />
    <Tabs.Screen name="quests" options={{ title: 'Goals', tabBarIcon: icon('flag') }} />
    <Tabs.Screen name="rewards" options={{ title: 'Rewards', tabBarIcon: icon('gift') }} />
    <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('stats-chart') }} />
    <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: icon('person') }} />
  </Tabs>;
}