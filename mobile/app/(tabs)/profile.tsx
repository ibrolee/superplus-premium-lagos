import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../../lib/BrandLogo";
import { useApp } from "../../lib/AppContext";
import { disableCurrentMemberPushToken } from "../../lib/push-notifications";
import { supabase } from "../../lib/supabase";
import {
  AccountLinkRequired,
  Card,
  colors,
  iconPalette,
  LoadingView,
  Screen,
  sharedStyles,
} from "../../lib/ui";

function toneForIcon(icon: string) {
  if (icon.includes("mail")) return iconPalette.blue;
  if (icon.includes("call") || icon.includes("whatsapp")) return iconPalette.teal;
  if (icon.includes("card")) return iconPalette.orange;
  if (icon.includes("shield")) return iconPalette.purple;
  if (icon.includes("document")) return iconPalette.gold;
  return iconPalette.orange;
}

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
      <View style={[styles.iconBox, { backgroundColor: toneForIcon(icon).bg }]}>
        <Ionicons name={icon} size={18} color={toneForIcon(icon).fg} />
      </View>
      <View style={styles.grow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function SupportLink({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon:
    | "logo-whatsapp"
    | "mail-outline"
    | "call-outline"
    | "shield-checkmark-outline"
    | "document-text-outline"
    | "trash-outline";
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.supportRow} onPress={onPress}>
      <View
        style={[
          styles.iconBox,
          { backgroundColor: danger ? "#FFF2F0" : toneForIcon(icon).bg },
          danger && styles.dangerIconBox,
        ]}
      >
        <Ionicons name={icon} size={18} color={danger ? colors.danger : toneForIcon(icon).fg} />
      </View>
      <Text style={[styles.supportText, danger && styles.dangerText]}>{label}</Text>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={danger ? colors.danger : colors.muted}
      />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { session, member, dataLoading, refreshing, refresh } = useApp();
  const [deletingAccount, setDeletingAccount] = useState(false);

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

  function requestAccountDeletion() {
    if (deletingAccount) return;

    Alert.alert(
      "Permanently delete account?",
      "This removes your Super Plus login and deletes or anonymizes app data such as attendance activity, SP Points, challenges, bookings, saved posts, likes and comments. Certain payment or accounting records may be retained where required.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeletingAccount(true);
              await disableCurrentMemberPushToken();

              const { error } = await supabase.functions.invoke(
                "delete-member-account",
                { body: { requested_from: "android-app" } },
              );

              if (error) {
                setDeletingAccount(false);
                Alert.alert(
                  "Could not delete account",
                  "Please try again or contact Super Plus support.",
                );
                return;
              }

              await supabase.auth.signOut();
              setDeletingAccount(false);
              Alert.alert(
                "Account deleted",
                "Your Super Plus app account has been deleted.",
              );
            })();
          },
        },
      ],
    );
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

      <Text style={styles.sectionTitle}>Help & support</Text>
      <Card style={styles.supportCard}>
        <SupportLink
          icon="logo-whatsapp"
          label="Chat with Super Plus on WhatsApp"
          onPress={() => void Linking.openURL("https://wa.me/2347054263170")}
        />
        <View style={styles.separator} />
        <SupportLink
          icon="mail-outline"
          label="Email support"
          onPress={() => void Linking.openURL("mailto:spfitnessandspa@gmail.com")}
        />
        <View style={styles.separator} />
        <SupportLink
          icon="call-outline"
          label="Call Super Plus Fitness"
          onPress={() => void Linking.openURL("tel:+2347054263170")}
        />
        <View style={styles.separator} />
        <SupportLink
          icon="shield-checkmark-outline"
          label="Privacy Policy"
          onPress={() => void Linking.openURL("https://www.superplusfitness.com/privacy-policy")}
        />
        <View style={styles.separator} />
        <SupportLink
          icon="document-text-outline"
          label="Terms & Conditions"
          onPress={() => void Linking.openURL("https://www.superplusfitness.com/terms")}
        />
      </Card>

      <Pressable
        style={styles.websiteButton}
        onPress={() => void Linking.openURL("https://www.superplusfitness.com")}
      >
        <Ionicons name="globe-outline" size={19} color={iconPalette.blue.fg} />
        <Text style={styles.websiteText}>Open superplusfitness.com</Text>
        <Ionicons name="open-outline" size={18} color={colors.green2} />
      </Pressable>

      <Pressable style={styles.logout} onPress={() => void signOut()}>
        <Ionicons name="log-out-outline" size={19} color={colors.danger} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>

      <Pressable
        style={[styles.deleteAccount, deletingAccount && styles.disabled]}
        disabled={deletingAccount}
        onPress={requestAccountDeletion}
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <View style={styles.deleteCopy}>
          <Text style={styles.deleteTitle}>
            {deletingAccount ? "Deleting account…" : "Delete account"}
          </Text>
          <Text style={styles.deleteText}>Permanently remove your app account and personal app data.</Text>
        </View>
      </Pressable>

      <Text style={styles.deletionWebNote}>
        You can also request deletion at superplusfitness.com/delete-account.
      </Text>

      <View style={styles.brandFooter}>
        <BrandLogo size={120} />
        <Text style={styles.version}>Super Plus Fitness · v1.0.0</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: 11,
    height: 39,
    justifyContent: "center",
    width: 39,
  },
  dangerIconBox: { backgroundColor: "#FFF2F0" },
  grow: { flex: 1 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  detailValue: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 3 },
  separator: { backgroundColor: colors.line, height: 1, marginVertical: 10 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 2 },
  supportCard: { paddingVertical: 8 },
  supportRow: { alignItems: "center", flexDirection: "row", gap: 11, minHeight: 50, paddingVertical: 4 },
  supportText: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800" },
  dangerText: { color: colors.danger },
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
  deleteAccount: {
    alignItems: "center",
    backgroundColor: "#FFF9F8",
    borderColor: "#EBCBC6",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    padding: 15,
  },
  deleteCopy: { flex: 1 },
  deleteTitle: { color: colors.danger, fontSize: 13, fontWeight: "900" },
  deleteText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  disabled: { opacity: 0.55 },
  deletionWebNote: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: "center" },
  brandFooter: { alignItems: "center", gap: 8, paddingTop: 8 },
  version: { color: "#9AA39D", fontSize: 10, textAlign: "center" },
});
