import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return respond({ ok: true });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!url || !anon || !serviceKey || !paystackKey) return respond({ error: 'Payment verification is not configured.' }, 503);
    const authorization = request.headers.get('Authorization');
    if (!authorization) return respond({ error: 'Please sign in again to verify your payment.' }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return respond({ error: 'Your session expired. Sign in and retry verification with the same reference; do not pay again.' }, 401);
    const body = await request.json();
    const reference = String(body?.reference || body?.trxref || '').trim();
    if (!/^SPF-\d+-[0-9a-f-]{36}$/i.test(reference)) return respond({ error: 'A valid payment reference is required.' }, 400);

    const verified = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackKey}` }, signal: AbortSignal.timeout(12000),
    });
    if (!verified.ok) return respond({ error: 'Paystack verification is temporarily unavailable. Please retry; do not pay again.' }, 503);
    const payload = await verified.json();
    const transaction = payload?.data;
    if (payload?.status !== true || transaction?.status !== 'success' || transaction?.reference !== reference) {
      return respond({ error: 'Payment has not yet been confirmed by Paystack. Do not pay again; retry verification shortly.' }, 409);
    }
    const meta = transaction?.metadata || {};
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: member, error: memberError } = await service.from('members')
      .select('id,auth_user_id,email').eq('auth_user_id', user.id).maybeSingle();
    if (memberError || !member || String(meta?.auth_user_id || '') !== user.id ||
        String(meta?.member_id || '') !== member.id || meta?.source !== 'member_dashboard') {
      return respond({ error: 'This verified payment cannot be linked to your account. Contact reception with the reference; do not pay again.' }, 403);
    }
    if (!Number.isSafeInteger(transaction?.amount) || !Number.isSafeInteger(transaction?.id) ||
        transaction?.currency !== 'NGN' || !transaction?.paid_at) {
      return respond({ error: 'Paystack returned incomplete transaction details. Contact reception; do not pay again.' }, 409);
    }
    const { data, error } = await service.rpc('finalize_member_paystack_payment', {
      p_reference: reference, p_member_id: member.id, p_auth_user_id: user.id,
      p_plan_id: String(meta.plan_id || ''), p_amount_kobo: transaction.amount,
      p_currency: transaction.currency, p_paid_at: transaction.paid_at,
      p_channel: String(transaction.channel || 'paystack'),
      p_customer_code: transaction.customer?.customer_code || null,
      p_transaction_id: transaction.id,
    });
    if (error) {
      console.error('Payment finalization failed:', { reference, code: error.code, message: error.message });
      return respond({ error: 'Your payment was received but activation could not finish. Please retry with this reference or contact reception. Do not pay again.' }, 503);
    }
    return respond(data);
  } catch (error) {
    console.error('Payment callback verification error:', error instanceof Error ? error.message : 'unknown');
    return respond({ error: 'Verification could not finish. Retry with the same reference or contact reception; do not pay again.' }, 503);
  }
});
