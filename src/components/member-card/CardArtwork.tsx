import type { ReactNode, RefObject } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export type PrintableMember = { id: string; full_name: string; qr_token: string; member_card_number: number };
const CARD_W = 856;
const CARD_H = 540;
export const cardNumber = (number: number) => `SPF-${String(number).padStart(6, '0')}`;

// The card uses the existing brand SVG; only its black strokes are made white.
export async function loadCardLogo() {
  const response = await fetch('/header-logo-colour.svg');
  if (!response.ok) throw new Error('Unable to load the Super Plus Fitness logo.');
  const original = await response.text();
  const svg = original.replace(/#050505/gi, '#ffffff').replace(/#101010/gi, '#ffffff').replace(/#000000/gi, '#ffffff');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
function Frame({ children, label, side, reference }: { children: ReactNode; label: string; side: 'front' | 'back'; reference?: RefObject<SVGSVGElement | null> }) {
  return <svg ref={reference} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${CARD_W} ${CARD_H}`} role="img" aria-label={label} className="block h-auto w-full overflow-hidden rounded-[15px] shadow-xl" data-card-side={side}>{children}</svg>;
}
function BrandArtwork({ source }: { source: string }) { return <image href={source} x="48" y="29" width="593" height={593 * 255 / 1030} preserveAspectRatio="xMinYMid meet"/>; }
function Definitions({ side }: { side: 'front' | 'back' }) {
  const p = side === 'front' ? 'spf-front' : 'spf-back';
  return <defs>
    <clipPath id={`${p}-clip`}><rect width="856" height="540" rx="25"/></clipPath>
    <linearGradient id={`${p}-base`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1d1d21"/><stop offset=".44" stopColor="#09090b"/><stop offset="1" stopColor="#141419"/></linearGradient>
    <linearGradient id={`${p}-red`} x1="0" y1="0" x2="1" y2=".3"><stop stopColor="#ec162c"/><stop offset=".58" stopColor="#f43029"/><stop offset="1" stopColor="#ff651c"/></linearGradient>
    <linearGradient id={`${p}-edge`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff6038"/><stop offset=".15" stopColor="#eeeeef"/><stop offset=".65" stopColor="#35363c"/><stop offset="1" stopColor="#ff481d"/></linearGradient>
    <radialGradient id={`${p}-glow`} cx=".88" cy=".81" r=".68"><stop stopColor="#fa3e19" stopOpacity=".54"/><stop offset=".48" stopColor="#ca2223" stopOpacity=".09"/><stop offset="1" stopColor="#ae1515" stopOpacity="0"/></radialGradient>
    <pattern id={`${p}-grain`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><path d="M0 0V8" stroke="#ffffff" strokeWidth=".45" opacity=".13"/></pattern>
  </defs>;
}
function Base({ side }: { side: 'front' | 'back' }) {
  const p = side === 'front' ? 'spf-front' : 'spf-back';
  return <>
    <rect width="856" height="540" fill={`url(#${p}-base)`}/>
    <path d="M0 0H427L75 540H0Z" fill="#151519" opacity=".66"/>
    <path d="M350 -10H516L163 555H5Z" fill="#050507" opacity=".6"/>
    <path d="M535 -5H622L267 550H182Z" fill="#27272a" opacity=".24"/>
    <rect width="856" height="540" fill={`url(#${p}-grain)`} opacity=".6"/>
    <rect width="856" height="540" fill={`url(#${p}-glow)`}/>
    <rect x="1.5" y="1.5" width="853" height="537" rx="24" fill="none" stroke={`url(#${p}-edge)`} strokeWidth="3"/>
  </>;
}
export function BatchCardFront({ member, logo, reference }: { member: PrintableMember; logo: string; reference?: RefObject<SVGSVGElement | null> }) {
  const number = cardNumber(member.member_card_number);
  return <Frame reference={reference} label={`Front of ${member.full_name}'s membership card`} side="front">
    <Definitions side="front"/>
    <g clipPath="url(#spf-front-clip)">
      <Base side="front"/>
      <path d="M-15 356 188 548H-15Z" fill="#521316" opacity=".32"/>
      <path d="M-30 478 204 239" stroke="#ed252e" strokeWidth="1.6" opacity=".9"/>
      <path d="M382 540 566 329 856 117V540Z" fill="#161317" opacity=".45"/>
      <path d="M404 540 660 247 856 124" stroke="#ee2430" strokeWidth="2.2" opacity=".9"/>
      <path d="M438 540 677 279 856 171" stroke="#ff501a" strokeWidth="4" opacity=".85"/>
      <path d="M832 0 856 0V191L716 349Z" fill="url(#spf-front-red)" opacity=".9"/>
      <path d="M856 136 653 368 536 540H499L660 292Z" fill="url(#spf-front-red)" opacity=".91"/>
      <path d="M856 172 665 393 555 540H532L672 312Z" fill="#ff771d" opacity=".68"/>
      <path d="M0 465 70 540H0Z" fill="#f3252a" opacity=".54"/>
      <BrandArtwork source={logo}/>
      <g fill="#fff" fontSize="17" fontWeight="650" letterSpacing="3.1" textAnchor="middle"><text x="757" y="65">STRONGER</text><text x="757" y="89">FITTER</text><text x="757" y="113">HEALTHIER</text><text x="757" y="137">HAPPIER</text></g>
      <path d="M731 151H783" stroke="#f03130" strokeWidth="3"/>
      <text x="76" y="265" fontSize="17" fontWeight="600" letterSpacing="4.2" fill="#fff">MEMBER NAME</text>
      <text x="76" y="321" fill="#fff" fontWeight="850" fontSize={member.full_name.length > 29 ? 32 : member.full_name.length > 20 ? 39 : 47} textLength={member.full_name.length > 32 ? 490 : undefined} lengthAdjust="spacingAndGlyphs">{member.full_name.toUpperCase()}</text>
      <text x="76" y="386" fontSize="18" fontWeight="600" letterSpacing="3.5" fill="#fff">MEMBER ID</text>
      <text x="76" y="435" fontSize={number.length > 11 ? 43 : 46} fill="#fc353c" fontWeight="850" letterSpacing="1.4">{number}</text>
      <text x="76" y="500" fontSize="18" fill="#fff" fontWeight="650" letterSpacing="4">MEMBER ID CARD</text>
      <path d="M335 493H392" stroke="#ff6121" strokeWidth="3"/>
      <rect x="583" y="243" width="218" height="218" rx="8" fill="#fff"/>
      <svg x="591" y="251" width="202" height="202" viewBox="0 0 202 202"><QRCodeSVG value={member.qr_token} size={202} level="H" marginSize={2} bgColor="#ffffff" fgColor="#101010"/></svg>
      <text x="702" y="479" fill="#fff" textAnchor="middle" fontWeight="700" fontSize="14" letterSpacing="3.2">SCAN FOR</text>
      <text x="702" y="500" fill="#fff" textAnchor="middle" fontWeight="700" fontSize="14" letterSpacing="3.2">MEMBER ACCESS</text>
    </g>
  </Frame>;
}
export function BatchCardBack({ logo, reference }: { logo: string; reference?: RefObject<SVGSVGElement | null> }) {
  return <Frame reference={reference} label="Back of Super Plus Fitness membership card" side="back">
    <Definitions side="back"/>
    <g clipPath="url(#spf-back-clip)">
      <Base side="back"/>
      <path d="M592 0H856V314L680 92Z" fill="#210f12" opacity=".66"/>
      <path d="M700 -10 856 194V310L665 47Z" fill="url(#spf-back-red)"/>
      <path d="M801 -10 856 74V134L761 -10Z" fill="#fe511d" opacity=".85"/>
      <path d="M840 408 856 386V540H739Z" fill="url(#spf-back-red)" opacity=".9"/>
      <BrandArtwork source={logo}/>
      <g fill="#fff" fontSize="17" fontWeight="650" letterSpacing="3" textAnchor="middle"><text x="768" y="69">DISCIPLINE</text><text x="768" y="93">BUILDS</text><text x="768" y="117">A BETTER</text><text x="768" y="141">YOU</text></g>
      <path d="M742 156H798" stroke="#ff641f" strokeWidth="3"/>
      <path d="M49 204H714Q752 204 752 242V474Q752 510 714 510H49Q31 510 31 486V238Q31 204 49 204Z" fill="#18191d" stroke="#7c7d82" strokeWidth="1.5"/>
      <path d="M55 207H706Q748 207 748 246V472Q748 504 716 504H55Q36 504 36 486V238Q36 207 55 207Z" fill="#1d1e22" opacity=".65"/>
      <g fill="none" stroke="#fa4737" strokeWidth="3"><circle cx="78" cy="255" r="21"/><circle cx="78" cy="317" r="21"/><circle cx="78" cy="379" r="21"/><circle cx="78" cy="440" r="21"/></g>
      <g fill="none" stroke="#ff6835" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="65" y="244" width="26" height="21" rx="3"/><circle cx="73" cy="251" r="2.4"/><path d="M69 259q4-5 8 0M81 250h6M81 256h6"/>
        <path d="M78 304 91 327H65Z"/><path d="M78 312v7M78 323v.3"/>
        <path d="M78 367c-6 0-11 5-11 11 0 8 11 15 11 15s11-7 11-15c0-6-5-11-11-11Z"/><circle cx="78" cy="378" r="3.5"/>
        <path d="M69 430c1-2 4-3 6-1l3 5-4 3c2 4 5 7 9 9l3-4 5 3c2 2 1 5-1 6-4 2-11-1-17-7s-9-13-4-14Z"/>
      </g>
      <g fill="#fff" fontSize="20" fontWeight="500"><text x="122" y="263">Present this card at check-in.</text><text x="122" y="326">If lost, please return to Super Plus Fitness &amp; Spa.</text><text x="122" y="387">No. 105 Apata Street, Shomolu, Lagos.</text><text x="122" y="448">07054263170</text></g>
      <path d="M59 467H725" stroke="#b3b4b8" strokeWidth="1.3"/>
      <text x="59" y="492" fill="#fff" fontSize="16">This card remains the property of Super Plus Fitness &amp; Spa.</text>
      <g fill="#fff" textAnchor="middle" fontSize="15" fontWeight="700" letterSpacing="2.5"><text x="803" y="395">FIT</text><text x="803" y="419">PEOPLE</text><text x="803" y="443">BRIGHTER</text><text x="803" y="467">LIVES</text></g>
      <path d="M783 478H822" stroke="#f94a2a" strokeWidth="3"/>
    </g>
  </Frame>;
}
