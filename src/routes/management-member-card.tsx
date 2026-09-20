import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2, Printer, RefreshCcw, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BatchCardFront, BatchCardBack, loadCardLogo, type PrintableMember } from '@/components/member-card/CardArtwork';
import { generateMemberCardPdf, saveMemberCardPdf } from '@/lib/member-card-pdf';
import { prefersMobileCardShare } from '@/lib/member-card-file-actions';

export const Route = createFileRoute('/management-member-card')({ component: MembershipCardPage });
type CardMember = { id: string; full_name: string; qr_token: string; created_at: string; member_card_number: number | null };
const formattedNumber = (number: number) => `SPF-${String(number).padStart(6, '0')}`;

function MembershipCardPage() {
  const frontRef = useRef<SVGSVGElement>(null);
  const backRef = useRef<SVGSVGElement>(null);
  const [logo, setLogo] = useState('');
  const [member, setMember] = useState<CardMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmReissue, setConfirmReissue] = useState(false);

  useEffect(() => {
    let active = true;
    void loadCardLogo().then((source) => { if (active) setLogo(source); }).catch(() => {
      if (active) setError('Logo colours could not load. Refresh the page before printing this card.');
    });
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
    // Keep desktop's existing print preview, but iOS needs a deliberate second
    // tap to invoke navigator.share with a real PDF File while activation is live.
    const popup = mode === 'open' && !prefersMobileCardShare() ? window.open('about:blank', '_blank') : null;
    setBusy(true); setError('');
    try {
      const pdf = await generateMemberCardPdf(frontRef.current, backRef.current);
      const name = member.full_name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      const filename = `${formattedNumber(member.member_card_number)}-${name}-membership-card.pdf`;
      if (mode === 'save' || prefersMobileCardShare()) saveMemberCardPdf(pdf, filename);
      else if (popup) {
        const url = URL.createObjectURL(pdf);
        popup.location.replace(url);
        window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      } else saveMemberCardPdf(pdf, filename);
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
      {!member.member_card_number && <div className="mt-6 rounded-2xl border border-amber-400/40 bg-[#392c1e] p-5 text-sm leading-6 text-[#ffe6aa]"><strong>ID unavailable:</strong> A permanent member ID has not been assigned. PDF export and replacement are disabled until the member database is updated.</div>}
      {logo && member.member_card_number && <div className="mt-8 grid gap-7 lg:grid-cols-2"><section><h2 className="mb-3 text-sm font-black uppercase tracking-widest">Front · member identification</h2><BatchCardFront member={member as PrintableMember} reference={frontRef} logo={logo}/></section><section><h2 className="mb-3 text-sm font-black uppercase tracking-widest">Back · card instructions</h2><BatchCardBack reference={backRef} logo={logo}/></section></div>}
      <div className="mt-7 rounded-2xl border border-[#44444a] bg-[#232328] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Print-ready files</h2><p className="mt-1 text-sm text-[#c1c0c1]">Two-page PDF: front on page 1 and back on page 2, CR80 finished size 85.6 × 54 mm. Print at 100% scale; ask the card shop whether they require a separate bleed specification.</p><p className="mt-2 text-xs text-[#ffb6a1]">iPhone: After preparing the PDF, tap Save / Share / Print and select Save to Files or Print.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !logo || !member.member_card_number} onClick={() => void exportPdf('save')} className="inline-flex items-center gap-2 rounded-xl bg-[#eb3037] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Download size={17}/>{busy ? 'Preparing…' : 'Download PDF'}</button><button type="button" disabled={busy || !logo || !member.member_card_number} onClick={() => void exportPdf('open')} className="inline-flex items-center gap-2 rounded-xl border border-[#8e8e95] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Printer size={17}/> Open to print</button></div></div></div>
      <section className="mt-5 rounded-2xl border border-[#48444a] bg-[#232328] p-5 sm:p-6"><div className="flex items-start gap-3"><ShieldAlert size={23} className="shrink-0 text-[#ff5b47]"/><div className="min-w-0"><h2 className="font-black">Lost or damaged card?</h2><p className="mt-1 text-sm leading-6 text-[#c1c0c1]">An administrator can invalidate the old QR and issue a replacement without changing the member ID or altering memberships and payments.</p><button disabled={!member.member_card_number || busy} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#ff6657] underline disabled:opacity-40" onClick={() => setConfirmReissue(!confirmReissue)}><RefreshCcw size={16}/> Replace lost card</button></div></div>{confirmReissue && <div className="mt-4 border-t border-[#53535a] pt-4"><label className="block text-sm font-bold">Audit reason (required)<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} placeholder="For example: Member reported card lost" className="mt-2 block w-full rounded-xl border border-[#85858a] bg-[#161619] p-3 text-sm text-white"/></label><button onClick={() => void reissue()} disabled={busy || reason.trim().length < 8} className="mt-3 rounded-xl bg-[#e63235] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Invalidate old QR and reissue</button></div>}</section>
    </>}
  </div></main>;
}
