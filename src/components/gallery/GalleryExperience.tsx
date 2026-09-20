import { Link } from '@tanstack/react-router';
import { ArrowRight, Images, Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

type GalleryItem = { id: string; title: string; category: string; media_type: 'image' | 'video'; storage_path: string; sort_order: number; created_at: string };
type DisplayItem = { id: string; title: string; category: string; media_type: 'image' | 'video'; url: string };
const categories = ['All', 'Gym', 'Equipment', 'Training', 'Classes', 'Spa & Recovery', 'Events'];

/** Show only uploaded, published media. Never fall back to hardcoded facility photos. */
function useGallery() {
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data, error } = await supabase.from('gallery_media').select('id,title,category,media_type,storage_path,sort_order,created_at').eq('is_published', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false });
        if (!alive) return;
        if (error) console.error('Unable to load gallery media', error);
        else setItems(((data || []) as GalleryItem[]).map(item => ({ id: item.id, title: item.title, category: item.category, media_type: item.media_type, url: supabase.storage.from('gallery-media').getPublicUrl(item.storage_path).data.publicUrl })));
      } catch (error) {
        if (alive) console.error('Unable to load gallery media', error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);
  return { items, loading };
}
function MediaTile({ item, onOpen, priority = false }: { item: DisplayItem; onOpen: () => void; priority?: boolean }) {
  return <button type="button" onClick={onOpen} aria-label={`View ${item.title}`} className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[1.4rem] bg-zinc-800 text-left shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary sm:aspect-[5/4]">
    {item.media_type === 'video' ? <video src={`${item.url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <img src={item.url} alt={item.title} loading={priority ? 'eager' : 'lazy'} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
    <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
    {item.media_type === 'video' && <span className="absolute left-4 top-4 grid size-12 place-items-center rounded-full border border-white/50 bg-black/40 text-white backdrop-blur"><Play className="size-5 fill-current" /></span>}
    <span className="absolute bottom-5 left-5 right-5 text-white"><span className="block text-[10px] font-bold uppercase tracking-[.18em] text-red-300">{item.category}</span><span className="mt-1 block font-display text-2xl font-extrabold uppercase leading-tight">{item.title}</span></span>
  </button>;
}
function Viewer({ item, close }: { item: DisplayItem; close: () => void }) {
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); }; document.addEventListener('keydown', onKey); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = old; }; }, [close]);
  return <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 p-4 text-white" role="dialog" aria-modal="true" aria-label={item.title} onClick={close}>
    <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 py-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">{item.category}</p><h2 className="font-display text-xl font-bold uppercase">{item.title}</h2></div><button onClick={close} aria-label="Close gallery viewer" className="grid size-12 place-items-center rounded-full border border-white/30"><X /></button></div>
    <div className="flex min-h-0 flex-1 items-center justify-center" onClick={event => event.stopPropagation()}>{item.media_type === 'video' ? <video src={item.url} controls autoPlay playsInline className="max-h-full max-w-full rounded-xl" /> : <img src={item.url} alt={item.title} className="max-h-full max-w-full rounded-xl object-contain" />}</div>
  </div>;
}
export function GalleryExperience({ compact = false }: { compact?: boolean }) {
  const { items, loading } = useGallery();
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<DisplayItem | null>(null);
  const visible = (filter === 'All' ? items : items.filter(item => item.category === filter)).slice(0, compact ? 4 : undefined);
  return <section className="overflow-hidden bg-[#191615] py-16 text-white sm:py-24" aria-label="Super Plus Fitness Gallery">
    <div className="section-shell">
      <div className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-3 text-xs font-bold uppercase tracking-[.23em] text-primary">Inside Super Plus Fitness</p><h1 className="font-display text-5xl font-black uppercase leading-[.92] tracking-tight sm:text-7xl">See the space.<br /><span className="text-primary">Feel the energy.</span></h1><p className="mt-5 max-w-lg text-sm leading-7 text-white/65">Explore our facilities, equipment, classes and moments from the gym.</p></div></div>
      {!compact && <div className="mb-8 flex gap-2 overflow-x-auto pb-3" role="group" aria-label="Filter gallery media">{categories.map(category => <button type="button" key={category} onClick={() => setFilter(category)} aria-pressed={filter === category} className={`shrink-0 rounded-full border px-5 py-2.5 text-xs font-bold transition-colors ${filter === category ? 'border-primary bg-primary text-white' : 'border-white/20 bg-white/5 text-white/80 hover:border-primary'}`}>{category}</button>)}</div>}
      {loading ? <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-16 text-center text-sm text-white/65" role="status">Loading gallery…</div> : visible.length ? <div className={`grid gap-3 sm:gap-4 ${compact ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>{visible.map((item, index) => <MediaTile key={item.id} item={item} priority={index === 0} onOpen={() => setSelected(item)} />)}</div> : <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-16 text-center"><Images className="mx-auto mb-3 size-9 text-primary" /><p className="text-lg font-semibold">No photos or videos published yet.</p><p className="mt-2 text-sm text-white/50">Check back as our gallery grows.</p></div>}
      {compact && <Button asChild size="lg" variant="inverse" className="mt-8 w-full sm:w-auto"><Link to="/gallery">View the gallery <ArrowRight /></Link></Button>}
      {!compact && <p className="mt-8 text-xs text-white/45">Gallery media is uploaded and managed by Super Plus Fitness.</p>}
    </div>
    {selected && <Viewer item={selected} close={() => setSelected(null)} />}
  </section>;
}
