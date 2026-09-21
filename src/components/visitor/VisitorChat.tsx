import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { contact } from '@/lib/site-data';
import { supabase } from '@/lib/supabase';
import { answerVisitorQuestion, type PublicArticle } from '@/lib/visitor-guide';

type ChatMessage = { id: number; sender: 'guide' | 'visitor'; text: string; href?: string; linkLabel?: string };
const greeting = 'Hi! 👋 Welcome to Super Plus Fitness & Spa. Ask me about membership prices, opening hours, registration, facilities, training, spa or HMO partners.';
const suggestions = [
  'How much is the monthly plan?',
  'What are your opening hours?',
  'How do I join?',
  'Do you accept HMOs?',
];

/** This is a public-site knowledge guide, not an AI service or a live support agent. */
export function VisitorChat() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 0, sender: 'guide', text: greeting }]);
  const [articles, setArticles] = useState<PublicArticle[]>([]);
  const [previousId, setPreviousId] = useState<string | null>(null);
  const nextId = useRef(1);
  const articleLoaded = useRef(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || articleLoaded.current) return;
    articleLoaded.current = true;
    let mounted = true;
    // Only published articles; never use private member, payment or staff data.
    void supabase.from('blog_posts').select('title,slug,excerpt,category,published_at')
      .eq('status', 'published').not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }).limit(80)
      .then(({ data, error }) => {
        if (mounted && !error) setArticles((data || []) as PublicArticle[]);
      });
    return () => { mounted = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    // Avoid unexpectedly opening the mobile keyboard just because the visitor tapped the launcher.
    if (messages.length === 1 && window.matchMedia('(min-width: 640px)').matches) input.current?.focus();
  }, [messages, open]);

  function closeChat() { setOpen(false); launcher.current?.focus(); }
  function resetChat() { setMessages([{ id: nextId.current++, sender: 'guide', text: greeting }]); setPreviousId(null); setDraft(''); }
  function ask(raw: string) {
    const question = raw.trim().slice(0, 300);
    if (!question) return;
    const reply = answerVisitorQuestion(question, previousId, articles);
    setMessages(current => [...current, { id: nextId.current++, sender: 'visitor', text: question }, { id: nextId.current++, sender: 'guide', text: reply.text, href: reply.href, linkLabel: reply.linkLabel }].slice(-32));
    if (reply.confident && reply.id !== 'hello') setPreviousId(reply.id);
    setDraft('');
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); ask(draft); }

  return <div className="pointer-events-none fixed inset-0 z-[80]" aria-label="Super Plus visitor assistance">
    {open && <section role="dialog" aria-modal="false" aria-labelledby="visitor-chat-title" onKeyDown={event => { if (event.key === 'Escape') closeChat(); }} className="pointer-events-auto absolute bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-2 flex h-[min(620px,calc(100dvh-7rem))] w-[calc(100vw-1rem)] max-w-[390px] flex-col overflow-hidden rounded-[22px] border border-[#dce4d8] bg-[#fafcf8] text-[#17271e] shadow-[0_20px_75px_rgba(0,0,0,.26)] sm:right-5" >
      <header className="flex shrink-0 items-center gap-3 bg-[#193226] px-4 py-4 text-white">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e84936] text-white"><Sparkles aria-hidden="true" size={22}/></span>
        <div className="min-w-0 flex-1"><h2 id="visitor-chat-title" className="font-display text-[21px] font-extrabold uppercase leading-none">Ask Super Plus</h2><p className="mt-1 text-[11px] font-medium text-[#cfe3d2]">Website guide · instant answers</p></div>
        <button type="button" aria-label="Start a new chat" title="Start a new chat" onClick={resetChat} className="grid size-10 shrink-0 place-items-center rounded-xl text-white/85 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><RotateCcw size={18}/></button>
        <button type="button" aria-label="Close chat" onClick={closeChat} className="grid size-10 shrink-0 place-items-center rounded-xl text-white/85 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><X size={22}/></button>
      </header>
      <div className="shrink-0 border-b border-[#dfe6db] bg-[#eaf3e7] px-4 py-2 text-[11px] leading-[1.5] text-[#4c6652]">Answers use public website information. I cannot access accounts, take payments or provide live support. Please don't share passwords, OTPs or card details.</div>
      <div role="log" aria-label="Visitor chat messages" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3.5 py-5 [scrollbar-width:thin] sm:px-4">
        {messages.map(message => <div key={message.id} className={`flex ${message.sender === 'visitor' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[90%] rounded-2xl px-4 py-3 text-[13px] leading-[1.65] shadow-sm ${message.sender === 'visitor' ? 'rounded-br-sm bg-[#1e3d2c] text-white' : 'rounded-bl-sm border border-[#e2e9de] bg-white text-[#283a2b]'}`}><p className="whitespace-pre-line break-words">{message.text}</p>{message.href && <a href={message.href} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#edf5e8] px-3 py-1.5 text-xs font-extrabold text-[#286038] underline decoration-[#9cb99b] underline-offset-2 hover:bg-[#e0efda] focus-visible:outline-2 focus-visible:outline-[#286038]">{message.linkLabel || 'View website page'} <ArrowUpRight aria-hidden="true" size={14}/></a>}</div></div>)}
        {messages.length === 1 && <div className="space-y-2"><p className="pl-1 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#708074]">Try asking</p><div className="grid gap-2">{suggestions.map(question => <button key={question} type="button" onClick={() => ask(question)} className="min-h-10 rounded-xl border border-[#d5e4d1] bg-white px-3 py-2 text-left text-xs font-bold text-[#315e3e] transition hover:border-[#78a479] hover:bg-[#f2f8ef] focus-visible:outline-2 focus-visible:outline-[#315e3e]">{question} <span aria-hidden="true">↗</span></button>)}</div></div>}
        <div ref={bottom} aria-hidden="true"/>
      </div>
      <div className="shrink-0 border-t border-[#e0e6dc] bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl border border-[#cbd9c8] bg-[#fafcf9] p-1.5 focus-within:border-[#3f7948] focus-within:ring-2 focus-within:ring-[#3f7948]/10">
          <input ref={input} aria-label="Your question about Super Plus Fitness" value={draft} onChange={event => setDraft(event.target.value)} maxLength={300} placeholder="Ask a question…" className="min-h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-[#1e3222] outline-none placeholder:text-[#7a897e]"/>
          <button type="submit" aria-label="Send question" disabled={!draft.trim()} className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e84936] text-white transition hover:bg-[#ce3c2c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e84936] disabled:cursor-not-allowed disabled:opacity-40"><Send size={17}/></button>
        </form>
        <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-[#65796a]">Need a person? <a href={contact.whatsapp} target="_blank" rel="noopener noreferrer" className="font-extrabold text-[#277647] underline underline-offset-2">Chat with reception on WhatsApp <ArrowUpRight aria-hidden="true" className="inline size-3"/></a></div>
      </div>
    </section>}
    <button ref={launcher} type="button" onClick={() => setOpen(value => !value)} aria-label={open ? 'Close visitor chat' : 'Chat with Super Plus website guide'} aria-expanded={open} aria-controls="super-plus-chat-panel" className="pointer-events-auto absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 flex min-h-14 items-center gap-2 rounded-full border-2 border-white bg-[#e84936] px-4 text-sm font-extrabold text-white shadow-[0_10px_35px_rgba(30,35,30,.27)] transition hover:-translate-y-0.5 hover:bg-[#d53c2a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e84936] motion-reduce:transform-none sm:right-6">
      {open ? <X aria-hidden="true" size={22}/> : <MessageCircle aria-hidden="true" size={23}/>}<span>{open ? 'Close' : 'Ask us'}</span>
    </button>
  </div>;
}
