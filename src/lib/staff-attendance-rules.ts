/** Display-only attendance rules. Never alter scan records or calculate payroll here. */
export type StaffScan = {
  id: string;
  staff_profile_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
};

const LAGOS = "Africa/Lagos";
const CUTOFF_MINUTES = 7 * 60 + 30;

function normalizedName(name: string | null): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Date is YYYY-MM-DD in Lagos. Sunday (0) is outside the punctuality rule. */
export function lateRuleApplies(name: string | null, date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const weekday = parsed.getUTCDay();
  if (weekday === 0) return false;
  const staffName = normalizedName(name);
  if (staffName === "njorteah ifeanyi anthony") return false;
  if (staffName === "oroke stephen chinedu" && (weekday === 4 || weekday === 5)) return false;
  return true;
}

/** Check only the earliest recorded arrival that day, never a later return from a break. */
export function isLateArrival(name: string | null, date: string, firstClockIn: string | null): boolean {
  if (!firstClockIn || !lateRuleApplies(name, date)) return false;
  const instant = new Date(firstClockIn);
  if (Number.isNaN(instant.getTime())) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const part = (kind: string) => Number(parts.find((entry) => entry.type === kind)?.value ?? NaN);
  const hour = part("hour"), minute = part("minute"), second = part("second");
  if (![hour, minute, second].every(Number.isFinite)) return false;
  const clockMinutes = hour * 60 + minute;
  return clockMinutes > CUTOFF_MINUTES || (clockMinutes === CUTOFF_MINUTES && second > 0);
}

/**
 * Read-only time from one staff member's completed QR sessions. Merge overlapping
 * intervals so a duplicated/overlapping scan cannot double-count worked minutes.
 * Open and invalid sessions are excluded, never assigned an invented clock-out.
 * `overlapping` counts completed sessions intersecting an earlier interval and
 * signals that management should check the source QR records.
 */
export function recordedWorkMinutes(scans: StaffScan[]): {
  minutes: number; completed: number; open: number; invalid: number; overlapping: number;
} {
  const intervals: Array<{ start: number; end: number }> = [];
  let open = 0, invalid = 0;
  for (const scan of scans) {
    const start = Date.parse(scan.checked_in_at);
    if (!Number.isFinite(start)) { invalid += 1; continue; }
    if (!scan.checked_out_at) { open += 1; continue; }
    const end = Date.parse(scan.checked_out_at);
    if (!Number.isFinite(end) || end < start) { invalid += 1; continue; }
    intervals.push({ start, end });
  }
  intervals.sort((a, b) => a.start - b.start || a.end - b.end);
  let milliseconds = 0, overlapping = 0;
  let currentStart: number | null = null, currentEnd = 0;
  for (const interval of intervals) {
    if (currentStart === null) {
      currentStart = interval.start;
      currentEnd = interval.end;
    } else if (interval.start <= currentEnd) {
      if (interval.start < currentEnd) overlapping += 1;
      currentEnd = Math.max(currentEnd, interval.end);
    } else {
      milliseconds += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  }
  if (currentStart !== null) milliseconds += currentEnd - currentStart;
  return { minutes: Math.floor(milliseconds / 60000), completed: intervals.length, open, invalid, overlapping };
}

export function workDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
