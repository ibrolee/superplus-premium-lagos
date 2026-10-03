import { Ionicons } from "@expo/vector-icons";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../../lib/BrandLogo";
import { useApp } from "../../lib/AppContext";
import { disableCurrentMemberPushToken } from "../../lib/push-notifications";
import { supabase } from "../../lib/supabase";
import {
  AccountLinkRequired,
  Card,
  colors,
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
  return (
    <View style={styles.detailRow}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={18} color={colors.green} />
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
  if (!member) {
    return (
      <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
        <AccountLinkRequired email={session?.user.email} />
        <Pressable
          style={styles.logoutSecondary}
          onPress={() => void supabase.auth.signOut()}
        >
          <Text style={styles.logoutSecondaryText}>Sign out</Text>
        </Pressable>
      </Screen>
    );
  }

  async function signOut() {
    Alert.alert("Sign out?", "You can sign back in with this member login.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await disableCurrentMemberPushToken();
            await supabase.auth.signOut();
          })();
        },
      },
    ]);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={sharedStyles.kicker}>PROFILE</Text>
      <Text style={sharedStyles.title}>Your account.</Text>

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
        <DetailRow icon="card-outline" label="Member card" value={String(member.member_card_number)} />
        <View style={styles.separator} />
        <DetailRow icon="mail-outline" label="Email" value={member.email ?? "Not provided"} />
        <View style={styles.separator} />
        <DetailRow icon="call-outline" label="Phone" value={member.phone ?? "Not provided"} />
      </Card>

      <Pressable
        style={styles.websiteButton}
        onPress={() => void Linking.openURL("https://www.superplusfitness.com")}
      >
        <Ionicons name="globe-outline" size={19} color={colors.green} />
        <Text style={styles.websiteText}>Open superplusfitness.com</Text>
        <Ionicons name="open-outline" size={18} color={colors.green2} />
      </Pressable>

      <Pressable style={styles.logout} onPress={() => void signOut()}>
        <Ionicons name="log-out-outline" size={19} color={colors.danger} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>

      <View style={styles.brandFooter}>
        <BrandLogo size={120} />
        <Text style={styles.version}>Super Plus Fitness · v0.1</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: { alignItems: "center", paddingVertical: 25 },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.green,
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: 11,
    height: 39,
    justifyContent: "center",
    width: 39,
  },
  grow: { flex: 1 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  detailValue: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 3 },
  separator: { backgroundColor: colors.line, height: 1, marginVertical: 10 },
  websiteButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    padding: 16,
  },
  websiteText: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900" },
  logout: {
    alignItems: "center",
    borderColor: "#EBCBC6",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 51,
  },
  logoutText: { color: colors.danger, fontSize: 13, fontWeight: "900" },
  logoutSecondary: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
  },
  logoutSecondaryText: { color: colors.danger, fontSize: 13, fontWeight: "900" },
  brandFooter: { alignItems: "center", gap: 8, paddingTop: 8 },
  version: { color: "#9AA39D", fontSize: 10, textAlign: "center" },
});
