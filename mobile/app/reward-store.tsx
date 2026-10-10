import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../lib/AppContext";
import { supabase } from "../lib/supabase";
import { Card, colors, iconPalette, Screen, sharedStyles } from "../lib/ui";

type Reward = { id: string; name: string; description: string; points_cost: number; inventory: number | null };
type Redemption = { id: string; points_cost: number; status: string; created_at: string };

export default function RewardStoreScreen() {
  const { member, refreshing, refresh } = useApp();
  const [points, setPoints] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!member?.id) return;
    setLoading(true);
    const [ledger, catalogue, history] = await Promise.all([
      supabase.from("member_points_ledger").select("points").eq("member_id", member.id),
      supabase.from("reward_catalog").select("id,name,description,points_cost,inventory").eq("active", true).order("points_cost"),
      supabase.from("reward_redemptions").select("id,points_cost,status,created_at").eq("member_id", member.id).order("created_at", { ascending: false }).limit(10),
    ]);
    setPoints((ledger.data ?? []).reduce((sum, row) => sum + Number(row.points || 0), 0));
    setRewards((catalogue.data ?? []) as Reward[]);
    setRedemptions((history.data ?? []) as Redemption[]);
    setLoading(false);
  }, [member?.id]);

  useEffect(() => { void load(); }, [load]);

  async function redeem(reward: Reward) {
    if (points < reward.points_cost || redeeming) return;
    Alert.alert("Redeem reward?", `${reward.name} costs ${reward.points_cost.toLocaleString()} SP Points.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Redeem", onPress: () => void (async () => {
        setRedeeming(reward.id);
        const { error } = await supabase.rpc("redeem_my_reward", { p_reward_id: reward.id });
        setRedeeming(null);
        if (error) { Alert.alert("Could not redeem", error.message || "Please try again."); return; }
        Alert.alert("Redemption requested", "Reception/management can now process this reward.");
        await load();
      })() },
    ]);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void refresh(); void load(); }}>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable>
        <View style={styles.grow}>
          <Text style={sharedStyles.kicker}>REWARD STORE</Text>
          <Text style={sharedStyles.title}>Treat yourself.</Text>
          <Text style={sharedStyles.subtitle}>Use the SP Points you earn from real activity to claim available Super Plus rewards.</Text>
        </View>
      </View>

      <View style={styles.balanceStrip}>
        <Ionicons name="sparkles" size={20} color="#8A5A00" />
        <Text style={styles.balanceText}>{points.toLocaleString()} SP available</Text>
      </View>

      {loading ? (
        <Card style={styles.loading}><ActivityIndicator color={colors.green2} /></Card>
      ) : rewards.length ? rewards.map((reward, index) => {
        const unavailable = reward.inventory === 0;
        const enough = points >= reward.points_cost;
        const palette = ["#F2E9FF", "#FFF0D8", "#E9F8F4", "#FFE9E2"];
        return (
          <View key={reward.id} style={[styles.rewardCard, { backgroundColor: palette[index % palette.length] }]}>
            <View style={styles.rewardTop}>
              <View style={styles.rewardIcon}><Ionicons name="gift-outline" size={22} color={iconPalette.pink.fg} /></View>
              <View style={styles.grow}>
                <Text style={styles.rewardTitle}>{reward.name}</Text>
                <Text style={styles.rewardText}>{reward.description}</Text>
                <Text style={styles.rewardCost}>{reward.points_cost.toLocaleString()} SP Points</Text>
              </View>
            </View>
            <Pressable disabled={!enough || unavailable || redeeming === reward.id} onPress={() => void redeem(reward)} style={[styles.redeemButton, (!enough || unavailable) && styles.disabled]}>
              {redeeming === reward.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.redeemText}>{unavailable ? "Unavailable" : enough ? "Redeem reward" : "Keep earning"}</Text>}
            </Pressable>
          </View>
        );
      }) : (
        <Card><Text style={styles.empty}>No redeemable reward has been published yet.</Text></Card>
      )}

      {!!redemptions.length && (
        <>
          <Text style={styles.sectionTitle}>Recent redemptions</Text>
          <Card>
            {redemptions.map((item, index) => (
              <View key={item.id} style={[styles.historyRow, index > 0 && styles.border]}>
                <Ionicons name="gift-outline" size={18} color={iconPalette.pink.fg} />
                <View style={styles.grow}>
                  <Text style={styles.historyTitle}>{item.points_cost.toLocaleString()} SP</Text>
                  <Text style={styles.historyText}>{item.status === "rejected" || item.status === "cancelled" ? item.status + " · points returned" : item.status}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  grow: { flex: 1 },
  backButton: { alignItems: "center", backgroundColor: "#E9F8F4", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  balanceStrip: { alignItems: "center", backgroundColor: "#FFF1C9", borderRadius: 16, flexDirection: "row", gap: 9, padding: 14 },
  balanceText: { color: "#5D4200", fontSize: 13, fontWeight: "900" },
  loading: { alignItems: "center", paddingVertical: 28 },
  rewardCard: { borderRadius: 22, padding: 17 },
  rewardTop: { flexDirection: "row", gap: 11 },
  rewardIcon: { alignItems: "center", backgroundColor: "#FFFFFFB8", borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  rewardTitle: { color: "#241D2A", fontSize: 15, fontWeight: "900" },
  rewardText: { color: "#665D6B", fontSize: 11, lineHeight: 17, marginTop: 3 },
  rewardCost: { color: "#7A50C7", fontSize: 11, fontWeight: "900", marginTop: 7 },
  redeemButton: { alignItems: "center", backgroundColor: "#E44824", borderRadius: 13, justifyContent: "center", marginTop: 14, minHeight: 46 },
  disabled: { opacity: 0.42 },
  redeemText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  empty: { color: colors.muted, fontSize: 12, textAlign: "center" },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: 3 },
  historyRow: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 7 },
  border: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 6, paddingTop: 13 },
  historyTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  historyText: { color: colors.muted, fontSize: 10, marginTop: 2, textTransform: "capitalize" },
});
