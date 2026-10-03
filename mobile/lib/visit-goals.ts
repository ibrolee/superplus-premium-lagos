import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type VisitGoal = {
  id: string;
  member_id: string;
  weekly_target: number;
  preferred_days: number[];
  reminder_hour: number;
  reminder_minute: number;
  reminders_enabled: boolean;
  started_at: string;
  created_at: string;
  updated_at: string;
};

export type GoalProgress = {
  current: number;
  target: number;
  complete: boolean;
  remaining: number;
  percentage: number;
  streakWeeks: number;
  weekDates: string[];
  visitedDates: string[];
};

const CHANNEL_ID = "visit-goals";
const STORAGE_PREFIX = "@superplus/visit-goal-reminders:";

function lagosDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dateFromIsoDay(day: string) {
  return new Date(`${day}T12:00:00Z`);
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(day: string, amount: number) {
  const date = dateFromIsoDay(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDay(date);
}

export function currentLagosWeek() {
  const today = lagosDate(new Date());
  const date = dateFromIsoDay(today);
  const utcDay = date.getUTCDay();
  const mondayOffset = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = addDays(today, mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function uniqueVisitDates(attendance: Array<{ checked_in_at: string }>) {
  return [...new Set(attendance.map((visit) => lagosDate(visit.checked_in_at)))].sort();
}

function completedWeekCount(
  visitedDates: string[],
  target: number,
  goalStartedAt: string,
) {
  if (!visitedDates.length || target < 1) return 0;

  const currentWeek = currentLagosWeek();
  let cursorMonday = currentWeek[0];
  const started = goalStartedAt.slice(0, 10);
  let streak = 0;

  for (let offset = 0; offset < 104; offset += 1) {
    const monday = addDays(cursorMonday, -(offset * 7));
    const sunday = addDays(monday, 6);

    if (sunday < started) break;

    const count = visitedDates.filter((day) => day >= monday && day <= sunday).length;
    const isCurrent = offset === 0;

    if (isCurrent && count < target) {
      continue;
    }

    if (count >= target) {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

export function calculateGoalProgress(
  attendance: Array<{ checked_in_at: string }>,
  goal: VisitGoal,
): GoalProgress {
  const weekDates = currentLagosWeek();
  const visitedDates = uniqueVisitDates(attendance);
  const current = visitedDates.filter(
    (day) => day >= weekDates[0] && day <= weekDates[6],
  ).length;
  const target = Math.max(1, goal.weekly_target);
  const remaining = Math.max(0, target - current);

  return {
    current,
    target,
    complete: current >= target,
    remaining,
    percentage: Math.min(100, Math.round((current / target) * 100)),
    streakWeeks: completedWeekCount(visitedDates, target, goal.started_at),
    weekDates,
    visitedDates,
  };
}

async function ensurePermission() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Gym visit goal reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted";
}

function storageKey(memberId: string) {
  return `${STORAGE_PREFIX}${memberId}`;
}

export async function cancelVisitGoalReminders(memberId: string) {
  const raw = await AsyncStorage.getItem(storageKey(memberId));

  if (raw) {
    try {
      const identifiers = JSON.parse(raw) as string[];
      await Promise.all(
        identifiers.map((id) =>
          Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
        ),
      );
    } catch {
      // Ignore malformed local state and clear it below.
    }
  }

  await AsyncStorage.removeItem(storageKey(memberId));
}

function expoWeekday(day: number) {
  // App uses Monday=0 ... Sunday=6. Expo weekly triggers use Sunday=1 ... Saturday=7.
  return day === 6 ? 1 : day + 2;
}

export async function scheduleVisitGoalReminders(goal: VisitGoal) {
  await cancelVisitGoalReminders(goal.member_id);

  if (!goal.reminders_enabled || !goal.preferred_days.length) {
    return { enabled: false, scheduled: 0 };
  }

  const allowed = await ensurePermission();
  if (!allowed) return { enabled: false, scheduled: 0 };

  const identifiers: string[] = [];

  for (const day of goal.preferred_days) {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your Super Plus gym day 🏋️",
        body: `You planned ${goal.weekly_target} visit${goal.weekly_target === 1 ? "" : "s"} this week. Keep your promise to yourself and check your progress in the app.`,
        data: { kind: "visit-goal", memberId: goal.member_id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday(day),
        hour: goal.reminder_hour,
        minute: goal.reminder_minute,
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
    });

    identifiers.push(identifier);
  }

  const weekendCheck = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Weekly gym goal check",
      body: "See how close you are to this week's Super Plus visit goal and finish strong.",
      data: { kind: "visit-goal-check", memberId: goal.member_id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,
      hour: 17,
      minute: 30,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
  });

  identifiers.push(weekendCheck);
  await AsyncStorage.setItem(storageKey(goal.member_id), JSON.stringify(identifiers));

  return { enabled: true, scheduled: identifiers.length };
}

export const goalDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
