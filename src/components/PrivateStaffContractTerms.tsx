import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PrivateStaffContractTermsProps = {
  staffProfileId?: string | undefined;
};

export function PrivateStaffContractTerms({ staffProfileId }: PrivateStaffContractTermsProps) {
  const [terms, setTerms] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTerms(null);

    const request = staffProfileId
      ? supabase.rpc("management_get_staff_contract_terms", {
          p_staff_profile_id: staffProfileId,
        })
      : supabase.rpc("get_my_staff_contract_terms");

    request.then(({ data, error }) => {
      if (!cancelled && !error) setTerms(typeof data === "string" ? data : null);
    });

    return () => {
      cancelled = true;
    };
  }, [staffProfileId]);

  if (!terms) return null;

  return (
    <div className="mb-4 rounded-xl border border-border p-4">
      <h3 className="font-bold">
        {staffProfileId ? "Private payment agreement" : "Your private payment agreement"}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{terms}</p>
    </div>
  );
}
