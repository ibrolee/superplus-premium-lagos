import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { recoveryServices, validateSpaTime } from "../_shared/spa-services.ts";
import { finalizeSpaPayment } from "../_shared/spa-payment.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);
  try {
    // Match the existing public checkout's API-key authentication. No caller-supplied
    // amounts or payment results are trusted; Paystack verifies every finalization.
    const key = Deno.env.get("PAYSTACK_SECRET_KEY"),
      url = Deno.env.get("SUPABASE_URL"),
      serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!key || !url || !serviceKey)
      return respond({ error: "Payments are temporarily unavailable." }, 503);
    const apiKey = req.headers.get("apikey") || "";
    if (!apiKey) return respond({ error: "Invalid API key." }, 401);
    // Validate rotated legacy keys and modern publishable keys against this project's
    // Auth endpoint rather than relying on a potentially older function environment key.
    if (apiKey !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const authCheck = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(10000),
      });
      if (!authCheck.ok) return respond({ error: "Invalid API key." }, 401);
    }
    const raw = await req.text();
    if (raw.length > 6000) return respond({ error: "Request too large." }, 413);
    const body = JSON.parse(raw),
      admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    if (body.action === "verify") {
      const reference = String(body.reference || "");
      if (!/^SPF-SPA-\d+-[0-9a-f-]{36}$/i.test(reference))
        return respond({ error: "Invalid payment reference." }, 400);
      const res = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) },
      );
      const verified = await res.json();
      if (!res.ok || verified.status !== true || verified.data?.reference !== reference)
        return respond(
          { error: "Unable to verify payment. If charged, do not pay again; retry verification." },
          409,
        );
      return respond(await finalizeSpaPayment(admin, verified.data));
    }
    if (body.action !== "initialize") return respond({ error: "Invalid checkout action." }, 400);
    const service = recoveryServices.find((s) => s.id === body.serviceId);
    if (!service?.price) return respond({ error: "Select a valid service." }, 400);
    const name = String(body.fullName || "").trim(),
      email = String(body.email || "")
        .trim()
        .toLowerCase(),
      phone = String(body.phone || "").trim(),
      notes = String(body.notes || "").trim();
    if (
      name.length < 2 ||
      name.length > 120 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^[+0-9 ()-]{7,30}$/.test(phone) ||
      notes.length > 1000
    )
      return respond(
        {
          error:
            "Enter your name, valid email and phone number. Notes must be under 1,000 characters.",
        },
        400,
      );
    let preferredAt;
    try {
      preferredAt = validateSpaTime(body.preferredAt, service.id === "vip-chair" ? 60 : 30);
    } catch (e) {
      return respond({ error: (e as Error).message }, 400);
    }
    // Limit accidental repeat clicks and automated attempts for the same email.
    const { count, error: countError } = await admin
      .from("spa_bookings")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", new Date(Date.now() - 3600000).toISOString());
    if (countError) return respond({ error: "Booking service is temporarily unavailable." }, 503);
    if ((count || 0) >= 8)
      return respond(
        { error: "Too many checkout attempts. Please try again later or contact reception." },
        429,
      );
    const reference = `SPF-SPA-${Date.now()}-${crypto.randomUUID()}`;
    const { error: insertError } = await admin.from("spa_bookings").insert({
      reference,
      service_id: service.id,
      service_name: service.name,
      amount: service.price,
      full_name: name,
      email,
      phone,
      preferred_at: preferredAt,
      notes,
    });
    if (insertError)
      return respond({ error: "Unable to create the booking. No payment has started." }, 503);
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: service.price * 100,
        currency: "NGN",
        reference,
        callback_url:
          "https://superplusfitness.com/spa-booking?reference=" + encodeURIComponent(reference),
        metadata: { source: "spa_booking", service_id: service.id, reference },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const payment = await res.json();
    if (!res.ok || !payment.status || !payment.data?.authorization_url) {
      console.error("Spa Paystack initialization rejected", {
        status: res.status,
        message: payment.message,
      });
      return respond(
        {
          error:
            typeof payment.message === "string"
              ? payment.message
              : "Paystack could not start checkout. No payment has been taken.",
        },
        502,
      );
    }
    return respond({ authorization_url: payment.data.authorization_url, reference });
  } catch (error) {
    console.error("Spa checkout failed", error instanceof Error ? error.message : "unknown");
    return respond(
      {
        error:
          "Unable to process checkout. If charged, do not pay again; contact reception with your reference.",
      },
      503,
    );
  }
});
