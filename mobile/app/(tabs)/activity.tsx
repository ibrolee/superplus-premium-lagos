import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "../../lib/AppContext";
import {
  AccountLinkRequired,
  Card,
  colors,
  dateTimeLabel,
  iconPalette,
  LoadingView,
  Screen,
  sharedStyles,
} from "../../lib/ui";

export default function VisitsScreen() {
  const {
    session,
    member,
    dataLoading,
    attendance,
    refreshing,
    refresh,
  } = useApp();

  if (!session) return <Redirect href="/login" />;
  if (dataLoading) return <LoadingView />;

  if (!member) {
    return (
      <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
        <AccountLinkRequired email={session.user.email} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <View style={styles.heading}>
        <Text style={sharedStyles.kicker}>VISIT HISTORY</Text>
        <Text style={styles.title}>Your Super Plus check-ins.</Text>
        <Text style={sharedStyles.subtitle}>
          This is your membership access history from reception card scans.
        </Text>
      </View>

      {attendance.length ? (
        <Card>
          {attendance.slice(0, 60).map((visit, index) => (
            <View key={visit.id} style={[styles.row, index > 0 && styles.border]}>
              <View style={styles.iconBox}>
                <Ionicons name="enter-outline" size={19} color={iconPalette.teal.fg} />
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
        <Card style={styles.emptyCard}>
          <Ionicons name="card-outline" size={28} color={colors.muted} />
          <Text style={styles.emptyTitle}>No check-ins yet</Text>
          <Text style={styles.emptyText}>
            Your reception card scans will appear here after your first visit.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 5 },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 35,
  },
  row: { alignItems: "center", flexDirection: "row", gap: 11, paddingVertical: 10 },
  border: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 3, paddingTop: 13 },
  iconBox: {
    alignItems: "center",
    backgroundColor: iconPalette.teal.bg,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  grow: { flex: 1 },
  visitTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  visitMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  emptyCard: { alignItems: "center", gap: 7, paddingVertical: 30 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
