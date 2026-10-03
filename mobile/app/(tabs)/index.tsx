import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../../lib/BrandLogo";
import { calculateGoalProgress } from "../../lib/visit-goals";
import { useApp } from "../../lib/AppContext";
import {
  AccountLinkRequired,
  Card,
  colors,
  dateLabel,
  dateTimeLabel,
  daysUntil,
  LoadingView,
  Pill,
  Screen,
  SectionTitle,
  sharedStyles,
  lagosToday,
} from "../../lib/ui";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const {
    session,
    member,
    dataLoading,
    error,
    currentMembership,
    attendance,
    announcements,
    visitGoal,
    notificationUnreadCount,
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

  const today = lagosToday();
  const phase = currentMembership
    ? currentMembership.start_date > today
      ? "upcoming"
      : currentMembership.end_date >= today
        ? "active"
        : "expired"
    : "none";
  const remaining = daysUntil(currentMembership?.end_date);
  const goalProgress = visitGoal ? calculateGoalProgress(attendance, visitGoal) : null;

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandIdentity}>
            <BrandLogo variant="mark" size={48} />
            <Text style={styles.brandName}>SUPER PLUS FITNESS</Text>
          </View>
          <Pressable
            accessibilityLabel="Open notifications"
            style={styles.notificationButton}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.green} />
            {notificationUnreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationUnreadCount > 9 ? "9+" : notificationUnreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
        <Text style={styles.greeting}>
          {greeting()}, {member.full_name.split(" ")[0]}.
        </Text>
        <Text style={sharedStyles.subtitle}>Membership, goals, workouts and more — all in one place.</Text>
      </View>

      {!!error && (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      )}

      <View style={styles.memberCard}>
        <View style={sharedStyles.row}>
          <Text style={styles.cardEyebrow}>MEMBERSHIP</Text>
          <Pill tone={phase === "active" ? "success" : phase === "upcoming" ? "amber" : "danger"}>
            {phase === "active" ? "ACTIVE" : phase === "upcoming" ? "UPCOMING" : "INACTIVE"}
          </Pill>
        </View>
        <Text style={styles.planName}>{currentMembership?.plan_name ?? "No paid plan"}</Text>
        {currentMembership ? (
          <>
            <Text style={styles.planDates}>
              {dateLabel(currentMembership.start_date)} — {dateLabel(currentMembership.end_date)}
            </Text>
            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.smallLabel}>
                  {phase === "upcoming" ? "STARTS" : "TIME LEFT"}
                </Text>
                <Text style={styles.bigStat}>
                  {phase === "upcoming"
                    ? dateLabel(currentMembership.start_date)
                    : remaining !== null && remaining >= 0
                      ? `${remaining} days`
                      : "Expired"}
                </Text>
              </View>
              <View style={styles.cardNumberWrap}>
                <Text style={styles.smallLabel}>MEMBER #</Text>
                <Text style={styles.cardNumber}>{member.member_card_number}</Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.planDates}>Contact reception or choose a plan to get started.</Text>
        )}
      </View>

      <Pressable style={styles.goalCard} onPress={() => router.push("/goal")}>
        <View style={styles.goalTop}>
          <View>
            <Text style={styles.goalEyebrow}>WEEKLY GYM GOAL</Text>
            <Text style={styles.goalTitle}>
              {goalProgress
                ? `${goalProgress.current} of ${goalProgress.target} visits`
                : "Set your visit goal"}
            </Text>
          </View>
          <View style={styles.goalIcon}>
            <Ionicons
              name={goalProgress?.complete ? "trophy" : "flag"}
              size={22}
              color={colors.green}
            />
          </View>
        </View>

        {goalProgress ? (
          <>
            <View style={styles.goalTrack}>
              <View style={[styles.goalFill, { width: `${goalProgress.percentage}%` as `${number}%` }]} />
            </View>
            <View style={styles.goalFooter}>
              <Text style={styles.goalNote}>
                {goalProgress.complete
                  ? "Goal complete for this week 🎉"
                  : `${goalProgress.remaining} visit${goalProgress.remaining === 1 ? "" : "s"} left this week`}
              </Text>
              <Text style={styles.goalStreak}>
                🔥 {goalProgress.streakWeeks} wk
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.goalNote}>
            Choose your weekly frequency, preferred gym days and reminder time.
          </Text>
        )}
      </Pressable>

      <View style={styles.cardReminder}>
        <View style={styles.cardReminderIcon}>
          <Ionicons name="card-outline" size={22} color={colors.green} />
        </View>
        <View style={styles.qrCopy}>
          <Text style={styles.qrTitle}>Bring your membership card</Text>
          <Text style={styles.qrText}>Your physical card is used to scan in and out at reception.</Text>
        </View>
      </View>

      <SectionTitle title="Explore Super Plus" />
      <View style={styles.exploreGrid}>
        <Pressable style={styles.exploreCard} onPress={() => router.push("/blog")}>
          <View style={styles.exploreIcon}>
            <Ionicons name="newspaper-outline" size={22} color={colors.green} />
          </View>
          <Text style={styles.exploreTitle}>Blog</Text>
          <Text style={styles.exploreText}>Tips, recovery and gym life.</Text>
        </Pressable>
        <Pressable style={styles.exploreCard} onPress={() => router.push("/workouts")}>
          <View style={styles.exploreIcon}>
            <Ionicons name="barbell-outline" size={22} color={colors.green} />
          </View>
          <Text style={styles.exploreTitle}>Workouts</Text>
          <Text style={styles.exploreText}>Plan and check off a session.</Text>
        </Pressable>
        <Pressable style={styles.exploreCard} onPress={() => router.push("/bookings")}>
          <View style={styles.exploreIcon}>
            <Ionicons name="calendar-outline" size={22} color={colors.green} />
          </View>
          <Text style={styles.exploreTitle}>Book</Text>
          <Text style={styles.exploreText}>PT, classes and spa services.</Text>
        </Pressable>
        <Pressable style={styles.exploreCard} onPress={() => router.push("/rewards")}>
          <View style={styles.exploreIcon}>
            <Ionicons name="trophy-outline" size={22} color={colors.green} />
          </View>
          <Text style={styles.exploreTitle}>Rewards</Text>
          <Text style={styles.exploreText}>Challenges, badges and SP Points.</Text>
        </Pressable>
      </View>

      <SectionTitle title="Recent visits" />
      {attendance.length ? (
        <Card>
          {attendance.slice(0, 3).map((visit, index) => (
            <View
              key={visit.id}
              style={[styles.visitRow, index > 0 && styles.rowBorder]}
            >
              <View style={styles.visitIcon}>
                <Ionicons name="barbell-outline" size={18} color={colors.green} />
              </View>
              <View style={styles.grow}>
                <Text style={styles.visitTitle}>{dateTimeLabel(visit.checked_in_at)}</Text>
                <Text style={styles.visitMeta}>
                  {visit.checked_out_at
                    ? `Checked out ${dateTimeLabel(visit.checked_out_at)}`
                    : "Check-out not recorded"}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <Text style={styles.mutedCenter}>Your gym visits will appear here after your first scan.</Text>
        </Card>
      )}

      {!!announcements.length && (
        <>
          <SectionTitle title="Announcements" />
          {announcements.slice(0, 3).map((item) => (
            <Card key={item.id}>
              <Text style={styles.announcementTitle}>{item.title}</Text>
              <Text style={styles.announcementBody}>{item.body}</Text>
              {!!item.cta_label && !!item.cta_url && (
                <Pressable
                  onPress={() => void Linking.openURL(item.cta_url!)}
                  style={styles.textAction}
                >
                  <Text style={styles.textActionLabel}>{item.cta_label}</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.green2} />
                </Pressable>
              )}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10, marginBottom: 7 },
  brandIdentity: { alignItems: "center", flex: 1, flexDirection: "row", gap: 10 },
  brandName: { ...sharedStyles.kicker, flexShrink: 1 },
  notificationButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    position: "relative",
    width: 44,
  },
  notificationBadge: {
    alignItems: "center",
    backgroundColor: "#EF2B2D",
    borderColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 3,
    position: "absolute",
    right: -4,
    top: -5,
  },
  notificationBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
  header: { gap: 5, paddingTop: 4 },
  greeting: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 36,
  },
  errorCard: { borderColor: "#F2C7C2", backgroundColor: "#FFF3F1" },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  memberCard: {
    backgroundColor: colors.green,
    borderRadius: 24,
    padding: 21,
  },
  cardEyebrow: { color: "#BAD4BF", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  planName: { color: "#FFFFFF", fontSize: 28, fontWeight: "900", letterSpacing: -0.8, marginTop: 18 },
  planDates: { color: "#CFE0D2", fontSize: 13, fontWeight: "600", marginTop: 5 },
  cardFooter: {
    borderTopColor: "rgba(255,255,255,0.16)",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 22,
    paddingTop: 18,
  },
  smallLabel: { color: "#AFCAB5", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  bigStat: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", marginTop: 4 },
  cardNumberWrap: { alignItems: "flex-end" },
  cardNumber: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", marginTop: 4 },
  goalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    padding: 17,
  },
  goalTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  goalEyebrow: {
    color: colors.green2,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  goalTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 4,
  },
  goalIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 13,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  goalTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 8,
    marginTop: 15,
    overflow: "hidden",
  },
  goalFill: { backgroundColor: colors.green, borderRadius: 999, height: "100%" },
  goalFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 9,
  },
  goalNote: { color: colors.muted, flex: 1, fontSize: 11, fontWeight: "700", lineHeight: 17, marginTop: 9 },
  goalStreak: { color: colors.green, fontSize: 11, fontWeight: "900" },
  cardReminder: {
    alignItems: "center",
    backgroundColor: "#F7F8F5",
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  cardReminderIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  exploreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  exploreCard: {
    backgroundColor: "#EEF5EA",
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 142,
    padding: 14,
    width: "48%",
  },
  exploreIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  exploreTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginTop: 12 },
  exploreText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  qrCopy: { flex: 1 },
  qrTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  qrText: { color: colors.muted, fontSize: 12, marginTop: 3 },
  visitRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 7 },
  rowBorder: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 6, paddingTop: 13 },
  visitIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  grow: { flex: 1 },
  visitTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  visitMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  mutedCenter: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  announcementTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  announcementBody: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  textAction: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 13 },
  textActionLabel: { color: colors.green2, fontSize: 12, fontWeight: "900" },
});
