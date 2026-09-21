import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { membershipPlans, formatNaira } from '@/lib/site-data';
import { supabase } from '@/lib/supabase';

export const Route = createFileRoute('/join')({ component: JoinPage });
const registrationFeeCoupons = new Set(['REGSF','REGOFF']);
function JoinPage() {
 const [selectedPlanId,setSelectedPlanId]=useState('monthly');
 const [fullName,setFullName]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState('');
 const [birthDay,setBirthDay]=useState(''),[birthMonth,setBirthMonth]=useState('');
 const [coupon,setCoupon]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const plan=params.get('plan');if(plan&&membershipPlans.some(p=>p.id===plan))setSelectedPlanId(plan);},[]);
 const selectedPlan=useMemo(()=>membershipPlans.find(p=>p.id===selectedPlanId)||membershipPlans[0]!,[selectedPlanId]);
 const cleanCoupon=coupon.trim().toUpperCase();const couponValid=registrationFeeCoupons.has(cleanCoupon);const couponInvalid=!!cleanCoupon&&!couponValid;
 const registrationFee=couponValid?0:selectedPlan.registration;
 const totalAmount=selectedPlan.price+registrationFee;
 async function handleSubmit(event:FormEvent<HTMLFormElement>){event.preventDefault();setError('');
  const name=fullName.trim(),mail=email.trim().toLowerCase(),mobile=phone.trim(),day=Number(birthDay),month=Number(birthMonth);
  if(!name||!mail.includes('@')||!mobile||!Number.isInteger(day)||day<1||day>31||!Number.isInteger(month)||month<1||month>12){setError('Enter your name, email, phone and valid birth day/month.');return;}
  if(couponInvalid){setError('Invalid code. Enter REGSF or remove the coupon.');return;}
  setLoading(true);
  try{const {data,error:fnError}=await supabase.functions.invoke('initialize-public-payment',{body:{planId:selectedPlan.id,fullName:name,email:mail,phone:mobile,birthDay:day,birthMonth:month,...(couponValid?{couponCode:cleanCoupon}:{})}});
   if(fnError)throw Error(fnError.message||'Unable to start payment.');
   if(!data?.authorization_url)throw Error(data?.error||'Unable to start payment.');
   // Never redirect to Paystack when the charged amount does not match the displayed fee-only discount.
   if(Number(data.total_amount)!==totalAmount||Number(data.registration_amount)!==registrationFee||Number(data.membership_amount)!==selectedPlan.price)throw Error('Checkout total does not match the selected plan and coupon. Payment was not started.');
   window.location.href=data.authorization_url;
  }catch(cause){setError(cause instanceof Error?cause.message:'Unable to start payment.');setLoading(false);}
 }
 return <main className="min-h-screen bg-background"><section className="border-b bg-card"><div className="mx-auto max-w-7xl px-6 py-5 lg:px-8"><Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/> Back to Super Plus Fitness</Link></div></section>
 <section className="px-6 py-10 sm:py-14 lg:px-8"><div className="mx-auto max-w-6xl"><div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-[.18em] text-primary">Membership</p><h1 className="mt-3 text-3xl font-bold sm:text-5xl">Join Super Plus Fitness</h1><p className="mt-4 text-base text-muted-foreground">Choose a plan and pay securely through Paystack. Existing members with a profile can <Link to="/login" className="font-semibold text-primary underline">log in and renew</Link> without a registration fee.</p></div>
 <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_420px] lg:items-start"><div><h2 className="mb-4 text-xl font-semibold">Choose your plan</h2><div className="grid gap-4 sm:grid-cols-2">{membershipPlans.map(plan=>{const selected=plan.id===selectedPlan.id;return <button key={plan.id} type="button" onClick={()=>setSelectedPlanId(plan.id)} disabled={loading} className={`relative rounded-2xl border p-5 text-left transition-all ${selected?'border-primary ring-2 ring-primary/20':'border-border hover:border-primary/50'}`}>
  {plan.badge&&<span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{plan.badge}</span>}
  <div className="pr-16"><h3 className="text-lg font-semibold">{plan.name}</h3><p className="mt-1 text-sm text-muted-foreground">{plan.duration}</p></div><div className="mt-5 text-2xl font-bold">{formatNaira(plan.price)}</div><div className="mt-3 space-y-1 text-sm text-muted-foreground"><p>Registration: {formatNaira(plan.registration)}</p><p className="font-medium text-foreground">Total before coupon: {formatNaira(plan.price+plan.registration)}</p></div><div className="mt-5 flex items-center gap-2 text-sm font-semibold">{selected?'Selected':'Select plan'}{selected&&<CheckCircle2 className="size-4"/>}</div>
 </button>;})}</div></div>
 <div className="lg:sticky lg:top-6"><div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-7"><p className="text-sm font-medium text-muted-foreground">Selected plan</p><h2 className="mt-1 text-2xl font-bold">{selectedPlan.name}</h2><div className="my-6 border-t"/><form onSubmit={event=>void handleSubmit(event)} className="space-y-4">
 <label className="block text-sm font-medium">Coupon code (optional)<input type="text" autoComplete="off" value={coupon} onChange={e=>setCoupon(e.target.value)} disabled={loading} placeholder="REGSF" className="mt-2 h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none focus:border-primary"/>{couponValid&&<span className="mt-2 block text-xs font-semibold text-green-700">{cleanCoupon} applied. Registration fee waived.</span>}{couponInvalid&&<span className="mt-2 block text-xs text-destructive">Invalid code.</span>}</label>
 <div className="space-y-3 rounded-xl bg-muted/30 p-4 text-sm"><p className="flex justify-between gap-4"><span>Membership</span><strong>{formatNaira(selectedPlan.price)}</strong></p><p className="flex justify-between gap-4"><span>Registration</span><strong>{formatNaira(registrationFee)}</strong></p><p className="flex justify-between gap-4 border-t pt-3 text-lg font-bold"><span>Total</span><span>{formatNaira(totalAmount)}</span></p></div><p className="text-xs leading-5 text-muted-foreground">REGSF removes only the registration fee; you still pay the membership price. Use your existing email if you have previously joined.</p>
 <label className="block text-sm font-medium">Full name<input type="text" value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name" required disabled={loading} placeholder="Enter your full name" className="mt-2 h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none focus:border-primary"/></label>
 <label className="block text-sm font-medium">Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required disabled={loading} placeholder="you@example.com" className="mt-2 h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none focus:border-primary"/></label>
 <label className="block text-sm font-medium">Phone number<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel" required disabled={loading} placeholder="08012345678" className="mt-2 h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none focus:border-primary"/></label>
 <label className="block text-sm font-medium">Date of birth (day and month)</label><div className="grid grid-cols-2 gap-3"><select value={birthDay} onChange={e=>setBirthDay(e.target.value)} aria-label="Birth day" required disabled={loading} className="h-12 w-full rounded-xl border bg-background px-3 text-sm"><option value="">Day</option>{Array.from({length:31},(_,i)=>i+1).map(day=><option key={day} value={day}>{day}</option>)}</select><select value={birthMonth} onChange={e=>setBirthMonth(e.target.value)} aria-label="Birth month" required disabled={loading} className="h-12 w-full rounded-xl border bg-background px-3 text-sm"><option value="">Month</option>{['January','February','March','April','May','June','July','August','September','October','November','December'].map((month,index)=><option key={month} value={index+1}>{month}</option>)}</select></div><p className="text-xs text-muted-foreground">Only the day and month are needed for birthday benefits.</p>
 {error&&<div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
 <Button type="submit" size="lg" className="h-12 w-full" disabled={loading||couponInvalid}>{loading?<><Loader2 className="mr-2 size-4 animate-spin"/>Connecting to Paystack…</>:<>Continue to payment <ArrowRight className="ml-2 size-4"/></>}</Button><p className="text-center text-xs leading-5 text-muted-foreground">You will be redirected to Paystack to complete payment securely.</p>
 </form></div></div></div></div></section></main>;
}
