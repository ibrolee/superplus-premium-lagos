import { contact, facilities, membershipPlans, openingHours, recoveryServices, formatNaira } from '@/lib/site-data';

/** A grounded guide to PUBLIC website content only. No private tables, AI provider or payment access. */
export type GuideEntry = { id: string; title: string; answer: string; href: string; linkLabel: string; terms: string[] };
export type PublicArticle = { title: string; slug: string; excerpt: string | null; category: string };
export type GuideAnswer = { id: string; text: string; href: string; linkLabel: string; confident: boolean };
const hours = openingHours.map(item => `${item.days}: ${item.hours}`).join('; ');
const planSummary = membershipPlans.map(plan => `${plan.name}: ${formatNaira(plan.price)} (${plan.duration})`).join('; ');
const text = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const filler = new Set(['a','an','and','are','at','be','can','could','do','does','for','from','have','how','i','in','is','it','me','my','of','on','or','please','the','there','to','us','we','what','when','which','who','with','you','your']);
const tokens = (s: string) => text(s).split(' ').filter(word => word.length > 1 && !filler.has(word));
const entry = (id: string, title: string, answer: string, href: string, terms: string[], linkLabel = 'Read more'): GuideEntry => ({ id, title, answer, href, terms, linkLabel });

const common: GuideEntry[] = [
  entry('welcome','About Super Plus Fitness & Spa','Super Plus Fitness & Spa is a gym, personal-training, spa and recovery centre in Shomolu, Lagos. Our website covers gym memberships, facilities, personal coaching, classes, recovery and partnerships.','/about',['about','super plus','spf','what is this gym','who are you','fitness centre','fitness center','tell me about','services','offer','provide'],'About the gym'),
  entry('hours','Opening hours',`Our published opening hours are ${hours}. Please contact reception to confirm any special holiday hours.`,'/contact',['hours','opening','closing','close','open','time','sunday','saturday','weekend','holiday hours','today hours','morning','night','opening time','closing time'],'Opening hours and contact'),
  entry('location','Address and directions',`We're at ${contact.address}. Use the directions link on our contact page to navigate here.`,'/contact',['where','address','location','located','find you','directions','map','shomolu','apata','how to get','visit','nearest','lagos'],'Get directions'),
  entry('contact','Contact reception',`Call ${contact.phone}, WhatsApp the gym or email ${contact.email}. For the fastest response, reach us during our published opening hours.`,'/contact',['contact','phone','number','whatsapp','call','email','customer service','reception','speak','human','person','support','enquiry','enquiries'],'Contact the team'),
  entry('plans','Membership plans and prices',`Our currently published plans are: ${planSummary}. First-time registration fees are displayed per plan and added during new-member checkout. Visit the Membership page to compare benefits and totals.`,'/membership',['membership','memberships','plans','prices','pricing','subscriptions','packages','options','rates','how much','cost','membership fee','price list','gym fee','gym price'],'Compare membership plans'),
  entry('registration','New-member registration fees','New members pay their chosen plan price plus the registration fee shown for that plan. Most published plans list ₦7,000 registration; Semi-Annual and VIP Gold list ₦3,000, and Family lists ₦20,000. Existing members should renew through their existing account instead of registering again. Confirm the exact checkout total before paying.','/membership',['registration','registration fee','joining fee','enrollment','enrolment','new member fee','first payment','first time','sign up fee','signup fee','extra fee','why fee'],'See registration fees'),
  entry('join','How to become a member','On the Join page, choose your plan, enter your details and complete payment through verified Paystack checkout. Your membership activates after payment verification. Previously enrolled offline? Ask reception to verify your existing-member identity before renewing rather than registering again.','/join',['join','sign up','signup','register','become member','become a member','new member','enroll','enrol','start membership','how to join','subscribe'],'Join online'),
  entry('renew','Renew an existing membership','Sign into your existing member account and renew from the member dashboard. Please do not open a second new-member profile. If you joined before the online system and have no account yet, ask reception to verify that you are a returning member first.','/login',['renew','renewal','extend','existing member','old member','returning member','again','already a member','registration fee again','previous membership'],'Member login'),
  entry('payment','Paying for membership','New members use secure Paystack checkout on the Join page. For cash, POS or transfer at reception, staff can submit a pending request; a separate manager must independently verify actual funds before the payment counts or a plan activates. A transfer screenshot alone is not verification.','/join',['pay','payment','paystack','card','bank transfer','transfer','cash','pos','payment methods','online payment','checkout','receipt','payment confirmation'],'Join and pay securely'),
  entry('qr','Your membership QR code','Sign into your member account and open My QR Code to show reception for gym check-in. This public visitor guide cannot view, issue or validate your private code.','/my-qr',['qr','qr code','scan','scanner','check in','check out','entry','access code','attendance','my code'],'Open My QR Code'),
  entry('access','Gym facilities and equipment',`Our published facilities include ${facilities.map(item => item.name).join(', ')}. Browse Facilities and Gallery for details and photos, and ask reception to confirm that a particular machine is currently available.`,'/facilities',['equipment','machines','weights','dumbbell','bench','squat','cardio','treadmill','facilities','gym floor','free weights','strength','functional','leg press','smith machine','hip thrust'],'Explore the facilities'),
  entry('classes','Group classes','Group classes are included in several published plans, including Monthly and Personal Training. The public website does not publish a confirmed live class timetable; please ask reception about specific sessions and availability.','/membership',['classes','group class','group training','aerobics','yoga','zumba','class schedule','timetable','instructor','fitness class','group exercise'],'Check membership benefits'),
  entry('coach','Personal training','Personal training includes structured coaching, form guidance, goal-led programming and accountability. The published Personal Training membership includes 30-day gym access, equipment, group classes and coaching. Visit the training page for the experience and Membership for the current plan price.','/personal-training',['personal training','personal trainer','coach','coaching','pt','one on one','one to one','trainer','training program','training programme','fitness plan','goal'],'Explore personal training'),
  entry('spa','Spa and recovery services',`Our website lists ${recoveryServices.map(service => service.name).join(', ')}. Individual service details are on Spa & Recovery. Confirm current prices, suitability and appointments directly with reception.`,'/spa-recovery',['spa','recovery','relax','wellness','massage','therapy','pedicure','detox','body treatment','treatment','appointment','booking'],'Explore spa services'),
  entry('hmo','HMO and wellness partnerships','The website lists PayGYM, Bardge, Reliance HMO and Noor HMO as direct partners. The Bardge network shown includes Hygeia, NEM Health HMO, Bastion HMO, Clearline HMO and AXA Mansard. Coverage and eligibility depend on your exact plan; please confirm with your provider and reception before visiting.','/hmo',['hmo','hmos','accept hmo','health insurance','insurance','reliance','noor','axa','mansard','bastion','paygym','bardge','hygeia','nem health','clearline','health plan','corporate'],'See HMO information'),
  entry('business','Corporate wellness partnerships','Super Plus works with companies and HMO networks on gym access, group sessions and wellness partnerships. Visit the HMO & Corporate page to enquire about benefits for your organisation.','/hmo',['company','companies','corporate','employer','employee','partnership','partner','organisation','organization','staff gym','team membership'],'Partnership enquiries'),
  entry('blog','Fitness and wellness articles','Our blog shares published articles about fitness, nutrition, recovery and wellness. Browse articles or search them on the Blog page. For personalised medical or training advice, speak to a qualified professional.','/blog',['blog','article','read','reading','tips','nutrition','fitness tips','wellness tips','exercise advice','articles'],'Explore the blog'),
  entry('gallery','Photos and videos','The Gallery page has publicly shared photos and videos of the gym. Ask reception if you need confirmation of a particular piece of equipment.','/gallery',['gallery','pictures','picture','photos','images','videos','tour','inside','see gym','look like'],'View the gallery'),
  entry('membership-help','Member or account support',`I cannot access member profiles, balances, payment histories, renewal status or private QR codes. Please sign into your account or contact reception on ${contact.phone} about your individual case. Never enter passwords, OTPs or card details in this chat.`,'/login',['my membership status','my account','my payment status','my transaction','my balance','my expiry','my expiration','my receipt','my profile','forgot password','password reset','login problem','cant login','login','sign in','password'],'Member login'),
];

const planTerms: Record<string,string[]> = {
  daily:['day pass','day rate','one day','single day','walk in','walk-in','daily membership'],
  weekly:['one week','week pass','weekly fee'],monthly:['one month','month pass','monthly fee','monthly gym','monthly membership'],
  quarterly:['three months','3 month','quarterly fee'],'semi-annual':['six months','6 month','half year','semi annual'],
  yearly:['annual','year','12 month','yearly fee'],'vip-silver':['silver','vip silver','silver plan'],
  'vip-gold':['gold','vip gold','gold plan'],family:['family','family membership','three people'],
  'personal-training':['personal training price','pt price','personal training fee','coaching fee'],
};

export const visitorKnowledge: GuideEntry[] = [
  ...common,
  ...membershipPlans.map(plan => entry(`plan-${plan.id}`,`${plan.name} membership`,`${plan.name} costs ${formatNaira(plan.price)} for ${plan.duration}. The published one-time registration fee for new members is ${formatNaira(plan.registration)}; the first checkout total is ${formatNaira(plan.price + plan.registration)}. Benefits: ${plan.benefits.join('; ')}. Returning members should renew using their existing account.`,`/join?plan=${encodeURIComponent(plan.id)}`,[plan.name,`${plan.name} plan`,...(planTerms[plan.id] || [])],`Choose ${plan.name}`)),
  ...recoveryServices.map(service => entry(`spa-${service.id}`,service.name,`${service.name}: ${service.description}${service.duration ? ` The website lists a ${service.duration} session.` : ''}${service.price !== null ? ` The published price is ${formatNaira(service.price)}; please confirm today's spa rates and availability with reception.` : ' Ask reception for current pricing.'}`,'/spa-recovery',[service.name,service.name.replace('machine','').trim(),service.id.replace(/-/g,' '),...(service.id === 'full-body-massage' ? ['massage','massage price'] : [])],'Spa & recovery services')),
];

export function articleKnowledge(articles: PublicArticle[]): GuideEntry[] {
  return articles.filter(post => /^[a-z0-9-]{1,120}$/.test(post.slug)).map(post => entry(`article-${post.slug}`,post.title,`${post.title}${post.category ? ` (${post.category})` : ''}. ${post.excerpt?.trim() || 'Read the full published article for the details.'} I can link you to the article, but cannot confirm information beyond its published summary.`,`/blog/${post.slug}`,[post.title,...tokens(post.title).filter(word => word.length > 5)],'Read the article'));
}

function scoreQuestion(question: string, item: GuideEntry): number {
  const q = ` ${text(question)} `;
  const qt = new Set(tokens(question));
  const et = new Set(tokens(`${item.title} ${item.terms.join(' ')}`));
  let matched = 0;
  for (const word of qt) if (et.has(word)) matched++;
  if (!matched) return 0;
  let score = matched * 2;
  for (const term of item.terms) {
    const phrase = text(term);
    if (phrase && q.includes(` ${phrase} `)) score += phrase.includes(' ') ? 9 + phrase.split(' ').length : 4;
  }
  const titlePhrase = text(item.title);
  if (titlePhrase && q.includes(` ${titlePhrase} `)) score += 10;
  if (item.id.startsWith('plan-') || item.id.startsWith('spa-')) score += 1;
  return score;
}

export function answerVisitorQuestion(question: string, previousId: string | null, articles: PublicArticle[]): GuideAnswer {
  const clean = text(question);
  if (!clean) return { id:'empty',text:'Ask me about memberships, prices, hours, location, training, spa services or how to join.',href:'/membership',linkLabel:'Explore memberships',confident:false };
  if (/^(hello|hi|hey|good morning|good afternoon|good evening|salam|howdy|thanks|thank you|ok|okay)( there)?$/.test(clean)) return { id:'hello',text:'Hello! Welcome to Super Plus Fitness & Spa. Ask about membership prices, opening hours, location, personal training, spa or how to join. What would you like to know?',href:'/membership',linkLabel:'See membership options',confident:true };
  if (/\b(my|mine)\b.*\b(status|balance|expiry|expiration|payment|receipt|transaction|account|membership|qr code)\b/.test(clean) && !/\b(how|renew|register|join|pay|use|get|find)\b/.test(clean)) {
    const item = common.find(item => item.id === 'membership-help')!;
    return { id:item.id,text:item.answer,href:item.href,linkLabel:item.linkLabel,confident:true };
  }
  if (/\b(refund|cancellation policy|freeze policy|pause policy|guest policy|trial policy)\b/.test(clean)) return { id:'policy-unknown',text:'I cannot confirm that policy from the published website, so I do not want to give an incorrect answer. Please ask reception before paying or making arrangements.',href:'/contact',linkLabel:'Ask reception',confident:false };
  const entries = [...visitorKnowledge,...articleKnowledge(articles)];
  if (/^(how much|how much is it|what about that|what about it|and the price|what is the price|tell me more|more details|what does it include|does it include classes)$/.test(clean) && previousId) {
    const prior = entries.find(item => item.id === previousId);
    if (prior) return { id:prior.id,text:prior.answer,href:prior.href,linkLabel:prior.linkLabel,confident:true };
  }
  const best = entries.map(item => ({ item,score:scoreQuestion(question,item) })).sort((a,b) => b.score - a.score)[0];
  if (best && best.score >= 5) return { id:best.item.id,text:best.item.answer,href:best.item.href,linkLabel:best.item.linkLabel,confident:true };
  return { id:'unknown',text:`I couldn't verify that answer from the published website, and I don't want to guess. Ask reception on WhatsApp or call ${contact.phone}. I can also help with membership prices, registration, hours, facilities, classes, spa and HMO partners.`,href:'/contact',linkLabel:'Contact reception',confident:false };
}
