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
import { scheduleBookingReminders, cancelBookingReminders } from "../lib/booking-reminders";
import { supabase } from "../lib/supabase";
import { Card, colors, dateTimeLabel, lagosToday, Screen, sharedStyles } from "../lib/ui";

type Booking = {
  id: string;
  member_id: string;
  service_type: string;
  service_name: string;
  preferred_at: string;
  notes: string;
  status: string;
  staff_note: string | null;
  created_at: string;
};

const services = [
  { type: "group_class", name: "Group Class", icon: "people-outline" as const },
  { type: "personal_training", name: "Personal Training", icon: "barbell-outline" as const },
  { type: "massage", name: "Massage", icon: "hand-left-outline" as const },
  { type: "pedicure", name: "Pedicure", icon: "sparkles-outline" as const },
  { type: "spa", name: "Spa Session", icon: "water-outline" as const },
];

const timeSlots = [7, 9, 11, 13, 15, 17, 19];

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dayLabel(day: string, offset: number) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short" })
    .format(new Date(`${day}T12:00:00Z`));
}

function timeLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:00 ${suffix}`;
}

export default function BookingsScreen() {
  const { session, member, refreshing, refresh } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceType, setServiceType] = useState("personal_training");
  const [serviceName, setServiceName] = useState("Personal Training");
  const [dayOffset, setDayOffset] = useState(1);
  const [hour, setHour] = useState(17);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, offset) => {
      const date = addDays(lagosToday(), offset);
      return { offset, date, label: dayLabel(date, offset) };
    }),
    [],
  );

  const load = useCallback(async () => {
    if (!member?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from("member_bookings")
      .select("id,member_id,service_type,service_name,preferred_at,notes,status,staff_note,created_at")
      .eq("member_id", member.id)
      .order("preferred_at", { ascending: false })
      .limit(30);

    const rows = (data ?? []) as Booking[];
    setBookings(rows);
    setLoading(false);

    await Promise.all(
      rows.map((booking) =>
        booking.status === "confirmed"
          ? scheduleBookingReminders(booking).catch(() => undefined)
          : cancelBookingReminders(booking.id).catch(() => undefined),
      ),
    );
  }, [member?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestBooking() {
    if (!member?.id || submitting) return;

    const selectedDay = days.find((item) => item.offset === dayOffset)?.date ?? addDays(lagosToday(), dayOffset);
    const preferredAt = new Date(
      `${selectedDay}T${String(hour).padStart(2, "0")}:00:00+01:00`,
    ).toISOString();

    if (new Date(preferredAt).getTime() <= Date.now() + 30 * 60 * 1000) {
      Alert.alert("Choose a later time", "Bookings must be requested at least 30 minutes ahead.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("member_bookings").insert({
      member_id: member.id,
      service_type: serviceType,
      service_name: serviceName,
      preferred_at: preferredAt,
      notes: notes.trim(),
      status: "pending",
    });
    setSubmitting(false);

    if (error) {
      Alert.alert("Could not request booking", "Please try again.");
      return;
    }

    setNotes("");
    Alert.alert("Request sent", "Super Plus staff can confirm or adjust your request.");
    await load();
  }

  function cancelBooking(booking: Booking) {
    Alert.alert("Cancel booking?", `Cancel your ${booking.service_name} request?`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel booking",
        style: "destructive",
        onPress: () => {
          void (async () => {
            const { error } = await supabase
              .from("member_bookings")
              .update({ status: "cancelled", updated_at: new Date().toISOString() })
              .eq("id", booking.id);
            if (!error) {
              await cancelBookingReminders(booking.id);
              await load();
            }
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
          <Text style={sharedStyles.kicker}>BOOK AT SUPER PLUS</Text>
          <Text style={styles.title}>Plan your next session.</Text>
          <Text style={sharedStyles.subtitle}>
            Request classes, personal training and spa services. Staff confirms the final time.
          </Text>
        </View>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Choose a service</Text>
        <View style={styles.serviceGrid}>
          {services.map((service) => {
            const active = serviceType === service.type;
            return (
              <Pressable
                key={service.type}
                style={[styles.serviceCard, active && styles.selected]}
                onPress={() => {
                  setServiceType(service.type);
                  setServiceName(service.name);
                }}
              >
                <Ionicons name={service.icon} size={22} color={active ? "#FFFFFF" : colors.green} />
                <Text style={[styles.serviceName, active && styles.selectedText]}>{service.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Preferred day</Text>
        <View style={styles.chips}>
          {days.map((item) => {
            const active = item.offset === dayOffset;
            return (
              <Pressable
                key={item.date}
                style={[styles.chip, active && styles.selected]}
                onPress={() => setDayOffset(item.offset)}
              >
                <Text style={[styles.chipText, active && styles.selectedText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.timeHeading}>PREFERRED TIME</Text>
        <View style={styles.chips}>
          {timeSlots.map((slot) => {
            const active = slot === hour;
            return (
              <Pressable
                key={slot}
                style={[styles.chip, active && styles.selected]}
                onPress={() => setHour(slot)}
              >
                <Text style={[styles.chipText, active && styles.selectedText]}>{timeLabel(slot)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Anything staff should know?</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional note — e.g. preferred coach or massage focus"
          placeholderTextColor={colors.muted}
          maxLength={1000}
          multiline
          textAlignVertical="top"
          style={styles.notes}
        />
      </Card>

      <Pressable
        style={[styles.requestButton, submitting && styles.disabled]}
        disabled={submitting}
        onPress={() => void requestBooking()}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="calendar-outline" size={19} color="#FFFFFF" />
            <Text style={styles.requestText}>Request booking</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.sectionTitle}>Your bookings</Text>
      {loading ? (
        <Card style={styles.loadingCard}><ActivityIndicator color={colors.green} /></Card>
      ) : bookings.length ? (
        bookings.map((booking) => (
          <Card key={booking.id}>
            <View style={styles.bookingTop}>
              <View style={styles.grow}>
                <Text style={styles.bookingTitle}>{booking.service_name}</Text>
                <Text style={styles.bookingDate}>{dateTimeLabel(booking.preferred_at)}</Text>
              </View>
              <View style={[styles.statusPill, styles[`status_${booking.status}` as keyof typeof styles]]}>
                <Text style={styles.statusText}>{booking.status.toUpperCase()}</Text>
              </View>
            </View>
            {!!booking.staff_note && (
              <Text style={styles.staffNote}>Staff: {booking.staff_note}</Text>
            )}
            {["pending", "confirmed"].includes(booking.status) && (
              <Pressable style={styles.cancelButton} onPress={() => cancelBooking(booking)}>
                <Text style={styles.cancelText}>Cancel request</Text>
              </Pressable>
            )}
          </Card>
        ))
      ) : (
        <Card><Text style={styles.emptyText}>You have no booking requests yet.</Text></Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  headingCopy: { flex: 1, gap: 5 },
  title: { color: colors.ink, fontSize: 29, fontWeight: "900", letterSpacing: -0.8, lineHeight: 34 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  serviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 14 },
  serviceCard: { alignItems: "center", backgroundColor: colors.background, borderColor: colors.line, borderRadius: 15, borderWidth: 1, gap: 6, minHeight: 84, justifyContent: "center", padding: 10, width: "48%" },
  serviceName: { color: colors.ink, fontSize: 11, fontWeight: "900", textAlign: "center" },
  selected: { backgroundColor: colors.green, borderColor: colors.green },
  selectedText: { color: "#FFFFFF" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { backgroundColor: colors.background, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  chipText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  timeHeading: { color: colors.green2, fontSize: 9, fontWeight: "900", letterSpacing: 1.1, marginTop: 18 },
  notes: { backgroundColor: colors.background, borderColor: colors.line, borderRadius: 13, borderWidth: 1, color: colors.ink, fontSize: 13, lineHeight: 20, marginTop: 12, minHeight: 100, padding: 12 },
  requestButton: { alignItems: "center", backgroundColor: colors.green, borderRadius: 16, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 54 },
  requestText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  loadingCard: { alignItems: "center", paddingVertical: 28 },
  bookingTop: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  grow: { flex: 1 },
  bookingTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  bookingDate: { color: colors.muted, fontSize: 11, marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  status_pending: { backgroundColor: "#FFF3D9" },
  status_confirmed: { backgroundColor: "#E4F4E8" },
  status_completed: { backgroundColor: "#E8F0FF" },
  status_declined: { backgroundColor: "#FCE9E6" },
  status_cancelled: { backgroundColor: "#EEF0EE" },
  statusText: { color: colors.ink, fontSize: 8, fontWeight: "900" },
  staffNote: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 10 },
  cancelButton: { alignItems: "center", borderColor: "#EBCBC6", borderRadius: 11, borderWidth: 1, justifyContent: "center", marginTop: 13, minHeight: 40 },
  cancelText: { color: colors.danger, fontSize: 11, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 12, textAlign: "center" },
});
