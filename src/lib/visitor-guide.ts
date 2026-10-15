import {
  contact,
  facilities,
  membershipPlans,
  publicMembershipOptions,
  openingHours,
  recoveryServices,
  formatNaira,
} from "@/lib/site-data";

/** A grounded guide to PUBLIC website content only. No private tables, AI provider or payment access. */
export type GuideEntry = {
  id: string;
  title: string;
  answer: string;
  href: string;
  linkLabel: string;
  terms: string[];
};
export type PublicArticle = {
  title: string;
  slug: string;
  excerpt: string | null;
  category: string;
};
export type GuideAnswer = {
  id: string;
  text: string;
  href: string;
  linkLabel: string;
  confident: boolean;
};
const hours = openingHours.map((item) => `${item.days}: ${item.hours}`).join("; ");
const planSummary = membershipPlans
  .map((plan) => `${plan.name}: ${formatNaira(plan.price)} (${plan.duration})`)
  .join("\n");
const text = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const filler = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "have",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "the",
  "there",
  "to",
  "us",
  "we",
  "what",
  "when",
  "which",
  "who",
  "with",
  "you",
  "your",
]);
const tokens = (s: string) =>
  text(s)
    .split(" ")
    .filter((word) => word.length > 1 && !filler.has(word));
const entry = (
  id: string,
  title: string,
  answer: string,
  href: string,
  terms: string[],
  linkLabel = "Read more",
): GuideEntry => ({ id, title, answer, href, terms, linkLabel });

const common: GuideEntry[] = [
  entry(
    "registration-only",
    "Registration Only",
    `Registration Only costs ${formatNaira(publicMembershipOptions.find((plan) => plan.id === "registration-only")!.registration)}. It records your one-time registration now so you can buy a membership later. It does not include gym access. Family registration is ₦20,000; reception can help with the balance if you choose Family later.`,
    "/join?plan=registration-only",
    [
      "registration only",
      "register only",
      "registration now",
      "pay registration",
      "register now plan later",
    ],
    "Register now",
  ),
  entry(
    "pt-only",
    "Personal Training Only",
    `The Personal Training Only add-on is ${formatNaira(publicMembershipOptions.find((plan) => plan.id === "personal-training-only")!.price)} for 30 days. You must already have an active gym membership. Sign into your existing account to buy it; existing registered members pay no new registration fee. For gym access plus coaching together, the Personal Training plan is ${formatNaira(membershipPlans.find((plan) => plan.id === "personal-training")!.price)} for 30 days, plus one-time registration for new members.`,
    "/login",
    [
      "pt only",
      "personal training only",
      "pt add on",
      "add personal training",
      "already have gym membership",
      "trainer only",
    ],
    "Add PT from your account",
  ),
  entry(
    "staff-portal",
    "Staff, reception and admin portals",
    "Open Staff Portal to choose Staff, Reception or Admin, then sign in with your authorised account. For access problems, contact management. This public assistant cannot view staff records or reset staff access.",
    "/portal",
    [
      "staff portal",
      "reception portal",
      "admin portal",
      "staff login",
      "admin login",
      "staff dashboard",
    ],
    "Open Staff Portal",
  ),
  entry(
    "app",
    "SP Fitness app",
    "SP Fitness brings membership information, SP Points, rewards, challenges, streaks, bookings and blog updates together. Visit the app page for current download and installation options. Follow that page for availability rather than assuming a store release is live.",
    "/app",
    [
      "app",
      "android",
      "iphone",
      "ios",
      "apk",
      "download",
      "install",
      "sp points",
      "rewards",
      "wheel",
      "streak",
      "achievements",
      "challenges",
    ],
    "Get the app",
  ),
  entry(
    "booking-help",
    "Spa booking and payment help",
    "Choose a service and a future date/time on Spa Booking, then complete secure payment. Reception confirms availability and assigns an available team member. This assistant cannot see appointment availability, confirm a booking or verify a payment. For an existing booking or payment issue, contact reception with your reference through the official contact channels.",
    "/spa-booking",
    [
      "book spa",
      "book massage",
      "book pedicure",
      "spa appointment",
      "book appointment",
      "booking status",
      "my booking",
      "choose therapist",
      "select therapist",
      "who will do",
      "availability",
    ],
    "Book spa & recovery",
  ),
  entry(
    "welcome",
    "About Super Plus Fitness & Spa",
    "Super Plus Fitness & Spa is a gym, personal-training, spa and recovery centre in Shomolu, Lagos. Our website covers gym memberships, facilities, personal coaching, classes, recovery and partnerships.",
    "/about",
    [
      "about",
      "super plus",
      "spf",
      "what is this gym",
      "who are you",
      "fitness centre",
      "fitness center",
      "tell me about",
      "services",
      "offer",
      "provide",
    ],
    "About the gym",
  ),
  entry(
    "hours",
    "Opening hours",
    `Our published opening hours are ${hours}. Please contact reception to confirm any special holiday hours.`,
    "/contact",
    [
      "hours",
      "opening",
      "closing",
      "close",
      "open",
      "time",
      "sunday",
      "saturday",
      "weekend",
      "holiday hours",
      "today hours",
      "morning",
      "night",
      "opening time",
      "closing time",
    ],
    "Opening hours and contact",
  ),
  entry(
    "location",
    "Address and directions",
    `We're at ${contact.address}. Use the directions link on our contact page to navigate here.`,
    "/contact",
    [
      "where",
      "address",
      "location",
      "located",
      "find you",
      "directions",
      "map",
      "shomolu",
      "apata",
      "how to get",
      "visit",
      "nearest",
      "lagos",
    ],
    "Get directions",
  ),
  entry(
    "contact",
    "Contact reception",
    `Call ${contact.phone}, WhatsApp the gym or email ${contact.email}. For the fastest response, reach us during our published opening hours.`,
    "/contact",
    [
      "contact",
      "phone",
      "number",
      "whatsapp",
      "call",
      "email",
      "customer service",
      "reception",
      "speak",
      "human",
      "person",
      "support",
      "enquiry",
      "enquiries",
    ],
    "Contact the team",
  ),
  entry(
    "plans",
    "Membership plans and prices",
    `Our published membership prices:\n${planSummary}\n\nFirst-time registration fees are displayed per plan and added during new-member checkout. Visit the Membership page to compare benefits and totals.`,
    "/membership",
    [
      "membership",
      "memberships",
      "plans",
      "prices",
      "pricing",
      "subscriptions",
      "packages",
      "options",
      "rates",
      "how much",
      "cost",
      "membership fee",
      "price list",
      "gym fee",
      "gym price",
    ],
    "Compare membership plans",
  ),
  entry(
    "registration",
    "New-member registration fees",
    "New-member registration is a one-time ₦7,000 for individual plans or ₦20,000 for the Family Plan. Add this to your chosen membership price for your first payment. Existing registered members do not pay registration again when renewing. You can also pay Registration Only now and buy gym access later.",
    "/membership",
    [
      "registration",
      "registration fee",
      "joining fee",
      "enrollment",
      "enrolment",
      "new member fee",
      "first payment",
      "first time",
      "sign up fee",
      "signup fee",
      "extra fee",
      "why fee",
    ],
    "See registration fees",
  ),
  entry(
    "join",
    "How to become a member",
    "On the Join page, choose your plan, enter your details and complete payment through verified Paystack checkout. Your membership activates after payment verification. Previously enrolled offline? Ask reception to find your existing profile before renewing so you do not create a duplicate record.",
    "/join",
    [
      "join",
      "sign up",
      "signup",
      "register",
      "become member",
      "become a member",
      "new member",
      "enroll",
      "enrol",
      "start membership",
      "how to join",
      "subscribe",
    ],
    "Join online",
  ),
  entry(
    "renew",
    "Renew an existing membership",
    "Sign into your existing member account and renew from the member dashboard, or ask reception to find your existing profile and renew it directly after confirmed payment. Existing members do not pay another registration fee.",
    "/login",
    [
      "renew",
      "renewal",
      "extend",
      "existing member",
      "old member",
      "returning member",
      "again",
      "already a member",
      "registration fee again",
      "previous membership",
    ],
    "Member login",
  ),
  entry(
    "payment",
    "Paying for membership",
    "New members can use secure Paystack checkout on the Join page. For cash, POS or transfer at reception, staff confirm the gym has actually received the money before recording the successful payment and activating the membership. A transfer screenshot alone is not enough.",
    "/join",
    [
      "pay",
      "payment",
      "paystack",
      "card",
      "bank transfer",
      "transfer",
      "cash",
      "pos",
      "payment methods",
      "online payment",
      "checkout",
      "receipt",
      "payment confirmation",
    ],
    "Join and pay securely",
  ),
  entry(
    "qr",
    "Your membership QR code",
    "Sign into your member account and open My QR Code to show reception for gym check-in. This public visitor guide cannot view, issue or validate your private code.",
    "/my-qr",
    [
      "qr",
      "qr code",
      "scan",
      "scanner",
      "check in",
      "check out",
      "entry",
      "access code",
      "attendance",
      "my code",
    ],
    "Open My QR Code",
  ),
  entry(
    "access",
    "Gym facilities and equipment",
    `Our published facilities include ${facilities.map((item) => item.name).join(", ")}. Browse Facilities and Gallery for details and photos, and ask reception to confirm that a particular machine is currently available.`,
    "/facilities",
    [
      "equipment",
      "machines",
      "weights",
      "dumbbell",
      "bench",
      "squat",
      "cardio",
      "treadmill",
      "facilities",
      "gym floor",
      "free weights",
      "strength",
      "functional",
      "leg press",
      "smith machine",
      "hip thrust",
    ],
    "Explore the facilities",
  ),
  entry(
    "classes",
    "Group classes",
    "Group classes are included in several published plans, including Monthly and Personal Training. The public website does not publish a confirmed live class timetable; please ask reception about specific sessions and availability.",
    "/membership",
    [
      "classes",
      "group class",
      "group training",
      "aerobics",
      "yoga",
      "zumba",
      "class schedule",
      "timetable",
      "instructor",
      "fitness class",
      "group exercise",
    ],
    "Check membership benefits",
  ),
  entry(
    "coach",
    "Personal training",
    "Personal training includes structured coaching, form guidance, goal-led programming and accountability. The published Personal Training membership includes 30-day gym access, equipment, group classes and coaching. Visit the training page for the experience and Membership for the current plan price.",
    "/personal-training",
    [
      "personal training",
      "personal trainer",
      "coach",
      "coaching",
      "pt",
      "one on one",
      "one to one",
      "trainer",
      "training program",
      "training programme",
      "fitness plan",
      "goal",
      "beginner",
      "beginners",
      "new to gym",
      "first workout",
    ],
    "Explore personal training",
  ),
  entry(
    "spa",
    "Spa and recovery services",
    `We offer ${recoveryServices.map((service) => service.name).join(", ")}. Choose a service, date and time on Spa Booking, then complete secure checkout. Reception confirms availability and assigns an available qualified team member; customers do not choose a therapist.`,
    "/spa-booking",
    [
      "spa",
      "recovery",
      "relax",
      "wellness",
      "massage",
      "therapy",
      "pedicure",
      "detox",
      "body treatment",
      "treatment",
      "appointment",
      "booking",
    ],
    "Book a spa service",
  ),
  entry(
    "hmo",
    "HMO and wellness partnerships",
    "The website lists PayGYM, Bardge, Reliance HMO and Noor HMO as direct partners. The Bardge network shown includes Hygeia, NEM Health HMO, Bastion HMO, Clearline HMO and AXA Mansard. Coverage and eligibility depend on your exact plan; please confirm with your provider and reception before visiting.",
    "/hmo",
    [
      "hmo",
      "hmos",
      "accept hmo",
      "health insurance",
      "insurance",
      "reliance",
      "noor",
      "axa",
      "mansard",
      "bastion",
      "paygym",
      "bardge",
      "hygeia",
      "nem health",
      "clearline",
      "health plan",
      "corporate",
    ],
    "See HMO information",
  ),
  entry(
    "business",
    "Corporate wellness partnerships",
    "Super Plus works with companies and HMO networks on gym access, group sessions and wellness partnerships. Visit the HMO & Corporate page to enquire about benefits for your organisation.",
    "/hmo",
    [
      "company",
      "companies",
      "corporate",
      "employer",
      "employee",
      "partnership",
      "partner",
      "organisation",
      "organization",
      "staff gym",
      "team membership",
    ],
    "Partnership enquiries",
  ),
  entry(
    "blog",
    "Fitness and wellness articles",
    "Our blog shares published articles about fitness, nutrition, recovery and wellness. Browse articles or search them on the Blog page. For personalised medical or training advice, speak to a qualified professional.",
    "/blog",
    [
      "blog",
      "article",
      "read",
      "reading",
      "tips",
      "nutrition",
      "fitness tips",
      "wellness tips",
      "exercise advice",
      "articles",
    ],
    "Explore the blog",
  ),
  entry(
    "gallery",
    "Photos and videos",
    "The Gallery page has publicly shared photos and videos of the gym. Ask reception if you need confirmation of a particular piece of equipment.",
    "/gallery",
    [
      "gallery",
      "pictures",
      "picture",
      "photos",
      "images",
      "videos",
      "tour",
      "inside",
      "see gym",
      "look like",
    ],
    "View the gallery",
  ),
  entry(
    "membership-help",
    "Member or account support",
    `I cannot access member profiles, balances, payment histories, renewal status or private QR codes. Please sign into your account or contact reception on ${contact.phone} about your individual case. Never enter passwords, OTPs or card details in this chat.`,
    "/login",
    [
      "my membership status",
      "my account",
      "my payment status",
      "my transaction",
      "my balance",
      "my expiry",
      "my expiration",
      "my receipt",
      "my profile",
      "forgot password",
      "password reset",
      "login problem",
      "cant login",
      "login",
      "sign in",
      "password",
    ],
    "Member login",
  ),
];

const planTerms: Record<string, string[]> = {
  daily: [
    "day pass",
    "day rate",
    "one day",
    "single day",
    "walk in",
    "walk-in",
    "daily membership",
  ],
  weekly: ["one week", "week pass", "weekly fee"],
  monthly: ["one month", "month pass", "monthly fee", "monthly gym", "monthly membership"],
  quarterly: ["three months", "3 month", "quarterly fee"],
  "semi-annual": ["six months", "6 month", "half year", "semi annual"],
  yearly: ["annual", "year", "12 month", "yearly fee"],
  "vip-silver": ["silver", "vip silver", "silver plan"],
  "vip-gold": ["gold", "vip gold", "gold plan"],
  family: [
    "family",
    "family membership",
    "three people",
    "3 people",
    "three family members",
    "3 family members",
  ],
  "personal-training": [
    "personal training price",
    "pt price",
    "personal training fee",
    "coaching fee",
  ],
};

export const visitorKnowledge: GuideEntry[] = [
  ...common,
  ...publicMembershipOptions
    .filter((plan) => plan.category !== "Registration" && plan.id !== "personal-training-only")
    .map((plan) =>
      entry(
        `plan-${plan.id}`,
        `${plan.name} membership`,
        `${plan.name}: ${formatNaira(plan.price)} for ${plan.duration}.\n\nNew-member registration: ${formatNaira(plan.registration)} (one time).\nFirst payment total: ${formatNaira(plan.price + plan.registration)}.\n\nIncludes: ${plan.benefits.join("; ")}.\n\nAlready registered? Renew through your existing account without another registration fee.`,
        `/join?plan=${encodeURIComponent(plan.id)}`,
        [plan.name, `${plan.name} plan`, ...(planTerms[plan.id] || [])],
        `Choose ${plan.name}`,
      ),
    ),
  ...recoveryServices.map((service) =>
    entry(
      `spa-${service.id}`,
      service.name,
      `${service.name}: ${service.description}${service.duration ? ` The website lists a ${service.duration} session.` : ""}${service.price !== null ? ` The published price is ${formatNaira(service.price)}.` : " Ask reception for current pricing."} Book and pay online; reception confirms availability and assigns your service provider.`,
      `/spa-booking?service=${encodeURIComponent(service.id)}`,
      [
        service.name,
        service.name.replace("machine", "").trim(),
        service.id.replace(/-/g, " "),
        ...(service.id === "full-body-massage" ? ["massage", "massage price"] : []),
      ],
      "Book this service",
    ),
  ),
];

export function articleKnowledge(articles: PublicArticle[]): GuideEntry[] {
  return articles
    .filter((post) => /^[a-z0-9-]{1,120}$/.test(post.slug))
    .map((post) =>
      entry(
        `article-${post.slug}`,
        post.title,
        `${post.title}${post.category ? ` (${post.category})` : ""}. ${post.excerpt?.trim() || "Read the full published article for the details."} I can link you to the article, but cannot confirm information beyond its published summary.`,
        `/blog/${post.slug}`,
        [post.title, ...tokens(post.title).filter((word) => word.length > 5)],
        "Read the article",
      ),
    );
}

function scoreQuestion(question: string, item: GuideEntry): number {
  const q = ` ${text(question)} `;
  const qt = new Set(tokens(question));
  const et = new Set(tokens(`${item.title} ${item.terms.join(" ")}`));
  let matched = 0;
  for (const word of qt) if (et.has(word)) matched++;
  if (!matched) return 0;
  let score = matched * 2;
  for (const term of item.terms) {
    const phrase = text(term);
    if (phrase && q.includes(` ${phrase} `))
      score += phrase.includes(" ") ? 9 + phrase.split(" ").length : 4;
  }
  const titlePhrase = text(item.title);
  if (titlePhrase && q.includes(` ${titlePhrase} `)) score += 10;
  if (item.id.startsWith("plan-") || item.id.startsWith("spa-")) score += 1;
  return score;
}

function reply(item: GuideEntry): GuideAnswer {
  return {
    id: item.id,
    text: item.answer,
    href: item.href,
    linkLabel: item.linkLabel,
    confident: true,
  };
}

/** Phrase routing takes precedence over broad keyword matches (e.g. registration vs join). */
function answerSingleQuestion(
  question: string,
  previousId: string | null,
  articles: PublicArticle[],
  now = new Date(),
): GuideAnswer {
  const clean = text(question.slice(0, 600)).replace(
    /\b(workin|workout) hours\b/g,
    "opening hours",
  );
  const entries = [...visitorKnowledge, ...articleKnowledge(articles)];
  const byId = (id: string) => reply(entries.find((item) => item.id === id)!);
  if (!clean)
    return {
      id: "empty",
      text: "Ask me about memberships, prices, hours, location, training, spa services or how to join.",
      href: "/membership",
      linkLabel: "Explore memberships",
      confident: false,
    };
  if (/^(hello|hi|hey|good morning|good afternoon|good evening|salam|howdy)( there)?$/.test(clean))
    return {
      ...byId("welcome"),
      text: "Hi! Welcome to Super Plus Fitness & Spa. What can I help you with today? You can ask about prices, joining, spa bookings, opening hours or finding the gym.",
    };
  if (/^(thanks|thank you|thank you so much|ok|okay|nice|great|bye)$/.test(clean))
    return {
      id: "thanks",
      text: "You’re welcome! I’m here whenever you need help with Super Plus.",
      href: "/contact",
      linkLabel: "Contact the team",
      confident: true,
    };
  if (
    /\b(password|otp|card number|cvv|my balance|my expiry|my expiration|my receipt|my transaction|my payment|my account|membership status)\b/.test(
      clean,
    )
  )
    return byId("membership-help");
  if (
    /\b(salary|commission|payroll|staff records|member list|system prompt|ignore.*instructions)\b/.test(
      clean,
    )
  )
    return {
      id: "private",
      text: "I help with public Super Plus information. For private member, staff or management matters, sign into the appropriate portal or contact the team.",
      href: "/portal",
      linkLabel: "Open portals",
      confident: false,
    };
  if (/\b(refund|cancel|cancellation|freeze|pause|guest|trial|discount|promo|coupon)\b/.test(clean))
    return {
      id: "policy-unknown",
      text: "Please ask reception to confirm the current policy or offer before paying. I do not have a verified answer for that arrangement.",
      href: "/contact",
      linkLabel: "Ask reception",
      confident: false,
    };
  if (
    /\b(cure|diagnos|diabetes|hypertension|injury|pregnant|pregnancy|medical|blood pressure|pain|lose.*(kg|kilos).*week)\b/.test(
      clean,
    )
  )
    return {
      id: "health",
      text: "I can explain our services and help you find a coach, but I cannot diagnose a condition, promise results or confirm that a treatment is medically suitable. Speak to a qualified clinician about your condition and let reception know about any exercise or treatment restrictions.",
      href: "/contact",
      linkLabel: "Discuss service suitability",
      confident: false,
    };
  if (/\b(staff|admin|reception)\b.*\b(portal|login|log in|dashboard)\b/.test(clean))
    return byId("staff-portal");
  if (/\b(renew|renewal|extend|registration.*again)\b/.test(clean)) return byId("renew");
  if (
    /\b(registration only|register only|registration now|pay registration|register now.*later)\b/.test(
      clean,
    )
  )
    return byId("registration-only");
  if (
    /\b(pt only|personal training only|trainer only|pt add on|add personal training)\b/.test(
      clean,
    ) ||
    /\b(active|existing|already)\b.*\b(membership|member)\b.*\b(pt|trainer|personal training)\b/.test(
      clean,
    )
  )
    return byId("pt-only");
  // Keep brief follow-ups attached to the plan or service the visitor just asked about.
  const prior = entries.find((item) => item.id === previousId);
  if (
    prior &&
    /^(and |what about |is that |does that |does it |including |with |without )?(the )?(registration|registration fee|total|first payment|first time total|price|cost|how much|how much is it|what is the price|tell me more|more details|what does it include|include registration|include classes|includes registration|with registration|including registration)( fee| included)?$/.test(
      clean,
    )
  )
    return reply(prior);
  if (
    /\b(registration|joining fee|sign up fee|signup fee|enrolment fee|enrollment fee)\b/.test(
      clean,
    ) &&
    !/\b(monthly|weekly|daily|quarterly|yearly|family|gold|silver|semi annual)\b/.test(clean)
  )
    return byId("registration");
  if (/\b(open now|open today|closed now|are you open|still open)\b/.test(clean)) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
    const sunday = value("weekday") === "Sun";
    const minutes = Number(value("hour")) * 60 + Number(value("minute"));
    const withinHours = minutes >= (sunday ? 390 : 360) && minutes < (sunday ? 1140 : 1230);
    return {
      ...byId("hours"),
      text: `Based on our published schedule and the current time in Lagos, we ${withinHours ? "should be open now" : "are outside opening hours now"}. ${sunday ? "Sunday: 6:30 AM–7:00 PM." : "Monday–Saturday: 6:00 AM–8:30 PM."} Holiday hours or unexpected closures may differ; reception can confirm.`,
    };
  }
  if (/\b(hours|opening|closing|sunday|saturday|weekend|close|open)\b/.test(clean))
    return byId("hours");
  if (/\b(where|address|location|directions|located|map|find the gym)\b/.test(clean))
    return byId("location");
  const service =
    recoveryServices.find((service) => clean.includes(text(service.name))) ||
    (/\b(massage|body massage)\b/.test(clean) && !/\b(foot|pulse)\b/.test(clean)
      ? recoveryServices.find((service) => service.id === "full-body-massage")
      : undefined);
  if (service) return byId(`spa-${service.id}`);
  const planId = /\bfamily\b|\b(3|three) (people|family members)\b/.test(clean)
    ? "family"
    : /\b(silver|gold)\b/.test(clean)
      ? clean.includes("gold")
        ? "vip-gold"
        : "vip-silver"
      : /\b(pt|personal train(er|ing)|coaching fee)\b/.test(clean)
        ? "personal-training"
        : /\b(semi annual|six months|6 months|half year)\b/.test(clean)
          ? "semi-annual"
          : /\b(quarterly|three months|3 months)\b/.test(clean)
            ? "quarterly"
            : /\b(yearly|annual|one year|12 months)\b/.test(clean)
              ? "yearly"
              : /\b(monthly|one month|1 month)\b/.test(clean)
                ? "monthly"
                : /\b(weekly|one week|1 week)\b/.test(clean)
                  ? "weekly"
                  : /\b(daily|day pass|one day|walk in)\b/.test(clean)
                    ? "daily"
                    : null;
  if (
    planId === "personal-training" &&
    !/\b(price|cost|fee|much|plan|membership|pay)\b/.test(clean)
  )
    return byId("coach");
  if (planId) return byId(`plan-${planId}`);
  if (/\b(book|booking|appointment|therapist|availability|available slots)\b/.test(clean))
    return byId("booking-help");
  if (/\b(spa|recovery|wellness services)\b/.test(clean)) return byId("spa");
  if (
    /\b(app|apk|android|iphone|ios|points|rewards|streak|wheel|challenges|achievements)\b/.test(
      clean,
    )
  )
    return byId("app");
  if (
    /\b(hmo|hmos|insurance|axa|mansard|reliance|noor|bardge|bastion|paygym|hygeia|clearline)\b/.test(
      clean,
    )
  )
    return byId("hmo");
  if (/\b(human|person|reception|whatsapp|phone|email|contact|call|support)\b/.test(clean))
    return byId("contact");
  if (/\b(login|log in|sign in|account)\b/.test(clean)) return byId("membership-help");
  if (/\b(qr|check in|check out|scan|attendance)\b/.test(clean)) return byId("qr");
  if (/\b(pay|payment|paystack|transfer|cash|pos|checkout)\b/.test(clean)) return byId("payment");
  if (/\b(join|sign up|signup|register|enroll|enrol|become a member)\b/.test(clean))
    return byId("join");
  const best = entries
    .map((item) => ({ item, score: scoreQuestion(clean, item) }))
    .sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 6) return reply(best.item);
  return {
    id: "unknown",
    text: `I don’t have a verified answer for that yet. Reception can help on WhatsApp or ${contact.phone}. You can also ask me about membership prices, registration, opening hours, facilities, PT, spa bookings or HMO partners.`,
    href: "/contact",
    linkLabel: "Contact reception",
    confident: false,
  };
}

/** Handle a pair of clearly separated questions without losing the first topic. */
export function answerVisitorQuestion(
  question: string,
  previousId: string | null,
  articles: PublicArticle[],
  now = new Date(),
): GuideAnswer {
  const parts = question
    .slice(0, 600)
    .split(
      /\?\s*(?=\S)|\s+and\s+(?=(?:what|where|how|when|do you|can i|are you|opening hours|closing time|registration fee|address)\b)/i,
    )
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (parts.length < 2) return answerSingleQuestion(question, previousId, articles, now);
  const replies: GuideAnswer[] = [];
  let context = previousId;
  for (const part of parts) {
    const answer = answerSingleQuestion(part, context, articles, now);
    if (!replies.some((existing) => existing.id === answer.id)) replies.push(answer);
    if (answer.confident) context = answer.id;
  }
  const first = replies[0]!;
  return {
    ...first,
    text: replies.map((answer) => answer.text).join("\n\n"),
    confident: replies.every((answer) => answer.confident),
  };
}
