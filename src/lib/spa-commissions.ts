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
