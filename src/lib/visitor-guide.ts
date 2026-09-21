import { contact, facilities, membershipPlans, openingHours, recoveryServices, formatNaira } from '@/lib/site-data';

/** Public marketing information only. Never index member, staff or payment tables here. */
export type GuideEntry = {
  id: string;
  title: string;
  answer: string;
  href: string;
  linkLabel: string;
  terms: string[];
};
export type PublicArticle = { title: string; slug: string; excerpt: string | null; category: string };
export type GuideAnswer = { id: string; text: string; href: string; linkLabel: string; confident: boolean };

const hours = openingHours.map(item => `${item.days}: ${item.hours}`).join('; ');
const planSummary = membershipPlans.map(plan => `${plan.name}: ${formatNaira(plan.price)} (${plan.duration})`).join('; ');
const text = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const filler = new Set(['a', 'an', 'and', 'are', 'at', 'be', 'can', 'could', 'do', 'does', 'for', 'from', 'have', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'please', 'the', 'there', 'to', 'us', 'we', 'what', 'when', 'where', 'which', 'who', 'with', 'you', 'your']);
const tokens = (s: string) => text(s).split(' ').filter(word => word.length > 1 && !filler.has(word));
const entry = (id: string, title: string, answer: string, href: string, terms: string[], linkLabel = 'Read more'): GuideEntry => ({ id, title, answer, href, terms, linkLabel });

const common: GuideEntry[] = [
  entry('welcome', 'About Super Plus Fitness & Spa', 'Super Plus Fitness & Spa is a gym, personal-training, spa and recovery centre in Shomolu, Lagos. You can explore memberships, facilities, coaching and wellness services on this website.', '/about', ['about', 'super plus', 'spf', 'what is this gym', 'who are you', 'fitness centre', 'fitness center', 'tell me about'], 'About the gym'),
  entry('hours', 'Opening hours', `Our published opening hours are ${hours}. Please contact reception to confirm special holiday hours.`, '/contact', ['hours', 'opening', 'closing', 'close', 'open', 'time', 'sunday', 'saturday', 'weekend', 'holiday hours', 'today hours', 'morning', 'night', 'opening time', 'closing time'], 'Opening hours and contact'),
  entry('location', 'Address and directions', `We're at ${contact.address}. Tap the directions link on our contact page to navigate to us.`, '/contact', ['where', 'address', 'location', 'located', 'find you', 'directions', 'map', 'shomolu', 'apata', 'how to get', 'visit', 'nearest', 'lagos'], 'Get directions'),
  entry('contact', 'Contact reception', `Call ${contact.phone}, WhatsApp us, or email ${contact.email}. For the fastest response, reach us during our published opening hours.`, '/contact', ['contact', 'phone', 'number', 'whatsapp', 'call', 'email', 'customer service', 'reception', 'speak', 'human', 'person', 'support', 'enquiry', 'enquiries'], 'Contact the team'),
  entry('plans', 'Membership plans and prices', `Our currently published plans are: ${planSummary}. First-time registration fees are shown on each plan and added during new-member checkout. Visit Membership to compare benefits and totals.`, '/membership', ['membership', 'memberships', 'plans', 'prices', 'pricing', 'subscriptions', 'packages', 'options', 'rates', 'how much', 'cost', 'membership fee', 'price list', 'gym fee', 'gym price'], 'Compare membership plans'),
  entry('registration', 'New-member registration fees', 'New members pay their selected plan price plus the registration amount displayed for that plan. Most published plans list a ₦7,000 registration fee; Semi-Annual and VIP Gold list ₦3,000, and Family lists ₦20,000. Existing members should use their member account to renew rather than registering again. Confirm your exact checkout total before paying.', '/membership', ['registration', 'registration fee', 'joining fee', 'enrollment', 'enrolment', 'new member fee', 'first payment', 'first time', 'sign up fee', 'signup fee', 'extra fee', 'why fee'], 'See plan fees'),
  entry('join', 'How to become a member', 'Choose a plan on the Join page, enter your information and complete payment securely through Paystack. A new membership is activated after verified payment. If you belonged to the gym before, contact reception to have your existing membership history recognised rather than paying a new registration fee.', '/join', ['join', 'sign up', 'signup', 'register', 'become member', 'become a member', 'new member', 'enroll', 'enrol', 'start membership', 'how to join', 'subscribe'], 'Join online'),
  entry('renew', 'Renew an existing membership', 'If you already have a member profile, sign in and renew through your member dashboard. Do not create a second new-member account. If you previously paid offline and have no online record, ask reception to verify that you are a returning member before you renew, so you are not treated as a new registrant.', '/login', ['renew', 'renewal', 'extend', 'existing member', 'old member', 'returning member', 'again', 'already a member', 'registration fee again', 'previous membership'], 'Member login'),
  entry('payment', 'Paying for membership', 'New members can choose a membership on the Join page and pay through verified Paystack checkout. For an offline bank transfer, POS or cash payment at reception, staff submit a request and a separate manager must verify the actual funds before the membership becomes active. Never treat a transfer screenshot alone as payment confirmation.', '/join', ['pay', 'payment', 'paystack', 'card', 'bank transfer', 'transfer', 'cash', 'pos', 'payment methods', 'online payment', 'checkout', 'receipt', 'payment confirmation'], 'Join and pay securely'),
  entry('qr', 'Your membership QR code', 'Members can sign in to their account and open My QR Code to show reception for check-in. Your QR code is private to your membership; this public website assistant cannot retrieve or display it.', '/my-qr', ['qr', 'qr code', 'scan', 'scanner', 'check in', 'check out', 'entry', 'access code', 'attendance', 'my code'], 'Open My QR Code'),
  entry('access', 'Gym facilities and equipment', `Our published facilities include ${facilities.map(item => item.name).join(', ')}. Browse the facilities and gallery pages for photos and details; ask reception to confirm a particular machine's availability.`, '/facilities', ['equipment', 'machines', 'weights', 'dumbbell', 'bench', 'squat', 'cardio', 'treadmill', 'facilities', 'gym floor', 'free weights', 'strength', 'functional', 'leg press', 'smith machine', 'hip thrust'], 'Explore the facilities'),
  entry('classes', 'Group classes', 'Group classes are included in several published memberships, including Monthly and Personal Training. For the current class timetable, specific class types and spaces, ask reception: the website does not publish a confirmed live class schedule.', '/membership', ['classes', 'group class', 'group training', 'aerobics', 'yoga', 'zumba', 'class schedule', 'timetable', 'instructor', 'fitness class', 'group exercise'], 'Check plan benefits'),
  entry('coach', 'Personal training', 'Personal training offers structured coaching, technique guidance, goal-led programming and accountability. Our published Personal Training plan includes 30-day gym access, gym equipment, group classes and coaching. Visit the training page for details and the membership page for the current price.', '/personal-training', ['personal training', 'personal trainer', 'coach', 'coaching', 'pt', 'one on one', 'one to one', 'trainer', 'training program', 'training programme', 'fitness plan', 'goal'], 'Explore personal training'),
  entry('spa', 'Spa and recovery services', `Our website lists ${recoveryServices.map(service => service.name).join(', ')}. Individual service information is on Spa & Recovery. Please confirm current prices, suitability and appointment availability with the team before visiting.`, '/spa-recovery', ['spa', 'recovery', 'relax', 'wellness', 'massage', 'therapy', 'pedicure', 'detox', 'body treatment', 'treatment', 'appointment', 'booking'], 'Explore spa services'),
  entry('hmo', 'HMO and wellness partnerships', 'Our website lists direct partners PayGYM, Bardge, Reliance HMO and Noor HMO. The Bardge network shown includes Hygeia, NEM Health HMO, Bastion HMO, Clearline HMO and AXA Mansard. Eligibility and included services depend on your particular plan; please confirm coverage with your provider and reception before visiting.', '/hmo', ['hmo', 'insurance', 'health insurance', 'reliance', 'noor', 'axa', 'mansard', 'bastion', 'paygym', 'bardge', 'hygeia', 'nem health', 'clearline', 'health plan', 'corporate'], 'See HMO information'),
  entry('business', 'Corporate wellness partnerships', 'Super Plus works with organisations and HMO networks on gym access, group sessions and wellness partnerships. Visit HMO & Corporate to send an enquiry about your team or members.', '/hmo', ['company', 'companies', 'corporate', 'employer', 'employee', 'partnership', 'partner', 'organisation', 'organization', 'staff gym', 'team membership'], 'Partnership enquiries'),
  entry('blog', 'Fitness and wellness articles', 'Our blog publishes articles about fitness, nutrition, recovery and wellness. Browse the articles or search by topic on the blog page. For personalised health or training advice, speak to a qualified professional.', '/blog', ['blog', 'article', 'read', 'reading', 'tips', 'nutrition', 'fitness tips', 'wellness tips', 'exercise advice', 'articles'], 'Explore the blog'),
  entry('gallery', 'Photos and videos', 'Visit the Gallery page to see publicly shared photos and videos of Super Plus Fitness. For a specific machine or facility that is not pictured, contact reception.', '/gallery', ['gallery', 'pictures', 'picture', 'photos', 'images', 'videos', 'tour', 'inside', 'see gym', 'look like'], 'View the gallery'),
  entry('membership-help', 'Membership or account support', `This visitor guide cannot view member profiles, balances, payment records, renewal status or private QR codes. Please sign into your member account or contact reception on ${contact.phone} to check your individual case. Never share a password, OTP or card details in this chat.`, '/login', ['my membership status', 'my account', 'my payment status', 'my transaction', 'my balance', 'my expiry', 'my expiration', 'my receipt', 'my profile', 'forgot password', 'password reset', 'login problem', 'cant login'], 'Member login'),
];

const planTerms: Record<string, string[]> = {
  daily: ['day pass', 'day rate', 'one day', 'single day', 'walk in', 'walk-in', 'daily membership'],
  weekly: ['one week', 'week pass', 'weekly fee'],
  monthly: ['one month', 'month pass', 'monthly fee', 'monthly gym', 'monthly membership'],
  quarterly: ['three months', '3 month', 'quarterly fee'],
  'semi-annual': ['six months', '6 month', 'half year', 'semi annual'],
  yearly: ['annual', 'year', '12 month', 'yearly fee'],
  'vip-silver': ['silver', 'vip silver', 'silver plan'],
  'vip-gold': ['gold', 'vip gold', 'gold plan'],
  family: ['family', 'family membership', 'three people'],
  'personal-training': ['personal training price', 'pt price', 'personal training fee', 'coaching fee'],
};

export const visitorKnowledge: GuideEntry[] = [
  ...common,
  ...membershipPlans.map(plan => entry(
    `plan-${plan.id}`,
    `${plan.name} membership`,
    `${plan.name} costs ${formatNaira(plan.price)} for ${plan.duration}. Its published one-time registration fee for a new member is ${formatNaira(plan.registration)}, making the first checkout total ${formatNaira(plan.price + plan.registration)}. Benefits: ${plan.benefits.join('; ')}. Existing members should renew through their account rather than register again.`,
    `/join?plan=${encodeURIComponent(plan.id)}`,
    [plan.name, `${plan.name} plan`, ...planTerms[plan.id] || []],
    `Choose ${plan.name}`,
  )),
  ...recoveryServices.map(service => entry(
    `spa-${service.id}`,
    service.name,
    `${service.name}: ${service.description}${service.duration ? ` The website lists a ${service.duration} session.` : ''}${service.price !== null ? ` Its published price is ${formatNaira(service.price)}, but please confirm today's spa rates and availability with reception.` : ' Ask reception for current pricing.'}`,
    '/spa-recovery',
    [service.name, service.name.replace('machine', '').trim(), service.id.replace(/-/g, ' ')],
    'Spa & recovery services',
  )),
];

export function articleKnowledge(articles: PublicArticle[]): GuideEntry[] {
  return articles.filter(post => /^[a-z0-9-]{1,120}$/.test(post.slug)).map(post => entry(
    `article-${post.slug}`, post.title,
    `${post.title}${post.category ? ` (${post.category})` : ''}. ${post.excerpt?.trim() || 'Read the full published article for the details.'} I can show the article, but I cannot provide advice beyond what is published in its summary.`,
    `/blog/${post.slug}`, [post.title, ...tokens(post.title).filter(word => word.length > 3)], 'Read the article',
  ));
}

function scoreQuestion(question: string, item: GuideEntry): number {
  const q = ` ${text(question)} `;
  const qt = new Set(tokens(question));
  const et = new Set(tokens(`${item.title} ${item.terms.join(' ')}`));
  let matched = 0;
  for (const word of qt) if (et.has(word)) matched++;
  if (matched === 0) return 0;
  let score = matched * 2;
  for (const term of item.terms) {
    const phrase = text(term);
    if (phrase && q.includes(` ${phrase} `)) score += phrase.includes(' ') ? 9 + phrase.split(' ').length : 4;
  }
  const titlePhrase = text(item.title);
  if (titlePhrase && q.includes(` ${titlePhrase} `)) score += 10;
  // Prefer an exact plan or service over a generic category answer when both match.
  if ((item.id.startsWith('plan-') || item.id.startsWith('spa-')) && matched > 0) score += 1;
  return score;
}

export function answerVisitorQuestion(question: string, previousId: string | null, articles: PublicArticle[]): GuideAnswer {
  const clean = text(question);
  if (!clean) return { id: 'empty', text: 'Ask me about memberships, prices, hours, location, training, spa services or how to join.', href: '/membership', linkLabel: 'Explore memberships', confident: false };
  if (/^(hello|hi|hey|good morning|good afternoon|good evening|salam|howdy|thanks|thank you|ok|okay)( there)?$/.test(clean)) return { id: 'hello', text: 'Hello! Welcome to Super Plus Fitness & Spa. Ask about our membership prices, opening hours, location, personal training, spa or how to join. What would you like to know?', href: '/membership', linkLabel: 'See membership options', confident: true };
  if (/\b(my|mine)\b.*\b(status|balance|expiry|expiration|payment|receipt|transaction|account|membership|qr code)\b/.test(clean) && !/\b(how|renew|register|join|pay|use|get|find)\b/.test(clean)) {
    const item = common.find(entry => entry.id === 'membership-help')!;
    return { id: item.id, text: item.answer, href: item.href, linkLabel: item.linkLabel, confident: true };
  }
  if (/\b(refund|cancellation policy|freeze policy|pause policy|guest policy|trial policy)\b/.test(clean)) {
    return { id: 'policy-unknown', text: 'I cannot confirm that policy from our published website, so I do not want to give you an incorrect answer. Please check directly with reception before paying or making arrangements.', href: '/contact', linkLabel: 'Ask reception', confident: false };
  }
  const entries = [...visitorKnowledge, ...articleKnowledge(articles)];
  const ranked = entries.map(item => ({ item, score: scoreQuestion(question, item) })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (best && best.score >= 5) return { id: best.item.id, text: best.item.answer, href: best.item.href, linkLabel: best.item.linkLabel, confident: true };
  if (/^(how much|what about that|and the price|what is the price|how much is it|what about it|tell me more|more details|what does it include)$/.test(clean) && previousId) {
    const prior = entries.find(item => item.id === previousId);
    if (prior) return { id: prior.id, text: prior.answer, href: prior.href, linkLabel: prior.linkLabel, confident: true };
  }
  return { id: 'unknown', text: `I couldn't verify an answer to that from our published website, and I don't want to guess. Please ask our team on WhatsApp or call ${contact.phone}. You can also ask me about prices, registration, hours, facilities, classes, spa and HMO partners.`, href: '/contact', linkLabel: 'Contact reception', confident: false };
}
