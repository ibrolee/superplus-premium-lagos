import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useApp } from "../../lib/AppContext";
import { colors, LoadingView } from "../../lib/ui";

type IconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color }: { name: IconName; color: ComponentProps<typeof Ionicons>["color"] }) {
  return <Ionicons name={name} color={color} size={23} />;
}

export default function TabsLayout() {
  const { authLoading, session } = useApp();

  if (authLoading) return <LoadingView />;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: "#849188",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800", marginBottom: 4 },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: colors.line,
          height: 70,
          paddingTop: 7,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="membership"
        options={{
          title: "Membership",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "card" : "card-outline"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="qr"
        options={{
          title: "QR Card",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "qr-code" : "qr-code-outline"} color={color} />
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
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "person-circle" : "person-circle-outline"}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
