import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { membershipPlans, publicMembershipOptions, type MembershipPlan } from "@/lib/site-data";

/** Prices and active plans from the database, with bundled catalog as an initial skeleton.
 * Checkout still independently verifies every amount with the server.
 */
export function useLivePlans(includeRegistration = true) {
  const fallback = includeRegistration ? publicMembershipOptions : membershipPlans;
  const [plans, setPlans] = useState<MembershipPlan[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data, error: fetchError } = await supabase
        .from("membership_plans").select("name,price,duration_days,active").order("name");
      if (!alive) return;
      if (fetchError) {
        setError("Live plan prices are temporarily unavailable. Please refresh.");
        setPlans(includeRegistration ? publicMembershipOptions.filter((item) => item.id === "registration-only") : []);
      } else {
        const byName = new Map((data || []).map((item) => [item.name, item]));
        setPlans(fallback.filter((item) => {
          if (item.id === "registration-only") return true;
          return byName.get(item.name)?.active === true;
        }).map((item) => {
          const latest = byName.get(item.name);
          return latest ? { ...item, price: Number(latest.price), duration: item.duration } : item;
        }));
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [includeRegistration]);
  return { plans, loading, error };
}
