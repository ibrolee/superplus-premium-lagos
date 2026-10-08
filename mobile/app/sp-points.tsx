import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../lib/AppContext";
import { supabase } from "../lib/supabase";
import { Card, colors, dateLabel, Screen, sharedStyles } from "../lib/ui";

type Ledger = { id: string; points: number; reason: string; created_at: string };

export default function SpPointsScreen() {
  const { member, refreshing, refresh } = useApp();
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!member?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("member_points_ledger")
      .select("id,points,reason,created_at")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setLedger((data ?? []) as Ledger[]);
    setLoading(false);
  }, [member?.id]);

  useEffect(() => { void load(); }, [load]);
  const balance = ledger.reduce((sum, row) => sum + Number(row.points || 0), 0);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void refresh(); void load(); }}>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable>
        <View style={styles.grow}>
          <Text style={sharedStyles.kicker}>SP POINTS</Text>
          <Text style={sharedStyles.title}>Your balance.</Text>
          <Text style={sharedStyles.subtitle}>Earn from gym visits, memberships, challenges, streaks, badges and approved bonus activities.</Text>
        </View>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
        <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
        <Text style={styles.balanceText}>SP Points have no cash value. Use them for rewards published by Super Plus.</Text>
        <Pressable style={styles.bonusButton} onPress={() => router.push("/bonus-points" as never)}>
          <Ionicons name="flash" size={17} color="#FFFFFF" />
          <Text style={styles.bonusText}>See bonus ways to earn</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Recent activity</Text>
      {loading ? (
        <Card style={styles.loading}><ActivityIndicator color={colors.green2} /></Card>
      ) : ledger.length ? (
        <Card>
          {ledger.map((item, index) => (
            <View key={item.id} style={[styles.row, index > 0 && styles.border]}>
              <View style={[styles.pointBubble, item.points < 0 && styles.pointBubbleSpent]}>
                <Text style={[styles.pointNumber, item.points < 0 && styles.pointNumberSpent]}>
                  {item.points > 0 ? "+" : ""}{Number(item.points).toLocaleString()}
                </Text>
              </View>
              <View style={styles.grow}>
                <Text style={styles.reason}>{item.reason}</Text>
                <Text style={styles.date}>{dateLabel(item.created_at)}</Text>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <Card><Text style={styles.empty}>Your SP Points activity will appear here.</Text></Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  grow: { flex: 1 },
  backButton: { alignItems: "center", backgroundColor: "#FFF1C9", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  balanceCard: { backgroundColor: "#2F2340", borderRadius: 26, padding: 22 },
  balanceLabel: { color: "#F7C8B8", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  balanceValue: { color: "#FFFFFF", fontSize: 43, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  balanceText: { color: "#E9DFEF", fontSize: 11, lineHeight: 17, marginTop: 5 },
  bonusButton: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#E44824", borderRadius: 12, flexDirection: "row", gap: 7, marginTop: 15, minHeight: 42, paddingHorizontal: 13 },
  bonusText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: 3 },
  loading: { alignItems: "center", paddingVertical: 28 },
  row: { alignItems: "center", flexDirection: "row", gap: 11, paddingVertical: 7 },
  border: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 6, paddingTop: 13 },
  pointBubble: { alignItems: "center", backgroundColor: "#E9F8F4", borderRadius: 12, minWidth: 62, paddingHorizontal: 9, paddingVertical: 10 },
  pointBubbleSpent: { backgroundColor: "#FFE9E2" },
  pointNumber: { color: "#187B6C", fontSize: 12, fontWeight: "900" },
  pointNumberSpent: { color: "#B43B1D" },
  reason: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  date: { color: colors.muted, fontSize: 9, marginTop: 3 },
  empty: { color: colors.muted, fontSize: 12, textAlign: "center" },
});
