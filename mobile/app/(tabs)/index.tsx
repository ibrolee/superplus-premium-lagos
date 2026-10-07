import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../../lib/BrandLogo";
import { DailyRewardsCard } from "../../lib/DailyRewardsCard";
import { MembershipCard } from "../../lib/MembershipCard";
import { useApp } from "../../lib/AppContext";
import {
  AccountLinkRequired,
  Card,
  colors,
  dateTimeLabel,
  iconPalette,
  lagosToday,
  LoadingView,
  Screen,
  SectionTitle,
  sharedStyles,
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
            <Ionicons name="notifications-outline" size={22} color={iconPalette.purple.fg} />
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
        <Text style={sharedStyles.subtitle}>
          Membership, check-ins, bookings, rewards and account updates — all in one place.
        </Text>
      </View>

      {!!error && (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      )}

      <MembershipCard
        member={member}
        membership={currentMembership}
        phase={phase}
        onChoosePlan={() => router.push("/(tabs)/membership")}
      />

      <DailyRewardsCard compact />

      {phase === "active" && (
        <View style={styles.cardReminder}>
          <View style={styles.cardReminderIcon}>
            <Ionicons name="card-outline" size={22} color={iconPalette.blue.fg} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.cardReminderTitle}>Bring your membership card</Text>
            <Text style={styles.cardReminderText}>
              Your physical card is used for reception check-in and check-out.
            </Text>
          </View>
        </View>
      )}

      {phase === "active" && (
        <Pressable style={styles.feedbackCard} onPress={() => router.push("/feedback")}>
          <View style={styles.feedbackIcon}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.grow}>
            <Text style={styles.feedbackEyebrow}>CONFIDENTIAL TO MANAGEMENT</Text>
            <Text style={styles.feedbackTitle}>Suggestion or report an issue</Text>
            <Text style={styles.feedbackText}>
              Staff, equipment, facilities, payments, safety or anything about your membership experience.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.green2} />
        </Pressable>
      )}

      <SectionTitle title="Quick access" />
      <View style={styles.exploreGrid}>
        <Pressable style={styles.exploreCard} onPress={() => router.push("/(tabs)/membership")}>
          <View style={[styles.exploreIcon, { backgroundColor: iconPalette.blue.bg }]}>
            <Ionicons name="card-outline" size={22} color={iconPalette.blue.fg} />
          </View>
          <Text style={styles.exploreTitle}>Membership</Text>
          <Text style={styles.exploreText}>Plans, status and payment history.</Text>
        </Pressable>

        <Pressable style={styles.exploreCard} onPress={() => router.push("/rewards")}>
          <View style={[styles.exploreIcon, { backgroundColor: iconPalette.gold.bg }]}>
            <Ionicons name="gift-outline" size={22} color={iconPalette.gold.fg} />
          </View>
          <Text style={styles.exploreTitle}>SP Rewards</Text>
          <Text style={styles.exploreText}>Points, bonuses and redeemable rewards.</Text>
        </Pressable>

        <Pressable style={styles.exploreCard} onPress={() => router.push("/bookings")}>
          <View style={[styles.exploreIcon, { backgroundColor: iconPalette.purple.bg }]}>
            <Ionicons name="calendar-outline" size={22} color={iconPalette.purple.fg} />
          </View>
          <Text style={styles.exploreTitle}>Bookings</Text>
          <Text style={styles.exploreText}>Request available Super Plus services.</Text>
        </Pressable>

        <Pressable style={styles.exploreCard} onPress={() => router.push("/(tabs)/activity")}>
          <View style={[styles.exploreIcon, { backgroundColor: iconPalette.teal.bg }]}>
            <Ionicons name="time-outline" size={22} color={iconPalette.teal.fg} />
          </View>
          <Text style={styles.exploreTitle}>Visit history</Text>
          <Text style={styles.exploreText}>Review your reception card check-ins.</Text>
        </Pressable>
      </View>

      <SectionTitle title="Recent check-ins" />
      {attendance.length ? (
        <Card>
          {attendance.slice(0, 3).map((visit, index) => (
            <View key={visit.id} style={[styles.visitRow, index > 0 && styles.rowBorder]}>
              <View style={styles.visitIcon}>
                <Ionicons name="enter-outline" size={18} color={iconPalette.teal.fg} />
              </View>
              <View style={styles.grow}>
                <Text style={styles.visitTitle}>{dateTimeLabel(visit.checked_in_at)}</Text>
                <Text style={styles.visitMeta}>
                  {visit.checked_out_at
                    ? "Checked out " + dateTimeLabel(visit.checked_out_at)
                    : "Check-out not recorded"}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <Text style={styles.mutedCenter}>
            Your reception card check-ins will appear here after your first visit.
          </Text>
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
                <Pressable onPress={() => void Linking.openURL(item.cta_url!)} style={styles.textAction}>
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
  header: { gap: 5, paddingTop: 4 },
  brandRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10, marginBottom: 7 },
  brandIdentity: { alignItems: "center", flex: 1, flexDirection: "row", gap: 10 },
  brandName: { ...sharedStyles.kicker, flexShrink: 1 },
  greeting: { color: colors.ink, fontSize: 31, fontWeight: "900", letterSpacing: -1, lineHeight: 36 },
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
    backgroundColor: colors.green2,
    borderColor: colors.surface,
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
  errorCard: { backgroundColor: colors.surface, borderColor: colors.line },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  grow: { flex: 1 },
  cardReminder: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  cardReminderIcon: {
    alignItems: "center",
    backgroundColor: iconPalette.blue.bg,
    borderRadius: 13,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  cardReminderTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  cardReminderText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  feedbackCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  feedbackIcon: {
    alignItems: "center",
    backgroundColor: colors.green2,
    borderRadius: 13,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  feedbackEyebrow: { color: colors.green2, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  feedbackTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 3 },
  feedbackText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  exploreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  exploreCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 142,
    padding: 15,
    width: "48.5%",
  },
  exploreIcon: { alignItems: "center", borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  exploreTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 12 },
  exploreText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  visitRow: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 8 },
  rowBorder: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 4, paddingTop: 12 },
  visitIcon: {
    alignItems: "center",
    backgroundColor: iconPalette.teal.bg,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  visitTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  visitMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  mutedCenter: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  announcementTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  announcementBody: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  textAction: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 12 },
  textActionLabel: { color: colors.green2, fontSize: 11, fontWeight: "900" },
});
