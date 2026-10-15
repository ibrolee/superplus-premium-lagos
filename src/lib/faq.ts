import {
  contact,
  facilities,
  formatNaira,
  membershipPlans,
  openingHours,
  publicMembershipOptions,
  recoveryServices,
} from "@/lib/site-data";

export const faqCategories = [
  {
    id: "getting-started",
    name: "Getting started",
    description: "Your first steps at Super Plus.",
  },
  {
    id: "membership",
    name: "Membership & fees",
    description: "Find the plan that fits your routine.",
  },
  {
    id: "training",
    name: "Training & classes",
    description: "Coaching, PT add-ons and group sessions.",
  },
  { id: "spa", name: "Spa & recovery", description: "Make time to recover and recharge." },
  {
    id: "payments",
    name: "Payments & account",
    description: "Checkout, login and your member QR.",
  },
  { id: "support", name: "HMO & support", description: "Partner access and a little extra help." },
] as const;
export type FaqCategory = (typeof faqCategories)[number]["id"];
export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  href: string;
  action: string;
  tags?: string[];
};
const monthly = membershipPlans.find((plan) => plan.id === "monthly")!;
const family = membershipPlans.find((plan) => plan.id === "family")!;
const pt = membershipPlans.find((plan) => plan.id === "personal-training")!;
const ptOnly = publicMembershipOptions.find((plan) => plan.id === "personal-training-only")!;
const registration = publicMembershipOptions.find((plan) => plan.id === "registration-only")!;
const hours = openingHours.map((day) => `${day.days}: ${day.hours}`).join("\n");
const item = (
  id: string,
  category: FaqCategory,
  question: string,
  answer: string,
  href: string,
  action: string,
  tags: string[] = [],
): FaqItem => ({ id, category, question, answer, href, action, tags });

/** Public answers only. Prices and hours share the same source as the live pages. */
export const faqItems: FaqItem[] = [
  item(
    "join",
    "getting-started",
    "How do I become a Super Plus member?",
    "Choose a plan on our membership page, complete your details and pay through secure Paystack checkout. Your membership activates after payment is verified.\n\nPreviously registered at reception? Use your existing account or ask reception to find your profile before joining again.",
    "/join",
    "Join Super Plus",
    ["register", "sign up", "new member", "start"],
  ),
  item(
    "first-visit",
    "getting-started",
    "What should I bring on my first visit?",
    "Bring water, a towel and suitable gym wear. If you already have a membership, have your member QR ready for check-in at reception. Ask a coach if you need help understanding the equipment.",
    "/login",
    "Open the member portal",
    ["beginner", "clothes", "first day", "check in"],
  ),
  item(
    "registration-only",
    "getting-started",
    "Can I register now and choose a plan later?",
    `Yes. Registration Only lets you pay your one-time individual registration of ${formatNaira(registration.registration)} now and buy a membership later. It does not include gym access.\n\nFamily registration is ${formatNaira(family.registration)}. If you choose Family later, reception can help with any registration balance.`,
    "/join?plan=registration-only",
    "Register now",
    ["registration only", "pay later"],
  ),
  item(
    "visit",
    "getting-started",
    "Where are you, and when can I visit?",
    `${contact.address}.\n\n${hours}\n\nThese are our published opening hours in Lagos time. Please check with reception for special holiday hours.`,
    "/contact",
    "Get directions & contact",
    ["address", "location", "map", "opening hours", "sunday", "saturday"],
  ),

  item(
    "monthly",
    "membership",
    "How much is monthly membership?",
    `The Monthly Plan is ${formatNaira(monthly.price)} for ${monthly.duration}. It includes ${monthly.benefits.join(", ").toLowerCase()}.\n\nFor a new individual member, add the one-time ${formatNaira(monthly.registration)} registration fee: your first payment is ${formatNaira(monthly.price + monthly.registration)}. Existing registered members do not pay registration again.`,
    "/join?plan=monthly",
    "Choose Monthly",
    ["price", "cost", "gym fee", "30 days"],
  ),
  item(
    "registration-fees",
    "membership",
    "Is the registration fee paid every month?",
    `No. Registration is a one-time fee: ${formatNaira(monthly.registration)} for individual plans or ${formatNaira(family.registration)} for the Family Plan. New members pay registration plus their chosen membership price. Existing registered members renew without another registration fee.`,
    "/membership",
    "Compare all plans",
    ["joining fee", "renewal", "extra charge"],
  ),
  item(
    "family",
    "membership",
    "How does the Family Plan work?",
    `The Family Plan covers three family members for ${formatNaira(family.price)} per ${family.duration.toLowerCase()}. It includes gym equipment and group classes.\n\nNew-family registration is ${formatNaira(family.registration)}, making the first payment ${formatNaira(family.price + family.registration)}. Follow the family setup prompts or ask reception to help link the three profiles.`,
    "/join?plan=family",
    "Explore the Family Plan",
    ["3 people", "three people", "household", "relatives"],
  ),
  item(
    "short-plans",
    "membership",
    "Do you offer shorter visits and longer memberships?",
    `Yes. Our published gym options include Daily, Weekly, Monthly, Quarterly, Semi-Annual and Yearly plans, alongside VIP and Family options.\n\nThe Weekly Plan provides four days of access within one week. Each plan’s price, duration, benefits and new-member registration fee are shown on the membership page.`,
    "/membership",
    "Find your plan",
    ["day pass", "daily", "weekly", "annual", "quarterly", "vip"],
  ),
  item(
    "renew",
    "membership",
    "How do I renew my existing membership?",
    "Sign into your existing member account and use the renewal options on your dashboard. You can also renew through reception after confirmed payment.\n\nUse the same profile so your membership history stays together. Existing registered members do not pay another registration fee.",
    "/login",
    "Sign in to renew",
    ["expired", "extend", "returning member"],
  ),

  item(
    "personal-training",
    "training",
    "What does the Personal Training plan include?",
    `Our Personal Training plan costs ${formatNaira(pt.price)} for ${pt.duration} and includes gym access, equipment, group classes and personal coach training.\n\nNew individual members also pay the one-time ${formatNaira(pt.registration)} registration fee, making the first payment ${formatNaira(pt.price + pt.registration)}.`,
    "/personal-training",
    "Explore personal training",
    ["coach", "trainer", "one to one", "pt price"],
  ),
  item(
    "pt-only",
    "training",
    "Can I add personal training to my active gym membership?",
    `Yes. Personal Training Only is an add-on at ${formatNaira(ptOnly.price)} for ${ptOnly.duration}. You must already have an active gym membership; gym access comes from that existing plan.\n\nSign into your member account to add PT. Existing registered members pay no new registration fee for the add-on.`,
    "/login",
    "Sign in to add PT",
    ["pt only", "personal training only", "add on", "active member"],
  ),
  item(
    "classes",
    "training",
    "Are group classes included, and where is the timetable?",
    "Group classes are included in several published plans, including Monthly and Personal Training. Check your chosen plan’s benefits for details.\n\nPlease ask reception for the current class timetable and available sessions. A confirmed live timetable is not published on the public website.",
    "/contact",
    "Ask about classes",
    ["aerobics", "zumba", "schedule", "group exercise"],
  ),

  item(
    "spa-services",
    "spa",
    "Which spa and recovery services can I book?",
    `Our current published services are:\n${recoveryServices.map((service) => `${service.name}${service.price === null ? "" : ` — ${formatNaira(service.price)}`}${service.duration ? ` (${service.duration})` : ""}`).join("\n")}\n\nChoose a service on the booking page to see the checkout total and request a preferred time.`,
    "/spa-booking",
    "Explore services & book",
    ["massage", "pedicure", "quantum therapy", "detox", "spa prices"],
  ),
  item(
    "spa-booking",
    "spa",
    "How do I book and pay for a spa session?",
    "Choose your service, enter your contact details and select a future date and time on our Spa Booking page. Times are in Lagos time. Complete payment through Paystack.\n\nYour chosen time is a request. Reception confirms availability and contacts you if another time is needed. Keep your booking reference for follow-up.",
    "/spa-booking",
    "Book a spa session",
    ["appointment", "reservation", "availability", "book massage"],
  ),
  item(
    "spa-membership",
    "spa",
    "Do I need gym membership to book the spa?",
    "No gym membership is required for a standalone spa booking. You pay for the service selected on the booking page, with no gym membership registration fee added.",
    "/spa-booking",
    "Book without gym membership",
    ["non member", "visitor", "walk in", "spa registration"],
  ),
  item(
    "spa-provider",
    "spa",
    "Can I choose who performs my spa service?",
    "Reception assigns an available team member who can carry out your chosen service. The booking form does not ask you to select a preferred provider.\n\nIf you have a particular service requirement, discuss it with reception before booking.",
    "/contact",
    "Speak to reception",
    ["therapist", "staff", "masseuse", "provider"],
  ),

  item(
    "payment-methods",
    "payments",
    "Which payment methods can I use?",
    "Online membership and spa payments use secure Paystack checkout. At reception, you can ask about paying by cash, POS or bank transfer.\n\nStaff confirm that the gym has received payment before recording it and activating the relevant membership or service. A transfer screenshot alone is not payment confirmation.",
    "/join",
    "Join & pay online",
    ["cash", "pos", "bank transfer", "card", "paystack"],
  ),
  item(
    "payment-help",
    "payments",
    "I was charged, but my payment is not confirmed. What should I do?",
    `Avoid making another payment straight away. Keep the payment reference and contact reception on ${contact.phone} or WhatsApp so the team can check it.\n\nDo not share your password, OTP, PIN or full card details in a chat. The digital assistant cannot verify an individual transaction.`,
    "/contact",
    "Get payment support",
    ["failed payment", "charged twice", "pending", "receipt", "transaction"],
  ),
  item(
    "login",
    "payments",
    "How do I sign in or reset my password?",
    "Open Member Portal and sign in with your password, or request a secure login code sent to the email registered with your membership.\n\nUse “Create / reset password” on the login page if you need to set up or change your password. If your registered email needs correcting, contact reception for help verifying the change.",
    "/login",
    "Open Member Portal",
    ["forgot password", "otp", "email", "account access"],
  ),
  item(
    "qr",
    "payments",
    "Where do I find my membership QR code?",
    "Sign into your member account and select Open QR. Show your membership QR at reception for gym check-in and follow the team’s check-out process when leaving.\n\nIf a visit is missing from your activity, ask reception to check the record.",
    "/my-qr",
    "Open my QR",
    ["scan", "attendance", "check in", "check out", "membership card"],
  ),

  item(
    "hmo",
    "support",
    "Do you accept HMO and fitness-access partners?",
    "Our published direct partners include PayGYM, Bardge, Reliance HMO and Noor HMO. The Bardge network shown on our HMO page includes Hygeia, NEM Health HMO, Bastion HMO, Clearline HMO and AXA Mansard.\n\nEligibility and benefits depend on your exact plan. Confirm your coverage with your provider and reception before visiting.",
    "/hmo",
    "View HMO & corporate information",
    ["insurance", "reliance", "noor", "axa", "mansard", "bardge", "bastion"],
  ),
  item(
    "plan-changes",
    "support",
    "Who can confirm a refund, freeze or special arrangement?",
    "Please speak to reception before paying or making plans around a refund, cancellation, membership freeze, guest visit or special offer. The team can confirm the current terms for your situation.\n\nThe public assistant cannot approve an exception or change a membership or booking.",
    "/contact",
    "Ask reception",
    ["refund", "cancel", "pause", "discount", "guest", "trial"],
  ),
  item(
    "app",
    "support",
    "Is there a Super Plus app?",
    "SP Fitness brings member information, SP Points, rewards, challenges, bookings and gym updates together. Visit our app page for current download options and installation instructions.",
    "/app",
    "Get SP Fitness",
    ["android", "iphone", "apk", "ios", "download", "rewards"],
  ),
  item(
    "equipment",
    "support",
    "Can you help me find a specific machine or facility?",
    `Our published facilities include ${facilities.map((facility) => facility.name).join(", ")}. Explore the gallery and facilities page for more information.\n\nPlease ask reception to confirm that a specific machine is currently available before making a visit around it.`,
    "/facilities",
    "Explore the facilities",
    ["equipment", "weights", "cardio", "treadmill", "machines"],
  ),
];

export function filterFaqs(query: string, category: FaqCategory | "all" = "all"): FaqItem[] {
  const terms = query
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return faqItems.filter(
    (faq) =>
      (category === "all" || faq.category === category) &&
      terms.every((term) =>
        `${faq.question} ${faq.answer} ${(faq.tags || []).join(" ")}`
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(term),
      ),
  );
}
