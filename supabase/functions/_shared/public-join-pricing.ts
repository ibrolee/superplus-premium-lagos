// Staged pricing shared by both public payment initialization and verification.
// Keep prices aligned with current live Paystack plan maps and approved gym plan rates.
export type JoinPlan = { name: string; databaseName: string; price: number; registration: number; durationDays: number };
export const plans: Record<string, JoinPlan> = {
 daily: { name:'Daily Plan',databaseName:'Daily Plan',price:4000,registration:7000,durationDays:1 },
 weekly: { name:'Weekly Plan',databaseName:'Weekly Plan',price:15000,registration:7000,durationDays:7 },
 monthly: { name:'Monthly Plan',databaseName:'Monthly Plan',price:27000,registration:7000,durationDays:30 },
 quarterly: { name:'Quarterly',databaseName:'Quarterly',price:75000,registration:7000,durationDays:90 },
 'semi-annual': { name:'Semi-Annual',databaseName:'Semi-Annual',price:150000,registration:7000,durationDays:180 },
 yearly: { name:'Yearly',databaseName:'Yearly',price:285000,registration:7000,durationDays:365 },
 'vip-silver': { name:'Monthly VIP Silver',databaseName:'Monthly VIP Silver',price:55000,registration:7000,durationDays:30 },
 'vip-gold': { name:'Monthly VIP Gold',databaseName:'Monthly VIP Gold',price:85000,registration:7000,durationDays:30 },
 family: { name:'Family Plan',databaseName:'Family Plan',price:75000,registration:20000,durationDays:30 },
 'personal-training': { name:'Personal Training',databaseName:'Personal Training',price:57000,registration:7000,durationDays:30 },
};
export const registrationOnlyPlan: JoinPlan = { name:'Registration Only',databaseName:'Registration Only',price:0,registration:7000,durationDays:0 };
plans['registration-only'] = registrationOnlyPlan;

// In-flight checkouts created before this pricing version retain their verified amount.
export function verifiedCheckoutPlan(planId: string, pricingVersion: unknown): JoinPlan | undefined {
 const plan = plans[planId];
 return plan && pricingVersion !== 'registration-7000-v1' && ['semi-annual','vip-gold'].includes(planId) ? { ...plan, registration:3000 } : plan;
}
const registrationFeeCoupons = new Set(['REGOFF', 'REGSF']);
export function couponPricing(plan: JoinPlan, raw: unknown) {
 const code=String(raw||'').trim().toUpperCase();
 if(plan === registrationOnlyPlan && code) throw new Error('Coupons do not apply to registration-only payments.');
 if(code && !registrationFeeCoupons.has(code)) throw new Error('Invalid coupon code.');
 const registrationAmount=registrationFeeCoupons.has(code)?0:plan.registration;
 return { couponCode: code||null, membershipAmount: plan.price, registrationAmount, totalAmount: plan.price+registrationAmount };
}
