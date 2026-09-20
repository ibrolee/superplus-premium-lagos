import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2, Printer, RefreshCcw, ShieldAlert } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { generateMemberCardPdf, saveMemberCardPdf } from '@/lib/member-card-pdf';

export const Route = createFileRoute('/management-member-card')({ component: MembershipCardPage });
type CardMember = { id: string; full_name: string; qr_token: string; created_at: string; member_card_number: number | null };
const BRAND_LOGO = '/header-logo-colour.svg';
const CARD_W = 856;
const CARD_H = 540;
function formattedNumber(number: number | null) {
  return number === null ? 'SPF-PREVIEW' : `SPF-${String(number).padStart(6, '0')}`;
}

// Preserve the *actual* Super Plus vector artwork and its red/orange gradients.
// Only recolour the black figure/wordmark to white for this black card: the
// public header uses the original asset and is unaffected.
async function getDarkCardLogo() {
  const response = await fetch(BRAND_LOGO);
  if (!response.ok) throw new Error('The Super Plus Fitness logo could not be loaded.');
  const original = await response.text();
  const darkCardVersion = original
    .replace(/#050505/gi, '#ffffff')
    .replace(/#101010/gi, '#ffffff')
    .replace(/#000000/gi, '#ffffff');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(darkCardVersion)}`;
}
function SvgFrame({ children, label, side, reference }: {
  children: React.ReactNode; label: string; side: 'front' | 'back'; reference: React.RefObject<SVGSVGElement | null>;
}) {
  return <svg ref={reference} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${CARD_W} ${CARD_H}`} role="img" aria-label={label} className="block h-auto w-full overflow-hidden rounded-[15px] shadow-xl" data-card-side={side}>{children}</svg>;
}
function BrandArtwork({ source, x = 48, y = 29, width = 593 }: { source: string; x?: number; y?: number; width?: number }) {
  return <image href={source} x={x} y={y} width={width} height={width * 255 / 1030} preserveAspectRatio="xMinYMid meet"/>;
}
function CardDefinitions({ side }: { side: 'front' | 'back' }) {
  const prefix = side === 'front' ? 'spf-front' : 'spf-back';
  return <defs>
    <clipPath id={`${prefix}-clip`}><rect width="856" height="540" rx="25"/></clipPath>
    <linearGradient id={`${prefix}-base`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1d1d21"/><stop offset=".44" stopColor="#09090b"/><stop offset="1" stopColor="#141419"/></linearGradient>
    <linearGradient id={`${prefix}-red`} x1="0" y1="0" x2="1" y2=".3"><stop stopColor="#ec162c"/><stop offset=".58" stopColor="#f43029"/><stop offset="1" stopColor="#ff651c"/></linearGradient>
    <linearGradient id={`${prefix}-edge`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff6038"/><stop offset=".15" stopColor="#eeeeef"/><stop offset=".65" stopColor="#35363c"/><stop offset="1" stopColor="#ff481d"/></linearGradient>
    <radialGradient id={`${prefix}-glow`} cx=".88" cy=".81" r=".68"><stop stopColor="#fa3e19" stopOpacity=".54"/><stop offset=".48" stopColor="#ca2223" stopOpacity=".09"/><stop offset="1" stopColor="#ae1515" stopOpacity="0"/></radialGradient>
    <pattern id={`${prefix}-grain`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><path d="M0 0V8" stroke="#ffffff" strokeWidth=".45" opacity=".13"/></pattern>
  </defs>;
}
function CardBase({ side }: { side: 'front' | 'back' }) {
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
function CardFront({ member, reference, logo }: { member: CardMember; reference: React.RefObject<SVGSVGElement | null>; logo: string }) {
  const number = formattedNumber(member.member_card_number);
  return <SvgFrame reference={reference} label={`Front of ${member.full_name}'s membership card`} side="front">
    <CardDefinitions side="front"/>
    <g clipPath="url(#spf-front-clip)">
      <CardBase side="front"/>
      {/* Diagonal panels and bright red/orange strokes match approved image three. */}
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
  </SvgFrame>;
}
function CardBack({ reference, logo }: { reference: React.RefObject<SVGSVGElement | null>; logo: string }) {
  return <SvgFrame reference={reference} label="Back of Super Plus Fitness membership card" side="back">
    <CardDefinitions side="back"/>
    <g clipPath="url(#spf-back-clip)">
      <CardBase side="back"/>
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
  </SvgFrame>;
}
function MembershipCardPage() {
  const frontRef = useRef<SVGSVGElement>(null);
  const backRef = useRef<SVGSVGElement>(null);
  const [logo, setLogo] = useState(BRAND_LOGO);
  const [member, setMember] = useState<CardMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmReissue, setConfirmReissue] = useState(false);
  useEffect(() => {
    let active = true;
    void getDarkCardLogo().then((source) => { if (active) setLogo(source); }).catch(() => { if (active) setError('Logo colours could not load. Refresh the page before approving this design.'); });
    async function load() {
      try {
        const id = new URLSearchParams(window.location.search).get('memberId');
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Open a member profile and choose Membership ID Card.');
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error('Sign in to the Admin Portal to access membership cards.');
        const { data: staff, error: staffError } = await supabase.from('staff_users').select('role,active').eq('auth_user_id', auth.user.id).maybeSingle();
        if (staffError || !staff?.active || String(staff.role).toLowerCase() !== 'admin') throw new Error('An active administrator account is required to create or print member cards.');
        const query = await supabase.from('members').select('id,full_name,qr_token,created_at,member_card_number').eq('id', id).maybeSingle();
        let data: CardMember | null = null;
        if (query.error?.code === '42703' || query.error?.code === 'PGRST204') {
          const older = await supabase.from('members').select('id,full_name,qr_token,created_at').eq('id', id).maybeSingle();
          if (older.error) throw older.error;
          if (older.data) data = { ...older.data, member_card_number: null } as CardMember;
        } else { if (query.error) throw query.error; data = query.data as CardMember | null; }
        if (!data) throw new Error('Member not found.');
        if (!data.qr_token) throw new Error('This member does not have a QR code yet. Contact reception.');
        if (active) setMember(data);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load membership card.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);
  async function exportPdf(mode: 'save' | 'open') {
    if (!member?.member_card_number || !frontRef.current || !backRef.current || busy) return;
    const popup = mode === 'open' ? window.open('about:blank', '_blank') : null;
    setBusy(true); setError('');
    try {
      const pdf = await generateMemberCardPdf(frontRef.current, backRef.current);
      const name = member.full_name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      const filename = `${formattedNumber(member.member_card_number)}-${name}-membership-card.pdf`;
      if (mode === 'save') saveMemberCardPdf(pdf, filename);
      else if (popup) { const url = URL.createObjectURL(pdf); popup.location.replace(url); window.setTimeout(() => URL.revokeObjectURL(url), 120_000); }
      else saveMemberCardPdf(pdf, filename);
    } catch (cause) { popup?.close(); setError(cause instanceof Error ? cause.message : 'Could not generate the PDF.'); }
    finally { setBusy(false); }
  }
  async function reissue() {
    if (!member?.member_card_number || busy || reason.trim().length < 8) return;
    if (!window.confirm('Invalidate this member’s old QR card immediately? Old printed cards will stop scanning. The permanent member ID will remain unchanged.')) return;
    setBusy(true); setError('');
    try {
      const { data, error: issueError } = await supabase.rpc('admin_reissue_member_card', { p_member_id: member.id, p_reason: reason.trim() });
      if (issueError) throw issueError;
      if (!data?.success) throw new Error('Card replacement was not confirmed.');
      const refreshed = await supabase.from('members').select('qr_token').eq('id', member.id).single();
      if (refreshed.error || !refreshed.data?.qr_token) throw refreshed.error || new Error('Refresh the page to see the replacement code.');
      setMember({ ...member, qr_token: refreshed.data.qr_token }); setReason(''); setConfirmReissue(false);
      window.alert('Old card invalidated. Download and print the new card now.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not replace the card.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#111113] px-4 py-8 text-white sm:px-7 sm:py-12"><div className="mx-auto max-w-6xl">
    <a href="/management-profiles" className="inline-flex items-center gap-2 text-sm font-bold text-[#ff7050]"><ArrowLeft size={17}/> Back to member profiles</a>
    <div className="mt-6"><p className="text-xs font-black uppercase tracking-[.2em] text-[#ff6750]">Super Plus Fitness &amp; Spa · Reference design 3</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Membership ID Card</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#c1c0c1]">Premium black and red, double-sided PVC card based on your chosen reference. The same QR works with existing reception check-in.</p></div>
    {loading && <p role="status" className="mt-8 flex items-center gap-2 rounded-2xl bg-[#242429] p-6"><Loader2 className="animate-spin" size={18}/> Loading member and checking admin access…</p>}
    {error && <p role="alert" className="mt-6 rounded-2xl border border-red-500/40 bg-red-950 p-4 text-sm text-red-100">{error}</p>}
    {member && <>
      {!member.member_card_number && <div className="mt-6 rounded-2xl border border-amber-400/40 bg-[#392c1e] p-5 text-sm leading-6 text-[#ffe6aa]"><strong>Preview mode:</strong> The actual member information and QR appear on the design, but SPF-PREVIEW is a placeholder. Permanent ID database migration has NOT been run, and PDF export and lost-card replacement remain disabled until you approve launch.</div>}
      <div className="mt-8 grid gap-7 lg:grid-cols-2"><section><h2 className="mb-3 text-sm font-black uppercase tracking-widest">Front · member identification</h2><CardFront member={member} reference={frontRef} logo={logo}/></section><section><h2 className="mb-3 text-sm font-black uppercase tracking-widest">Back · card instructions</h2><CardBack reference={backRef} logo={logo}/></section></div>
      <div className="mt-7 rounded-2xl border border-[#44444a] bg-[#232328] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Print-ready files</h2><p className="mt-1 text-sm text-[#c1c0c1]">Two-page PDF: front on page 1 and back on page 2, CR80 finished size 85.6 × 54 mm. Print at 100% scale; ask the card shop whether they require a separate bleed specification.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !member.member_card_number} onClick={() => void exportPdf('save')} className="inline-flex items-center gap-2 rounded-xl bg-[#eb3037] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Download size={17}/>{busy ? 'Preparing…' : 'Download PDF'}</button><button type="button" disabled={busy || !member.member_card_number} onClick={() => void exportPdf('open')} className="inline-flex items-center gap-2 rounded-xl border border-[#8e8e95] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Printer size={17}/> Open to print</button></div></div></div>
      <section className="mt-5 rounded-2xl border border-[#48444a] bg-[#232328] p-5 sm:p-6"><div className="flex items-start gap-3"><ShieldAlert size={23} className="shrink-0 text-[#ff5b47]"/><div className="min-w-0"><h2 className="font-black">Lost or damaged card?</h2><p className="mt-1 text-sm leading-6 text-[#c1c0c1]">An administrator can invalidate the old QR and issue a replacement without changing the member ID or altering memberships and payments.</p><button disabled={!member.member_card_number || busy} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#ff6657] underline disabled:opacity-40" onClick={() => setConfirmReissue(!confirmReissue)}><RefreshCcw size={16}/> Replace lost card</button></div></div>{confirmReissue && <div className="mt-4 border-t border-[#53535a] pt-4"><label className="block text-sm font-bold">Audit reason (required)<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} placeholder="For example: Member reported card lost" className="mt-2 block w-full rounded-xl border border-[#85858a] bg-[#161619] p-3 text-sm text-white"/></label><button onClick={() => void reissue()} disabled={busy || reason.trim().length < 8} className="mt-3 rounded-xl bg-[#e63235] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Invalidate old QR and reissue</button></div>}</section>
    </>}
  </div></main>;
}