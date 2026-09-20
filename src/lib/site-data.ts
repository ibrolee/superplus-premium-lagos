import facilitiesImage from "@/assets/facilities.jpg";
import heroImage from "@/assets/gym-hero.jpg";
import recoveryImage from "@/assets/recovery.jpg";
import trainingImage from "@/assets/training.jpg";

export const images = {
  hero: heroImage,
  training: trainingImage,
  recovery: recoveryImage,
  facilities: facilitiesImage,
};

export const contact = {
  name: "Super Plus Fitness",
  descriptor: "Fitness • Spa • Recovery",
  address: "No. 105 Apata Street, Shomolu, Lagos, Nigeria",
  phone: "07054263170",
  phoneHref: "+2347054263170",
  email: "spfitnessandspa@gmail.com",
  whatsapp: "https://wa.me/2347054263170",
  directions: "https://maps.app.goo.gl/eDa5jBujqoraFBpD8?g_st=ic",
};

export const openingHours = [
  { days: "Monday–Saturday", hours: "6:00 AM – 8:30 PM" },
  { days: "Sunday", hours: "6:30 AM – 7:00 PM" },
];

export type MembershipCategory =
  | "Gym"
  | "VIP"
  | "Family"
  | "Training"
  | "Spa & Recovery";

export type MembershipPlan = {
  id: string;
  name: string;
  category: MembershipCategory;
  group: "Gym Access" | "Long-Term" | "Premium" | "Training";
  price: number;
  duration: string;
  registration: number;
  benefits: string[];
  badge?: string;
  checkoutUrl: string;
};

export const membershipPlans: MembershipPlan[] = [
  {
    id: "daily",
    name: "Daily Plan",
    category: "Gym",
    group: "Gym Access",
    price: 4000,
    duration: "One day",
    registration: 7000,
    benefits: ["One-day access", "All gym equipment"],
    checkoutUrl:
      "https://members.superplusfitness.com/pricing-plans/plan-customization?planId=9936425b-445f-4215-a1e3-72903e369ad7&checkoutFlowId=fe154732-10d9-4910-8f77-1db50d1d3e18&pricingVariantId=739fed6d-ac44-426c-a6ec-83efc2613ed8",
  },
  {
    id: "weekly",
    name: "Weekly Plan",
    category: "Gym",
    group: "Gym Access",
    price: 15000,
    duration: "One week",
    registration: 7000,
    benefits: ["4-day access", "Valid for one week", "All gym equipment"],
    checkoutUrl:
      "https://members.superplusfitness.com/checkout?checkoutId=ca727402-46b4-409d-930a-7c82e6bf7e18&disableContinueShopping=true",
  },
  {
    id: "monthly",
    name: "Monthly Plan",
    category: "Gym",
    group: "Gym Access",
    price: 27000,
    duration: "30 days",
    registration: 7000,
    benefits: ["30-day access", "All gym equipment", "Group classes"],
    checkoutUrl:
      "https://members.superplusfitness.com/pricing-plans/plan-customization?planId=c1eaf695-49d0-482d-8fcc-ddec40830ccc&checkoutFlowId=77d29695-f6f4-427d-b6ee-0687784a95b4&pricingVariantId=c1eaf695-49d0-482d-8fcc-ddec40830ccc",
  },
];
