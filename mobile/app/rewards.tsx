import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { DailyRewardsCard } from "../lib/DailyRewardsCard";
import { useApp } from "../lib/AppContext";
import { supabase } from "../lib/supabase";
import { Card, colors, iconPalette, Screen, sharedStyles } from "../lib/ui";

type Reward = {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  inventory: number | null;
};

type Redemption = {
  id: string;
  reward_id: string;
  points_cost: number;
  status: string;
  created_at: string;
};

export default function RewardsScreen() {
  const { session, member, refreshing, refresh } = useApp();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [points, setPoints] = useState(0);
  const [visitPoints, setVisitPoints] = useState(10);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!member?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    await supabase.rpc("sync_my_engagement");

    const [ledgerResult, rewardsResult, redemptionsResult, settingsResult] = await Promise.all([
      supabase.from("member_points_ledger").select("points").eq("member_id", member.id),
      supabase.from("reward_catalog").select("id,name,description,points_cost,inventory").eq("active", true).order("points_cost"),
      supabase.from("reward_redemptions").select("id,reward_id,points_cost,status,created_at").eq("member_id", member.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("app_engagement_settings").select("visit_points").eq("id", "default").maybeSingle(),
    ]);

    setRewards((rewardsResult.data ?? []) as Reward[]);
    setRedemptions((redemptionsResult.data ?? []) as Redemption[]);
    setPoints((ledgerResult.data ?? []).reduce((sum, item) => sum + Number(item.points || 0), 0));
    setVisitPoints(Number(settingsResult.data?.visit_points ?? 10));
    setLoading(false);
  }, [member?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function redeem(reward: Reward) {
    if (points < reward.points_cost || redeeming) return;

    Alert.alert(
      "Redeem reward?",
      reward.name + " costs " + reward.points_cost.toLocaleString() + " SP Points.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Redeem",
          onPress: () => {
            void (async () => {
              setRedeeming(reward.id);
              const { error } = await supabase.rpc("redeem_my_reward", { p_reward_id: reward.id });
              setRedeeming(null);

              if (error) {
                Alert.alert("Could not redeem", error.message || "Please try again.");
                return;
              }

              Alert.alert("Redemption requested", "Reception or management can now process this reward.");
              await load();
            })();
          },
        },
      ],
    );
  }

  if (!session) return <Redirect href="/login" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void refresh(); void load(); }}>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.headingCopy}>
          <Text style={sharedStyles.kicker}>SP REWARDS</Text>
          <Text style={styles.title}>Membership rewards made simple.</Text>
          <Text style={sharedStyles.subtitle}>
            Earn SP Points through eligible check-ins, memberships, app activity and verified bonus activities.
          </Text>
        </View>
      </View>

      <View style={styles.pointsCard}>
        <Text style={styles.pointsLabel}>SP POINTS</Text>
        <Text style={styles.pointsValue}>{points.toLocaleString()}</Text>
        <Text style={styles.pointsNote}>
          Eligible reception check-ins earn {visitPoints} point{visitPoints === 1 ? "" : "s"} per day. Registration and membership renewals can also earn points.
        </Text>
      </View>

      {!!member && (
        <>
          <Card style={styles.bonusCard}>
            <View style={styles.bonusIcon}>
              <Ionicons name="sparkles" size={22} color={iconPalette.purple.fg} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.bonusTitle}>Bonus SP Points</Text>
              <Text style={styles.bonusText}>
                Earn one-time bonuses for private feedback and verified Instagram or TikTok follows.
              </Text>
            </View>
            <Pressable onPress={() => router.push("/bonus-points" as never)} style={styles.bonusButton}>
              <Text style={styles.bonusButtonText}>View</Text>
              <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
            </Pressable>
          </Card>

          <DailyRewardsCard onAward={() => void load()} />
        </>
      )}

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.green2} />
          <Text style={styles.loadingText}>Updating your rewards…</Text>
        </Card>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Available rewards</Text>
          {rewards.length ? (
            rewards.map((reward) => {
              const unavailable = reward.inventory === 0;
              const enough = points >= reward.points_cost;

              return (
                <Card key={reward.id}>
                  <View style={styles.rewardRow}>
                    <View style={styles.rewardIcon}>
                      <Ionicons name="gift-outline" size={22} color={iconPalette.pink.fg} />
                    </View>
                    <View style={styles.grow}>
                      <Text style={styles.rewardTitle}>{reward.name}</Text>
                      <Text style={styles.rewardText}>{reward.description}</Text>
                      <Text style={styles.rewardCost}>{reward.points_cost.toLocaleString()} SP Points</Text>
                    </View>
                  </View>

                  <Pressable
                    disabled={!enough || unavailable || redeeming === reward.id}
                    onPress={() => void redeem(reward)}
                    style={[styles.redeemButton, (!enough || unavailable) && styles.disabledButton]}
                  >
                    {redeeming === reward.id ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.redeemText}>
                        {unavailable ? "Unavailable" : enough ? "Redeem" : "Keep earning"}
                      </Text>
                    )}
                  </Pressable>
                </Card>
              );
            })
          ) : (
            <Card>
              <Text style={styles.emptyTitle}>Reward catalogue is ready.</Text>
              <Text style={styles.emptyText}>
                Management has not published a redeemable reward yet. Your points remain available.
              </Text>
            </Card>
          )}

          {!!redemptions.length && (
            <>
              <Text style={styles.sectionTitle}>Recent redemptions</Text>
              <Card>
                {redemptions.map((item, index) => (
                  <View key={item.id} style={[styles.redemptionRow, index > 0 && styles.border]}>
                    <Ionicons name="gift-outline" size={18} color={iconPalette.pink.fg} />
                    <View style={styles.grow}>
                      <Text style={styles.redemptionTitle}>{item.points_cost.toLocaleString()} points</Text>
                      <Text style={styles.redemptionMeta}>
                        {item.status === "rejected" || item.status === "cancelled"
                          ? item.status + " · points returned"
                          : item.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headingCopy: { flex: 1, gap: 5 },
  title: { color: colors.ink, fontSize: 29, fontWeight: "900", letterSpacing: -0.8, lineHeight: 34 },
  pointsCard: { backgroundColor: "#211A25", borderRadius: 24, padding: 22 },
  pointsLabel: { color: "#F4B7A8", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  pointsValue: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", letterSpacing: -0.6, marginTop: 3 },
  pointsNote: { color: "#E9E4E0", fontSize: 11, lineHeight: 17, marginTop: 5 },
  bonusCard: { alignItems: "center", flexDirection: "row", gap: 11 },
  bonusIcon: { alignItems: "center", backgroundColor: iconPalette.purple.bg, borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  grow: { flex: 1 },
  bonusTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  bonusText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  bonusButton: { alignItems: "center", backgroundColor: colors.green2, borderRadius: 11, flexDirection: "row", gap: 5, minHeight: 38, paddingHorizontal: 12 },
  bonusButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  loadingCard: { alignItems: "center", gap: 10, paddingVertical: 30 },
  loadingText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: 4 },
  rewardRow: { alignItems: "center", flexDirection: "row", gap: 11 },
  rewardIcon: { alignItems: "center", backgroundColor: iconPalette.pink.bg, borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  rewardTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  rewardText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  rewardCost: { color: colors.green2, fontSize: 11, fontWeight: "900", marginTop: 6 },
  redeemButton: { alignItems: "center", backgroundColor: colors.green2, borderRadius: 12, justifyContent: "center", marginTop: 13, minHeight: 46 },
  disabledButton: { opacity: 0.45 },
  redeemText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  redemptionRow: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 8 },
  border: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 5, paddingTop: 13 },
  redemptionTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  redemptionMeta: { color: colors.muted, fontSize: 10, marginTop: 3, textTransform: "capitalize" },
});
