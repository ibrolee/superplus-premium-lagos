// Staged pricing shared by both public payment initialization and verification.
// Keep prices aligned with current live Paystack plan maps and approved gym plan rates.
export type JoinPlan = { name: string; databaseName: string; price: number; registration: number; durationDays: number };
export const plans: Record<string, JoinPlan> = {
 daily: { name:'Daily Plan',databaseName:'Daily Plan',price:4000,registration:7000,durationDays:1 },
 weekly: { name:'Weekly Plan',databaseName:'Weekly Plan',price:15000,registration:7000,durationDays:7 },
 monthly: { name:'Monthly Plan',databaseName:'Monthly Plan',price:27000,registration:7000,durationDays:30 },
 quarterly: { name:'Quarterly',databaseName:'Quarterly',price:75000,registration:7000,durationDays:90 },
 'semi-annual': { name:'Semi-Annual',databaseName:'Semi-Annual',price:150000,registration:3000,durationDays:180 },
 yearly: { name:'Yearly',databaseName:'Yearly',price:285000,registration:7000,durationDays:365 },
 'vip-silver': { name:'Monthly VIP Silver',databaseName:'Monthly VIP Silver',price:55000,registration:7000,durationDays:30 },
 'vip-gold': { name:'Monthly VIP Gold',databaseName:'Monthly VIP Gold',price:85000,registration:3000,durationDays:30 },
 family: { name:'Family Plan',databaseName:'Family Plan',price:75000,registration:20000,durationDays:30 },
 'personal-training': { name:'Personal Training',databaseName:'Personal Training',price:57000,registration:7000,durationDays:30 },
};
export function couponPricing(plan: JoinPlan, raw: unknown) {
 const code=String(raw||'').trim().toUpperCase();
 if(code && code !== 'REGOFF') throw new Error('Invalid coupon code.');
 return { couponCode: code||null, membershipAmount: plan.price, registrationAmount: code==='REGOFF'?0:plan.registration, totalAmount: plan.price+(code==='REGOFF'?0:plan.registration) };
}
