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

export function validateSpaTime(value: unknown, durationMinutes = 30, now = Date.now()) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+01:00$/.test(value))
    throw Error("Choose a valid date and time in Lagos.");
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= now || timestamp > now + 90 * 86400000)
    throw Error("Choose a future appointment within the next 90 days.");
  const lagos = new Date(timestamp + 3600000);
  if (lagos.toISOString().slice(0, 16) !== value.slice(0, 16))
    throw Error("Choose a valid date and time.");
  const minutes = lagos.getUTCHours() * 60 + lagos.getUTCMinutes();
  const sunday = lagos.getUTCDay() === 0;
  if (minutes < (sunday ? 390 : 360) || minutes + durationMinutes > (sunday ? 1140 : 1230))
    throw Error("Choose a time during opening hours, allowing enough time for your session.");
  return new Date(timestamp).toISOString();
}

export const spaStaff = ["Salma", "James", "Chinedu"] as const;

/** Parse Lagos booking timestamp without hardcoding opening hours.
 * Published opening/closing rules are checked by the checkout independently.
 */
export function validateSpaTimestamp(value:unknown,now=Date.now()){
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+01:00$/.test(value))
  throw Error("Choose a valid date and time in Lagos.");
 const timestamp=Date.parse(value);
 if(!Number.isFinite(timestamp)||timestamp<=now||timestamp>now+91*86400000)
  throw Error("Choose a future appointment within the next 90 days.");
 const lagos=new Date(timestamp+3600000);
 if(lagos.toISOString().slice(0,16)!==value.slice(0,16))
  throw Error("Choose a valid date and time.");
 return new Date(timestamp).toISOString();
}
