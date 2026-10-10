import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useApp } from "../../lib/AppContext";
import {
  AccountLinkRequired,
  Card,
  colors,
  iconPalette,
  LoadingView,
  Screen,
  sharedStyles,
} from "../../lib/ui";

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: "mail-outline" | "call-outline" | "card-outline";
  label: string;
  value: string;
}) {
  const tone =
    icon === "mail-outline"
      ? iconPalette.blue
      : icon === "call-outline"
        ? iconPalette.teal
        : iconPalette.orange;

  return (
    <View style={styles.detailRow}>
      <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
        <Ionicons name={icon} size={18} color={tone.fg} />
      </View>
      <View style={styles.grow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { session, member, dataLoading, refreshing, refresh } = useApp();

  if (dataLoading) return <LoadingView />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.ink} />
        <Text style={styles.backText}>Settings</Text>
      </Pressable>

      <Text style={sharedStyles.kicker}>PROFILE</Text>
      <Text style={sharedStyles.title}>Your account.</Text>
      <Text style={sharedStyles.subtitle}>
        Your member details are linked to your Super Plus account.
      </Text>

      {!member ? (
        <AccountLinkRequired email={session?.user.email} />
      ) : (
        <>
          <Card style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {member.full_name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")}
              </Text>
            </View>
            <Text style={styles.name}>{member.full_name}</Text>
            <Text style={styles.memberId}>Member #{member.member_card_number}</Text>
          </Card>

          <Card>
            <DetailRow
              icon="card-outline"
              label="Member card"
              value={String(member.member_card_number)}
            />
            <View style={styles.separator} />
            <DetailRow
              icon="mail-outline"
              label="Email"
              value={member.email ?? "Not provided"}
            />
            <View style={styles.separator} />
            <DetailRow
              icon="call-outline"
              label="Phone"
              value={member.phone ?? "Not provided"}
            />
          </Card>

          <Card style={styles.noteCard}>
            <View style={styles.noteIcon}>
              <Ionicons name="information-circle-outline" size={19} color={iconPalette.blue.fg} />
            </View>
            <Text style={styles.noteText}>
              If any profile information is incorrect, contact Super Plus support from Settings so reception can update your member record.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 3,
    minHeight: 34,
  },
  backText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  profileCard: { alignItems: "center", paddingVertical: 25 },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.green2,
    borderRadius: 28,
    height: 70,
    justifyContent: "center",
    width: 70,
  },
  avatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  name: { color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: 13 },
  memberId: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  detailRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 5 },
  iconBox: {
    alignItems: "center",
    borderRadius: 11,
    height: 39,
    justifyContent: "center",
    width: 39,
  },
  grow: { flex: 1 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  detailValue: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 3 },
  separator: { backgroundColor: colors.line, height: 1, marginVertical: 10 },
  noteCard: { alignItems: "flex-start", flexDirection: "row", gap: 11 },
  noteIcon: {
    alignItems: "center",
    backgroundColor: iconPalette.blue.bg,
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  noteText: { color: colors.muted, flex: 1, fontSize: 11, lineHeight: 17 },
});
