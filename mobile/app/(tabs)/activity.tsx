import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "../../lib/AppContext";
import {
  AccountLinkRequired,
  Card,
  colors,
  dateTimeLabel,
  EmptyState,
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

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={sharedStyles.kicker}>ACTIVITY</Text>
      <Text style={sharedStyles.title}>Your gym history.</Text>
      <Text style={sharedStyles.subtitle}>
        Recent scans and successful payments from the same records used by reception.
      </Text>

      <SectionTitle title="Attendance" />
      {attendance.length ? (
        <Card>
          {attendance.map((visit, index) => (
            <View key={visit.id} style={[styles.row, index > 0 && styles.border]}>
              <View style={styles.iconBox}>
                <Ionicons name="enter-outline" size={19} color={colors.green} />
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
              <View style={styles.iconBox}>
                <Ionicons name="receipt-outline" size={19} color={colors.green} />
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
  row: { alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 9 },
  border: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 5, paddingTop: 14 },
  iconBox: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
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
