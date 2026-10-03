import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHANNEL_ID = "booking-reminders";
const PREFIX = "@superplus/booking-reminder:";

type BookingReminderInput = {
  id: string;
  service_name: string;
  preferred_at: string;
  status: string;
};

type StoredState = {
  preferredAt: string;
  identifiers: string[];
};

async function ensurePermission() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Booking reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted";
}

export async function cancelBookingReminders(bookingId: string) {
  const key = `${PREFIX}${bookingId}`;
  const raw = await AsyncStorage.getItem(key);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredState;
      await Promise.all(
        (parsed.identifiers ?? []).map((id) =>
          Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
        ),
      );
    } catch {
      // Clear malformed local state below.
    }
  }

  await AsyncStorage.removeItem(key);
}

export async function scheduleBookingReminders(booking: BookingReminderInput) {
  const key = `${PREFIX}${booking.id}`;

  if (booking.status !== "confirmed") {
    await cancelBookingReminders(booking.id);
    return;
  }

  const raw = await AsyncStorage.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredState;
      if (parsed.preferredAt === booking.preferred_at && parsed.identifiers?.length) return;
    } catch {
      // Rebuild below.
    }
  }

  const allowed = await ensurePermission();
  if (!allowed) return;

  await cancelBookingReminders(booking.id);

  const start = new Date(booking.preferred_at).getTime();
  const now = Date.now();
  const moments = [
    { msBefore: 24 * 60 * 60 * 1000, title: "Booking tomorrow" },
    { msBefore: 2 * 60 * 60 * 1000, title: "Booking in 2 hours" },
  ];
  const identifiers: string[] = [];

  for (const moment of moments) {
    const when = start - moment.msBefore;
    if (when <= now + 60_000) continue;

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: moment.title,
        body: `Your ${booking.service_name} at Super Plus Fitness is coming up.`,
        data: { kind: "booking", bookingId: booking.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(when),
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
    });

    identifiers.push(identifier);
  }

  if (identifiers.length) {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ preferredAt: booking.preferred_at, identifiers } satisfies StoredState),
    );
  }
}
