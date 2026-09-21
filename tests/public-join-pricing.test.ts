import { describe, expect, test } from 'bun:test';
import { couponPricing, plans } from '../supabase/functions/_shared/public-join-pricing';

const expected: Record<string, { price: number; fee: number; days: number }> = {
  daily: { price: 4000, fee: 7000, days: 1 },
  weekly: { price: 15000, fee: 7000, days: 7 },
  monthly: { price: 27000, fee: 7000, days: 30 },
  quarterly: { price: 75000, fee: 7000, days: 90 },
  'semi-annual': { price: 150000, fee: 3000, days: 180 },
  yearly: { price: 285000, fee: 7000, days: 365 },
  'vip-silver': { price: 55000, fee: 7000, days: 30 },
  'vip-gold': { price: 85000, fee: 3000, days: 30 },
  family: { price: 75000, fee: 20000, days: 30 },
  'personal-training': { price: 57000, fee: 7000, days: 30 },
};

describe('Public Join pricing contract (no Paystack or production DB calls)', () => {
  test('the exact ten approved checkout IDs are present', () => {
    expect(Object.keys(plans).sort()).toEqual(Object.keys(expected).sort());
  });
  for (const [id, row] of Object.entries(expected)) {
    test(`${id}: full price and registration-fee coupons retain the same plan amount`, () => {
      const plan = plans[id];
      expect(plan).toBeDefined();
      expect(plan!.price).toBe(row.price);
      expect(plan!.registration).toBe(row.fee);
      expect(plan!.durationDays).toBe(row.days);
      const regular = couponPricing(plan!, '');
      expect(regular).toEqual({couponCode:null,membershipAmount:row.price,registrationAmount:row.fee,totalAmount:row.price+row.fee});
      for (const code of ['REGSF','regsf','  regsf  ','REGOFF','regoff','  regoff  ']) {
        const waived = couponPricing(plan!, code);
        expect(waived).toEqual({couponCode:String(code).trim().toUpperCase(),membershipAmount:row.price,registrationAmount:0,totalAmount:row.price});
        expect(waived.totalAmount * 100).toBe(row.price * 100);
      }
    });
  }
  test('unknown coupons are rejected rather than silently applying a discount', () => {
    expect(() => couponPricing(plans.monthly!, 'FREE100')).toThrow('Invalid coupon');
    expect(() => couponPricing(plans.monthly!, 'REGOFF2')).toThrow('Invalid coupon');
    expect(() => couponPricing(plans.monthly!, 'REGSF2')).toThrow('Invalid coupon');
  });
});
