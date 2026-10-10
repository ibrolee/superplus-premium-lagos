import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const STORAGE_KEY = "@superplus/membership-expiry-reminders";
const CHANNEL_ID = "membership-reminders";

type StoredReminderState = {
  endDate: string;
  identifiers: string[];
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function readState(): Promise<StoredReminderState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredReminderState;
    if (!parsed?.endDate || !Array.isArray(parsed.identifiers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function ensurePermission() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Membership reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted";
}

export async function cancelMembershipExpiryReminders() {
  const state = await readState();
  if (state) {
    await Promise.all(
      state.identifiers.map((identifier) =>
        Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined),
      ),
    );
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function membershipExpiryRemindersEnabled(endDate?: string | null) {
  if (!endDate) return false;
  const state = await readState();
  return Boolean(
    state &&
      state.endDate === endDate &&
      state.identifiers.length > 0,
  );
}

export async function scheduleMembershipExpiryReminders(
  endDate: string,
  planName: string,
) {
  const allowed = await ensurePermission();
  if (!allowed) {
    return { enabled: false, scheduled: 0 };
  }

  await cancelMembershipExpiryReminders();

  const [year, month, day] = endDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Membership expiry date is invalid.");
  }

  const identifiers: string[] = [];
  const now = Date.now();
  const reminders = [
    { daysBefore: 7, title: "Membership expires in 7 days" },
    { daysBefore: 3, title: "Membership expires in 3 days" },
    { daysBefore: 1, title: "Membership expires tomorrow" },
    { daysBefore: 0, title: "Membership expires today" },
  ];

  for (const reminder of reminders) {
    const when = new Date(year, month - 1, day, 9, 0, 0, 0);
    when.setDate(when.getDate() - reminder.daysBefore);
    if (when.getTime() <= now + 60_000) continue;

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: `Your ${planName} at Super Plus Fitness ends on ${endDate}. Renew in the app to keep your access continuous.`,
        data: {
          kind: "membership-expiry",
          endDate,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
    });

    identifiers.push(identifier);
  }

  if (identifiers.length) {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ endDate, identifiers } satisfies StoredReminderState),
    );
  }

  return { enabled: identifiers.length > 0, scheduled: identifiers.length };
}
