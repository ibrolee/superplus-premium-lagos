// Used only after an independent server-side Paystack verification.
export async function finalizeSpaPayment(admin: any, transaction: any) {
  const reference = String(transaction?.reference || "");
  if (
    transaction?.status !== "success" ||
    transaction?.currency !== "NGN" ||
    !Number.isSafeInteger(transaction?.amount) ||
    !transaction?.paid_at ||
    transaction?.metadata?.source !== "spa_booking"
  )
    throw Error("Payment is not a successful spa transaction.");
  const { data: booking, error } = await admin
    .from("spa_bookings")
    .select("email,amount")
    .eq("reference", reference)
    .maybeSingle();
  if (
    error ||
    !booking ||
    String(transaction.customer?.email || "").toLowerCase() !== booking.email ||
    transaction.amount !== Number(booking.amount) * 100
  )
    throw Error("Payment does not match the booking.");
  const result = await admin.rpc("finalize_spa_payment", {
    p_reference: reference,
    p_amount_kobo: transaction.amount,
    p_paid_at: transaction.paid_at,
    p_channel: transaction.channel || "paystack",
  });
  if (result.error || !result.data?.success)
    throw Error("Payment received but booking recording needs a retry. Do not pay again.");
  return result.data;
}
