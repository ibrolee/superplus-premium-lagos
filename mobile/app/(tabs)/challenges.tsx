import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../../lib/AppContext";
import { supabase } from "../../lib/supabase";
import { uniqueVisitDates } from "../../lib/visit-goals";
import { Card, colors, iconPalette, Screen, sharedStyles } from "../../lib/ui";

type Challenge = {
  id: string;
  title: string;
  description: string;
  starts_on: string;
  ends_on: string;
  target_visits: number;
  points_reward: number;
};

type DailyStatus = {
  streak: number;
  spun_this_week: boolean;
  balance: number;
};

export default function ChallengesScreen() {
  const { member, attendance, refreshing, refresh } = useApp();
  const [points, setPoints] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState(0);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [programStartedAt, setProgramStartedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!member?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    await supabase.rpc("sync_my_engagement");

    const [ledger, badges, activeChallenges, completions, dailyRewards, settings] = await Promise.all([
      supabase.from("member_points_ledger").select("points").eq("member_id", member.id),
      supabase.from("member_achievements").select("id").eq("member_id", member.id),
      supabase.from("fitness_challenges").select("id,title,description,starts_on,ends_on,target_visits,points_reward").eq("active", true).order("ends_on"),
      supabase.from("member_challenge_completions").select("challenge_id").eq("member_id", member.id),
      supabase.rpc("get_my_daily_rewards"),
      supabase.from("app_engagement_settings").select("program_started_at").eq("id", "default").maybeSingle(),
    ]);

    setPoints((ledger.data ?? []).reduce((sum, row) => sum + Number(row.points || 0), 0));
    setEarnedBadges((badges.data ?? []).length);
    setChallenges((activeChallenges.data ?? []) as Challenge[]);
    setCompletedIds(new Set((completions.data ?? []).map((row) => String(row.challenge_id))));
    setDaily((dailyRewards.data as DailyStatus) ?? null);
    setProgramStartedAt(settings.data?.program_started_at ?? null);
    setLoading(false);
  }, [member?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const visitDates = useMemo(() => {
    const eligible = programStartedAt
      ? attendance.filter((item) => new Date(item.checked_in_at).getTime() >= new Date(programStartedAt).getTime())
      : attendance;
    return uniqueVisitDates(eligible);
  }, [attendance, programStartedAt]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void refresh(); void load(); }}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}><Ionicons name="trophy" size={24} color="#FFFFFF" /></View>
          <View style={styles.grow}>
            <Text style={styles.heroEyebrow}>PLAY · EARN · UNLOCK</Text>
            <Text style={styles.heroTitle}>Challenges</Text>
          </View>
        </View>
        <Text style={styles.heroText}>
          Your points, streaks, badges, challenges and rewards — all together and one tap away.
        </Text>
      </View>

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.green2} />
          <Text style={styles.loadingText}>Loading your progress…</Text>
        </Card>
      ) : (
        <>
          <View style={styles.statsRow}>
            <Pressable style={[styles.statCard, styles.pointsStat]} onPress={() => router.push("/sp-points" as never)}>
              <Ionicons name="sparkles" size={20} color="#8A5A00" />
              <Text style={styles.statValue}>{points.toLocaleString()}</Text>
              <Text style={styles.statLabel}>SP POINTS</Text>
            </Pressable>
            <Pressable style={[styles.statCard, styles.streakStat]} onPress={() => router.push("/weekly-spin" as never)}>
              <Ionicons name="flame" size={20} color="#B43B1D" />
              <Text style={styles.statValue}>{daily?.streak ?? 0}</Text>
              <Text style={styles.statLabel}>DAY STREAK</Text>
            </Pressable>
            <Pressable style={[styles.statCard, styles.badgeStat]} onPress={() => router.push("/badges" as never)}>
              <Ionicons name="ribbon" size={20} color="#6C3DB6" />
              <Text style={styles.statValue}>{earnedBadges}</Text>
              <Text style={styles.statLabel}>BADGES</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Quick access</Text>
          <View style={styles.tileGrid}>
            <Pressable style={[styles.tile, { backgroundColor: "#F2E9FF" }]} onPress={() => router.push("/weekly-spin" as never)}>
              <View style={[styles.tileIcon, { backgroundColor: "#7A50C7" }]}><Ionicons name="disc-outline" size={23} color="#FFFFFF" /></View>
              <Text style={styles.tileTitle}>Weekly Spin</Text>
              <Text style={styles.tileText}>{daily?.spun_this_week ? "Spin used this week" : "Your weekly wheel"}</Text>
            </Pressable>
            <Pressable style={[styles.tile, { backgroundColor: "#FFF0D8" }]} onPress={() => router.push("/badges" as never)}>
              <View style={[styles.tileIcon, { backgroundColor: "#B77800" }]}><Ionicons name="medal-outline" size={23} color="#FFFFFF" /></View>
              <Text style={styles.tileTitle}>Badges</Text>
              <Text style={styles.tileText}>See earned & locked badges</Text>
            </Pressable>
            <Pressable style={[styles.tile, { backgroundColor: "#E9F8F4" }]} onPress={() => router.push("/reward-store" as never)}>
              <View style={[styles.tileIcon, { backgroundColor: "#187B6C" }]}><Ionicons name="gift-outline" size={23} color="#FFFFFF" /></View>
              <Text style={styles.tileTitle}>Rewards</Text>
              <Text style={styles.tileText}>Spend your SP Points</Text>
            </Pressable>
            <Pressable style={[styles.tile, { backgroundColor: "#FFE9E2" }]} onPress={() => router.push("/bonus-points" as never)}>
              <View style={[styles.tileIcon, { backgroundColor: "#E44824" }]}><Ionicons name="flash-outline" size={23} color="#FFFFFF" /></View>
              <Text style={styles.tileTitle}>Bonus Points</Text>
              <Text style={styles.tileText}>Extra ways to earn</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Active challenges</Text>
          {challenges.length ? challenges.map((challenge) => {
            const visits = visitDates.filter((day) => day >= challenge.starts_on && day <= challenge.ends_on).length;
            const percentage = Math.min(100, Math.round((visits / Math.max(1, challenge.target_visits)) * 100));
            const complete = completedIds.has(challenge.id) || visits >= challenge.target_visits;
            return (
              <Card key={challenge.id} style={styles.challengeCard}>
                <View style={styles.challengeTop}>
                  <View style={styles.challengeIcon}><Ionicons name={complete ? "checkmark" : "barbell-outline"} size={20} color="#FFFFFF" /></View>
                  <View style={styles.grow}>
                    <Text style={styles.challengeTitle}>{challenge.title}</Text>
                    <Text style={styles.challengeText}>{challenge.description}</Text>
                  </View>
                  <Text style={styles.challengeReward}>+{challenge.points_reward}</Text>
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: `${percentage}%` as `${number}%` }]} /></View>
                <Text style={styles.challengeMeta}>{complete ? "Completed 🎉" : `${visits}/${challenge.target_visits} visits`} · Ends {challenge.ends_on}</Text>
              </Card>
            );
          }) : (
            <Card><Text style={styles.emptyText}>No active challenge right now. New ones will appear here.</Text></Card>
          )}

          <Pressable style={styles.activityLink} onPress={() => router.push("/(tabs)/activity")}>
            <View style={styles.activityIcon}><Ionicons name="stats-chart-outline" size={20} color={iconPalette.teal.fg} /></View>
            <View style={styles.grow}>
              <Text style={styles.activityTitle}>Gym activity & visits</Text>
              <Text style={styles.activityText}>See your attendance, weekly goal and payment history.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  hero: { backgroundColor: "#2F2340", borderRadius: 26, padding: 20, overflow: "hidden" },
  heroTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  heroIcon: { alignItems: "center", backgroundColor: "#E44824", borderRadius: 15, height: 48, justifyContent: "center", width: 48 },
  heroEyebrow: { color: "#F7C8B8", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  heroTitle: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", letterSpacing: -0.8, marginTop: 2 },
  heroText: { color: "#E9DFEF", fontSize: 13, lineHeight: 20, marginTop: 12 },
  loadingCard: { alignItems: "center", gap: 10, paddingVertical: 28 },
  loadingText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: { borderRadius: 18, flex: 1, minHeight: 112, padding: 13, justifyContent: "space-between" },
  pointsStat: { backgroundColor: "#FFF1C9" },
  streakStat: { backgroundColor: "#FFE2D8" },
  badgeStat: { backgroundColor: "#ECE1FF" },
  statValue: { color: "#241D2A", fontSize: 23, fontWeight: "900", letterSpacing: -0.5 },
  statLabel: { color: "#554B5B", fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: 3 },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { borderRadius: 20, minHeight: 146, padding: 15, width: "48%" },
  tileIcon: { alignItems: "center", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  tileTitle: { color: "#241D2A", fontSize: 15, fontWeight: "900", marginTop: 13 },
  tileText: { color: "#6D6471", fontSize: 10, lineHeight: 15, marginTop: 4 },
  challengeCard: { backgroundColor: "#FFFDFB" },
  challengeTop: { alignItems: "center", flexDirection: "row", gap: 11 },
  challengeIcon: { alignItems: "center", backgroundColor: "#E44824", borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  challengeTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  challengeText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  challengeReward: { color: "#7A50C7", fontSize: 13, fontWeight: "900" },
  track: { backgroundColor: "#F1E8E1", borderRadius: 999, height: 8, marginTop: 14, overflow: "hidden" },
  fill: { backgroundColor: "#E44824", borderRadius: 999, height: "100%" },
  challengeMeta: { color: colors.muted, fontSize: 10, fontWeight: "800", marginTop: 8 },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  activityLink: { alignItems: "center", backgroundColor: "#EAF8F5", borderRadius: 18, flexDirection: "row", gap: 11, padding: 15 },
  activityIcon: { alignItems: "center", backgroundColor: iconPalette.teal.bg, borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  activityTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  activityText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
});
