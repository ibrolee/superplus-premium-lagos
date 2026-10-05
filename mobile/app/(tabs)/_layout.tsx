import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { useApp } from "../../lib/AppContext";
import { colors, iconPalette, LoadingView } from "../../lib/ui";

type IconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  name,
  color,
  focused,
  tone,
}: {
  name: IconName;
  color: ComponentProps<typeof Ionicons>["color"];
  focused: boolean;
  tone: { bg: string; fg: string };
}) {
  if (!focused) return <Ionicons name={name} color={color} size={22} />;

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: tone.bg,
        borderRadius: 12,
        height: 34,
        justifyContent: "center",
        width: 42,
      }}
    >
      <Ionicons name={name} color={tone.fg} size={22} />
    </View>
  );
}

export default function TabsLayout() {
  const { authLoading, session } = useApp();
  const insets = useSafeAreaInsets();

  if (authLoading) return <LoadingView />;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: "#849188",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800", marginBottom: 4 },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: colors.line,
          height: 62 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 7,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} color={color} focused={focused} tone={iconPalette.orange} />
          ),
        }}
      />
      <Tabs.Screen
        name="membership"
        options={{
          title: "Membership",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "card" : "card-outline"} color={color} focused={focused} tone={iconPalette.blue} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "stats-chart" : "stats-chart-outline"}
              color={color}
              focused={focused}
              tone={iconPalette.teal}
            />
          ),
        }}
      />
      <Tabs.Screen name="blog" options={{
        title: "Blog",
        tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "book" : "book-outline"} color={color} focused={focused} tone={iconPalette.gold} />,
      }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "person-circle" : "person-circle-outline"}
              color={color}
              focused={focused}
              tone={iconPalette.purple}
            />
          ),
        }}
      />
    </Tabs>
  );
}
