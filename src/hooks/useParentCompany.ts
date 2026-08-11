import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "parent_portal_company_slug";

export function useParentCompany() {
  const [searchParams] = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolve = async () => {
      const fromUrl = searchParams.get("company");
      if (fromUrl) sessionStorage.setItem(STORAGE_KEY, fromUrl);
      const slug = fromUrl || sessionStorage.getItem(STORAGE_KEY);
      if (!slug) {
        setCompanyId(null);
        setCompanySlug(null);
        setLoading(false);
        return;
      }
      setCompanySlug(slug);
      const { data } = await supabase.from("companies").select("id").eq("slug", slug).maybeSingle();
      setCompanyId(data?.id ?? null);
      setLoading(false);
    };
    void resolve();
  }, [searchParams]);

  return { companyId, companySlug, loading };
}

export function parentPortalUrl(slug: string, path: "/parents" | "/parents/portal" = "/parents") {
  return `${path}?company=${encodeURIComponent(slug)}`;
}
