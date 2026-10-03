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
import { Card, colors, dateTimeLabel, Screen, sharedStyles } from "../lib/ui";

type Exercise = {
  id: string;
  name: string;
  done: boolean;
};

type WorkoutSession = {
  id: string;
  member_id: string;
  title: string;
  template_key: string | null;
  exercises: Exercise[];
  started_at: string;
  completed_at: string | null;
};

const templates: Array<{ key: string; title: string; icon: keyof typeof Ionicons.glyphMap; exercises: string[] }> = [
  {
    key: "full_body",
    title: "Full Body",
    icon: "body-outline",
    exercises: ["Squat or Leg Press", "Chest Press", "Lat Pulldown", "Shoulder Press", "Leg Curl", "Core / Plank"],
  },
  {
    key: "upper",
    title: "Upper Body",
    icon: "barbell-outline",
    exercises: ["Chest Press", "Lat Pulldown", "Shoulder Press", "Seated Cable Row", "Biceps Curl", "Triceps Pushdown"],
  },
  {
    key: "lower",
    title: "Lower Body",
    icon: "walk-outline",
    exercises: ["Squat or Leg Press", "Romanian Deadlift", "Leg Curl", "Leg Extension", "Calf Raise", "Core"],
  },
  {
    key: "cardio",
    title: "Cardio",
    icon: "heart-outline",
    exercises: ["Warm-up", "Treadmill", "Bike or Elliptical", "Mobility", "Cool-down"],
  },
];

function makeExercises(names: string[]): Exercise[] {
  return names.map((name, index) => ({
    id: `${Date.now()}-${index}`,
    name,
    done: false,
  }));
}

export default function WorkoutsScreen() {
  const { session, member, refreshing, refresh } = useApp();
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newExercise, setNewExercise] = useState("");

  const load = useCallback(async () => {
    if (!member?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from("member_workout_sessions")
      .select("id,member_id,title,template_key,exercises,started_at,completed_at")
      .eq("member_id", member.id)
      .order("started_at", { ascending: false })
      .limit(20);

    const rows = (data ?? []) as WorkoutSession[];
    setActive(rows.find((item) => !item.completed_at) ?? null);
    setHistory(rows.filter((item) => !!item.completed_at));
    setLoading(false);
  }, [member?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const completedCount = useMemo(
    () => active?.exercises.filter((item) => item.done).length ?? 0,
    [active],
  );

  async function startWorkout(templateKey: string | null) {
    if (!member?.id || starting || active) return;

    const template = templates.find((item) => item.key === templateKey);
    const title = template?.title ?? "My Workout";
    const exercises = makeExercises(template?.exercises ?? []);

    setStarting(true);
    const { data, error } = await supabase
      .from("member_workout_sessions")
      .insert({
        member_id: member.id,
        title,
        template_key: templateKey,
        exercises,
      })
      .select("id,member_id,title,template_key,exercises,started_at,completed_at")
      .single();

    setStarting(false);

    if (error || !data) {
      Alert.alert("Could not start workout", "Please try again.");
      return;
    }

    setActive(data as WorkoutSession);
  }

  async function saveExercises(next: Exercise[]) {
    if (!active) return;
    setActive({ ...active, exercises: next });
    setSaving(true);

    const { error } = await supabase
      .from("member_workout_sessions")
      .update({ exercises: next, updated_at: new Date().toISOString() })
      .eq("id", active.id);

    setSaving(false);
    if (error) Alert.alert("Could not save workout", "Your last change may not have synced.");
  }

  function toggleExercise(id: string) {
    if (!active) return;
    void saveExercises(
      active.exercises.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    );
  }

  function addExercise() {
    const name = newExercise.trim();
    if (!active || !name) return;
    const next = [
      ...active.exercises,
      { id: `${Date.now()}-${active.exercises.length}`, name: name.slice(0, 80), done: false },
    ];
    setNewExercise("");
    void saveExercises(next);
  }

  function removeExercise(id: string) {
    if (!active) return;
    void saveExercises(active.exercises.filter((item) => item.id !== id));
  }

  async function finishWorkout() {
    if (!active) return;
    const done = active.exercises.filter((item) => item.done).length;
    if (active.exercises.length && done === 0) {
      Alert.alert("Nothing checked off yet", "Complete at least one item before finishing this workout.");
      return;
    }

    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from("member_workout_sessions")
      .update({ completed_at: completedAt, updated_at: completedAt })
      .eq("id", active.id);

    if (error) {
      Alert.alert("Could not finish workout", "Please try again.");
      return;
    }

    setActive(null);
    await load();
    Alert.alert("Workout complete 🎉", "Nice work. This session is now in your history.");
  }

  function abandonWorkout() {
    if (!active) return;
    Alert.alert("Delete this workout?", "This incomplete session will be removed.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await supabase.from("member_workout_sessions").delete().eq("id", active.id);
            setActive(null);
            await load();
          })();
        },
      },
    ]);
  }

  if (!session) return <Redirect href="/login" />;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void refresh(); void load(); }}>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.headingCopy}>
          <Text style={sharedStyles.kicker}>WORKOUTS</Text>
          <Text style={styles.title}>Plan today's session.</Text>
          <Text style={sharedStyles.subtitle}>
            Keep it simple: choose a template, check off exercises and save your completed session.
          </Text>
        </View>
      </View>

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.green} />
        </Card>
      ) : active ? (
        <>
          <View style={styles.activeCard}>
            <View style={styles.activeTop}>
              <View>
                <Text style={styles.activeKicker}>IN PROGRESS</Text>
                <Text style={styles.activeTitle}>{active.title}</Text>
              </View>
              <Text style={styles.counter}>{completedCount}/{active.exercises.length || "—"}</Text>
            </View>
            <Text style={styles.activeMeta}>Started {dateTimeLabel(active.started_at)}</Text>
          </View>

          <Card>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Exercise checklist</Text>
              {saving && <ActivityIndicator size="small" color={colors.green} />}
            </View>

            {active.exercises.length ? (
              active.exercises.map((exercise, index) => (
                <View key={exercise.id} style={[styles.exerciseRow, index > 0 && styles.border]}>
                  <Pressable
                    style={[styles.check, exercise.done && styles.checkDone]}
                    onPress={() => toggleExercise(exercise.id)}
                  >
                    {exercise.done && <Ionicons name="checkmark" size={17} color="#FFFFFF" />}
                  </Pressable>
                  <Pressable style={styles.exerciseCopy} onPress={() => toggleExercise(exercise.id)}>
                    <Text style={[styles.exerciseName, exercise.done && styles.exerciseDone]}>
                      {exercise.name}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => removeExercise(exercise.id)} style={styles.removeButton}>
                    <Ionicons name="close" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Add exercises below to build your custom session.</Text>
            )}

            <View style={styles.addRow}>
              <TextInput
                value={newExercise}
                onChangeText={setNewExercise}
                placeholder="Add an exercise"
                placeholderTextColor={colors.muted}
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={addExercise}
                style={styles.input}
              />
              <Pressable style={styles.addButton} onPress={addExercise}>
                <Ionicons name="add" size={21} color="#FFFFFF" />
              </Pressable>
            </View>
          </Card>

          <Pressable style={styles.finishButton} onPress={() => void finishWorkout()}>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.finishText}>Finish workout</Text>
          </Pressable>

          <Pressable style={styles.deleteButton} onPress={abandonWorkout}>
            <Text style={styles.deleteText}>Delete incomplete workout</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Start a workout</Text>
          <View style={styles.templateGrid}>
            {templates.map((template) => (
              <Pressable
                key={template.key}
                disabled={starting}
                onPress={() => void startWorkout(template.key)}
                style={styles.templateCard}
              >
                <View style={styles.templateIcon}>
                  <Ionicons name={template.icon} size={24} color={colors.green} />
                </View>
                <Text style={styles.templateTitle}>{template.title}</Text>
                <Text style={styles.templateMeta}>{template.exercises.length} items</Text>
              </Pressable>
            ))}

            <Pressable
              disabled={starting}
              onPress={() => void startWorkout(null)}
              style={styles.templateCard}
            >
              <View style={styles.templateIcon}>
                <Ionicons name="create-outline" size={24} color={colors.green} />
              </View>
              <Text style={styles.templateTitle}>Custom</Text>
              <Text style={styles.templateMeta}>Build your own</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Recent workouts</Text>
          {history.length ? (
            <Card>
              {history.slice(0, 8).map((item, index) => {
                const done = item.exercises.filter((exercise) => exercise.done).length;
                return (
                  <View key={item.id} style={[styles.historyRow, index > 0 && styles.border]}>
                    <View style={styles.historyIcon}>
                      <Ionicons name="barbell-outline" size={18} color={colors.green} />
                    </View>
                    <View style={styles.exerciseCopy}>
                      <Text style={styles.historyTitle}>{item.title}</Text>
                      <Text style={styles.historyMeta}>
                        {dateTimeLabel(item.completed_at)} · {done}/{item.exercises.length} completed
                      </Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  </View>
                );
              })}
            </Card>
          ) : (
            <Card><Text style={styles.emptyText}>Your completed workouts will appear here.</Text></Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  headingCopy: { flex: 1, gap: 5 },
  title: { color: colors.ink, fontSize: 29, fontWeight: "900", letterSpacing: -0.8, lineHeight: 34 },
  loadingCard: { alignItems: "center", paddingVertical: 34 },
  activeCard: { backgroundColor: colors.green, borderRadius: 24, padding: 20 },
  activeTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  activeKicker: { color: "#BDD1C0", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  activeTitle: { color: "#FFFFFF", fontSize: 27, fontWeight: "900", marginTop: 4 },
  activeMeta: { color: "#CFDDD1", fontSize: 11, marginTop: 7 },
  counter: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  listHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  exerciseRow: { alignItems: "center", flexDirection: "row", gap: 11, paddingVertical: 10 },
  border: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 4, paddingTop: 14 },
  check: { alignItems: "center", borderColor: colors.line, borderRadius: 8, borderWidth: 2, height: 28, justifyContent: "center", width: 28 },
  checkDone: { backgroundColor: colors.green, borderColor: colors.green },
  exerciseCopy: { flex: 1 },
  exerciseName: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  exerciseDone: { color: colors.muted, textDecorationLine: "line-through" },
  removeButton: { padding: 6 },
  addRow: { flexDirection: "row", gap: 8, marginTop: 15 },
  input: { backgroundColor: colors.background, borderColor: colors.line, borderRadius: 12, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13, minHeight: 44, paddingHorizontal: 12 },
  addButton: { alignItems: "center", backgroundColor: colors.green, borderRadius: 12, justifyContent: "center", width: 46 },
  finishButton: { alignItems: "center", backgroundColor: colors.green, borderRadius: 16, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 54 },
  finishText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  deleteButton: { alignItems: "center", minHeight: 42, justifyContent: "center" },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  templateCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, padding: 15, width: "48%" },
  templateIcon: { alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: 12, height: 44, justifyContent: "center", width: 44 },
  templateTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginTop: 12 },
  templateMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  historyRow: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 8 },
  historyIcon: { alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: 10, height: 38, justifyContent: "center", width: 38 },
  historyTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  historyMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
