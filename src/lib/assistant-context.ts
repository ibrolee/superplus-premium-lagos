export type AssistantPageContext = {
  key: string;
  invite: string;
  greeting: string;
  suggestions: readonly string[];
};
const contexts: Record<string, AssistantPageContext> = {
  membership: {
    key: "membership",
    invite: "Let’s find your plan.",
    greeting:
      "Hi! I’m Super, your SPF companion. Compare gym and family plans, understand registration fees or check whether PT Only is right for you. What would you like to know?",
    suggestions: [
      "How much is monthly?",
      "Family membership",
      "Registration fees",
      "Registration Only",
      "PT Only add-on",
      "How do I renew?",
    ],
  },
  join: {
    key: "join",
    invite: "Need a hand joining?",
    greeting:
      "Hi! I’m Super. I can explain registration, first-payment totals and how to join. Already a member? I can point you to renewal through your existing account.",
    suggestions: [
      "How do I join?",
      "Registration fees",
      "How much is monthly?",
      "Registration Only",
      "How do I renew?",
      "Payment methods",
    ],
  },
  spa: {
    key: "spa",
    invite: "Let’s plan your recovery.",
    greeting:
      "Hi! I’m Super. Ask about massage, pedicure and recovery services, prices or how to book. Reception confirms your preferred time and assigns an available service provider.",
    suggestions: [
      "Full Body Massage price",
      "Pedicure price",
      "Book a spa service",
      "Can I choose my therapist?",
      "Spa services",
      "Opening hours",
    ],
  },
  training: {
    key: "training",
    invite: "Find your coaching option.",
    greeting:
      "Hi! I’m Super. I can explain personal training, the gym-and-coaching plan and the PT Only add-on for members with active gym access.",
    suggestions: [
      "How much is personal training?",
      "PT Only add-on",
      "What is personal training?",
      "Group classes",
      "How do I join?",
      "Contact reception",
    ],
  },
  facilities: {
    key: "facilities",
    invite: "Explore the gym with me.",
    greeting:
      "Hi! I’m Super. Looking around? Ask about our equipment, facilities, classes or how to visit Super Plus in Shomolu.",
    suggestions: [
      "Gym equipment",
      "Group classes",
      "Personal training",
      "Membership prices",
      "Opening hours",
      "Find the gym",
    ],
  },
  blog: {
    key: "blog",
    invite: "Explore the fitness journal.",
    greeting:
      "Hi! I’m Super. I can help you find published fitness articles, explore training and recovery services or plan a visit to the gym.",
    suggestions: [
      "Fitness articles",
      "Personal training",
      "Spa services",
      "Group classes",
      "Membership prices",
      "Contact reception",
    ],
  },
  hmo: {
    key: "hmo",
    invite: "Questions about HMO access?",
    greeting:
      "Hi! I’m Super. Ask about our published HMO partners or corporate wellness. Your exact coverage needs confirmation from your provider and reception.",
    suggestions: [
      "HMO partners",
      "Reliance HMO",
      "AXA Mansard",
      "Noor HMO",
      "Corporate partnerships",
      "Contact reception",
    ],
  },
  contact: {
    key: "contact",
    invite: "Planning your visit?",
    greeting:
      "Hi! I’m Super. I can help with directions, published opening hours or reaching reception. What do you need for your visit?",
    suggestions: [
      "Find the gym",
      "Opening hours",
      "Are you open now?",
      "Contact reception",
      "How do I join?",
      "Book a spa service",
    ],
  },
  app: {
    key: "app",
    invite: "Need help with SP Fitness?",
    greeting:
      "Hi! I’m Super. Ask about the SP Fitness app, download options, points and rewards, or signing into your member account.",
    suggestions: [
      "Download Android APK",
      "iPhone app",
      "SP Points",
      "Rewards",
      "Member login",
      "Contact reception",
    ],
  },
};
const fallback: AssistantPageContext = {
  key: "general",
  invite: "Hi, how can I help?",
  greeting:
    "Hi! 👋 I’m Super, your SPF companion. Ask me about joining, prices, personal training, spa bookings or visiting the gym.",
  suggestions: [
    "Membership prices",
    "Book a spa service",
    "Opening hours",
    "PT Only add-on",
    "Find the gym",
    "HMO partners",
  ],
};

export function getAssistantPageContext(pathname: string): AssistantPageContext {
  const path = pathname.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
  if (path === "/faq")
    return {
      key: "faq",
      invite: "Let’s find your answer.",
      greeting:
        "Hi! I’m Super. Ask about membership, registration, personal training or spa bookings. For your own account or payment, reception can help directly.",
      suggestions: [
        "Registration fees",
        "How much is monthly?",
        "PT Only add-on",
        "Book a spa service",
        "Opening hours",
        "HMO partners",
      ],
    };
  if (path === "/membership") return contexts["membership"]!;
  if (path === "/join" || path === "/family-join") return contexts["join"]!;
  if (path === "/spa-recovery" || path === "/spa-booking") return contexts["spa"]!;
  if (path === "/personal-training") return contexts["training"]!;
  if (path === "/gallery" || path === "/facilities") return contexts["facilities"]!;
  if (path === "/blog" || path.startsWith("/blog/")) return contexts["blog"]!;
  if (path === "/hmo") return contexts["hmo"]!;
  if (path === "/contact") return contexts["contact"]!;
  if (path === "/app") return contexts["app"]!;
  return fallback;
}
