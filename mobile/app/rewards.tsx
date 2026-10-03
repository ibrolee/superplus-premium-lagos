import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../lib/AppContext";
import { supabase } from "../lib/supabase";
import { uniqueVisitDates } from "../lib/visit-goals";
import { Card, colors, Screen, sharedStyles } from "../lib/ui";

type AchievementDefinition = {
  code: string;
  title: string;
  description: string;
  visit_threshold: number;
  points_reward: number;
};

type MemberAchievement = {
  achievement_code: string;
  awarded_at: string;
};

type Challenge = {
  id: string;
  title: string;
  description: string;
  starts_on: string;
  ends_on: string;
  target_visits: number;
  points_reward: number;
};

type ChallengeCompletion = { challenge_id: string; completed_at: string };

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
  const { session, member, attendance, refreshing, refresh } = useApp();
  const [definitions, setDefinitions] = useState<AchievementDefinition[]>([]);
  const [earned, setEarned] = useState<MemberAchievement[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [completions, setCompletions] = useState<ChallengeCompletion[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [points, setPoints] = useState(0);
  const [visitPoints, setVisitPoints] = useState(1);
  const [programStartedAt, setProgramStartedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!member?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    await supabase.rpc("sync_my_engagement");

    const [
      definitionsResult,
      earnedResult,
      challengesResult,
      completionsResult,
      ledgerResult,
      rewardsResult,
      redemptionsResult,
      settingsResult,
    ] = await Promise.all([
      supabase.from("achievement_definitions").select("code,title,description,visit_threshold,points_reward").eq("active", true).order("visit_threshold"),
      supabase.from("member_achievements").select("achievement_code,awarded_at").eq("member_id", member.id),
      supabase.from("fitness_challenges").select("id,title,description,starts_on,ends_on,target_visits,points_reward").eq("active", true).order("ends_on"),
      supabase.from("member_challenge_completions").select("challenge_id,completed_at").eq("member_id", member.id),
      supabase.from("member_points_ledger").select("points").eq("member_id", member.id),
      supabase.from("reward_catalog").select("id,name,description,points_cost,inventory").eq("active", true).order("points_cost"),
      supabase.from("reward_redemptions").select("id,reward_id,points_cost,status,created_at").eq("member_id", member.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("app_engagement_settings").select("visit_points,program_started_at").eq("id", "default").maybeSingle(),
    ]);

    setDefinitions((definitionsResult.data ?? []) as AchievementDefinition[]);
    setEarned((earnedResult.data ?? []) as MemberAchievement[]);
    setChallenges((challengesResult.data ?? []) as Challenge[]);
    setCompletions((completionsResult.data ?? []) as ChallengeCompletion[]);
    setRewards((rewardsResult.data ?? []) as Reward[]);
    setRedemptions((redemptionsResult.data ?? []) as Redemption[]);
    setPoints((ledgerResult.data ?? []).reduce((sum, item) => sum + Number(item.points || 0), 0));
    setVisitPoints(Number(settingsResult.data?.visit_points ?? 1));
    setProgramStartedAt(settingsResult.data?.program_started_at ?? null);
    setLoading(false);
  }, [member?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const earnedCodes = useMemo(() => new Set(earned.map((item) => item.achievement_code)), [earned]);
  const completedChallengeIds = useMemo(() => new Set(completions.map((item) => item.challenge_id)), [completions]);
  const eligibleAttendance = useMemo(
    () =>
      programStartedAt
        ? attendance.filter(
            (item) => new Date(item.checked_in_at).getTime() >= new Date(programStartedAt).getTime(),
          )
        : attendance,
    [attendance, programStartedAt],
  );
  const visitDates = useMemo(() => uniqueVisitDates(eligibleAttendance), [eligibleAttendance]);

  async function redeem(reward: Reward) {
    if (points < reward.points_cost || redeeming) return;

    Alert.alert(
      "Redeem reward?",
      `${reward.name} costs ${reward.points_cost.toLocaleString()} SP Points.`,
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
              Alert.alert("Redemption requested", "Reception/management can now process this reward.");
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
          <Text style={sharedStyles.kicker}>REWARDS & CHALLENGES</Text>
          <Text style={styles.title}>Your consistency pays.</Text>
          <Text style={sharedStyles.subtitle}>
            Earn SP Points from real gym visits, memberships, milestones and active Super Plus challenges.
          </Text>
        </View>
      </View>

      <View style={styles.pointsCard}>
        <Text style={styles.pointsLabel}>SP POINTS</Text>
        <Text style={styles.pointsValue}>{points.toLocaleString()}</Text>
        <Text style={styles.pointsNote}>
          {visitPoints} point{visitPoints === 1 ? "" : "s"} per gym day from the SP Points launch onward, plus 5 points whenever you register or renew a paid membership plan. Multiple scans on the same day do not earn extra visit points, and you can also earn badge and challenge bonuses.
        </Text>
      </View>

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.loadingText}>Updating your rewards…</Text>
        </Card>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <View style={styles.achievementGrid}>
            {definitions.map((item) => {
              const unlocked = earnedCodes.has(item.code);
              return (
                <View key={item.code} style={[styles.achievementCard, !unlocked && styles.lockedCard]}>
                  <View style={[styles.badgeIcon, unlocked && styles.badgeUnlocked]}>
                    <Ionicons name={unlocked ? "trophy" : "lock-closed"} size={22} color={unlocked ? "#FFFFFF" : colors.muted} />
                  </View>
                  <Text style={styles.achievementTitle}>{item.title}</Text>
                  <Text style={styles.achievementText}>{item.description}</Text>
                  <Text style={styles.achievementPoints}>+{item.points_reward} pts</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Active challenges</Text>
          {challenges.length ? (
            challenges.map((challenge) => {
              const visits = visitDates.filter((day) => day >= challenge.starts_on && day <= challenge.ends_on).length;
              const percentage = Math.min(100, Math.round((visits / challenge.target_visits) * 100));
              const complete = completedChallengeIds.has(challenge.id) || visits >= challenge.target_visits;
              return (
                <Card key={challenge.id}>
                  <View style={styles.challengeTop}>
                    <View style={styles.grow}>
                      <Text style={styles.challengeTitle}>{challenge.title}</Text>
                      <Text style={styles.challengeText}>{challenge.description}</Text>
                    </View>
                    <Text style={styles.challengeReward}>+{challenge.points_reward}</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${percentage}%` as `${number}%` }]} />
                  </View>
                  <Text style={styles.challengeMeta}>
                    {complete ? "Completed 🎉" : `${visits}/${challenge.target_visits} visits`} · Ends {challenge.ends_on}
                  </Text>
                </Card>
              );
            })
          ) : (
            <Card><Text style={styles.emptyText}>No active challenge right now.</Text></Card>
          )}

          <Text style={styles.sectionTitle}>Rewards</Text>
          {rewards.length ? (
            rewards.map((reward) => {
              const unavailable = reward.inventory === 0;
              const enough = points >= reward.points_cost;
              return (
                <Card key={reward.id}>
                  <View style={styles.rewardRow}>
                    <View style={styles.rewardIcon}>
                      <Ionicons name="gift-outline" size={22} color={colors.green} />
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
                Management has not published a redeemable reward yet. Your points keep accumulating meanwhile.
              </Text>
            </Card>
          )}

          {!!redemptions.length && (
            <>
              <Text style={styles.sectionTitle}>Recent redemptions</Text>
              <Card>
                {redemptions.map((item, index) => (
                  <View key={item.id} style={[styles.redemptionRow, index > 0 && styles.border]}>
                    <Ionicons name="gift-outline" size={18} color={colors.green} />
                    <View style={styles.grow}>
                      <Text style={styles.redemptionTitle}>{item.points_cost.toLocaleString()} points</Text>
                      <Text style={styles.redemptionMeta}>{item.status}</Text>
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
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  headingCopy: { flex: 1, gap: 5 },
  title: { color: colors.ink, fontSize: 29, fontWeight: "900", letterSpacing: -0.8, lineHeight: 34 },
  pointsCard: { backgroundColor: colors.green, borderRadius: 24, padding: 22 },
  pointsLabel: { color: "#BFD2C2", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  pointsValue: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", letterSpacing: -0.6, marginTop: 3 },
  pointsNote: { color: "#D5E2D7", fontSize: 11, lineHeight: 17, marginTop: 5 },
  loadingCard: { alignItems: "center", gap: 10, paddingVertical: 30 },
  loadingText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: 4 },
  achievementGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achievementCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, padding: 14, width: "48%" },
  lockedCard: { opacity: 0.6 },
  badgeIcon: { alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: 999, height: 42, justifyContent: "center", width: 42 },
  badgeUnlocked: { backgroundColor: colors.green },
  achievementTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: 10 },
  achievementText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  achievementPoints: { color: colors.green2, fontSize: 10, fontWeight: "900", marginTop: 8 },
  challengeTop: { flexDirection: "row", gap: 12 },
  grow: { flex: 1 },
  challengeTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  challengeText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  challengeReward: { color: colors.green, fontSize: 13, fontWeight: "900" },
  track: { backgroundColor: colors.surfaceMuted, borderRadius: 999, height: 8, marginTop: 14, overflow: "hidden" },
  fill: { backgroundColor: colors.green, borderRadius: 999, height: "100%" },
  challengeMeta: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: 8 },
  rewardRow: { flexDirection: "row", gap: 12 },
  rewardIcon: { alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: 12, height: 44, justifyContent: "center", width: 44 },
  rewardTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  rewardText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  rewardCost: { color: colors.green2, fontSize: 11, fontWeight: "900", marginTop: 6 },
  redeemButton: { alignItems: "center", backgroundColor: colors.green, borderRadius: 12, justifyContent: "center", minHeight: 44, marginTop: 14 },
  disabledButton: { opacity: 0.4 },
  redeemText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  redemptionRow: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 7 },
  border: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 6, paddingTop: 13 },
  redemptionTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  redemptionMeta: { color: colors.muted, fontSize: 10, marginTop: 2, textTransform: "capitalize" },
});
