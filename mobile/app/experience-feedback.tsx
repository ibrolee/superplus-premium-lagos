import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  LoadingView,
  Screen,
  sharedStyles,
} from "../lib/ui";

type RatingKey =
  | "equipment"
  | "cleanliness"
  | "staff"
  | "facilities";
type RatingMap = Partial<Record<RatingKey, number>>;

const RATING_ROWS: Array<[RatingKey, string]> = [
  ["equipment", "Equipment"],
  ["cleanliness", "Cleanliness"],
  ["staff", "Staff & service"],
  ["facilities", "Facilities"],
];

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onChange(star)} hitSlop={5}>
            <Ionicons
              name={star <= value ? "star" : "star-outline"}
              size={26}
              color={star <= value ? "#E3A11A" : colors.muted}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ExperienceFeedbackScreen() {
  const { session, member, dataLoading, refreshing, refresh } = useApp();
  const [overall, setOverall] = useState(0);
  const [ratings, setRatings] = useState<RatingMap>({});
  const [comments, setComments] = useState("");
  const [existing, setExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const rows = RATING_ROWS;

  const load = useCallback(async () => {
    if (!member?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("member_experience_feedback")
      .select("overall_rating,ratings,comments")
      .eq("member_id", member.id)
      .eq("feedback_kind", "gym")
      .maybeSingle();

    if (error) {
      setExisting(false);
      setOverall(0);
      setRatings({});
      setComments("");
    } else if (data) {
      setExisting(true);
      setOverall(Number(data.overall_rating ?? 0));
      setRatings((data.ratings ?? {}) as RatingMap);
      setComments(String(data.comments ?? ""));
    } else {
      setExisting(false);
      setOverall(0);
      setRatings({});
      setComments("");
    }
    setLoading(false);
  }, [member?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const complete = useMemo(
    () => overall > 0 && rows.every(([key]) => Number(ratings[key] ?? 0) > 0),
    [overall, ratings, rows],
  );

  async function submit() {
    if (!complete || busy) {
      Alert.alert("Complete all ratings", "Please choose 1–5 stars for every item.");
      return;
    }

    setBusy(true);
    const payload = Object.fromEntries(
      rows.map(([key]) => [key, Number(ratings[key])]),
    );

    const { data, error } = await supabase.rpc("submit_my_experience_feedback", {
      p_kind: "gym",
      p_overall_rating: overall,
      p_ratings: payload,
      p_comments: comments.trim() || null,
    });
    setBusy(false);

    if (error) {
      Alert.alert("Could not submit", error.message || "Please try again.");
      return;
    }

    const awarded = Number(data?.points_awarded ?? 0);
    Alert.alert(
      existing ? "Feedback updated" : "Thank you",
      awarded > 0
        ? "Your private feedback was saved and +" + awarded + " SP Points were added."
        : "Your private feedback was updated. The one-time SP bonus was already awarded on your first submission.",
      [{ text: "Done", onPress: () => router.back() }],
    );
  }

  if (!session) return <Redirect href="/login" />;
  if (dataLoading) return <LoadingView />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void refresh(); void load(); }}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={colors.ink} />
        <Text style={styles.backText}>Bonus points</Text>
      </Pressable>

      <Text style={sharedStyles.kicker}>PRIVATE FEEDBACK</Text>
      <Text style={sharedStyles.title}>Help us improve.</Text>
      <Text style={sharedStyles.subtitle}>
        Your first Gym Experience Feedback earns 10 SP Points. Honest low or high ratings earn the same amount.
      </Text>

      {!member ? (
        <AccountLinkRequired email={session.user.email} />
      ) : (
        <>
          {loading ? (
            <Card style={styles.loadingCard}>
              <ActivityIndicator color={colors.green2} />
            </Card>
          ) : (
            <>
              <Card>
                <View style={styles.rewardRow}>
                  <View style={styles.rewardIcon}>
                    <Ionicons
                      name={existing ? "checkmark-circle" : "sparkles"}
                      size={21}
                      color={colors.green2}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.rewardTitle}>
                      {existing ? "Bonus already earned" : "One-time +10 SP bonus"}
                    </Text>
                    <Text style={styles.copy}>
                      {existing
                        ? "You can update your feedback anytime, but points are awarded only once."
                        : "Requires at least one recorded gym visit."}
                    </Text>
                  </View>
                </View>
              </Card>

              <Card>
                <RatingRow label="Overall" value={overall} onChange={setOverall} />
                <View style={styles.divider} />
                {rows.map(([key, label], index) => (
                  <View key={key}>
                    {index > 0 && <View style={styles.thinDivider} />}
                    <RatingRow
                      label={label}
                      value={Number(ratings[key] ?? 0)}
                      onChange={(value) =>
                        setRatings((current) => ({ ...current, [key]: value }))
                      }
                    />
                  </View>
                ))}
              </Card>

              <Card>
                <Text style={styles.label}>Anything else we should know? (optional)</Text>
                <TextInput
                  value={comments}
                  onChangeText={setComments}
                  multiline
                  maxLength={2000}
                  placeholder="Tell us what went well or what the gym can improve."
                  placeholderTextColor={colors.muted}
                  textAlignVertical="top"
                  style={styles.textArea}
                />
                <Text style={styles.count}>{comments.length}/2000</Text>
              </Card>

              <Pressable
                disabled={!complete || busy}
                onPress={() => void submit()}
                style={[styles.submitButton, (!complete || busy) && styles.disabled]}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={17} color="#FFFFFF" />
                    <Text style={styles.submitText}>
                      {existing ? "Update private feedback" : "Submit & earn 10 SP"}
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          )}
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
    gap: 5,
    minHeight: 38,
  },
  backText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  loadingCard: { alignItems: "center", paddingVertical: 28 },
  rewardRow: { alignItems: "center", flexDirection: "row", gap: 11 },
  rewardIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  grow: { flex: 1 },
  rewardTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 3 },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 48,
  },
  ratingLabel: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: "900" },
  stars: { flexDirection: "row", gap: 4 },
  divider: { backgroundColor: colors.line, height: 1, marginVertical: 8 },
  thinDivider: { backgroundColor: colors.line, height: 1 },
  label: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  textArea: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 9,
    minHeight: 130,
    padding: 12,
  },
  count: { color: colors.muted, fontSize: 9, marginTop: 5, textAlign: "right" },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.green2,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
  },
  submitText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.45 },
});
