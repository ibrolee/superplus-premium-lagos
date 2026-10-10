import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useApp } from "../lib/AppContext";
import { supabase } from "../lib/supabase";
import {
  AccountLinkRequired,
  Card,
  colors,
  iconPalette,
  LoadingView,
  Screen,
  sharedStyles,
} from "../lib/ui";

type FeedbackKind = "gym";
type SocialPlatform = "instagram" | "tiktok";

type SocialClaim = {
  platform: SocialPlatform;
  handle: string;
  status: "pending" | "approved" | "rejected";
  points_reward: number;
  staff_note: string | null;
};

const SOCIALS: Record<SocialPlatform, { label: string; account: string; url: string; icon: "logo-instagram" | "musical-notes-outline" }> = {
  instagram: {
    label: "Instagram",
    account: "@superplusfitnessandspa",
    url: "https://www.instagram.com/superplusfitnessandspa/",
    icon: "logo-instagram",
  },
  tiktok: {
    label: "TikTok",
    account: "@superplusfitness",
    url: "https://www.tiktok.com/@superplusfitness",
    icon: "musical-notes-outline",
  },
};

const GOOGLE_MAPS_URL = "https://maps.app.goo.gl/e1Hsixb4neoSSHQd7?g_st=ic";
const PLAY_STORE_WEB = "https://play.google.com/store/apps/details?id=com.superplusfitness.app";
const PLAY_STORE_APP = "market://details?id=com.superplusfitness.app";

function statusLabel(status?: SocialClaim["status"]) {
  if (status === "approved") return "Approved · +10 SP";
  if (status === "pending") return "Pending verification";
  if (status === "rejected") return "Needs resubmission";
  return "Not claimed";
}

export default function BonusPointsScreen() {
  const { session, member, dataLoading, refreshing, refresh } = useApp();
  const [feedbackDone, setFeedbackDone] = useState<Set<FeedbackKind>>(new Set());
  const [claims, setClaims] = useState<Partial<Record<SocialPlatform, SocialClaim>>>({});
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<SocialPlatform | null>(null);

  const load = useCallback(async () => {
    if (!member?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [feedbackResult, socialResult] = await Promise.all([
      supabase
        .from("member_experience_feedback")
        .select("feedback_kind")
        .eq("member_id", member.id),
      supabase
        .from("member_social_follow_claims")
        .select("platform,handle,status,points_reward,staff_note")
        .eq("member_id", member.id),
    ]);

    setFeedbackDone(
      new Set(
        (feedbackResult.data ?? [])
          .map((item) => String(item.feedback_kind))
          .filter((value): value is FeedbackKind => value === "gym"),
      ),
    );

    const nextClaims: Partial<Record<SocialPlatform, SocialClaim>> = {};
    for (const row of socialResult.data ?? []) {
      const platform = String(row.platform) as SocialPlatform;
      if (platform !== "instagram" && platform !== "tiktok") continue;
      nextClaims[platform] = {
        platform,
        handle: String(row.handle ?? ""),
        status: String(row.status) as SocialClaim["status"],
        points_reward: Number(row.points_reward ?? 10),
        staff_note: row.staff_note ? String(row.staff_note) : null,
      };
    }

    setClaims(nextClaims);
    if (nextClaims.instagram?.handle) setInstagramHandle(nextClaims.instagram.handle);
    if (nextClaims.tiktok?.handle) setTiktokHandle(nextClaims.tiktok.handle);
    setLoading(false);
  }, [member?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitSocial(platform: SocialPlatform) {
    const handle = (platform === "instagram" ? instagramHandle : tiktokHandle)
      .trim()
      .replace(/^@+/, "");

    if (handle.length < 2) {
      Alert.alert("Enter your username", "Follow Super Plus first, then enter the username you followed with.");
      return;
    }

    setBusy(platform);
    const { data, error } = await supabase.rpc("submit_my_social_follow_claim", {
      p_platform: platform,
      p_handle: handle,
    });
    setBusy(null);

    if (error) {
      Alert.alert("Could not submit", error.message || "Please try again.");
      return;
    }

    if (data?.already_approved) {
      Alert.alert("Already approved", "You already received this one-time follow bonus.");
    } else {
      Alert.alert(
        "Sent for verification",
        "Management will verify the follow. Your 10 SP Points are added automatically when approved.",
      );
    }
    await load();
  }

  async function openPlayStore() {
    if (Platform.OS !== "android") return;
    const supported = await Linking.canOpenURL(PLAY_STORE_APP).catch(() => false);
    await Linking.openURL(supported ? PLAY_STORE_APP : PLAY_STORE_WEB);
  }

  if (!session) return <Redirect href="/login" />;
  if (dataLoading) return <LoadingView />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void refresh(); void load(); }}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={colors.ink} />
        <Text style={styles.backText}>Rewards</Text>
      </Pressable>

      <Text style={sharedStyles.kicker}>BONUS SP POINTS</Text>
      <Text style={sharedStyles.title}>Small actions. Extra points.</Text>
      <Text style={sharedStyles.subtitle}>
        These bonuses are one-time rewards. Private gym experience feedback earns points; public reviews are always optional and never affect SP Points.
      </Text>

      {!member ? (
        <AccountLinkRequired email={session.user.email} />
      ) : loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.green2} />
          <Text style={styles.copy}>Checking your bonus tasks…</Text>
        </Card>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Private feedback · 10 SP</Text>
          <Card>
            <View style={styles.taskRow}>
              <View style={[styles.iconBox, { backgroundColor: iconPalette.teal.bg }]}>
                <Ionicons name="barbell-outline" size={20} color={iconPalette.teal.fg} />
              </View>
              <View style={styles.grow}>
                <Text style={styles.taskTitle}>Rate your gym experience</Text>
                <Text style={styles.copy}>Private feedback on equipment, cleanliness, staff and facilities. A recorded visit is required.</Text>
              </View>
              <Pressable
                onPress={() => router.push("/experience-feedback?kind=gym" as never)}
                style={[styles.actionButton, feedbackDone.has("gym") && styles.secondaryButton]}
              >
                <Text style={[styles.actionText, feedbackDone.has("gym") && styles.secondaryText]}>
                  {feedbackDone.has("gym") ? "Update" : "+10 SP"}
                </Text>
              </Pressable>
            </View>
          </Card>

          <Text style={styles.sectionTitle}>Social follow bonuses · 10 SP each</Text>
          {(["instagram", "tiktok"] as const).map((platform) => {
            const social = SOCIALS[platform];
            const claim = claims[platform];
            const approved = claim?.status === "approved";
            const pending = claim?.status === "pending";
            const handle = platform === "instagram" ? instagramHandle : tiktokHandle;
            const setHandle = platform === "instagram" ? setInstagramHandle : setTiktokHandle;

            return (
              <Card key={platform}>
                <View style={styles.socialTop}>
                  <View style={styles.iconBox}>
                    <Ionicons name={social.icon} size={21} color={colors.green2} />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.taskTitle}>Follow Super Plus on {social.label}</Text>
                    <Text style={styles.copy}>{social.account}</Text>
                    <Text
                      style={[
                        styles.status,
                        approved && styles.statusApproved,
                        claim?.status === "rejected" && styles.statusRejected,
                      ]}
                    >
                      {statusLabel(claim?.status)}
                    </Text>
                  </View>
                  <Pressable onPress={() => void Linking.openURL(social.url)} style={styles.outlineButton}>
                    <Text style={styles.outlineText}>Open</Text>
                  </Pressable>
                </View>

                {!approved && (
                  <>
                    <TextInput
                      value={handle}
                      onChangeText={setHandle}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!pending && busy !== platform}
                      placeholder={"Your " + social.label + " username"}
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                    />
                    {!!claim?.staff_note && claim.status === "rejected" && (
                      <Text style={styles.rejectionNote}>Management note: {claim.staff_note}</Text>
                    )}
                    <Pressable
                      disabled={pending || busy === platform}
                      onPress={() => void submitSocial(platform)}
                      style={[styles.submitButton, (pending || busy === platform) && styles.disabled]}
                    >
                      {busy === platform ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.submitText}>
                          {pending ? "Waiting for verification" : claim?.status === "rejected" ? "Resubmit claim" : "Claim +10 SP"}
                        </Text>
                      )}
                    </Pressable>
                  </>
                )}
              </Card>
            );
          })}

          <Text style={styles.sectionTitle}>Public reviews · no SP Points</Text>
          <Card>
            <Text style={styles.taskTitle}>Share your experience publicly</Text>
            <Text style={styles.copy}>
              Public ratings are completely optional. Positive or negative reviews do not earn, reduce or affect your SP Points.
            </Text>
            <View style={styles.publicActions}>
              <Pressable onPress={() => void Linking.openURL(GOOGLE_MAPS_URL)} style={styles.publicButton}>
                <Ionicons name="location-outline" size={18} color={colors.ink} />
                <Text style={styles.publicText}>Review gym on Google</Text>
              </Pressable>
              {Platform.OS === "android" && (
                <Pressable onPress={() => void openPlayStore()} style={styles.publicButton}>
                  <Ionicons name="logo-google-playstore" size={18} color={colors.ink} />
                  <Text style={styles.publicText}>Rate app on Google Play</Text>
                </Pressable>
              )}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 5, minHeight: 38 },
  backText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 4 },
  loadingCard: { alignItems: "center", gap: 9, paddingVertical: 28 },
  grow: { flex: 1 },
  taskRow: { alignItems: "center", flexDirection: "row", gap: 11 },
  socialTop: { alignItems: "center", flexDirection: "row", gap: 11 },
  iconBox: { alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  taskTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 3 },
  status: { color: colors.amber, fontSize: 9, fontWeight: "900", marginTop: 5, textTransform: "uppercase" },
  statusApproved: { color: colors.success },
  statusRejected: { color: colors.danger },
  actionButton: { alignItems: "center", backgroundColor: colors.green2, borderRadius: 10, justifyContent: "center", minHeight: 38, minWidth: 68, paddingHorizontal: 10 },
  actionText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  secondaryButton: { backgroundColor: colors.surfaceMuted, borderColor: colors.line, borderWidth: 1 },
  secondaryText: { color: colors.ink },
  outlineButton: { borderColor: colors.line, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  outlineText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  input: { backgroundColor: colors.background, borderColor: colors.line, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 12, marginTop: 13, minHeight: 46, paddingHorizontal: 12 },
  rejectionNote: { color: colors.danger, fontSize: 10, lineHeight: 15, marginTop: 7 },
  submitButton: { alignItems: "center", backgroundColor: colors.green2, borderRadius: 11, justifyContent: "center", marginTop: 9, minHeight: 44 },
  submitText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  publicActions: { gap: 8, marginTop: 13 },
  publicButton: { alignItems: "center", backgroundColor: colors.background, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 9, minHeight: 46, paddingHorizontal: 12 },
  publicText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
});
