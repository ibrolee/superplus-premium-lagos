import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../../lib/AppContext";
import {
  AccountLinkRequired,
  Card,
  colors,
  dateLabel,
  EmptyState,
  lagosToday,
  LoadingView,
  Pill,
  Screen,
  SectionTitle,
  sharedStyles,
} from "../../lib/ui";

export default function MembershipScreen() {
  const {
    session,
    member,
    dataLoading,
    currentMembership,
    memberships,
    family,
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
  const currentPhase = currentMembership
    ? currentMembership.start_date > today
      ? "UPCOMING"
      : currentMembership.end_date >= today
        ? "ACTIVE"
        : "EXPIRED"
    : "NO PLAN";

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={sharedStyles.kicker}>MEMBERSHIP</Text>
      <Text style={sharedStyles.title}>Your plan.</Text>
      <Text style={sharedStyles.subtitle}>
        Your dates here are the same dates held by reception.
      </Text>

      {currentMembership ? (
        <Card style={styles.hero}>
          <View style={sharedStyles.row}>
            <Pill tone={currentPhase === "ACTIVE" ? "success" : currentPhase === "UPCOMING" ? "amber" : "danger"}>
              {currentPhase}
            </Pill>
            {!!currentMembership.family_group_id && (
              <Pill>FAMILY PLAN</Pill>
            )}
          </View>
          <Text style={styles.heroPlan}>{currentMembership.plan_name ?? "Membership"}</Text>
          <View style={styles.dateGrid}>
            <View style={styles.dateCell}>
              <Text style={styles.dateLabel}>START DATE</Text>
              <Text style={styles.dateValue}>{dateLabel(currentMembership.start_date)}</Text>
            </View>
            <View style={styles.dateCell}>
              <Text style={styles.dateLabel}>END DATE</Text>
              <Text style={styles.dateValue}>{dateLabel(currentMembership.end_date)}</Text>
            </View>
          </View>
        </Card>
      ) : (
        <EmptyState>No membership is attached to this account yet.</EmptyState>
      )}

      {!!family && (
        <>
          <SectionTitle title="Family Plan" />
          <Card>
            <View style={sharedStyles.row}>
              <View>
                <Text style={styles.familyLabel}>
                  {family.is_primary ? "PRIMARY MEMBER" : "FAMILY MEMBER"}
                </Text>
                <Text style={styles.familyExpiry}>
                  Group expiry: {dateLabel(family.latest_end_date)}
                </Text>
              </View>
              <Ionicons name="people" size={24} color={colors.green2} />
            </View>
            <View style={styles.familyList}>
              {family.members.map((person) => (
                <View key={person.member_id} style={styles.familyRow}>
                  <View style={styles.slot}>
                    <Text style={styles.slotText}>{person.slot}</Text>
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.familyName}>{person.full_name}</Text>
                    <Text style={styles.familyEmail}>{person.email ?? "No email"}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}

      <Pressable
        style={sharedStyles.primaryButton}
        onPress={() => void Linking.openURL("https://www.superplusfitness.com/member")}
      >
        <Text style={sharedStyles.primaryButtonText}>Manage or renew membership</Text>
      </Pressable>
      <Text style={styles.webNote}>
        Secure in-app renewal is the next mobile milestone. For now this opens the
        existing member payment portal.
      </Text>

      <SectionTitle title="Membership history" />
      {memberships.length ? (
        <Card>
          {memberships.map((item, index) => (
            <View
              key={item.id}
              style={[styles.historyRow, index > 0 && styles.historyBorder]}
            >
              <View style={styles.grow}>
                <Text style={styles.historyPlan}>{item.plan_name ?? "Membership"}</Text>
                <Text style={styles.historyDates}>
                  {dateLabel(item.start_date)} — {dateLabel(item.end_date)}
                </Text>
              </View>
              <Pill
                tone={
                  item.payment_status === "paid" && item.end_date >= today
                    ? "success"
                    : "neutral"
                }
              >
                {item.payment_status?.toUpperCase() ?? item.status.toUpperCase()}
              </Pill>
            </View>
          ))}
        </Card>
      ) : (
        <EmptyState>Your previous memberships will appear here.</EmptyState>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 16 },
  heroPlan: { color: colors.ink, fontSize: 27, fontWeight: "900", letterSpacing: -0.7 },
  dateGrid: { flexDirection: "row", gap: 10 },
  dateCell: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    flex: 1,
    padding: 13,
  },
  dateLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.9 },
  dateValue: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: 4 },
  familyLabel: { color: colors.green2, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  familyExpiry: { color: colors.muted, fontSize: 12, marginTop: 4 },
  familyList: { borderTopColor: colors.line, borderTopWidth: 1, gap: 12, marginTop: 16, paddingTop: 16 },
  familyRow: { alignItems: "center", flexDirection: "row", gap: 11 },
  slot: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 999,
    height: 29,
    justifyContent: "center",
    width: 29,
  },
  slotText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  grow: { flex: 1 },
  familyName: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  familyEmail: { color: colors.muted, fontSize: 11, marginTop: 2 },
  webNote: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: -7, textAlign: "center" },
  historyRow: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 8 },
  historyBorder: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 5, paddingTop: 13 },
  historyPlan: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  historyDates: { color: colors.muted, fontSize: 11, marginTop: 3 },
});
