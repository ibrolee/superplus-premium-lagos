import { type ReactNode, useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Activity, ArrowUpRight, Cake, CalendarDays, ClipboardList, CreditCard, Download, LayoutDashboard, ScanLine, Users, UserPlus, UserRound, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ActionSearch } from './ActionSearch';
import { useAdminNavigation } from '../admin/AdminNavigationContext';

function StaffToolLink({href,className,readOnly,children}:{href:string;className:string;readOnly:boolean;children:ReactNode}){
 if(readOnly)return <span aria-disabled="true" title="Read-only staff preview" className={`${className} cursor-not-allowed`}>{children}</span>;
 return <a href={href} className={className}>{children}</a>;
}

/** Secondary bar remains for older management pages; reception sidebar supersedes it on front-desk routes. */
export function WorkspaceNavigation(){
 const pathname=useRouterState({select:state=>state.location.pathname});
 const {hasPageNavigation}=useAdminNavigation();
 const onReception=pathname==='/reception-workspace',onStaff=['/staff','/staff-attendance','/staff-admin','/reception-checkin','/staff-missed-scans'].includes(pathname);
 const inWorkspace=!hasPageNavigation&&(onReception||onStaff||['/management-preview','/management-members','/management-attendance','/management-operations','/management-custom-plan','/management-standard-plan','/management-payment-desk','/management-profiles','/management-member-cards','/management-communications','/management-revenue','/management-staff','/management-staff-monthly','/management-staff-review','/management-payroll','/management-attendance-export','/management-payroll-export','/management-new-member-intake','/management-family'].includes(pathname));
 const[role,setRole]=useState<string|null>(null);
 const[staffPreview,setStaffPreview]=useState(false);
 useEffect(()=>{let cancelled=false;setRole(null);setStaffPreview(false);if(!inWorkspace)return()=>{cancelled=true;};void(async()=>{
  const{data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)return;
  const{data:staff,error}=await supabase.from('staff_users').select('role,active').eq('auth_user_id',auth.user.id).maybeSingle();if(error||!staff?.active)return;
  const signedInRole=String(staff.role||'').toLowerCase();
  const previewId=pathname==='/staff'&&typeof window!=='undefined'?new URLSearchParams(window.location.search).get('preview'):null;
  if(!previewId){if(!cancelled)setRole(signedInRole);return;}
  if(!['admin','owner'].includes(signedInRole)){if(!cancelled)setRole(signedInRole);return;}

  if(!cancelled)setStaffPreview(true);
  const{data:profile,error:profileError}=await supabase.from('staff_profiles').select('auth_user_id,role').eq('id',previewId).maybeSingle();
  if(profileError||!profile){if(!cancelled)setRole(null);return;}

  let targetRole=String(profile.role||'staff').toLowerCase();
  if(profile.auth_user_id){
   const{data:targetAccount,error:targetError}=await supabase.from('staff_users').select('role,active').eq('auth_user_id',profile.auth_user_id).maybeSingle();
   if(!targetError&&targetAccount?.active)targetRole=String(targetAccount.role||targetRole).toLowerCase();
  }
  if(!cancelled)setRole(targetRole);
 })();return()=>{cancelled=true;};},[inWorkspace,pathname]);
 if(!inWorkspace)return null;const management=['admin','owner','manager'].includes(role||''),admin=role==='admin',reception=management||role==='reception';
 if(onReception||onStaff)return <nav aria-label="Staff and reception action navigation" className="relative z-30 border-b border-[#365139] bg-[#173326] px-4 py-3 text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-3"><span className="text-xs font-black uppercase tracking-wider text-[#b8ee73]">{staffPreview?'Staff tools · preview':'Staff tools'}</span>{role&&<ActionSearch role={role} readOnly={staffPreview}/>}</div><div className="flex flex-wrap gap-2 text-xs font-bold">{reception&&<StaffToolLink href="/reception-workspace" readOnly={staffPreview} className="rounded-lg border border-[#b8ee73] px-3 py-2 text-[#b8ee73]">Reception</StaffToolLink>}{reception&&<StaffToolLink href="/reception-register" readOnly={staffPreview} className="rounded-lg border border-[#b8ee73] px-3 py-2 text-[#b8ee73]">Register / renew</StaffToolLink>}<StaffToolLink href="/staff-attendance" readOnly={staffPreview} className="rounded-lg border border-white/25 px-3 py-2">Clock in / out</StaffToolLink><StaffToolLink href="/staff-missed-scans" readOnly={staffPreview} className="rounded-lg border border-white/25 px-3 py-2">Missed scan</StaffToolLink>{admin&&<StaffToolLink href="/management-staff-review" readOnly={staffPreview} className="rounded-lg border border-white/25 px-3 py-2">Staff QR review</StaffToolLink>}{admin&&<StaffToolLink href="/management-member-cards" readOnly={staffPreview} className="inline-flex items-center gap-1 rounded-lg border border-[#b8ee73] px-3 py-2 text-[#b8ee73]"><CreditCard size={14}/> ID cards</StaffToolLink>}{reception&&<StaffToolLink href="/management-communications" readOnly={staffPreview} className="inline-flex items-center gap-1 rounded-lg bg-[#b8ee73] px-3 py-2 text-[#173326]"><Cake size={14}/> Reminders <ArrowUpRight size={13}/></StaffToolLink>}</div></div></nav>;
 if(!reception||!role)return null;
 const pages=[
  {label:'Overview',href:'/management-preview',icon:LayoutDashboard},
  {label:'Reception',href:'/reception-workspace',icon:UserPlus},
  {label:'Register / renew',href:'/reception-register',icon:CreditCard},
  {label:'Family Plan',href:'/management-family',icon:Users},
  {label:'Members',href:'/management-members',icon:Users},
  {label:'Profiles',href:'/management-profiles',icon:UserRound},
  {label:'Attendance',href:'/management-attendance',icon:Activity},
  {label:'Operations',href:'/management-operations',icon:ClipboardList},
  {label:'Birthdays & reminders',href:'/management-communications',icon:Cake},
 ];
 if(admin)pages.push({label:'ID Cards',href:'/management-member-cards',icon:CreditCard});
 if(management){pages.push({label:'Staff',href:'/management-staff',icon:Users});pages.push({label:'Monthly staff',href:'/management-staff-monthly',icon:CalendarDays});pages.push({label:'Staff QR review',href:'/management-staff-review',icon:ClipboardList});if(admin)pages.push({label:'Missed scan requests',href:'/staff-missed-scans',icon:ClipboardList});pages.push({label:'Export attendance',href:'/management-attendance-export',icon:Download});pages.push({label:'Salary records',href:'/management-payroll',icon:Wallet});pages.push({label:'Export salaries',href:'/management-payroll-export',icon:Download});pages.push({label:'Revenue',href:'/management-revenue',icon:Wallet});}
 return <nav aria-label="Super Plus management workspace" className="relative z-30 border-b border-[#263d31] bg-[#152820] px-3 py-3 text-white sm:px-6"><div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-5 gap-y-3"><span className="hidden shrink-0 text-[10px] font-black uppercase tracking-[.19em] text-[#b8ee73] sm:block">Management workspace</span><div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" role="group" aria-label="Workspace pages">{pages.map(({label,href,icon:Icon})=><a key={href} href={href} aria-current={pathname===href?'page':undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${pathname===href?'bg-[#b8ee73] text-[#183125]':'bg-white/5 text-[#d5e3d8] hover:bg-white/15'}`}><Icon size={15}/>{label}</a>)}</div><div className="flex shrink-0 items-center gap-2 overflow-x-auto text-xs"><a href="/reception-checkin" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 font-semibold"><ScanLine size={15}/> Scanner <ArrowUpRight size={13}/></a>{management&&<a href="/admin-workspace" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 font-semibold"><Wallet size={15}/> Admin <ArrowUpRight size={13}/></a>}</div><div className="w-full sm:ml-auto sm:w-80"><ActionSearch role={role}/></div></div></nav>;
}
