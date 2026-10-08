import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DailyRewardsCard } from "../lib/DailyRewardsCard";
import { useApp } from "../lib/AppContext";
import { colors, Screen, sharedStyles } from "../lib/ui";

export default function WeeklySpinScreen() {
  const { refreshing, refresh } = useApp();
  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.grow}>
          <Text style={sharedStyles.kicker}>STREAKS & SPIN</Text>
          <Text style={sharedStyles.title}>Keep the fun going.</Text>
          <Text style={sharedStyles.subtitle}>Claim your daily streak, finish the 7-day challenge and use your weekly SP Wheel.</Text>
        </View>
      </View>
      <DailyRewardsCard />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  grow: { flex: 1 },
  backButton: { alignItems: "center", backgroundColor: "#F2E9FF", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
});
