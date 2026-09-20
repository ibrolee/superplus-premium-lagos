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
function SvgFrame({ children, label, side, reference }: {
  children: React.ReactNode; label: string; side: 'front' | 'back'; reference: React.RefObject<SVGSVGElement | null>;
}) {
  return <svg ref={reference} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${CARD_W} ${CARD_H}`} role="img" aria-label={label} className="block h-auto w-full overflow-hidden rounded-[15px] shadow-xl" data-card-side={side}>
    {children}
  </svg>;
}
function BrandArtwork({ x = 47, y = 34, width = 505 }: { x?: number; y?: number; width?: number }) {
  return <image href={BRAND_LOGO} x={x} y={y} width={width} height={width * 255 / 1030} preserveAspectRatio="xMinYMid meet" />;
}
function CardFront({ member, reference }: { member: CardMember; reference: React.RefObject<SVGSVGElement | null> }) {
  const preview = member.member_card_number === null;
  const number = formattedNumber(member.member_card_number);
  return <SvgFrame reference={reference} label={`Front of ${member.full_name}'s membership card`} side="front">
    <defs>
      <linearGradient id="cardFrontRed" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ed1831"/><stop offset="1" stopColor="#ff671d"/></linearGradient>
      <linearGradient id="cardFrontTint" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffffff"/><stop offset="1" stopColor="#f8f9f7"/></linearGradient>
      <clipPath id="frontClip"><rect width="856" height="540" rx="25"/></clipPath>
    </defs>
    <g clipPath="url(#frontClip)">
      <rect width="856" height="540" fill="url(#cardFrontTint)"/>
      <path d="M735 -20 H880 V565 H317 C452 450 536 330 628 188 Z" fill="url(#cardFrontRed)"/>
      <path d="M784 -20 H825 C720 178 596 373 391 560 H345 C552 348 676 153 784 -20Z" fill="#ffffff" opacity=".28"/>
      <path d="M809 -20 H842 C730 165 599 378 436 560 H398 C594 344 708 148 809 -20Z" fill="#ffffff" opacity=".15"/>
      <path d="M-20 512 C220 479 283 514 435 560 H-20Z" fill="#e71d36" opacity=".07"/>
      <BrandArtwork/>
      <text x="794" y="62" textAnchor="end" fontSize="15" fill="#6d7971" fontWeight="800" letterSpacing="3">MEMBERSHIP</text>
      <text x="794" y="86" textAnchor="end" fontSize="15" fill="#6d7971" fontWeight="800" letterSpacing="3">ACCESS CARD</text>
      <path d="M55 206 H524" stroke="#dbe0dc" strokeWidth="2"/>
      <rect x="53" y="236" width="4" height="205" rx="2" fill="#ee2032"/>
      <text x="77" y="255" fontSize="16" fontWeight="750" fill="#5a6560" letterSpacing="3">MEMBER NAME</text>
      <text x="77" y="308" fontSize={member.full_name.length > 30 ? 27 : member.full_name.length > 20 ? 33 : 40} fontWeight="850" fill="#17241c" textLength={member.full_name.length > 32 ? 455 : undefined} lengthAdjust="spacingAndGlyphs">{member.full_name}</text>
      <text x="77" y="372" fontSize="16" fontWeight="750" fill="#5a6560" letterSpacing="3">MEMBER ID</text>
      <text x="77" y="415" fontSize="34" fontWeight="850" fill="#17241c" letterSpacing=".7">{number}</text>
      <text x="56" y="502" fontSize="12" fill="#58655c" fontWeight="750" letterSpacing="3">FITNESS THAT FITS YOUR LIFE</text>
      <rect x="610" y="250" width="208" height="208" rx="15" fill="white"/>
      <svg x="622" y="262" width="184" height="184" viewBox="0 0 184 184"><QRCodeSVG value={member.qr_token} size={184} level="H" marginSize={2} bgColor="#ffffff" fgColor="#101810"/></svg>
      <text x="713" y="486" textAnchor="middle" fontSize="14" letterSpacing="3" fontWeight="800" fill="white">SCAN AT RECEPTION</text>
      {preview && <g><rect x="15" y="14" width="255" height="31" rx="8" fill="#fff2cb"/><text x="28" y="35" fontSize="14" fill="#845100" fontWeight="800">PREVIEW · NUMBER PENDING</text></g>}
    </g>
  </SvgFrame>;
}
function CardBack({ reference }: { reference: React.RefObject<SVGSVGElement | null> }) {
  return <SvgFrame reference={reference} label="Back of Super Plus Fitness membership card" side="back">
    <defs><linearGradient id="cardBackRed" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#ed1831"/><stop offset="1" stopColor="#ff671d"/></linearGradient><clipPath id="backClip"><rect width="856" height="540" rx="25"/></clipPath></defs>
    <g clipPath="url(#backClip)">
      <rect width="856" height="540" fill="#ffffff"/>
      <path d="M0 493 Q260 448 390 499 T856 485 V560 H0Z" fill="url(#cardBackRed)"/>
      <path d="M695 -25 C765 35 801 43 880 36 V-25Z" fill="url(#cardBackRed)"/>
      <path d="M665 -20 C754 48 783 72 880 69" fill="none" stroke="#ff7b32" strokeWidth="8" opacity=".32"/>
      <circle cx="756" cy="266" r="143" fill="none" stroke="#ecefeb" strokeWidth="18"/>
      <circle cx="757" cy="267" r="111" fill="none" stroke="#f3f4f1" strokeWidth="12"/>
      <BrandArtwork x={47} y={29} width={500}/>
      <path d="M55 194 H801" stroke="#d8ded9" strokeWidth="2"/>
      <circle cx="77" cy="252" r="15" fill="#fff0e9" stroke="#ed2840" strokeWidth="2"/>
      <circle cx="77" cy="331" r="15" fill="#fff0e9" stroke="#ed2840" strokeWidth="2"/>
      <circle cx="77" cy="409" r="15" fill="#fff0e9" stroke="#ed2840" strokeWidth="2"/>
      <text x="111" y="259" fontSize="25" fill="#192920" fontWeight="700">No. 105 Apata Street, Shomolu, Lagos</text>
      <text x="111" y="338" fontSize="27" fill="#192920" fontWeight="700">07054263170</text>
      <text x="111" y="416" fontSize="25" fill="#192920" fontWeight="700">www.superplusfitness.com</text>
      <path d="M55 447 H801" stroke="#d8ded9" strokeWidth="2"/>
      <text x="55" y="475" fontSize="18" fill="#344238" fontWeight="650">Present this card at check-in. Card remains the property of Super Plus Fitness &amp; Spa.</text>
      <text x="805" y="530" textAnchor="end" fontSize="11" fontWeight="800" letterSpacing="2" fill="white">FITNESS THAT FITS YOUR LIFE</text>
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
        // The migration is intentionally NOT applied to production during preview.
        // Show the actual QR with an unmistakable preview number, and disable export
        // until the permanent numbers and reissue audit are installed after approval.
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
    // Open synchronously, before awaiting PDF rendering, to avoid Safari popup blocking.
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

  return <main className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#1d2e24] sm:px-7 sm:py-12"><div className="mx-auto max-w-6xl">
    <a href="/management-profiles" className="inline-flex items-center gap-2 text-sm font-bold text-[#285c3c]"><ArrowLeft size={17}/> Back to member profiles</a>
    <div className="mt-6"><p className="text-xs font-black uppercase tracking-[.2em] text-[#c32b36]">Super Plus Fitness &amp; Spa · Option B</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Membership ID Card</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#667568]">Clean white, double-sided PVC card. Same QR as the online member profile; expiry is checked live at reception. The permanent ID never changes on renewal.</p></div>
    {loading && <p role="status" className="mt-8 flex items-center gap-2 rounded-2xl bg-white p-6"><Loader2 className="animate-spin" size={18}/> Loading member and checking admin access…</p>}
    {error && <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {member && <>
      {!member.member_card_number && <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Preview mode:</strong> Your real member details and existing QR appear below, but the printed member number is a placeholder. The permanent-ID database migration is prepared separately and has NOT been applied to the live system. Printing and downloading are disabled until you approve the preview and the migration is installed.</div>}
      <div className="mt-8 grid gap-7 lg:grid-cols-2"><section><h2 className="mb-3 text-sm font-black uppercase tracking-widest">Front · member identification</h2><CardFront member={member} reference={frontRef}/></section><section><h2 className="mb-3 text-sm font-black uppercase tracking-widest">Back · gym information</h2><CardBack reference={backRef}/></section></div>
      <div className="mt-7 rounded-2xl border border-[#dde7da] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Print-ready files</h2><p className="mt-1 text-sm text-[#667568]">Two-page PDF: front on page 1 and back on page 2, CR80 finished size 85.6 × 54 mm. Print at 100% scale; ask the card shop whether they require a separate bleed specification.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !member.member_card_number} onClick={() => void exportPdf('save')} className="inline-flex items-center gap-2 rounded-xl bg-[#173326] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Download size={17}/>{busy ? 'Preparing…' : 'Download PDF'}</button><button type="button" disabled={busy || !member.member_card_number} onClick={() => void exportPdf('open')} className="inline-flex items-center gap-2 rounded-xl border border-[#9cb6a1] px-5 py-3 text-sm font-black text-[#173326] disabled:cursor-not-allowed disabled:opacity-40"><Printer size={17}/> Open to print</button></div></div></div>
      <section className="mt-5 rounded-2xl border border-[#eed9d5] bg-white p-5 sm:p-6"><div className="flex items-start gap-3"><ShieldAlert size={23} className="shrink-0 text-[#b43b36]"/><div className="min-w-0"><h2 className="font-black">Lost or damaged card?</h2><p className="mt-1 text-sm leading-6 text-[#68776b]">An administrator can invalidate the old QR and issue a replacement, without changing the member ID or altering memberships and payments.</p><button disabled={!member.member_card_number || busy} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#ad2c36] underline disabled:opacity-40" onClick={() => setConfirmReissue(!confirmReissue)}><RefreshCcw size={16}/> Replace lost card</button></div></div>{confirmReissue && <div className="mt-4 border-t pt-4"><label className="block text-sm font-bold">Audit reason (required)<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} placeholder="For example: Member reported card lost" className="mt-2 block w-full rounded-xl border border-[#d7ded8] p-3 text-sm"/></label><button onClick={() => void reissue()} disabled={busy || reason.trim().length < 8} className="mt-3 rounded-xl bg-[#a92c34] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Invalidate old QR and reissue</button></div>}</section>
    </>}
  </div></main>;
}
