export const SPA_COMMISSION_RATE = 0.30;

export type SpaCommission = {
  id: string;
  booking_id: string | null;
  source: "manual" | "website_booking";
  staff_profile_id: string;
  service_name: string;
  customer_name: string | null;
  service_date: string;
  service_amount: number;
  commission_rate: number;
  commission_amount: number;
  notes: string;
  status: "pending" | "paid";
  paid_at: string | null;
  created_at: string;
};

export function spaCommissionAmount(serviceAmount: number) {
  if (!Number.isFinite(serviceAmount) || serviceAmount <= 0) return 0;
  return Math.round((serviceAmount * SPA_COMMISSION_RATE + Number.EPSILON) * 100) / 100;
}

/** A spa service belongs to the half-month in which it was performed.
 * Payment is due the day after that half-month closes (Lagos dates).
 */
export function spaPayPeriods(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("Invalid spa commission month.");
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  const nextMonthStart = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  return [
    { label: "1st–15th", periodStart: month + "-01", periodEnd: month + "-15", payDate: month + "-16" },
    { label: "16th–month end", periodStart: month + "-16", periodEnd: monthEnd, payDate: nextMonthStart },
  ];
}
