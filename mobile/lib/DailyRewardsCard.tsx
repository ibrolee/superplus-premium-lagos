import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { supabase } from "./supabase";
import { colors, dateLabel } from "./ui";

type DailyStatus = {
  enabled: boolean; streak: number; best_streak: number; claimed_today: boolean;
  daily_points: number; spin_points: number[]; spin_odds: number[];
  spun_this_week: boolean; spin_award: number | null; spin_segment: number | null;
  weekly_streak_target: number; weekly_streak_points: number;
  weekly_streak_progress: number; weekly_streak_claimed: boolean;
  next_spin_on: string; balance: number;
};
const wheelColors = ["#FFD97D", "#FFA58E", "#D7C2FF", "#98DECE", "#9ACBFF", "#F5ADD0"];
const pointLabel = (value: number) => Math.round(Number(value)).toLocaleString("en-NG");

function Wheel({ points, rotation }: { points: number[]; rotation: Animated.Value }) {
  const polar = (angle: number, radius: number) => ({ x: 110 + radius * Math.cos(angle * Math.PI / 180), y: 110 + radius * Math.sin(angle * Math.PI / 180) });
  return <View style={styles.wheelWrap}>
    <Ionicons name="caret-down" size={26} color={colors.green2} style={styles.pointer} />
    <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"], extrapolate: "extend" }) }] }}>
      <Svg width={190} height={190} viewBox="0 0 220 220" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {points.map((value, index) => {
          const start = polar(-90 + index * 60, 104), end = polar(-90 + (index + 1) * 60, 104), label = polar(-60 + index * 60, 67);
          return <ViewlessSegment key={index} path={`M110 110 L${start.x} ${start.y} A104 104 0 0 1 ${end.x} ${end.y} Z`} color={wheelColors[index] ?? "#FFD97D"} x={label.x} y={label.y} label={pointLabel(value)} />;
        })}
      </Svg>
    </Animated.View>
    <View style={styles.wheelHub}><Ionicons name="sparkles" size={22} color={colors.green2} /></View>
  </View>;
}
function ViewlessSegment({ path, color, x, y, label }: { path: string; color: string; x: number; y: number; label: string }) {
  return <><Path d={path} fill={color} stroke="#FFFFFF" strokeWidth={3} /><SvgText x={x} y={y + 4} textAnchor="middle" fontSize={14} fontWeight="bold" fill="#2B2132">{label}</SvgText></>;
}

export function DailyRewardsCard({ compact = false, onAward }: { compact?: boolean; onAward?: () => void }) {
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [busy, setBusy] = useState<"daily" | "spin" | null>(null);
  const [result, setResult] = useState("");
  const rotation = useRef(new Animated.Value(0)).current;
  const angle = useRef(0);
  const alive = useRef(true);
  // Synchronous guard also catches two taps before React renders disabled state.
  const claiming = useRef(false);
  const awardCallback = useRef(onAward);
  awardCallback.current = onAward;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive.current) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; rotation.stopAnimation(); }; }, [rotation]);
  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("get_my_daily_rewards");
    if (!alive.current) return;
    if (rpcError) {
      setError(rpcError.code === "PGRST202" ? "Daily rewards are coming in a future release." : rpcError.message);
      setStatus(null);
    } else { setStatus(data as DailyStatus); setError(""); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active" && !claiming.current) void load(); });
    return () => subscription.remove();
  }, [load]));

  async function claim(kind: "daily" | "spin") {
    if (claiming.current || !status?.enabled) return;
    claiming.current = true;
    setBusy(kind); setResult("");
    try {
      const { data, error: rpcError } = await supabase.rpc("claim_my_daily_reward", { p_kind: kind });
      if (rpcError) throw new Error(rpcError.message);
      if (!data?.status || !Number.isFinite(Number(data.points))) throw new Error("Reward confirmation was incomplete. Refresh before trying again.");
      const next = data.status as DailyStatus;
      if (kind === "spin" && !data.already_claimed) {
        const segment = Number(data.segment_index);
        if (!Number.isInteger(segment) || segment < 0 || segment > 5) throw new Error("Refresh to see your confirmed wheel reward.");
        const desired = ((-30 - segment * 60) % 360 + 360) % 360;
        const delta = (desired - angle.current % 360 + 360) % 360;
        angle.current += 360 * 4 + delta;
        if (reduceMotion) rotation.setValue(angle.current);
        else await new Promise<void>((resolve) => Animated.timing(rotation, { toValue: angle.current, duration: 2800, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => resolve()));
      }
      if (!alive.current) return;
      setStatus(next);
      if (data.already_claimed) {
        setResult("Already claimed — your points are safe.");
      } else {
        const bonus = Number(data.bonus_points ?? 0);
        setResult(
          bonus > 0
            ? `+${pointLabel(Number(data.points))} SP added · 7-Day App Streak complete! +${pointLabel(bonus)} SP bonus`
            : `+${pointLabel(Number(data.points))} SP Points added!`,
        );
      }
      awardCallback.current?.();
    } catch (cause) {
      if (alive.current) { Alert.alert("Reward could not be confirmed", cause instanceof Error ? cause.message : "Refresh and try again."); await load(); }
    } finally {
      claiming.current = false;
      if (alive.current) setBusy(null);
    }
  }

  if (loading) return <View style={styles.card}><ActivityIndicator color={colors.green2} /></View>;
  if (!status || !status.enabled) return <View style={styles.card}><Text style={styles.title}>Daily boosts</Text><Text style={styles.copy}>{error || "Daily streaks and the weekly wheel are not open yet."}</Text>{!!error && <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }}><Text style={styles.link}>Refresh rewards</Text></Pressable>}</View>;

  return <View style={styles.card}>
    <View style={styles.heading}>
      <View style={styles.flame}><Ionicons name="flame" size={25} color="#D74720" /></View>
      <View style={styles.grow}><Text style={styles.eyebrow}>DAILY BOOST</Text><Text style={styles.title}>{status.streak} day{status.streak === 1 ? "" : "s"} streak</Text></View>
    </View>
    <Text style={styles.copy}>Open the app and claim each day. Miss a Lagos calendar day and your streak starts again from day 1.</Text>
    {!compact && <Text style={styles.best}>Best streak: {status.best_streak} days · +{pointLabel(status.daily_points)} SP Points per claim</Text>}
    <View style={styles.challengeCard}>
      <View style={styles.challengeHeading}>
        <View style={styles.grow}>
          <Text style={styles.challengeKicker}>WEEKLY CHALLENGE</Text>
          <Text style={styles.challengeTitle}>7-Day App Streak</Text>
        </View>
        <Text style={[styles.challengeReward, status.weekly_streak_claimed && styles.challengeRewardDone]}>
          {status.weekly_streak_claimed ? "Completed" : `+${pointLabel(status.weekly_streak_points)} SP`}
        </Text>
      </View>
      <Text style={styles.copy}>
        Claim your daily app reward every day from Monday to Sunday. Complete all 7 days to earn the weekly bonus.
      </Text>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(
                100,
                (Number(status.weekly_streak_progress || 0) /
                  Math.max(1, Number(status.weekly_streak_target || 7))) *
                  100,
              )}%`,
            },
          ]}
        />
      </View>
      <Text style={styles.challengeProgress}>
        {Math.min(status.weekly_streak_progress || 0, status.weekly_streak_target || 7)}/{status.weekly_streak_target || 7} days this week
      </Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!busy || status.claimed_today }} disabled={!!busy || status.claimed_today} onPress={() => void claim("daily")} style={({ pressed }) => [styles.button, status.claimed_today && styles.claimed, (pressed || busy) && styles.muted]}>
      <Ionicons name={status.claimed_today ? "checkmark-circle" : "flame"} size={18} color={status.claimed_today ? "#276740" : "#FFFFFF"} />
      <Text style={[styles.buttonText, status.claimed_today && styles.claimedText]}>{busy === "daily" ? "Claiming…" : status.claimed_today ? "Claimed today · come back tomorrow" : `Claim today · +${pointLabel(status.daily_points)} SP`}</Text>
    </Pressable>
    {!!result && <Text accessibilityLiveRegion="polite" style={styles.result}>{result}</Text>}
    {compact ? <Pressable accessibilityRole="button" onPress={() => router.push("/rewards")} style={styles.wheelLink}><Ionicons name="sparkles" size={16} color="#7950C7" /><Text style={styles.link}>{status.spun_this_week ? "Weekly spin claimed · view rewards" : "Your weekly wheel spin is ready"}</Text><Ionicons name="arrow-forward" size={16} color="#7950C7" /></Pressable> : <>
      <View style={styles.divider} />
      <Text style={styles.title}>Weekly SP Wheel</Text>
      <Text style={styles.copy}>One free spin each Monday–Sunday week, using Lagos time. Smaller rewards are more common.</Text>
      <Wheel points={status.spin_points} rotation={rotation} />
      <View style={styles.odds}>{status.spin_points.map((points, index) => <Text key={index} style={[styles.oddsChip, { backgroundColor: wheelColors[index] }]}>{pointLabel(points)} SP · {status.spin_odds[index]}%</Text>)}</View>
      {status.spun_this_week && <Text style={styles.result}>This week: +{pointLabel(status.spin_award ?? 0)} SP Points · Next spin {dateLabel(status.next_spin_on)}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!busy || status.spun_this_week }} disabled={!!busy || status.spun_this_week} onPress={() => void claim("spin")} style={({ pressed }) => [styles.button, styles.spinButton, status.spun_this_week && styles.claimed, (pressed || busy) && styles.muted]}>
        <Text style={[styles.buttonText, status.spun_this_week && styles.claimedText]}>{busy === "spin" ? "Spinning…" : status.spun_this_week ? "Spin used this week" : "Spin for SP Points"}</Text>
      </Pressable>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 22, padding: 17, gap: 11 },
  heading: { flexDirection: "row", alignItems: "center", gap: 11 },
  flame: { backgroundColor: "#FFEADB", width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 }, eyebrow: { color: colors.green2, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 21, fontWeight: "900" }, copy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  best: { color: "#7950C7", fontSize: 11, fontWeight: "700" },
  challengeCard: { backgroundColor: colors.surfaceMuted, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 8, padding: 12 },
  challengeHeading: { alignItems: "center", flexDirection: "row", gap: 10 },
  challengeKicker: { color: colors.green2, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  challengeTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 2 },
  challengeReward: { color: colors.green2, fontSize: 11, fontWeight: "900" },
  challengeRewardDone: { color: colors.success },
  progressTrack: { backgroundColor: colors.line, borderRadius: 999, height: 8, overflow: "hidden" },
  progressFill: { backgroundColor: colors.green2, borderRadius: 999, height: "100%" },
  challengeProgress: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  button: { minHeight: 48, borderRadius: 14, backgroundColor: "#D63E1D", padding: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  buttonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", flexShrink: 1, textAlign: "center" },
  claimed: { backgroundColor: colors.surfaceMuted }, claimedText: { color: colors.success }, muted: { opacity: 0.7 },
  wheelLink: { flexDirection: "row", alignItems: "center", gap: 6 }, link: { color: "#7950C7", fontSize: 11, fontWeight: "800", flexShrink: 1 },
  result: { color: "#287A45", fontSize: 12, fontWeight: "800", textAlign: "center", lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 5 },
  wheelWrap: { alignItems: "center", justifyContent: "center", alignSelf: "center", width: 206, height: 206, marginVertical: 8 },
  pointer: { position: "absolute", top: -4, zIndex: 2 },
  wheelHub: { position: "absolute", width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  odds: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  oddsChip: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, color: "#2B2132", fontSize: 10, fontWeight: "700" },
  spinButton: { backgroundColor: "#7950C7" },
});
