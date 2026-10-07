import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../../lib/AppContext";
import {
  calculateGoalProgress,
  currentLagosWeek,
  goalDayLabels,
  uniqueVisitDates,
} from "../../lib/visit-goals";
import {
  AccountLinkRequired,
  Card,
  colors,
  iconPalette,
  dateTimeLabel,
  EmptyState,
  lagosToday,
  LoadingView,
  money,
  Screen,
  SectionTitle,
  sharedStyles,
} from "../../lib/ui";

export default function ActivityScreen() {
  const {
    session,
    member,
    dataLoading,
    attendance,
    payments,
    visitGoal,
    refreshing,
    refresh,
  } = useApp();

  if (dataLoading) return <LoadingView />;
  if (!member) {
    return (
      <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
        <AccountLinkRequired email={session?.user.email} />
      </Screen>
    );
  }

  const weekDates = currentLagosWeek();
  const visitedDates = uniqueVisitDates(attendance);
  const weekStart = weekDates[0] ?? lagosToday();
  const weekEnd = weekDates[6] ?? weekStart;
  const visitedSet = new Set(visitedDates);
  const monthKey = lagosToday().slice(0, 7);
  const monthVisits = visitedDates.filter((day) => day.startsWith(monthKey)).length;
  const goalProgress = visitGoal ? calculateGoalProgress(attendance, visitGoal) : null;

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={sharedStyles.kicker}>ACTIVITY</Text>
      <Text style={sharedStyles.title}>Your gym progress.</Text>
      <Text style={sharedStyles.subtitle}>
        Real attendance from your physical membership-card scans, turned into weekly progress and streaks.
      </Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {visitedDates.filter((day) => day >= weekStart && day <= weekEnd).length}
          </Text>
          <Text style={styles.statLabel}>THIS WEEK</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{monthVisits}</Text>
          <Text style={styles.statLabel}>THIS MONTH</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{visitedDates.length}</Text>
          <Text style={styles.statLabel}>RECORDED VISITS</Text>
        </View>
      </View>

      <Card>
        <View style={styles.weekHeader}>
          <View>
            <Text style={styles.cardKicker}>THIS WEEK</Text>
            <Text style={styles.weekTitle}>Your training week</Text>
          </View>
          <Pressable onPress={() => router.push("/goal")}>
            <Text style={styles.editLink}>{visitGoal ? "Edit goal" : "Set goal"}</Text>
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {weekDates.map((day, index) => {
            const visited = visitedSet.has(day);
            const planned = visitGoal?.preferred_days.includes(index) ?? false;
            return (
              <View key={day} style={styles.dayColumn}>
                <Text style={styles.dayLabel}>{goalDayLabels[index]}</Text>
                <View
                  style={[
                    styles.dayCircle,
                    planned && styles.dayPlanned,
                    visited && styles.dayVisited,
                  ]}
                >
                  {visited ? (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.dayNumber, planned && styles.dayNumberPlanned]}>
                      {Number(day.slice(-2))}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {goalProgress ? (
          <>
            <View style={styles.goalTrack}>
              <View style={[styles.goalFill, { width: `${goalProgress.percentage}%` }]} />
            </View>
            <View style={styles.goalFooter}>
              <Text style={styles.goalText}>
                {goalProgress.complete
                  ? "Weekly goal complete 🎉"
                  : `${goalProgress.current}/${goalProgress.target} visits · ${goalProgress.remaining} left`}
              </Text>
              <Text style={styles.streak}>🔥 {goalProgress.streakWeeks} wk streak</Text>
            </View>
          </>
        ) : (
          <Text style={styles.goalPrompt}>
            Set a weekly visit goal and the app will track this automatically.
          </Text>
        )}
      </Card>

      {goalProgress && (
        <View style={styles.timeCard}>
          <View style={styles.timeIcon}>
            <Ionicons name="time-outline" size={22} color={iconPalette.blue.fg} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.timeTitle}>
              {goalProgress.minutesThisWeek} minutes in the gym this week
            </Text>
            <Text style={styles.timeText}>
              {goalProgress.averageSessionMinutes
                ? `Average completed session: ${goalProgress.averageSessionMinutes} min · Your target: ${visitGoal?.session_minutes_target} min`
                : "Scan out with your membership card so session-time stats can be calculated."}
            </Text>
          </View>
        </View>
      )}

      <SectionTitle title="Recent visits" />
      {attendance.length ? (
        <Card>
          {attendance.slice(0, 30).map((visit, index) => (
            <View key={visit.id} style={[styles.row, index > 0 && styles.border]}>
              <View style={[styles.iconBox, { backgroundColor: iconPalette.teal.bg }]}>
                <Ionicons name="enter-outline" size={19} color={iconPalette.teal.fg} />
              </View>
              <View style={styles.grow}>
                <Text style={styles.primary}>{dateTimeLabel(visit.checked_in_at)}</Text>
                <Text style={styles.secondary}>
                  {visit.checked_out_at
                    ? `Out: ${dateTimeLabel(visit.checked_out_at)}`
                    : "No check-out recorded"}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <EmptyState>No attendance scans yet.</EmptyState>
      )}

      <SectionTitle title="Payments" />
      {payments.length ? (
        <Card>
          {payments.map((payment, index) => (
            <View key={payment.id} style={[styles.row, index > 0 && styles.border]}>
              <View style={[styles.iconBox, { backgroundColor: iconPalette.gold.bg }]}>
                <Ionicons name="receipt-outline" size={19} color={iconPalette.gold.fg} />
              </View>
              <View style={styles.grow}>
                <Text style={styles.primary}>{money(Number(payment.amount))}</Text>
                <Text style={styles.secondary}>
                  {payment.payment_method ?? "Payment"} · {dateTimeLabel(payment.paid_at ?? payment.created_at)}
                </Text>
              </View>
              <View style={styles.successDot} />
            </View>
          ))}
        </Card>
      ) : (
        <EmptyState>No successful payments are attached to this member yet.</EmptyState>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsGrid: { flexDirection: "row", gap: 8 },
  statCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 7,
    paddingVertical: 15,
  },
  statValue: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.5, marginTop: 3, textAlign: "center" },
  weekHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardKicker: { color: colors.green2, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  weekTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 3 },
  editLink: { color: colors.green2, fontSize: 12, fontWeight: "900" },
  weekRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  dayColumn: { alignItems: "center", flex: 1, gap: 6 },
  dayLabel: { color: colors.muted, fontSize: 9, fontWeight: "900" },
  dayCircle: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  dayPlanned: { borderColor: colors.green2, borderWidth: 2 },
  dayVisited: { backgroundColor: colors.green2, borderColor: colors.green2 },
  dayNumber: { color: colors.muted, fontSize: 10, fontWeight: "900" },
  dayNumberPlanned: { color: colors.ink },
  goalTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 8,
    marginTop: 18,
    overflow: "hidden",
  },
  goalFill: { backgroundColor: colors.green2, borderRadius: 999, height: "100%" },
  goalFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 9 },
  goalText: { color: colors.ink, flex: 1, fontSize: 11, fontWeight: "800" },
  streak: { color: colors.green2, fontSize: 10, fontWeight: "900" },
  goalPrompt: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 16 },
  timeCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 15,
  },
  timeIcon: {
    alignItems: "center",
    backgroundColor: iconPalette.blue.bg,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  timeTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  timeText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 3 },
  row: { alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 9 },
  border: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 5, paddingTop: 14 },
  iconBox: {
    alignItems: "center",
    backgroundColor: iconPalette.teal.bg,
    borderRadius: 12,
    height: 41,
    justifyContent: "center",
    width: 41,
  },
  grow: { flex: 1 },
  primary: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  secondary: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  successDot: { backgroundColor: colors.success, borderRadius: 99, height: 8, width: 8 },
});
