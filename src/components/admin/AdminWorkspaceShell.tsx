import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, BookOpen, CalendarDays, ChevronDown, ChevronRight, CreditCard, FileDown, Images, LayoutDashboard, Menu, Search, ShieldCheck, UserRound, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
type Tool = { label:string;href:string;icon:LucideIcon;keywords?:string;adminOnly?:boolean;ownerOrAdmin?:boolean };
type Group = { name:string;icon:LucideIcon;tools:Tool[] };
/** Reception handles all registration and renewal directly; the management menu focuses on oversight and staff requests. */
export const adminGroups:Group[] = [
 {name:'Overview',icon:LayoutDashboard,tools:[{label:'Dashboard',href:'/admin-workspace',icon:LayoutDashboard,keywords:'home revenue summary'}]},
 {name:'Staff requests',icon:ShieldCheck,tools:[
  {label:'Staff requests',href:'/admin-approvals',icon:ShieldCheck,keywords:'employee attendance account requests'},
  {label:'Staff account requests',href:'/staff-account-requests',icon:Users,adminOnly:true,keywords:'employee authorisation approve reject'},
  {label:'Missed-scan requests',href:'/staff-missed-scans',icon:CalendarDays,adminOnly:true,keywords:'staff missed scan'},
 ]},
 {name:'Finance',icon:Wallet,tools:[
  {label:'Revenue report',href:'/management-revenue',icon:Wallet,keywords:'sales payments income revenue'},
  {label:'Original financial report',href:'/staff-admin#revenue',icon:Wallet,keywords:'ledger historical baseline'},
 ]},
 {name:'Members',icon:Users,tools:[
  {label:'Members list',href:'/admin-members',icon:Users,keywords:'search directory'},
  {label:'Member profiles',href:'/management-profiles',icon:UserRound,keywords:'history'},
  {label:'Member ID cards',href:'/management-member-cards',icon:CreditCard,adminOnly:true,keywords:'print card'},
  {label:'Historical members',href:'/staff-admin#members',icon:ShieldCheck,adminOnly:true,keywords:'admin import excluded revenue'},
 ]},
 {name:'Attendance',icon:Activity,tools:[
  {label:'Member attendance report',href:'/management-attendance',icon:Activity,keywords:'visits records'},
  {label:'Attendance export',href:'/management-attendance-export',icon:FileDown,keywords:'download csv'},
 ]},
 {name:'Team & payroll',icon:Users,tools:[
  {label:'Staff directory',href:'/management-staff',icon:Users,keywords:'employees'},
  {label:'Manage staff profiles',href:'/staff-admin#staff',icon:ShieldCheck,keywords:'roles salaries'},
  {label:'Staff attendance report',href:'/management-staff',icon:CalendarDays,keywords:'daily attendance staff clock in clock out'},
  {label:'Monthly attendance',href:'/management-staff-monthly',icon:CalendarDays,keywords:'hours shifts'},
  {label:'QR attendance review',href:'/management-staff-review',icon:ShieldCheck,keywords:'employee QR'},
  {label:'Payroll records',href:'/management-payroll',icon:Wallet,keywords:'wages'},
  {label:'Payroll export',href:'/management-payroll-export',icon:FileDown,keywords:'download'},
 ]},
 {name:'Website',icon:Images,tools:[
  {label:'Gallery',href:'/staff-gallery',icon:Images,keywords:'photos media'},
  {label:'Blog',href:'/staff-blog',icon:BookOpen,keywords:'articles posts'},
 ]},
];
export function canSeeAdminTool(tool:Tool,role:string|null){return !!role&&(!tool.adminOnly||role==='admin')&&(!tool.ownerOrAdmin||role==='admin'||role==='owner');}
type MemberHit={id:string;full_name:string|null;phone:string|null;email:string|null};
const cleanSearch=(value:string)=>value.trim().replace(/[%_,()\\]/g,' ').trim();
export function AdminWorkspaceShell({title,subtitle,active,children}:{title:string;subtitle?:string;active:string;children:ReactNode}){
 const [role,setRole]=useState<string|null>(null),[checking,setChecking]=useState(true),[accessError,setAccessError]=useState('');
 const [mobileOpen,setMobileOpen]=useState(false),[expanded,setExpanded]=useState<Record<string,boolean>>({Overview:true,'Staff requests':true});
 const [searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState(''),[members,setMembers]=useState<MemberHit[]>([]),[searchError,setSearchError]=useState(''),[searching,setSearching]=useState(false);
 useEffect(()=>{let cancelled=false;void(async()=>{try{
  const{data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)throw Error('Sign in through the admin portal.');
  const{data:staff,error}=await supabase.from('staff_users').select('role,active').eq('auth_user_id',auth.user.id).maybeSingle();if(error)throw error;
  const next=String(staff?.role||'').toLowerCase();if(!staff?.active||!['admin','owner','manager'].includes(next))throw Error('An active management account is required.');if(!cancelled)setRole(next);
 }catch(cause){if(!cancelled)setAccessError(cause instanceof Error?cause.message:'Unable to check access.');}finally{if(!cancelled)setChecking(false);}})();return()=>{cancelled=true;};},[]);
 const toolResults=useMemo(()=>{const needle=query.trim().toLowerCase();return !needle||!role?[]:adminGroups.flatMap(group=>group.tools.filter(tool=>canSeeAdminTool(tool,role)&&`${tool.label} ${tool.keywords||''} ${group.name}`.toLowerCase().includes(needle))).slice(0,12);},[query,role]);
 useEffect(()=>{const term=cleanSearch(query);if(!role||!searchOpen||term.length<2){setMembers([]);setSearching(false);setSearchError('');return;}
  let cancelled=false;setMembers([]);setSearching(true);setSearchError('');const timer=setTimeout(()=>{void(async()=>{try{const{data,error}=await supabase.from('members').select('id,full_name,phone,email').or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`).order('full_name',{ascending:true}).limit(8);if(error)throw error;if(!cancelled)setMembers((data||[]) as MemberHit[]);}catch(cause){if(!cancelled){setMembers([]);setSearchError(cause instanceof Error?cause.message:'Member search unavailable.');}}finally{if(!cancelled)setSearching(false);}})();},250);return()=>{cancelled=true;clearTimeout(timer);};},[query,role,searchOpen]);
 const sidebar=<><a href="/admin-workspace" onClick={()=>setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-2 py-2"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#b8ee73] text-lg font-black text-[#193327]">S+</span><span><strong className="block text-sm tracking-wide">SUPER PLUS</strong><span className="text-[11px] text-[#b9c9be]">Admin workspace</span></span></a>
  <nav aria-label="Admin navigation" className="mt-7 min-h-0 flex-1 space-y-2 overflow-y-auto pb-5">{adminGroups.map(group=>{const Icon=group.icon,tools=group.tools.filter(tool=>canSeeAdminTool(tool,role));const open=expanded[group.name]??tools.some(tool=>tool.href.split('#')[0]===active);return <div key={group.name} className="rounded-xl border border-white/10"><button type="button" aria-expanded={open} onClick={()=>setExpanded(previous=>({...previous,[group.name]:!open}))} className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-white/10"><span className="flex items-center gap-3"><Icon size={17} className="text-[#b8ee73]"/>{group.name}</span><ChevronDown size={15} className={open?'rotate-180':''}/></button>{open&&<div className="space-y-0.5 px-2 pb-2">{tools.map(tool=>{const SelectedIcon=tool.icon;return <a href={tool.href} key={`${tool.href}-${tool.label}`} onClick={()=>setMobileOpen(false)} aria-current={active===tool.href?'page':undefined} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${active===tool.href?'bg-[#b8ee73] text-[#193327]':'text-[#d5e3d8] hover:bg-white/10'}`}><SelectedIcon size={15} className="shrink-0"/>{tool.label}</a>;})}</div>}</div>;})}</nav>
  <a href="/reception-workspace" className="mt-3 rounded-xl border border-white/20 px-4 py-3 text-xs font-bold text-[#d5e3d8] hover:bg-white/10">Switch to Reception Dashboard ↗</a></>;
 if(checking)return <main role="status" className="min-h-screen bg-[#f4f6f1] p-8 text-sm">Checking management access…</main>;
 if(!role)return <main className="min-h-screen bg-[#f4f6f1] p-8"><div role="alert" className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-7 text-red-800">{accessError||'Access denied.'} <a href="/portal/admin" className="font-bold underline">Admin sign-in</a></div></main>;
 return <div className="min-h-screen bg-[#f4f6f1] text-[#16221c] lg:flex">
  {mobileOpen&&<button type="button" aria-label="Close menu" onClick={()=>setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/50 lg:hidden"/>}
  <aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(85vw,300px)] flex-col overflow-y-auto bg-[#152820] p-5 text-white transition-transform lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:w-[270px] lg:shrink-0 lg:translate-x-0 ${mobileOpen?'translate-x-0':'-translate-x-full'}`}><button type="button" aria-label="Close menu" onClick={()=>setMobileOpen(false)} className="absolute right-4 top-5 rounded-lg p-2 hover:bg-white/10 lg:hidden"><X size={20}/></button>{sidebar}</aside>
  <div className="min-w-0 flex-1"><header className="sticky top-0 z-30 border-b border-[#e1e8dd] bg-[#f4f6f1]/95 px-4 py-3 backdrop-blur sm:px-7 lg:px-10"><div className="mx-auto flex max-w-[1400px] items-center gap-3"><button type="button" aria-label="Open menu" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)} className="rounded-xl border border-[#d8e2d5] bg-white p-2.5 lg:hidden"><Menu size={21}/></button><span className="hidden min-w-0 flex-1 text-xs font-bold text-[#526b57] sm:block">SUPER PLUS / ADMIN</span><button type="button" aria-expanded={searchOpen} onClick={()=>setSearchOpen(open=>!open)} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-3 py-2.5 text-left text-sm text-[#647468] sm:max-w-[450px]"><Search size={17}/><span className="truncate">Search tools or members</span></button><span className="hidden rounded-full bg-[#edf6e7] px-3 py-2 text-xs font-bold capitalize text-[#356942] sm:block">{role}</span></div>
   {searchOpen&&<div className="relative mx-auto mt-3 max-w-[1400px]"><div className="rounded-2xl border border-[#d8e2d5] bg-white p-3 shadow-lg"><label className="flex items-center gap-2 rounded-xl bg-[#f4f6f1] px-3"><Search size={18}/><span className="sr-only">Search admin tools and members</span><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Revenue, staff request, member name or phone" className="w-full min-w-0 bg-transparent py-3 text-sm outline-none"/></label>{!!query.trim()&&<div className="mt-3 max-h-[55vh] overflow-y-auto"><p className="px-2 py-2 text-[11px] font-black uppercase tracking-wider text-[#6b806c]">Tools & actions</p>{toolResults.map(tool=><a href={tool.href} key={`${tool.href}-${tool.label}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#edf6e7]"><ChevronRight size={15}/>{tool.label}</a>)}{!toolResults.length&&<p className="px-3 py-2 text-xs text-[#66766a]">No matching tool.</p>}<p className="mt-2 px-2 py-2 text-[11px] font-black uppercase tracking-wider text-[#6b806c]">Members</p>{searching&&<p role="status" className="px-3 text-xs">Searching members…</p>}{searchError&&<p role="alert" className="px-3 text-xs text-red-700">{searchError}</p>}{!searching&&members.map(member=><a key={member.id} href={`/reception-member/${encodeURIComponent(member.id)}`} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#edf6e7]"><span className="min-w-0"><strong className="block truncate">{member.full_name||'Unnamed member'}</strong><span className="block truncate text-xs text-[#66766a]">{member.phone||member.email||'No contact'}</span></span><ChevronRight size={16}/></a>)}{!searching&&cleanSearch(query).length>=2&&!members.length&&!searchError&&<p className="px-3 text-xs">No matching members.</p>}<a href="/admin-members" className="mt-2 block rounded-xl bg-[#edf6e7] px-3 py-3 text-xs font-bold text-[#356942]">Open full members list →</a></div>}</div></div>}</header>
   <main className="mx-auto max-w-[1480px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10"><p className="text-xs font-black uppercase tracking-[.17em] text-[#65905c]">Super Plus / Admin</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>{subtitle&&<p className="mt-2 text-sm text-[#637469]">{subtitle}</p>}{children}</main>
  </div></div>;
}
