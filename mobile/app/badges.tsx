import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../lib/AppContext";
import { supabase } from "../lib/supabase";
import { Card, colors, iconPalette, Screen, sharedStyles } from "../lib/ui";

type Definition = { code: string; title: string; description: string; visit_threshold: number; points_reward: number };
type Earned = { achievement_code: string; awarded_at: string };

export default function BadgesScreen() {
  const { member, refreshing, refresh } = useApp();
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [earned, setEarned] = useState<Earned[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!member?.id) return;
    setLoading(true);
    await supabase.rpc("sync_my_engagement");
    const [defs, mine] = await Promise.all([
      supabase.from("achievement_definitions").select("code,title,description,visit_threshold,points_reward").eq("active", true).order("visit_threshold"),
      supabase.from("member_achievements").select("achievement_code,awarded_at").eq("member_id", member.id),
    ]);
    setDefinitions((defs.data ?? []) as Definition[]);
    setEarned((mine.data ?? []) as Earned[]);
    setLoading(false);
  }, [member?.id]);

  useEffect(() => { void load(); }, [load]);
  const earnedCodes = useMemo(() => new Set(earned.map((item) => item.achievement_code)), [earned]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void refresh(); void load(); }}>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable>
        <View style={styles.grow}>
          <Text style={sharedStyles.kicker}>BADGES</Text>
          <Text style={sharedStyles.title}>Your milestones.</Text>
          <Text style={sharedStyles.subtitle}>Every badge marks real consistency. Locked badges show what you can unlock next.</Text>
        </View>
      </View>
      {loading ? (
        <Card style={styles.loading}><ActivityIndicator color={colors.green2} /></Card>
      ) : (
        <View style={styles.grid}>
          {definitions.map((item) => {
            const unlocked = earnedCodes.has(item.code);
            return (
              <View key={item.code} style={[styles.badgeCard, unlocked ? styles.unlocked : styles.locked]}>
                <View style={[styles.badgeIcon, unlocked && styles.badgeIconUnlocked]}>
                  <Ionicons name={unlocked ? "trophy" : "lock-closed"} size={24} color={unlocked ? "#FFFFFF" : iconPalette.purple.fg} />
                </View>
                <Text style={styles.badgeTitle}>{item.title}</Text>
                <Text style={styles.badgeText}>{item.description}</Text>
                <Text style={styles.badgeMeta}>{unlocked ? "Unlocked" : `${item.visit_threshold} visits`} · +{item.points_reward} SP</Text>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  grow: { flex: 1 },
  backButton: { alignItems: "center", backgroundColor: "#FFF0D8", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  loading: { alignItems: "center", paddingVertical: 28 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeCard: { borderRadius: 20, minHeight: 180, padding: 15, width: "48%" },
  unlocked: { backgroundColor: "#FFF0D8" },
  locked: { backgroundColor: "#F4F0F6" },
  badgeIcon: { alignItems: "center", backgroundColor: iconPalette.purple.bg, borderRadius: 999, height: 46, justifyContent: "center", width: 46 },
  badgeIconUnlocked: { backgroundColor: "#B77800" },
  badgeTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 12 },
  badgeText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  badgeMeta: { color: "#7A50C7", fontSize: 10, fontWeight: "900", marginTop: 9 },
});
