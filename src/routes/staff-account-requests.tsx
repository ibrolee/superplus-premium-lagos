import { createFileRoute } from '@tanstack/react-router';
import { useCallback,useEffect,useState } from 'react';
import { ArrowLeft,CheckCircle2,Clock3,RefreshCw,ShieldCheck,UserRound,XCircle } from 'lucide-react';
import { AdminWorkspaceShell } from '@/components/admin/AdminWorkspaceShell';
import { supabase } from '@/lib/supabase';

export const Route=createFileRoute('/staff-account-requests')({component:StaffAccountRequests});

type RequestRow={
 id:string;auth_user_id:string;staff_id:string|null;full_name:string|null;email:string|null;phone:string|null;
 position:string|null;department:string|null;employment_type:string|null;employment_date:string|null;role:string|null;status:string|null;created_at:string;
};
const allowedRoles=['staff','reception','trainer','spa_staff','manager','admin'];
const roleLabel=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const dateTime=(value:string)=>new Intl.DateTimeFormat('en-NG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Lagos'}).format(new Date(value));

function StaffAccountRequests(){
 const[requests,setRequests]=useState<RequestRow[]>([]),[loading,setLoading]=useState(true),[busyId,setBusyId]=useState<string|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');

 const refresh=useCallback(async()=>{setLoading(true);setError('');try{
  const{data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)throw Error('Sign in through the admin portal first.');
  const{data:admin,error:adminError}=await supabase.from('staff_users').select('role,active').eq('auth_user_id',auth.user.id).maybeSingle();if(adminError)throw adminError;
  if(!admin?.active||String(admin.role||'').toLowerCase()!=='admin')throw Error('Only an active administrator can review staff account requests.');
  const{data,error:queryError}=await supabase.from('staff_profiles').select('id,auth_user_id,staff_id,full_name,email,phone,position,department,employment_type,employment_date,role,status,created_at').eq('status','pending').order('created_at',{ascending:false});
  if(queryError)throw queryError;setRequests((data||[]) as RequestRow[]);
 }catch(cause){setRequests([]);setError(cause instanceof Error?cause.message:'Unable to load staff account requests.');}finally{setLoading(false);}},[]);

 useEffect(()=>{void refresh();},[refresh]);

 async function approve(request:RequestRow){
  const role=String(request.role||'staff').toLowerCase();if(!allowedRoles.includes(role)){setError('This request has an invalid staff role. Open Staff Management to correct it before approval.');return;}
  if(!window.confirm(`Approve ${request.full_name||'this staff account'} as ${roleLabel(role)}?`))return;
  setBusyId(request.id);setError('');setNotice('');
  try{
   const{error:profileError}=await supabase.from('staff_profiles').update({status:'approved'}).eq('id',request.id).eq('status','pending');if(profileError)throw profileError;
   const{data:existing,error:lookupError}=await supabase.from('staff_users').select('id').eq('auth_user_id',request.auth_user_id).maybeSingle();if(lookupError)throw lookupError;
   if(existing?.id){const{error}=await supabase.from('staff_users').update({role,active:true,full_name:request.full_name||'Staff'}).eq('id',existing.id);if(error)throw error;}
   else{const{error}=await supabase.from('staff_users').insert({id:crypto.randomUUID(),auth_user_id:request.auth_user_id,role,full_name:request.full_name||'Staff',active:true});if(error)throw error;}
   setRequests(current=>current.filter(item=>item.id!==request.id));setNotice(`${request.full_name||'Staff member'} approved successfully.`);
  }catch(cause){setError(cause instanceof Error?cause.message:'Approval failed. Refresh before trying again.');await refresh();}finally{setBusyId(null);}
 }

 async function reject(request:RequestRow){
  if(!window.confirm(`Reject ${request.full_name||'this staff account'}? Their account will remain unable to access staff features.`))return;
  setBusyId(request.id);setError('');setNotice('');
  try{
   const{error:profileError}=await supabase.from('staff_profiles').update({status:'inactive'}).eq('id',request.id).eq('status','pending');if(profileError)throw profileError;
   const{data:existing,error:lookupError}=await supabase.from('staff_users').select('id').eq('auth_user_id',request.auth_user_id).maybeSingle();if(lookupError)throw lookupError;
   if(existing?.id){const{error}=await supabase.from('staff_users').update({active:false}).eq('id',existing.id);if(error)throw error;}
   setRequests(current=>current.filter(item=>item.id!==request.id));setNotice(`${request.full_name||'Staff member'} rejected. The profile is now inactive.`);
  }catch(cause){setError(cause instanceof Error?cause.message:'Rejection failed. Refresh before trying again.');await refresh();}finally{setBusyId(null);}
 }

 return <AdminWorkspaceShell title="Staff account requests" subtitle="Review new staff accounts here without searching through the full staff directory." active="/staff-account-requests">
  <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><a href="/admin-approvals" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"><ArrowLeft size={16}/> All staff requests</a><button type="button" onClick={()=>void refresh()} disabled={loading||!!busyId} className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw size={16}/> Refresh</button></div>
  {error&&<div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
  {notice&&<div role="status" className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</div>}
  <section className="mt-5 rounded-[24px] border border-[#dce8d9] bg-white p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#65905c]">Pending approval</p><h2 className="mt-2 text-2xl font-black">Account requests</h2><p className="mt-2 text-sm leading-6 text-[#637469]">Approve a request to activate staff access, or reject it to mark the profile inactive.</p></div><span className="rounded-2xl bg-[#edf6e7] px-4 py-3 text-xl font-black">{loading?'—':requests.length}</span></div>
   {loading?<p role="status" className="mt-7 text-sm text-[#637469]">Loading pending staff accounts…</p>:requests.length===0?<div className="mt-7 rounded-2xl bg-[#f4f6f1] p-5"><p className="flex items-center gap-2 font-bold"><CheckCircle2 size={19}/> No pending staff account requests.</p></div>:<div className="mt-6 space-y-4">{requests.map(request=><article key={request.id} className="rounded-2xl border border-[#dce8d9] bg-[#fafcf9] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-xl bg-[#edf6e7] p-2 text-[#356942]"><UserRound size={18}/></span><h3 className="break-words text-lg font-black">{request.full_name||'Unnamed staff applicant'}</h3></div><p className="mt-3 break-all text-sm text-[#607066]">{request.email||'No email shown'}{request.phone?` · ${request.phone}`:''}</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"><Clock3 size={14}/> Pending</span></div>
    <dl className="mt-5 grid gap-3 rounded-xl bg-white p-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-wide text-[#758379]">Requested role</dt><dd className="mt-1 font-bold">{roleLabel(String(request.role||'staff'))}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-[#758379]">Submitted</dt><dd className="mt-1 font-bold">{dateTime(request.created_at)}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-[#758379]">Position</dt><dd className="mt-1">{request.position||'Not provided'}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-[#758379]">Department</dt><dd className="mt-1">{request.department||'Not provided'}</dd></div></dl>
    <div className="mt-5 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={!!busyId} onClick={()=>void approve(request)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><ShieldCheck size={17}/>{busyId===request.id?'Working…':'Approve account'}</button><button type="button" disabled={!!busyId} onClick={()=>void reject(request)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-5 py-3 text-sm font-bold text-red-700 disabled:opacity-50"><XCircle size={17}/> Reject request</button></div>
   </article>)}</div>}
  </section>
 </AdminWorkspaceShell>;
}
