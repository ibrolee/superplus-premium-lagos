import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckSquare, CreditCard, Download, Loader2, Printer, RefreshCw, Search, Square, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BatchCardBack, BatchCardFront, cardNumber, loadCardLogo, type PrintableMember } from '@/components/member-card/CardArtwork';
import { generateMemberCardBatchPdf, saveBatchPdf } from '@/lib/member-card-batch-pdf';

export const Route = createFileRoute('/management-member-cards')({ component: MembershipCardDesk });
type Member = PrintableMember & { phone: string | null; email: string | null };
type Plan = { member_id: string; start_date: string | null; end_date: string | null; status: string | null; payment_status: string | null };
type Filter = 'all' | 'active' | 'expired' | 'other' | 'none';
type MemberStatus = Exclude<Filter, 'all'>;
const CHUNK = 25;
const PAGE_SIZE = 500;
function lagosToday() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function currentPaidPlan(plan: Plan, day: string) {
  return plan.status?.toLowerCase() === 'active' && plan.payment_status?.toLowerCase() === 'paid' &&
    Boolean(plan.start_date && plan.end_date && plan.start_date.slice(0, 10) <= day && plan.end_date.slice(0, 10) >= day);
}
function classify(plans: Plan[], day: string): MemberStatus {
  if (!plans.length) return 'none';
  if (plans.some((plan) => currentPaidPlan(plan, day))) return 'active';
  if (plans.some((plan) => plan.end_date && plan.end_date.slice(0, 10) < day)) return 'expired';
  return 'other';
}
async function fetchAll<T>(table: 'members' | 'memberships', columns: string): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select(columns).order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    result.push(...batch);
    if (batch.length < PAGE_SIZE) return result;
  }
}
function MembershipCardDesk() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [logo, setLogo] = useState('');
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchIndex, setBatchIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [lastExport, setLastExport] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const today = lagosToday();
  const reload = useRef(0);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setAuthorized(false);
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error('Sign in to the Admin Portal first.');
        const { data: staff, error: staffError } = await supabase.from('staff_users').select('role,active').eq('auth_user_id', auth.user.id).maybeSingle();
        if (staffError || !staff?.active || String(staff.role).toLowerCase() !== 'admin') throw new Error('Only an active administrator can access membership card printing.');
        if (cancelled) return;
        setAuthorized(true);
        const [people, membershipRows, loadedLogo] = await Promise.all([
          fetchAll<Member>('members', 'id,full_name,phone,email,qr_token,member_card_number'),
          fetchAll<Plan>('memberships', 'member_id,start_date,end_date,status,payment_status'),
          loadCardLogo(),
        ]);
        if (cancelled) return;
        const printable = people.filter((item) => item.id && item.qr_token && Number.isInteger(item.member_card_number) && item.member_card_number > 0);
        printable.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '') || a.member_card_number - b.member_card_number);
        setMembers(printable); setPlans(membershipRows); setLogo(loadedLogo);
        setSelected(new Set()); setBatchIndex(0); setLastExport('');
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load the card directory.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [revision]);

  const status = useMemo(() => {
    const grouped = new Map<string, Plan[]>();
    for (const plan of plans) grouped.set(plan.member_id, [...(grouped.get(plan.member_id) || []), plan]);
    return new Map(members.map((member) => [member.id, classify(grouped.get(member.id) || [], today)]));
  }, [members, plans, today]);
  const counts = useMemo(() => {
    const totals: Record<MemberStatus, number> = { active: 0, expired: 0, other: 0, none: 0 };
    for (const member of members) totals[status.get(member.id) || 'none']++;
    return totals;
  }, [members, status]);
  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return members.filter((member) => (filter === 'all' || status.get(member.id) === filter) &&
      (!needle || [member.full_name || '', member.phone || '', member.email || '', cardNumber(member.member_card_number)]
        .some((value) => value.toLowerCase().includes(needle))));
  }, [members, filter, term, status]);
  const picked = useMemo(() => members.filter((member) => selected.has(member.id)), [members, selected]);
  const totalBatches = Math.ceil(picked.length / CHUNK);
  const safeBatch = Math.min(batchIndex, Math.max(0, totalBatches - 1));
  const current = picked.slice(safeBatch * CHUNK, (safeBatch + 1) * CHUNK);

  function updateSelection(next: Set<string>) { setSelected(next); setBatchIndex(0); setLastExport(''); setExportError(''); }
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    updateSelection(next);
  }
  function selectVisible() { updateSelection(new Set(visible.map((member) => member.id))); }
  function selectActive() {
    setFilter('active'); setTerm('');
    updateSelection(new Set(members.filter((member) => status.get(member.id) === 'active').map((member) => member.id)));
  }
  async function downloadBatch() {
    if (!authorized || exporting || !logo || !current.length) return;
    setExportError(''); setLastExport(''); setExporting(true);
    try {
      const nodes = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-print-member]') || []);
      if (nodes.length !== current.length) throw new Error('Card previews are not ready. Please try again.');
      const pairs = nodes.map((node) => {
        const front = node.querySelector<SVGSVGElement>('[data-card-side="front"]');
        const back = node.querySelector<SVGSVGElement>('[data-card-side="back"]');
        if (!front || !back) throw new Error('A selected card is incomplete. Please refresh before printing.');
        return { front, back };
      });
      const pdf = await generateMemberCardBatchPdf(pairs);
      saveBatchPdf(pdf, `superplus-membership-cards-batch-${safeBatch + 1}-of-${totalBatches}.pdf`);
      setLastExport(`Batch ${safeBatch + 1} of ${totalBatches} prepared: ${current.length} cards, ${current.length * 2} PDF pages.`);
      if (safeBatch + 1 < totalBatches) setBatchIndex(safeBatch + 1);
    } catch (cause) { setExportError(cause instanceof Error ? cause.message : 'Could not generate the batch PDF.'); }
    finally { setExporting(false); }
  }

  return <main className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#162b20] sm:px-7 sm:py-12"><div className="mx-auto max-w-6xl">
    <a href="/staff-admin" className="inline-flex items-center gap-2 text-sm font-bold text-[#3e6b49]"><ArrowLeft size={17}/> Back to Admin Portal</a>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.17em] text-[#64836a]">Admin tools · Membership cards</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Membership ID Card Desk</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#65776a]">Search, filter, select and prepare the approved two-sided plastic cards. Nothing here changes membership or payment records.</p></div><a href="/management-profiles" className="inline-flex items-center gap-2 rounded-xl border border-[#cbdaca] bg-white px-4 py-3 text-sm font-bold"><Users size={17}/> Member profiles</a></div>
    {loading && <p role="status" className="mt-7 flex items-center gap-2 rounded-2xl bg-white p-6 text-sm"><Loader2 size={18} className="animate-spin"/> Checking admin access and loading members…</p>}
    {error && <p role="alert" className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error} <a href="/portal" className="font-bold underline">Portal sign-in</a></p>}
    {authorized && !loading && !error && <>
      <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Membership card counts">
        {[{ label: 'All members', value: members.length }, { label: 'Active and paid', value: counts.active }, { label: 'Expired', value: counts.expired }, { label: 'Other / no plan', value: counts.other + counts.none }].map((item) => <div key={item.label} className="rounded-2xl border border-[#e0e9dd] bg-white p-4"><p className="text-xs font-bold uppercase text-[#6b7c6c]">{item.label}</p><p className="mt-1 text-3xl font-black">{item.value}</p></div>)}
      </section>
      <section className="mt-5 rounded-2xl border border-[#e0e9dd] bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Find cards to print</h2><p className="text-sm text-[#65776a]">Active = a paid, active plan covering today in Lagos.</p></div><button type="button" onClick={() => { reload.current += 1; setRevision(reload.current); }} className="inline-flex items-center gap-2 rounded-xl border border-[#d4dfcf] px-3 py-2 text-sm font-bold"><RefreshCw size={16}/> Refresh records</button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]"><label className="relative block"><Search size={18} className="absolute left-3 top-3.5 text-[#667b6a]"/><span className="sr-only">Search member name, phone, email or ID</span><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search name, phone or member ID" className="min-h-11 w-full rounded-xl border border-[#cbdaca] px-10 py-3 text-sm outline-none focus:border-[#376744]"/></label><label className="block"><span className="sr-only">Membership status</span><select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="min-h-11 w-full rounded-xl border border-[#cbdaca] bg-white p-3 text-sm font-bold"><option value="all">All members</option><option value="active">Active and paid</option><option value="expired">Expired</option><option value="other">Paused / other</option><option value="none">No membership</option></select></label></div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={selectVisible} disabled={!visible.length} className="rounded-lg bg-[#193328] px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><CheckSquare size={15} className="mr-1 inline"/> Select all {visible.length} matching</button><button type="button" onClick={selectActive} disabled={!counts.active} className="rounded-lg bg-[#b8ee73] px-4 py-2.5 text-xs font-black text-[#193328] disabled:opacity-40">Select all active ({counts.active})</button><button type="button" onClick={() => updateSelection(new Set())} disabled={!selected.size} className="rounded-lg border border-[#d2dfce] px-4 py-2.5 text-xs font-bold disabled:opacity-40">Clear selection</button><span className="ml-auto text-xs font-bold text-[#49624f]">{visible.length} shown · {selected.size} selected</span></div>
        <div className="mt-4 max-h-[550px] overflow-y-auto rounded-xl border border-[#dfebdc]" role="group" aria-label="Members available for card printing">{visible.length === 0 ? <p className="p-6 text-sm text-[#65776a]">No matching members. Try another search or filter.</p> : visible.map((member) => <div key={member.id} className="flex flex-wrap items-center gap-3 border-b border-[#e6eee3] p-3 last:border-b-0 sm:p-4"><button type="button" onClick={() => toggle(member.id)} aria-pressed={selected.has(member.id)} aria-label={`${selected.has(member.id) ? 'Deselect' : 'Select'} ${member.full_name || cardNumber(member.member_card_number)}`} className="shrink-0 text-[#376744]">{selected.has(member.id) ? <CheckSquare size={25}/> : <Square size={25}/>}</button><div className="min-w-0 flex-1"><p className="break-words text-sm font-black">{member.full_name || 'Unnamed member'}</p><p className="mt-1 text-xs text-[#6e7c70]">{cardNumber(member.member_card_number)} · {member.phone || 'No phone'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${status.get(member.id) === 'active' ? 'bg-[#def6c7] text-[#254b2f]' : 'bg-[#eff1ed] text-[#526458]'}`}>{status.get(member.id) === 'none' ? 'No plan' : status.get(member.id) === 'other' ? 'Not active' : status.get(member.id)}</span><a href={`/management-member-card?memberId=${encodeURIComponent(member.id)}`} className="inline-flex items-center gap-1 rounded-lg border border-[#d4dfcf] px-3 py-2 text-xs font-bold"><CreditCard size={14}/> Card</a></div>)}</div>
      </section>
      <section className="mt-5 rounded-2xl border border-[#e4bba9] bg-[#242126] p-5 text-white sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#ff916d]">Batch print</p><h2 className="mt-1 text-xl font-black">{picked.length} card{picked.length === 1 ? '' : 's'} selected</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#ded7d9]">PDF has the approved front and back for each member in order, on separate CR80-size pages (85.6 × 54 mm). Print at 100% scale; confirm double-sided orientation with the print shop.</p>{picked.length > CHUNK && <p className="mt-2 text-xs font-bold text-[#ffd6c4]">For reliable mobile downloads, files contain up to {CHUNK} members each. {totalBatches} files in total; download each batch in order.</p>}</div><button type="button" disabled={!picked.length || exporting || !logo} onClick={() => void downloadBatch()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#ff6841] px-5 py-3 text-sm font-black text-white disabled:opacity-40">{exporting ? <Loader2 size={19} className="animate-spin"/> : <Download size={19}/>} {exporting ? 'Preparing PDF…' : `Download batch ${safeBatch + 1} of ${Math.max(totalBatches, 1)} (${current.length} cards)`}</button></div>
        {totalBatches > 1 && <div className="mt-4 flex flex-wrap items-center gap-2"><button onClick={() => setBatchIndex((index) => Math.max(0, index - 1))} disabled={exporting || safeBatch === 0} className="rounded-lg border border-white/30 px-3 py-2 text-xs font-bold disabled:opacity-30">Previous batch</button><span className="text-xs">Batch {safeBatch + 1} / {totalBatches}</span><button onClick={() => setBatchIndex((index) => Math.min(totalBatches - 1, index + 1))} disabled={exporting || safeBatch === totalBatches - 1} className="rounded-lg border border-white/30 px-3 py-2 text-xs font-bold disabled:opacity-30">Next batch</button></div>}
        {lastExport && <p role="status" className="mt-4 rounded-xl border border-emerald-600/30 bg-emerald-950 p-3 text-sm text-emerald-100">{lastExport}</p>}{exportError && <p role="alert" className="mt-4 rounded-xl border border-red-400 bg-red-950 p-3 text-sm text-red-100">{exportError}</p>}
        <div className="mt-4 flex items-center gap-2 text-xs text-[#dcced0]"><Printer size={16}/> Open the downloaded PDF to print or send it to your card printer.</div>
      </section>
      {/* Only the current 25-card chunk is mounted, avoiding hundreds of high-resolution SVGs on phones. */}
      <div ref={rootRef} aria-hidden="true" style={{ position: 'absolute', width: 856, left: -100000, top: 0, pointerEvents: 'none' }}>{current.map((member) => <div data-print-member={member.id} key={member.id}><BatchCardFront member={member} logo={logo}/><BatchCardBack logo={logo}/></div>)}</div>
    </>}
  </div></main>;
}
