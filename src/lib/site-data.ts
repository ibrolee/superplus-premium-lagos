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
  {
    id: "quarterly",
    name: "Quarterly",
    category: "Gym",
    group: "Long-Term",
    price: 75000,
    duration: "3 months",
    registration: 7000,
    benefits: ["3 months", "All gym equipment", "Group classes"],
    badge: "Best Value",
    checkoutUrl:
      "https://members.superplusfitness.com/checkout?checkoutId=ca727402-80e5-4c6b-be70-246603093316&disableContinueShopping=true",
  },
  {
    id: "semi-annual",
    name: "Semi-Annual",
    category: "Gym",
    group: "Long-Term",
    price: 150000,
    duration: "6 months",
    registration: 3000,
    benefits: ["6 months", "All gym equipment", "Group classes"],
    checkoutUrl:
      "https://members.superplusfitness.com/checkout?checkoutId=ca727402-aeb9-4e0f-8c95-9a7c00e2f6c5&disableContinueShopping=true",
  },
  {
    id: "yearly",
    name: "Yearly",
    category: "Gym",
    group: "Long-Term",
    price: 285000,
    duration: "12 months",
    registration: 7000,
    benefits: ["12 months", "All gym equipment", "Group classes"],
    checkoutUrl:
      "https://members.superplusfitness.com/checkout?checkoutId=ca727402-f696-4774-b3c7-a405653731ef&disableContinueShopping=true",
  },
  {
    id: "vip-silver",
    name: "Monthly VIP Silver",
    category: "VIP",
    group: "Premium",
    price: 55000,
    duration: "One month",
    registration: 7000,
    benefits: [
      "All gym and spa equipment",
      "Free energy drink twice monthly",
      "One 30-minute full-body massage",
      "Group classes",
      "Two spa sessions",
    ],
    checkoutUrl:
      "https://members.superplusfitness.com/checkout?checkoutId=ca727402-84e5-4875-99b3-0248910a7a63&disableContinueShopping=true",
  },
  {
    id: "vip-gold",
    name: "Monthly VIP Gold",
    category: "VIP",
    group: "Premium",
    price: 85000,
    duration: "One month",
    registration: 3000,
    benefits: [
      "All gym equipment",
      "Two full-body massages",
      "Two spa sessions",
      "Free energy drink twice monthly",
      "One-on-one personal training",
      "Group training",
    ],
    checkoutUrl:
      "https://members.superplusfitness.com/checkout?checkoutId=ca727402-a648-4fab-9fe4-4e049c7d750a&disableContinueShopping=true",
  },
  {
    id: "family",
    name: "Family Plan",
    category: "Family",
    group: "Premium",
    price: 75000,
    duration: "One month",
    registration: 20000,
    benefits: ["For 3 family members", "All gym equipment", "Group classes"],
    checkoutUrl:
      "https://members.superplusfitness.com/checkout?checkoutId=ca727402-c0c9-415e-8035-ae594c823b56&disableContinueShopping=true",
  },
  {
    id: "personal-training",
    name: "Personal Training",
    category: "Training",
    group: "Training",
    price: 57000,
    duration: "30 days",
    registration: 7000,
    benefits: [
      "30-day access",
      "Gym equipment",
      "Group classes",
      "Personal coach training",
    ],
    checkoutUrl:
      "https://members.superplusfitness.com/checkout?checkoutId=ca727402-7374-426f-8780-7135176e7b7d&disableContinueShopping=true",
  },
];

export type RecoveryService = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  duration?: string;
  image?: string;
};

export const recoveryServices: RecoveryService[] = [
  {
    id: "vip-chair",
    name: "VIP Chair",
    description: "A dedicated relaxation and wellness session.",
    price: 7000,
    duration: "1 hour",
  },
  {
    id: "ultra-slim-machine",
    name: "Ultra Slim Machine",
    description: "A focused wellness session using our Ultra Slim machine.",
    price: 5000,
    duration: "30 mins",
  },
  {
    id: "blood-circulation-machine",
    name: "Blood Circulation Machine",
    description: "A wellness session using our blood circulation machine.",
    price: 5000,
    duration: "30 mins",
  },
  {
    id: "foot-massager",
    name: "Foot Massager",
    description: "A dedicated foot relaxation and recovery session.",
    price: 5000,
    duration: "30 mins",
  },
  {
    id: "pulse-massager",
    name: "Pulse Massager",
    description: "A focused massage session using our pulse massager.",
    price: 7000,
    duration: "30 mins",
  },
  {
    id: "detox-machine",
    name: "Detox Machine",
    description: "A wellness session using our detox machine.",
    price: 7000,
    duration: "30 mins",
  },
  {
    id: "full-body-massage",
    name: "Full Body Massage",
    description: "A full-body massage session.",
    price: 15000,
    duration: "30 mins",
  },
  {
    id: "quantum-therapy",
    name: "Quantum Therapy",
    description: "A dedicated quantum therapy session.",
    price: 7000,
    duration: "30 mins",
  },
  {
    id: "pedicure",
    name: "Pedicure",
    description: "Professional pedicure service.",
    price: 10000,
  },
];

export const facilities = [
  {
    name: "Strength Training",
    image: "/strength-training.png",
    description:
      "Free weights, racks and machines for focused strength work.",
  },
  {
    name: "Cardio",
    image: "/cardio.png",
    description:
      "Modern cardio equipment for every pace and fitness level.",
  },
  {
    name: "Functional Training",
    image: "/functional-training.png",
    description:
      "Open training space for movement, conditioning and performance.",
  },
  {
    name: "Group Classes",
    image: "/group-classes.png",
    description:
      "Coach-led sessions built around energy, community and progress.",
  },
  {
    name: "Modern Equipment",
    image: "/modern-equipment.png",
    description:
      "A considered mix of equipment for complete workouts.",
  },
];

export const testimonials = [
  {
    quote:
      "The team makes training feel structured, welcoming and serious. I have stayed more consistent here than anywhere else.",
    name: "Ada O.",
    detail: "Member, Shomolu",
  },
  {
    quote:
      "I can train, recover and get a massage in one place. That convenience has completely changed my routine.",
    name: "Tunde A.",
    detail: "VIP member",
  },
  {
    quote:
      "My coach pays attention to form and progress. Every session has a purpose and I can feel the difference.",
    name: "Mariam K.",
    detail: "Personal training member",
  },
];

export const navItems = [
  { label: "Home", to: "/" },
  { label: "Membership", to: "/membership" },
  { label: "Personal Training", to: "/personal-training" },
  { label: "Facilities", to: "/facilities" },
  { label: "Spa & Recovery", to: "/spa-recovery" },
  { label: "Blog", to: "/blog" },
  { label: "About", to: "/about" },
  { label: "HMO", to: "/hmo" },
  { label: "Contact", to: "/contact" },
] as const;

export const formatNaira = (value: number) =>
  `₦${value.toLocaleString("en-NG")}`;