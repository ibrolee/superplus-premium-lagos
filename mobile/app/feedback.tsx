import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../lib/AppContext";
import {
  AccountLinkRequired,
  Card,
  colors,
  lagosToday,
  LoadingView,
  Screen,
  sharedStyles,
} from "../lib/ui";
import { supabase } from "../lib/supabase";

const categories = [
  ["coach", "Coach"],
  ["staff", "Staff member"],
  ["equipment", "Equipment"],
  ["facilities", "Facilities"],
  ["cleanliness", "Cleanliness"],
  ["payment", "Payment / billing"],
  ["safety", "Safety"],
  ["service", "Gym service / experience"],
  ["other", "Other"],
] as const;

export default function FeedbackScreen() {
  const {
    session,
    member,
    memberships,
    dataLoading,
    refreshing,
    refresh,
  } = useApp();
  const [type, setType] = useState<"suggestion" | "issue">("suggestion");
  const [category, setCategory] = useState("service");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const today = lagosToday();
  const activeMembership = useMemo(
    () =>
      memberships.find(
        (item) =>
          item.payment_status === "paid" &&
          item.start_date <= today &&
          item.end_date >= today,
      ) ?? null,
    [memberships, today],
  );

  if (dataLoading) return <LoadingView />;
  if (!member) {
    return (
      <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
        <AccountLinkRequired email={session?.user.email} />
      </Screen>
    );
  }

  async function submit() {
    if (!member) {
      Alert.alert("Member account required", "Please sign in again and try once more.");
      return;
    }
    if (!activeMembership) {
      Alert.alert(
        "Active membership required",
        "Suggestions and confidential issue reports are available to active Super Plus members.",
      );
      return;
    }

    const cleanDetails = details.trim();
    if (cleanDetails.length < 10) {
      Alert.alert("Add more detail", "Please write at least 10 characters so management can understand your submission.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("member_feedback_submissions").insert({
        member_id: member.id,
        membership_id: activeMembership.id,
        submission_type: type,
        category,
        subject: subject.trim() || null,
        details: cleanDetails,
      });
      if (error) throw error;

      setSubject("");
      setDetails("");
      setCategory("service");
      Alert.alert(
        type === "suggestion" ? "Suggestion sent" : "Issue reported",
        "Your submission was sent confidentially to Super Plus management. Coaches, staff and reception cannot view it through their dashboards.",
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (cause) {
      Alert.alert(
        "Could not send",
        cause instanceof Error ? cause.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={20} color={colors.green} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={sharedStyles.kicker}>MEMBER FEEDBACK</Text>
      <Text style={sharedStyles.title}>Suggestions & issues.</Text>
      <Text style={sharedStyles.subtitle}>
        Tell management what can be improved or report anything concerning the gym.
      </Text>

      {!activeMembership ? (
        <Card>
          <View style={styles.noticeRow}>
            <Ionicons name="information-circle-outline" size={22} color={colors.green2} />
            <Text style={styles.noticeText}>
              This feature is available when your paid Super Plus membership is active.
            </Text>
          </View>
        </Card>
      ) : (
        <>
          <Card>
            <View style={styles.confidentialRow}>
              <View style={styles.shield}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.grow}>
                <Text style={styles.confidentialTitle}>Confidential to management</Text>
                <Text style={styles.confidentialText}>
                  Only authorised Super Plus management accounts can access your submission.
                  Coaches, staff and reception cannot see it through their dashboards. Management
                  may contact you privately if follow-up is needed.
                </Text>
              </View>
            </View>
          </Card>

          <Card>
            <Text style={styles.label}>What would you like to do?</Text>
            <View style={styles.typeRow}>
              <Pressable
                disabled={busy}
                onPress={() => {
                  setType("suggestion");
                  if (category === "other") setCategory("service");
                }}
                style={[styles.typeButton, type === "suggestion" && styles.typeButtonActive]}
              >
                <Ionicons
                  name="bulb-outline"
                  size={18}
                  color={type === "suggestion" ? "#FFFFFF" : colors.green2}
                />
                <Text style={[styles.typeButtonText, type === "suggestion" && styles.typeButtonTextActive]}>
                  Suggestion
                </Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => setType("issue")}
                style={[styles.typeButton, type === "issue" && styles.issueButtonActive]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={type === "issue" ? "#FFFFFF" : "#8F2F2F"}
                />
                <Text style={[styles.issueButtonText, type === "issue" && styles.typeButtonTextActive]}>
                  Report issue
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>What does it concern?</Text>
            <View style={styles.categoryGrid}>
              {categories.map(([value, label]) => {
                const selected = category === value;
                return (
                  <Pressable
                    key={value}
                    disabled={busy}
                    onPress={() => setCategory(value)}
                    style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                  >
                    <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Subject (optional)</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              maxLength={160}
              editable={!busy}
              placeholder={type === "suggestion" ? "Short title for your idea" : "Short title for the issue"}
              placeholderTextColor="#95A098"
              style={styles.input}
            />

            <Text style={styles.label}>
              {type === "suggestion" ? "Tell management your suggestion" : "Tell management what happened"}
            </Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={3000}
              editable={!busy}
              placeholder={
                type === "suggestion"
                  ? "Explain your idea and how it could improve Super Plus…"
                  : "Describe the issue clearly and include anything management should know…"
              }
              placeholderTextColor="#95A098"
              textAlignVertical="top"
              style={styles.textArea}
            />
            <Text style={styles.count}>{details.length}/3000</Text>

            <Pressable
              disabled={busy}
              onPress={() => void submit()}
              style={[styles.submitButton, busy && styles.disabled]}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
              <Text style={styles.submitText}>{busy ? "Sending…" : "Send confidentially"}</Text>
            </Pressable>
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
    gap: 6,
    marginBottom: 14,
    minHeight: 40,
  },
  backText: { color: colors.green, fontSize: 12, fontWeight: "900" },
  grow: { flex: 1 },
  noticeRow: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  noticeText: { color: colors.ink, flex: 1, fontSize: 12, lineHeight: 19 },
  confidentialRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  shield: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 13,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  confidentialTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  confidentialText: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 4 },
  label: { color: colors.ink, fontSize: 11, fontWeight: "900", marginTop: 16 },
  typeRow: { flexDirection: "row", gap: 8, marginTop: 9 },
  typeButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 10,
  },
  typeButtonActive: { backgroundColor: colors.green, borderColor: colors.green },
  issueButtonActive: { backgroundColor: "#8F2F2F", borderColor: "#8F2F2F" },
  typeButtonText: { color: colors.green2, fontSize: 11, fontWeight: "900" },
  issueButtonText: { color: "#8F2F2F", fontSize: 11, fontWeight: "900" },
  typeButtonTextActive: { color: "#FFFFFF" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
  categoryChip: {
    backgroundColor: "#FAFCF9",
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  categoryChipSelected: { backgroundColor: colors.surfaceMuted, borderColor: colors.green2 },
  categoryText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  categoryTextSelected: { color: colors.green2 },
  input: {
    backgroundColor: "#FAFCF9",
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 13,
    marginTop: 7,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  textArea: {
    backgroundColor: "#FAFCF9",
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    minHeight: 140,
    padding: 13,
  },
  count: { color: colors.muted, fontSize: 9, marginTop: 4, textAlign: "right" },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 13,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  submitText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.55 },
});
