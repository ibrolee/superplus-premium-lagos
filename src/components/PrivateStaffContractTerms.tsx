import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function PrivateStaffContractTerms() {
  const [terms, setTerms] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_my_staff_contract_terms").then(({ data, error }) => {
      if (!cancelled && !error) setTerms(typeof data === "string" ? data : null);
    });
    return () => { cancelled = true; };
  }, []);
  if (!terms) return null;
  return <div className="mb-4 rounded-xl border border-border p-4"><h3 className="font-bold">Your private payment agreement</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{terms}</p></div>;
}
