import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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

function SvgFrame({ children, label, side, reference }: {
  children: ReactNode; label: string; side: 'front' | 'back'; reference: RefObject<SVGSVGElement | null>;
}) {
  return <svg ref={reference} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${CARD_W} ${CARD_H}`} role="img" aria-label={label} className="block h-auto w-full overflow-hidden rounded-[15px] shadow-xl" data-card-side={side}>
    {children}
  </svg>;
}

/* Keep the actual Super Plus vector logo, not a recreated wordmark. The first
 * layer renders the original artwork white for contrast; the clipped second
 * layer preserves the original red-to-orange FITNESS wordmark and ring.
 * Both source images are embedded into the PDF by member-card-pdf.ts.
 */
function DarkBrand({ x = 53, y = 36, width = 520, prefix }: { x?: number; y?: number; width?: number; prefix: string }) {
  const height = width * 255 / 1030;
  const scale = width / 1030;
  return <g>
    <defs>
      <filter id={`${prefix}-white-logo`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter>
      <clipPath id={`${prefix}-red-logo-parts`}>
        <rect x={x + 381 * scale} y={y + 95 * scale} width={595 * scale} height={98 * scale}/>
        <circle cx={x + 125 * scale} cy={y + 127 * scale} r={117 * scale}/>
      </clipPath>
    </defs>
    <image href={BRAND_LOGO} x={x} y={y} width={width} height={height} preserveAspectRatio="xMinYMid meet" filter={`url(#${prefix}-white-logo)`}/>
    <image href={BRAND_LOGO} x={x} y={y} width={width} height={height} preserveAspectRatio="xMinYMid meet" clipPath={`url(#${prefix}-red-logo-parts)`}/>
  </g>;
}

function DarkCardDefs({ side }: { side: 'front' | 'back' }) {
  return <defs>
    <linearGradient id={`${side}-matte`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#161719"/><stop offset=".52" stopColor="#090a0c"/><stop offset="1" stopColor="#222326"/></linearGradient>
    <linearGradient id={`${side}-flare`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#f20e30"/><stop offset=".53" stopColor="#fa2c22"/><stop offset="1" stopColor="#ff7b16"/></linearGradient>
    <linearGradient id={`${side}-panel`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#242528"/><stop offset="1" stopColor="#121316"/></linearGradient>
    <pattern id={`${side}-texture`} width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(42)"><path d="M0 0V26" stroke="#ffffff" strokeWidth=".6" opacity=".08"/></pattern>
    <clipPath id={`${side}-clip`}><rect width={CARD_W} height={CARD_H} rx="25"/></clipPath>
  </defs>;
}

function CardFront({ member, reference }: { member: CardMember; reference: RefObject<SVGSVGElement | null> }) {
  const preview = member.member_card_number === null;
  const number = formattedNumber(member.member_card_number);
  const nameLength = member.full_name.trim().length;
  return <SvgFrame reference={reference} label={`Front of ${member.full_name}'s premium black membership card`} side="front">
    <DarkCardDefs side="front"/>
    <g clipPath="url(#front-clip)">
      <rect width="856" height="540" fill="url(#front-matte)"/>
      <rect width="856" height="540" fill="url(#front-texture)" opacity=".58"/>
      <path d="M487 -35 H693 L274 580 H79Z" fill="#242528" opacity=".41"/>
      <path d="M575 -30 H612 L216 575 H181Z" fill="#000000" opacity=".48"/>
      <path d="M854 250V540H589L856 219Z" fill="url(#front-flare)" opacity=".17"/>
      <path d="M-35 540 394 540 750 -30 783 -30 432 540Z" fill="url(#front-flare)" opacity=".72"/>
      <path d="M-35 540 H433 L795 -30 H823 L455 540Z" fill="#ff581b" opacity=".24"/>
      <path d="M-50 540 H360 L700 -30 H757 L398 540Z" fill="#111114"/>
      <path d="M0 493 100 393" fill="none" stroke="#f2262b" strokeWidth="3" opacity=".9"/>
      <path d="M432 540 854 20" fill="none" stroke="#ff481b" strokeWidth="2" opacity=".68"/>
      <DarkBrand prefix="front"/>
      <text x="796" y="75" textAnchor="end" fontSize="17" fontWeight="750" letterSpacing="3" fill="#e5e4e3">STRONGER</text>
      <text x="796" y="104" textAnchor="end" fontSize="17" fontWeight="750" letterSpacing="3" fill="#e5e4e3">FITTER</text>
      <text x="796" y="133" textAnchor="end" fontSize="17" fontWeight="750" letterSpacing="3" fill="#e5e4e3">HEALTHIER</text>
      <path d="M730 147 H796" stroke="url(#front-flare)" strokeWidth="4"/>
      <path d="M58 194 H545" stroke="#4a4c4e" strokeWidth="1.5" opacity=".8"/>
      <text x="67" y="260" fontSize="17" fill="#c9c9c9" fontWeight="700" letterSpacing="3.6">MEMBER NAME</text>
      <text x="67" y="318" fontSize={nameLength > 31 ? 26 : nameLength > 23 ? 31 : nameLength > 16 ? 36 : 43} fontWeight="850" fill="#ffffff" textLength={nameLength > 31 ? 450 : undefined} lengthAdjust="spacingAndGlyphs">{member.full_name}</text>
      <text x="67" y="381" fontSize="17" fill="#cececf" fontWeight="700" letterSpacing="3.5">PERMANENT MEMBER ID</text>
      <text x="67" y="428" fontSize="39" fill="#ff3341" fontWeight="850" letterSpacing="1">{number}</text>
      <text x="67" y="496" fontSize="18" fill="#f4f4f3" fontWeight="700" letterSpacing="4">PREMIUM MEMBER</text>
      <path d="M322 488 H384" stroke="url(#front-flare)" strokeWidth="4"/>
      <rect x="622" y="290" width="174" height="174" rx="12" fill="#ffffff"/>
      <svg x="631" y="299" width="156" height="156" viewBox="0 0 156 156"><QRCodeSVG value={member.qr_token} size={156} level="H" marginSize={2} bgColor="#ffffff" fgColor="#080a09"/></svg>
      <text x="709" y="490" fontSize="15" textAnchor="middle" fontWeight="750" letterSpacing="2" fill="#ffffff">SCAN FOR</text>
      <text x="709" y="509" fontSize="15" textAnchor="middle" fontWeight="750" letterSpacing="2" fill="#ffffff">MEMBER ACCESS</text>
      {preview && <g><rect x="570" y="170" width="232" height="33" rx="8" fill="#fff1cf"/><text x="584" y="192" fontSize="14" fill="#885000" fontWeight="800">PREVIEW · ID PENDING</text></g>}
    </g>
  </SvgFrame>;
}

function CardBack({ reference }: { reference: RefObject<SVGSVGElement | null> }) {
  return <SvgFrame reference={reference} label="Back of premium black Super Plus Fitness membership card" side="back">
    <DarkCardDefs side="back"/>
    <g clipPath="url(#back-clip)">
      <rect width="856" height="540" fill="url(#back-matte)"/>
      <rect width="856" height="540" fill="url(#back-texture)" opacity=".5"/>
      <path d="M675 -50 854 143 854 199 617 -50Z" fill="url(#back-flare)" opacity=".42"/>
      <path d="M751 -30 860 95" stroke="url(#back-flare)" strokeWidth="22" opacity=".75"/>
      <path d="M-26 510 265 540 H470 L850 100" stroke="url(#back-flare)" strokeWidth="14" opacity=".7" fill="none"/>
      <path d="M-20 532 296 552 H479 L853 134" stroke="#fd4d20" strokeWidth="4" opacity=".55" fill="none"/>
      <DarkBrand x={46} y={23} width={496} prefix="back"/>
      <text x="805" y="78" fontSize="16" textAnchor="end" fill="#ededed" fontWeight="700" letterSpacing="3">DISCIPLINE</text>
      <text x="805" y="104" fontSize="16" textAnchor="end" fill="#ededed" fontWeight="700" letterSpacing="3">BUILDS A</text>
      <text x="805" y="130" fontSize="16" textAnchor="end" fill="#ededed" fontWeight="700" letterSpacing="3">BETTER YOU</text>
      <path d="M737 145 H806" stroke="url(#back-flare)" strokeWidth="4"/>
      <rect x="45" y="187" width="765" height="328" rx="27" fill="url(#back-panel)" stroke="#55575a" strokeWidth="2"/>
      <rect x="68" y="218" width="43" height="43" rx="21" fill="#191a1d" stroke="#fb4529" strokeWidth="3"/>
      <path d="M82 240h14m-7-7v14" stroke="#ff6030" strokeWidth="3" strokeLinecap="round"/>
      <text x="129" y="247" fontSize="23" fontWeight="750" fill="#ffffff">Present this card at check-in.</text>
      <rect x="68" y="286" width="43" height="43" rx="21" fill="#191a1d" stroke="#fb4529" strokeWidth="3"/>
      <path d="M89 296v15m0 6v2" stroke="#ff6030" strokeWidth="4" strokeLinecap="round"/>
      <text x="129" y="303" fontSize="22" fontWeight="650" fill="#ffffff">If lost, please return to</text>
      <text x="129" y="328" fontSize="22" fontWeight="750" fill="#ffffff">Super Plus Fitness &amp; Spa.</text>
      <rect x="68" y="362" width="43" height="43" rx="21" fill="#191a1d" stroke="#fb4529" strokeWidth="3"/>
      <path d="M89 371c-11 0-12 15 0 25 12-10 11-25 0-25zm0 8v1" fill="none" stroke="#ff6030" strokeWidth="2.8" strokeLinecap="round"/>
      <text x="129" y="392" fontSize="21" fontWeight="650" fill="#ffffff">No. 105 Apata Street, Shomolu, Lagos</text>
      <rect x="68" y="424" width="43" height="43" rx="21" fill="#191a1d" stroke="#fb4529" strokeWidth="3"/>
      <path d="M82 434Q84 447 98 456" fill="none" stroke="#ff6030" strokeWidth="4" strokeLinecap="round"/>
      <text x="129" y="452" fontSize="23" fontWeight="650" fill="#ffffff">07054263170</text>
      <path d="M67 479 H785" stroke="#6b6d6f" strokeWidth="1.5" opacity=".75"/>
      <text x="68" y="501" fontSize="16" fill="#eeeeee" fontWeight="600">This card remains the property of Super Plus Fitness &amp; Spa.</text>
    </g>
  </SvgFrame>;
}

function MembershipCardPage() {
  const frontRef = useRef<SVGSVGElement>(null);
  const backRef = useRef<SVGSVGElement>(null);
  const [member, setMember] = useState<CardMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmReissue, setConfirmReissue] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const id = new URLSearchParams(window.location.search).get('memberId');
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Open a member profile and choose Membership ID Card.');
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error('Sign in to the Admin Portal to access membership cards.');
        const { data: staff, error: staffError } = await supabase.from('staff_users').select('role,active').eq('auth_user_id', auth.user.id).maybeSingle();
        if (staffError || !staff?.active || String(staff.role).toLowerCase() !== 'admin') throw new Error('An active administrator account is required to create or print member cards.');
        // Preview reads the actual existing QR but does not change production data.
        // Card export and replacement stay disabled until permanent IDs are migrated.
        const query = await supabase.from('members').select('id,full_name,qr_token,created_at,member_card_number').eq('id', id).maybeSingle();
        let data: CardMember | null = null;
        if (query.error?.code === '42703' || query.error?.code === 'PGRST204') {
          const older = await supabase.from('members').select('id,full_name,qr_token,created_at').eq('id', id).maybeSingle();
          if (older.error) throw older.error;
          if (older.data) data = { ...older.data, member_card_number: null } as CardMember;
        } else {
          if (query.error) throw query.error;
          data = query.data as CardMember | null;
        }
        if (!data) throw new Error('Member not found.');
        if (!data.qr_token) throw new Error('This member does not have a QR code yet. Contact reception.');
        if (active) setMember(data);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load membership card.');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function exportPdf(mode: 'save' | 'open') {
    if (!member?.member_card_number || !frontRef.current || !backRef.current || busy) return;
    // Open before awaiting PDF rendering to avoid Safari popup blocking.
    const popup = mode === 'open' ? window.open('about:blank', '_blank') : null;
    setBusy(true); setError('');
    try {
      const pdf = await generateMemberCardPdf(frontRef.current, backRef.current);
      const name = member.full_name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      const filename = `${formattedNumber(member.member_card_number)}-${name}-membership-card.pdf`;
      if (mode === 'save') saveMemberCardPdf(pdf, filename);
      else if (popup) {
        const url = URL.createObjectURL(pdf);
        popup.location.replace(url);
        window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      } else saveMemberCardPdf(pdf, filename);
    } catch (cause) {
      popup?.close();
      setError(cause instanceof Error ? cause.message : 'Could not generate the PDF.');
    } finally { setBusy(false); }
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
      setMember({ ...member, qr_token: refreshed.data.qr_token });
      setReason(''); setConfirmReissue(false);
      window.alert('Old card invalidated. Download and print the new card now.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not replace the card.'); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#111214] px-4 py-8 text-[#f4f4f3] sm:px-7 sm:py-12"><div className="mx-auto max-w-6xl">
    <a href="/management-profiles" className="inline-flex items-center gap-2 text-sm font-bold text-[#ff7b57]"><ArrowLeft size={17}/> Back to member profiles</a>
    <div className="mt-6"><p className="text-xs font-black uppercase tracking-[.2em] text-[#ff5c48]">Super Plus Fitness &amp; Spa · Premium Black · Design 3</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Membership ID Card</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#bbbcc0]">Premium matte-black, double-sided PVC design with red-to-orange details. Uses the same QR as the online member profile; membership status is checked live at reception. The permanent ID never changes on renewal.</p></div>
    {loading && <p role="status" className="mt-8 flex items-center gap-2 rounded-2xl bg-[#242529] p-6"><Loader2 className="animate-spin" size={18}/> Loading member and checking admin access…</p>}
    {error && <p role="alert" className="mt-6 rounded-2xl border border-red-700 bg-[#351b1b] p-4 text-sm text-red-100">{error}</p>}
    {member && <>
      {!member.member_card_number && <div className="mt-6 rounded-2xl border border-amber-500/70 bg-[#302818] p-5 text-sm leading-6 text-amber-100"><strong>Preview mode:</strong> This shows the member's actual details and existing QR, but the ID is clearly marked as a placeholder. The permanent-ID database migration has NOT been applied to your live system. Printing, downloading and lost-card replacement remain disabled until you approve the preview and the migration is installed.</div>}
      <div className="mt-8 grid gap-7 lg:grid-cols-2"><section><h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#f1f1ef]">Front · member identification</h2><CardFront member={member} reference={frontRef}/></section><section><h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#f1f1ef]">Back · card instructions</h2><CardBack reference={backRef}/></section></div>
      <div className="mt-7 rounded-2xl border border-[#414144] bg-[#222326] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Print-ready files</h2><p className="mt-1 text-sm text-[#c2c2c5]">Two-page PDF: front on page 1, back on page 2. CR80 finished size 85.6 × 54 mm. Print at 100% scale; confirm the card shop's required bleed and colour settings before production.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !member.member_card_number} onClick={() => void exportPdf('save')} className="inline-flex items-center gap-2 rounded-xl bg-[#f13735] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Download size={17}/>{busy ? 'Preparing…' : 'Download PDF'}</button><button type="button" disabled={busy || !member.member_card_number} onClick={() => void exportPdf('open')} className="inline-flex items-center gap-2 rounded-xl border border-[#a5a5a8] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Printer size={17}/> Open to print</button></div></div></div>
      <section className="mt-5 rounded-2xl border border-[#414144] bg-[#222326] p-5 sm:p-6"><div className="flex items-start gap-3"><ShieldAlert size={23} className="shrink-0 text-[#ff644f]"/><div className="min-w-0"><h2 className="font-black">Lost or damaged card?</h2><p className="mt-1 text-sm leading-6 text-[#c2c2c5]">An administrator can invalidate the old QR and issue a replacement without changing the permanent member ID, memberships or payments.</p><button disabled={!member.member_card_number || busy} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#ff7864] underline disabled:opacity-40" onClick={() => setConfirmReissue(!confirmReissue)}><RefreshCcw size={16}/> Replace lost card</button></div></div>{confirmReissue && <div className="mt-4 border-t border-[#55555a] pt-4"><label className="block text-sm font-bold">Audit reason (required)<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} placeholder="For example: Member reported card lost" className="mt-2 block w-full rounded-xl border border-[#707075] bg-[#151618] p-3 text-sm text-white"/></label><button onClick={() => void reissue()} disabled={busy || reason.trim().length < 8} className="mt-3 rounded-xl bg-[#ed303a] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Invalidate old QR and reissue</button></div>}</section>
    </>}
  </div></main>;
}
