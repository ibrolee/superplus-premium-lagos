import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect,useState } from 'react';
import { CheckCircle2,Loader2,XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
type PaymentResult={success?:boolean;already_processed?:boolean;error?:string;reference?:string;member_id?:string;auth_user_id?:string;membership_id?:string;payment_id?:string;plan_name?:string;start_date?:string;end_date?:string;email?:string};
export const Route=createFileRoute('/payment/public-callback')({component:PublicPaymentCallback});
function PublicPaymentCallback(){
 const[loading,setLoading]=useState(true),[result,setResult]=useState<PaymentResult|null>(null);
 useEffect(()=>{let cancelled=false;void(async()=>{try{
  const params=new URLSearchParams(window.location.search),reference=params.get('reference')||params.get('trxref');
  if(!reference)throw Error('No payment reference was found.');
  const{data,error}=await supabase.functions.invoke('verify-public-payment',{body:{reference}});
  if(error)throw Error(error.message||'Could not confirm payment.');
  if(!data?.success)throw Error(data?.error||'Could not confirm payment.');
  if(!cancelled)setResult(data);
 }catch(error){console.error('Public payment callback error:',error);if(!cancelled)setResult({success:false,error:error instanceof Error?error.message:'Unable to confirm payment. If Paystack charged you, do not pay again; contact reception with your payment reference.'});}
 finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true;};},[]);
 if(loading)return <main className="flex min-h-screen items-center justify-center bg-background px-6"><div className="w-full max-w-md text-center"><Loader2 className="mx-auto size-9 animate-spin"/><h1 className="mt-6 text-2xl font-semibold">Confirming your payment</h1><p className="mt-3 text-muted-foreground">Please wait while we verify your transaction with Paystack.</p></div></main>;
 if(!result?.success)return <main className="flex min-h-screen items-center justify-center bg-background px-6"><div className="w-full max-w-md text-center"><XCircle className="mx-auto size-10 text-destructive"/><h1 className="mt-6 text-2xl font-semibold">Payment could not be confirmed</h1><p className="mt-3 text-muted-foreground">{result?.error||'If you have been charged, do not pay again. Contact reception with your Paystack reference.'}</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild><Link to="/join">Back to membership</Link></Button><Button asChild variant="outline"><Link to="/">Back to website</Link></Button></div></div></main>;
 return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12"><div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm sm:p-8"><div className="text-center"><CheckCircle2 className="mx-auto size-12 text-green-600"/><h1 className="mt-6 text-3xl font-bold">Payment Successful!</h1><p className="mt-3 text-muted-foreground">Your membership is recorded and ready.</p></div><section className="mt-8 rounded-xl border bg-muted/30 p-5"><h2 className="font-semibold">Membership details</h2><div className="mt-4 space-y-3 text-sm"><p className="flex justify-between gap-4"><span>Plan</span><strong>{result.plan_name||'Membership'}</strong></p><p className="flex justify-between gap-4"><span>Start date</span><strong>{result.start_date||'—'}</strong></p><p className="flex justify-between gap-4"><span>Expiry date</span><strong>{result.end_date||'—'}</strong></p></div></section><section className="mt-6 rounded-xl border p-5"><h2 className="font-semibold">Your member profile</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Your existing gym record has been used, or a new member record created. Sign in securely with the email used for payment. The one-time email login will connect your online access to that record.</p>{result.email&&<p className="mt-3 break-all text-sm font-semibold">{result.email}</p>}</section><div className="mt-8 flex flex-col gap-3"><Button asChild size="lg"><Link to="/login">Go to Member Login</Link></Button><Button asChild variant="outline" size="lg"><Link to="/">Back to website</Link></Button></div></div></main>;
}
