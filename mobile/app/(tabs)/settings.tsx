import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useState } from "react";
import {
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BrandLogo } from "../../lib/BrandLogo";
import { useApp } from "../../lib/AppContext";
import {
  type AppearanceMode,
  useAppearancePreference,
} from "../../lib/appearance";
import { disableCurrentMemberPushToken } from "../../lib/push-notifications";
import { supabase } from "../../lib/supabase";
import {
  Card,
  colors,
  iconPalette,
  LoadingView,
  Screen,
  sharedStyles,
} from "../../lib/ui";

type IconName = ComponentProps<typeof Ionicons>["name"];

function SettingsRow({
  icon,
  label,
  detail,
  onPress,
  danger = false,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View
        style={[
          styles.iconBox,
          { backgroundColor: danger ? "#FFF2F0" : iconPalette.purple.bg },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={danger ? colors.danger : iconPalette.purple.fg}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>
        {!!detail && <Text style={styles.rowDetail}>{detail}</Text>}
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={danger ? colors.danger : colors.muted}
      />
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function AppearanceChoice({
  mode,
  currentMode,
  label,
  icon,
  onSelect,
}: {
  mode: AppearanceMode;
  currentMode: AppearanceMode;
  label: string;
  icon: IconName;
  onSelect: (mode: AppearanceMode) => void;
}) {
  const selected = mode === currentMode;

  return (
    <Pressable
      onPress={() => onSelect(mode)}
      style={[styles.appearanceChoice, selected && styles.appearanceChoiceSelected]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={selected ? "#FFFFFF" : colors.ink}
      />
      <Text style={[styles.appearanceLabel, selected && styles.appearanceLabelSelected]}>
        {label}
      </Text>
      {selected && <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { member, dataLoading } = useApp();
  const { mode, setMode } = useAppearancePreference();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  if (dataLoading) return <LoadingView />;

  async function signOut() {
    Alert.alert("Log out?", "You can sign back in anytime with your Super Plus login.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
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

  function exitApp() {
    Alert.alert("Exit Super Plus?", "This will close the app.", [
      { text: "Cancel", style: "cancel" },
      { text: "Exit", style: "destructive", onPress: () => BackHandler.exitApp() },
    ]);
  }

  function requestAccountDeletion() {
    if (deletingAccount || !member) return;

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
                {
                  body: {
                    requested_from: Platform.OS === "ios" ? "ios-app" : "android-app",
                  },
                },
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
              Alert.alert("Account deleted", "Your Super Plus app account has been deleted.");
            })();
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Text style={sharedStyles.kicker}>SETTINGS</Text>
      <Text style={sharedStyles.title}>Your app, your way.</Text>
      <Text style={sharedStyles.subtitle}>
        Manage your profile, appearance, support and account controls.
      </Text>

      <Text style={styles.sectionTitle}>Account</Text>
      <Card style={styles.card}>
        <SettingsRow
          icon="person-circle-outline"
          label="Profile"
          detail={
            member
              ? `${member.full_name} · Member #${member.member_card_number}`
              : "View your Super Plus account"
          }
          onPress={() => router.push("/(tabs)/profile" as never)}
        />
        <Separator />
        <SettingsRow
          icon="notifications-outline"
          label="Notifications"
          detail="View Super Plus alerts and updates"
          onPress={() => router.push("/notifications" as never)}
        />
        <Separator />
        <SettingsRow
          icon="sparkles-outline"
          label="Bonus SP Points"
          detail="Private feedback and verified social follow bonuses"
          onPress={() => router.push("/bonus-points" as never)}
        />
      </Card>

      <Text style={styles.sectionTitle}>Appearance</Text>
      <Card style={styles.appearanceCard}>
        <Pressable
          style={styles.appearanceHeader}
          onPress={() => setAppearanceOpen((open) => !open)}
        >
          <View style={[styles.iconBox, { backgroundColor: iconPalette.purple.bg }]}>
            <Ionicons name="contrast-outline" size={18} color={iconPalette.purple.fg} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowLabel}>Theme</Text>
            <Text style={styles.rowDetail}>
              {mode === "system" ? "System default" : mode === "dark" ? "Dark" : "Light"}
            </Text>
          </View>
          <Ionicons
            name={appearanceOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.muted}
          />
        </Pressable>

        {appearanceOpen && (
          <>
            <View style={styles.appearanceDivider} />
            <Text style={styles.appearanceHint}>
              Choose how Super Plus looks. The app refreshes automatically after you select one.
            </Text>
            <View style={styles.appearanceGrid}>
              <AppearanceChoice
                mode="light"
                currentMode={mode}
                label="Light"
                icon="sunny-outline"
                onSelect={(next) => void setMode(next)}
              />
              <AppearanceChoice
                mode="dark"
                currentMode={mode}
                label="Dark"
                icon="moon-outline"
                onSelect={(next) => void setMode(next)}
              />
              <AppearanceChoice
                mode="system"
                currentMode={mode}
                label="System"
                icon="phone-portrait-outline"
                onSelect={(next) => void setMode(next)}
              />
            </View>
          </>
        )}
      </Card>

      <Text style={styles.sectionTitle}>App & permissions</Text>
      <Card style={styles.card}>
        <SettingsRow
          icon="options-outline"
          label="App permissions"
          detail="Manage notification and device permissions"
          onPress={() => void Linking.openSettings()}
        />
        <Separator />
        <SettingsRow
          icon="information-circle-outline"
          label="About Super Plus"
          detail={`Version ${appVersion}`}
          onPress={() =>
            Alert.alert(
              "Super Plus Fitness",
              `Super Plus Fitness member app · Version ${appVersion}`,
            )
          }
        />
      </Card>

      <Text style={styles.sectionTitle}>Help, support & legal</Text>
      <Card style={styles.card}>
        <SettingsRow
          icon="logo-whatsapp"
          label="WhatsApp support"
          detail="Chat with Super Plus Fitness"
          onPress={() => void Linking.openURL("https://wa.me/2347054263170")}
        />
        <Separator />
        <SettingsRow
          icon="mail-outline"
          label="Email support"
          detail="spfitnessandspa@gmail.com"
          onPress={() => void Linking.openURL("mailto:spfitnessandspa@gmail.com")}
        />
        <Separator />
        <SettingsRow
          icon="shield-checkmark-outline"
          label="Privacy Policy"
          onPress={() =>
            void Linking.openURL("https://www.superplusfitness.com/privacy-policy")
          }
        />
        <Separator />
        <SettingsRow
          icon="document-text-outline"
          label="Terms & Conditions"
          onPress={() => void Linking.openURL("https://www.superplusfitness.com/terms")}
        />
        <Separator />
        <SettingsRow
          icon="globe-outline"
          label="Super Plus website"
          onPress={() => void Linking.openURL("https://www.superplusfitness.com")}
        />
      </Card>

      <Text style={styles.sectionTitle}>Account actions</Text>
      <Card style={styles.card}>
        <SettingsRow
          icon="log-out-outline"
          label="Log out"
          onPress={() => void signOut()}
          danger
        />
        {member && (
          <>
            <Separator />
            <SettingsRow
              icon="trash-outline"
              label={deletingAccount ? "Deleting account…" : "Delete account"}
              detail="Permanently remove your app account and personal app data"
              onPress={requestAccountDeletion}
              danger
            />
          </>
        )}
        {Platform.OS === "android" && (
          <>
            <Separator />
            <SettingsRow
              icon="exit-outline"
              label="Exit app"
              detail="Close Super Plus Fitness"
              onPress={exitApp}
              danger
            />
          </>
        )}
      </Card>

      <View style={styles.footer}>
        <BrandLogo size={108} />
        <Text style={styles.footerText}>Super Plus Fitness · v{appVersion}</Text>
        <Text style={styles.footerSubtext}>
          Account deletion is also available at superplusfitness.com/delete-account.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  card: { paddingVertical: 8 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 58,
    paddingVertical: 5,
  },
  iconBox: {
    alignItems: "center",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  rowCopy: { flex: 1 },
  rowLabel: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  rowDetail: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  dangerText: { color: colors.danger },
  separator: { backgroundColor: colors.line, height: 1, marginLeft: 54 },
  appearanceCard: { gap: 12, paddingVertical: 8 },
  appearanceHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 58,
    paddingVertical: 5,
  },
  appearanceDivider: { backgroundColor: colors.line, height: 1 },
  appearanceHint: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  appearanceGrid: { gap: 9 },
  appearanceChoice: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  appearanceChoiceSelected: {
    backgroundColor: colors.green2,
    borderColor: colors.green2,
  },
  appearanceLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
  },
  appearanceLabelSelected: { color: "#FFFFFF" },
  footer: { alignItems: "center", gap: 6, paddingBottom: 6, paddingTop: 6 },
  footerText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  footerSubtext: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 14,
    maxWidth: 310,
    textAlign: "center",
  },
});
