export type PublicMembershipPlan = {
  id: string;
  name: string;
  price: number;
  registration: number;
  duration: string;
  category: "Gym" | "VIP" | "Family" | "Training";
  badge?: string;
};

export const publicMembershipPlans: PublicMembershipPlan[] = [
  { id: "daily", name: "Daily Plan", price: 4000, registration: 7000, duration: "One day", category: "Gym" },
  { id: "weekly", name: "Weekly Plan", price: 15000, registration: 7000, duration: "One week", category: "Gym" },
  { id: "monthly", name: "Monthly Plan", price: 27000, registration: 7000, duration: "30 days", category: "Gym", badge: "Popular" },
  { id: "quarterly", name: "Quarterly", price: 75000, registration: 7000, duration: "3 months", category: "Gym", badge: "Best value" },
  { id: "semi-annual", name: "Semi-Annual", price: 150000, registration: 3000, duration: "6 months", category: "Gym" },
  { id: "yearly", name: "Yearly", price: 285000, registration: 7000, duration: "12 months", category: "Gym" },
  { id: "vip-silver", name: "Monthly VIP Silver", price: 55000, registration: 7000, duration: "One month", category: "VIP" },
  { id: "vip-gold", name: "Monthly VIP Gold", price: 85000, registration: 3000, duration: "One month", category: "VIP" },
  { id: "family", name: "Family Plan", price: 75000, registration: 20000, duration: "One month · 3 people", category: "Family" },
  { id: "personal-training", name: "Personal Training", price: 57000, registration: 7000, duration: "30 days", category: "Training" },
];

export const publicFacilities = [
  { title: "Strength Training", icon: "barbell-outline" as const, text: "Free weights, racks and machines for focused strength work." },
  { title: "Cardio", icon: "walk-outline" as const, text: "Cardio equipment for every pace and fitness level." },
  { title: "Group Classes", icon: "people-outline" as const, text: "Coach-led sessions with structure, energy and community." },
  { title: "Spa & Recovery", icon: "sparkles-outline" as const, text: "Massage, pedicure and recovery services under one roof." },
];

export const publicContact = {
  address: "105 Apata Street, Shomolu, Lagos",
  phone: "+2347054263170",
  email: "spfitnessandspa@gmail.com",
  whatsapp: "https://wa.me/2347054263170",
  directions: "https://maps.app.goo.gl/eDa5jBujqoraFBpD8?g_st=ic",
};

export const publicHours = [
  { days: "Monday–Saturday", hours: "6:00 AM – 8:30 PM" },
  { days: "Sunday", hours: "6:30 AM – 7:00 PM" },
];
