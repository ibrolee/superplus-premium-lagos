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
  return Number.isFinite(hour) && Number.isFinite(minute) && Number.isFinite(second) &&
    hour * 60 + minute > CUTOFF_MINUTES ||
    (Number.isFinite(hour) && Number.isFinite(minute) && Number.isFinite(second) && hour * 60 + minute === CUTOFF_MINUTES && second > 0);
}

/** Only completed QR sessions count; an open session is not an invented clock-out. */
export function recordedWorkMinutes(scans: StaffScan[]): { minutes: number; completed: number; open: number; invalid: number } {
  let milliseconds = 0, completed = 0, open = 0, invalid = 0;
  for (const scan of scans) {
    if (!scan.checked_out_at) { open += 1; continue; }
    const start = Date.parse(scan.checked_in_at);
    const end = Date.parse(scan.checked_out_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) { invalid += 1; continue; }
    milliseconds += end - start;
    completed += 1;
  }
  return { minutes: Math.floor(milliseconds / 60000), completed, open, invalid };
}

export function workDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
