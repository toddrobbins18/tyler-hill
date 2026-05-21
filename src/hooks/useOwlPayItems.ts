import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OwlPayItemRow = {
  id: string;
  company_id: string;
  name: string;
  price: number;
  category: string;
  active: boolean;
};

export function useOwlPayItems(companyId: string | null | undefined, activeOnly = false) {
  return useQuery({
    queryKey: ["owlpay-items", companyId, activeOnly],
    queryFn: async (): Promise<OwlPayItemRow[]> => {
      if (!companyId) return [];

      let query = supabase
        .from("owl_pay_items")
        .select("*")
        .eq("company_id", companyId)
        .order("name");

      if (activeOnly) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OwlPayItemRow[];
    },
    enabled: !!companyId,
  });
}
