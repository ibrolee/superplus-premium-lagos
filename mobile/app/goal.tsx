import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useApp } from "../lib/AppContext";
import { supabase } from "../lib/supabase";
import { Card, colors, lagosToday, Screen, sharedStyles } from "../lib/ui";
import {
  calculateGoalProgress,
  goalDayLabels,
  scheduleVisitGoalReminders,
  type VisitGoal,
} from "../lib/visit-goals";

const visitTargets = [1, 2, 3, 4, 5, 6];
const durationTargets = [30, 45, 60, 75, 90, 120];
const reminderTimes = [
  { label: "6:00 AM", hour: 6, minute: 0 },
  { label: "8:00 AM", hour: 8, minute: 0 },
  { label: "4:00 PM", hour: 16, minute: 0 },
  { label: "6:00 PM", hour: 18, minute: 0 },
  { label: "8:00 PM", hour: 20, minute: 0 },
];

function suggestedDays(target: number) {
  if (target <= 1) return [0];
  if (target === 2) return [1, 4];
  if (target === 3) return [0, 2, 4];
  if (target === 4) return [0, 1, 3, 5];
  if (target === 5) return [0, 1, 2, 3, 4];
  return [0, 1, 2, 3, 4, 5];
}

export default function VisitGoalScreen() {
  const { session, member, attendance, refreshing, refresh } = useApp();
  const [goal, setGoal] = useState<VisitGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeklyTarget, setWeeklyTarget] = useState(3);
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [preferredDays, setPreferredDays] = useState<number[]>([0, 2, 4]);
  const [reminderHour, setReminderHour] = useState(18);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!member?.id) {
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("member_visit_goals")
        .select("*")
        .eq("member_id", member.id)
        .maybeSingle();

      const loaded = (data ?? null) as VisitGoal | null;
      setGoal(loaded);

      if (loaded) {
        setWeeklyTarget(loaded.weekly_target);
        setSessionMinutes(loaded.session_minutes_target);
        setPreferredDays(loaded.preferred_days ?? []);
        setReminderHour(loaded.reminder_hour);
        setReminderMinute(loaded.reminder_minute);
        setRemindersEnabled(loaded.reminders_enabled);
      }

      setLoading(false);
    })();
  }, [member?.id]);

  const progress = useMemo(
    () => (goal ? calculateGoalProgress(attendance, goal) : null),
    [attendance, goal],
  );

  function chooseTarget(target: number) {
    setWeeklyTarget(target);
    if (!goal || preferredDays.length === goal.preferred_days.length) {
      setPreferredDays(suggestedDays(target));
    }
  }

  function toggleDay(day: number) {
    setPreferredDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }

  async function saveGoal() {
    if (!member?.id || saving) return;

    if (remindersEnabled && preferredDays.length === 0) {
      Alert.alert(
        "Choose reminder days",
        "Select at least one preferred gym day, or turn reminders off.",
      );
      return;
    }

    setSaving(true);

    const targetChanged =
      !goal ||
      goal.weekly_target !== weeklyTarget ||
      goal.session_minutes_target !== sessionMinutes;

    const payload = {
      member_id: member.id,
      weekly_target: weeklyTarget,
      session_minutes_target: sessionMinutes,
      preferred_days: preferredDays,
      reminder_hour: reminderHour,
      reminder_minute: reminderMinute,
      reminders_enabled: remindersEnabled,
      started_at: targetChanged ? lagosToday() : goal.started_at,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("member_visit_goals")
      .upsert(payload, { onConflict: "member_id" })
      .select("*")
      .single();

    if (error || !data) {
      setSaving(false);
      Alert.alert("Could not save goal", "Please try again in a moment.");
      return;
    }

    const saved = data as VisitGoal;
    setGoal(saved);

    try {
      const scheduled = await scheduleVisitGoalReminders(saved);
      Alert.alert(
        "Gym goal saved",
        remindersEnabled
          ? scheduled.enabled
            ? `We'll remind you on your chosen gym days. ${scheduled.scheduled} reminder schedules are active.`
            : "Your goal was saved, but notification permission is off on this device."
          : "Your goal is saved. Reminders are turned off.",
      );
    } catch {
      Alert.alert(
        "Goal saved",
        "Your goal is saved, but we couldn't update reminders on this device.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!session) return <Redirect href="/login" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.headingCopy}>
          <Text style={sharedStyles.kicker}>MY GYM GOAL</Text>
          <Text style={styles.title}>Build your consistency.</Text>
          <Text style={sharedStyles.subtitle}>
            Set how often you want to train and how long you plan to spend in the gym.
          </Text>
        </View>
      </View>

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.muted}>Loading your goal…</Text>
        </Card>
      ) : (
        <>
          {progress && (
            <View style={styles.progressCard}>
              <View style={styles.progressTop}>
                <View>
                  <Text style={styles.progressEyebrow}>THIS WEEK</Text>
                  <Text style={styles.progressNumber}>
                    {progress.current}/{progress.target} visits
                  </Text>
                </View>
                <View style={styles.streakPill}>
                  <Text style={styles.streakText}>
                    🔥 {progress.streakWeeks} week{progress.streakWeeks === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>

              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress.percentage}%` }]} />
              </View>

              <Text style={styles.progressNote}>
                {progress.complete
                  ? "Weekly goal complete. Nice work."
                  : `${progress.remaining} visit${progress.remaining === 1 ? "" : "s"} to complete this week.`}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{progress.minutesThisWeek}</Text>
                  <Text style={styles.statLabel}>minutes this week</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {progress.averageSessionMinutes || "—"}
                  </Text>
                  <Text style={styles.statLabel}>avg. session min</Text>
                </View>
              </View>
            </View>
          )}

          <Card>
            <Text style={styles.sectionTitle}>Visits per week</Text>
            <Text style={styles.sectionHint}>
              Choose a realistic target you want to hit every week.
            </Text>
            <View style={styles.optionWrap}>
              {visitTargets.map((target) => (
                <Pressable
                  key={target}
                  style={[
                    styles.numberOption,
                    weeklyTarget === target && styles.optionSelected,
                  ]}
                  onPress={() => chooseTarget(target)}
                >
                  <Text
                    style={[
                      styles.numberOptionText,
                      weeklyTarget === target && styles.optionSelectedText,
                    ]}
                  >
                    {target}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Planned session time</Text>
            <Text style={styles.sectionHint}>
              This is your target time per gym visit. Check-out scans make the app's time stats more accurate.
            </Text>
            <View style={styles.optionWrap}>
              {durationTargets.map((minutes) => (
                <Pressable
                  key={minutes}
                  style={[
                    styles.chip,
                    sessionMinutes === minutes && styles.optionSelected,
                  ]}
                  onPress={() => setSessionMinutes(minutes)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      sessionMinutes === minutes && styles.optionSelectedText,
                    ]}
                  >
                    {minutes} min
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Preferred gym days</Text>
            <Text style={styles.sectionHint}>
              Pick the days you usually plan to train. These are used for reminders, not manual check-ins.
            </Text>
            <View style={styles.daysRow}>
              {goalDayLabels.map((label, day) => {
                const active = preferredDays.includes(day);
                return (
                  <Pressable
                    key={label}
                    style={[styles.dayChip, active && styles.optionSelected]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={[styles.dayText, active && styles.optionSelectedText]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.sectionTitle}>Gym-day reminders</Text>
                <Text style={styles.sectionHint}>
                  Friendly reminders on the days you plan to visit.
                </Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
                trackColor={{ false: "#C9D0CB", true: "#91B49A" }}
                thumbColor={remindersEnabled ? colors.green : "#FFFFFF"}
              />
            </View>

            {remindersEnabled && (
              <>
                <Text style={styles.timeLabel}>REMINDER TIME</Text>
                <View style={styles.optionWrap}>
                  {reminderTimes.map((time) => {
                    const active =
                      reminderHour === time.hour && reminderMinute === time.minute;
                    return (
                      <Pressable
                        key={time.label}
                        style={[styles.chip, active && styles.optionSelected]}
                        onPress={() => {
                          setReminderHour(time.hour);
                          setReminderMinute(time.minute);
                        }}
                      >
                        <Text style={[styles.chipText, active && styles.optionSelectedText]}>
                          {time.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </Card>

          <Pressable
            style={[styles.saveButton, saving && styles.saveDisabled]}
            disabled={saving}
            onPress={() => void saveGoal()}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.saveText}>
                  {goal ? "Update my gym goal" : "Start my gym goal"}
                </Text>
              </>
            )}
          </Pressable>

          <Text style={styles.footnote}>
            Progress only counts real reception attendance scans. Your physical Super Plus membership card remains the gym access method.
          </Text>
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
  title: {
    color: colors.ink,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  loadingCard: { alignItems: "center", gap: 10, paddingVertical: 30 },
  muted: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  progressCard: {
    backgroundColor: colors.green,
    borderRadius: 24,
    padding: 20,
  },
  progressTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  progressEyebrow: {
    color: "#BFD2C2",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  progressNumber: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: 4,
  },
  streakPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  streakText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  track: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    height: 9,
    marginTop: 18,
    overflow: "hidden",
  },
  fill: { backgroundColor: "#FFFFFF", borderRadius: 999, height: "100%" },
  progressNote: {
    color: "#D5E2D7",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 9,
  },
  statsRow: {
    borderTopColor: "rgba(255,255,255,0.14)",
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: 16,
    paddingTop: 14,
  },
  stat: { flex: 1 },
  statDivider: {
    backgroundColor: "rgba(255,255,255,0.14)",
    marginHorizontal: 15,
    width: 1,
  },
  statValue: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  statLabel: { color: "#BFD2C2", fontSize: 10, fontWeight: "700", marginTop: 2 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  sectionHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 14 },
  numberOption: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  numberOptionText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  optionSelected: { backgroundColor: colors.green, borderColor: colors.green },
  optionSelectedText: { color: "#FFFFFF" },
  chip: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 14 },
  dayChip: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 42,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dayText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  switchRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  switchCopy: { flex: 1 },
  timeLabel: {
    color: colors.green2,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 18,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 56,
  },
  saveDisabled: { opacity: 0.55 },
  saveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  footnote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    paddingHorizontal: 8,
    textAlign: "center",
  },
});
