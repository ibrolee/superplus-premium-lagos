import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function validSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!/^[0-9a-f]{128}$/i.test(signature)) return false;
  const signedBytes = new Uint8Array(signature.match(/../g)!.map(byte => parseInt(byte, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, signedBytes, new TextEncoder().encode(payload));
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !url || !serviceKey) return json({ error: 'Webhook not configured' }, 503);
  try {
    const rawBody = await request.text();
    if (rawBody.length > 150000) return json({ error: 'Payload too large' }, 413);
    const signature = request.headers.get('x-paystack-signature') || '';
    if (!(await validSignature(rawBody, signature, secret))) return json({ error: 'Invalid signature' }, 401);
    const event = JSON.parse(rawBody);
    if (event?.event !== 'charge.success') return json({ received: true, ignored: true });
    const reference = String(event?.data?.reference || '').trim();
    if (!/^SPF-\d+-[0-9a-f-]{36}$/i.test(reference)) return json({ received: true, ignored: true });
    // The webhook is signed, and we independently verify with Paystack before granting membership.
    const verified = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(12000) });
    if (!verified.ok) return json({ error: 'Paystack verification temporarily unavailable' }, 503);
    const payload = await verified.json();
    const transaction = payload?.data;
    if (payload?.status !== true || transaction?.status !== 'success' || transaction?.reference !== reference ||
        transaction?.currency !== 'NGN' || !Number.isSafeInteger(transaction?.amount) ||
        transaction?.amount <= 0 || !Number.isSafeInteger(transaction?.id) || !transaction?.paid_at) {
      console.error('Webhook transaction verification failed:', reference);
      return json({ error: 'Transaction verification incomplete' }, 422);
    }
    const meta = transaction.metadata || {};
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    if (meta.source === 'member_dashboard') {
      if (typeof meta.member_id !== 'string' || typeof meta.auth_user_id !== 'string' || typeof meta.plan_id !== 'string') {
        return json({ error: 'Missing member checkout metadata' }, 422);
      }
      const { data, error } = await admin.rpc('finalize_member_paystack_payment', {
        p_reference: reference, p_member_id: meta.member_id, p_auth_user_id: meta.auth_user_id,
        p_plan_id: meta.plan_id, p_amount_kobo: transaction.amount, p_currency: transaction.currency,
        p_paid_at: transaction.paid_at, p_channel: transaction.channel || 'paystack',
        p_customer_code: transaction.customer?.customer_code || null, p_transaction_id: transaction.id,
      });
      if (error || !data?.success) {
        console.error('Webhook member finalization failed:', { reference, code: error?.code, message: error?.message });
        return json({ error: 'Member finalization failed; Paystack should retry' }, 503);
      }
      return json({ received: true, already_processed: data.already_processed === true });
    }
    if (meta.source === 'public_join') {
      const payerEmail = String(transaction.customer?.email || '').trim().toLowerCase();
      const requestedEmail = String(meta.email || '').trim().toLowerCase();
      if (meta.reference !== reference || !payerEmail || payerEmail !== requestedEmail) {
        return json({ error: 'Public checkout email/reference mismatch' }, 422);
      }
      const { data, error } = await admin.rpc('finalize_public_join_payment', {
        p_reference: reference, p_plan_id: String(meta.plan_id || ''),
        p_full_name: String(meta.full_name || ''), p_email: requestedEmail,
        p_phone: String(meta.phone || ''), p_birth_day: Number(meta.birth_day),
        p_birth_month: Number(meta.birth_month), p_paid_at: transaction.paid_at,
        p_channel: transaction.channel || 'paystack',
        p_customer_code: transaction.customer?.customer_code || null,
        p_coupon_code: String(meta.coupon_code || ''), p_verified_amount_kobo: transaction.amount,
      });
      if (error || !data?.success) {
        console.error('Webhook public finalization failed:', { reference, code: error?.code, message: error?.message });
        return json({ error: 'Public checkout finalization failed; Paystack should retry' }, 503);
      }
      return json({ received: true, already_processed: data.already_processed === true });
    }
    console.error('Unrecognized SPF checkout metadata source:', reference);
    return json({ error: 'Unrecognized checkout; investigate payment' }, 422);
  } catch (error) {
    console.error('Paystack webhook:', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'Webhook processing failed; retry required' }, 503);
  }
});
