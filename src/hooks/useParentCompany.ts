import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

const STORAGE_KEY = "parent_portal_company_slug";

type ParentCompanyRow = {
  id: string;
  name: string;
  theme_color: string | null;
  slug: string;
};

function companyFromContext(
  slug: string,
  availableCompanies: { id: string; name: string; slug: string; theme_color: string }[],
  currentCompany: { id: string; name: string; slug: string; theme_color: string } | null,
): ParentCompanyRow | null {
  const match =
    availableCompanies.find((c) => c.slug === slug) ??
    (currentCompany?.slug === slug ? currentCompany : null);
  if (!match) return null;
  return {
    id: match.id,
    name: match.name,
    theme_color: match.theme_color ?? null,
    slug: match.slug,
  };
}

export function useParentCompany() {
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { availableCompanies, currentCompany, loading: campContextLoading } = useCompany();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("Your Camp");
  const [themeColor, setThemeColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const applyCompany = (row: ParentCompanyRow) => {
      setCompanyId(row.id);
      setCompanySlug(row.slug);
      setCompanyName(row.name?.trim() || "Your Camp");
      setThemeColor(row.theme_color ?? null);
    };

    const resolve = async () => {
      setLoading(true);

      const fromUrl = searchParams.get("company");
      if (fromUrl) sessionStorage.setItem(STORAGE_KEY, fromUrl);
      const slug = fromUrl || sessionStorage.getItem(STORAGE_KEY);

      if (!slug) {
        setCompanyId(null);
        setCompanySlug(null);
        setCompanyName("Your Camp");
        setThemeColor(null);
        setLoading(false);
        return;
      }

      setCompanySlug(slug);

      // Public RPC — works before login (requires migration).
      const { data: rpcRows, error: rpcError } = await supabase.rpc("get_parent_portal_company", {
        _slug: slug,
      });

      if (!cancelled && !rpcError && rpcRows?.length) {
        applyCompany(rpcRows[0] as ParentCompanyRow);
        setLoading(false);
        return;
      }

      // Direct query — works when the session can read companies via RLS.
      const { data } = await supabase
        .from("companies")
        .select("id, name, theme_color, slug")
        .eq("slug", slug)
        .maybeSingle();

      if (!cancelled && data) {
        applyCompany(data as ParentCompanyRow);
        setLoading(false);
        return;
      }

      // Staff preview: reuse camp already loaded in The Nest after auth settles.
      if (!authLoading) {
        const fromContext = companyFromContext(slug, availableCompanies, currentCompany);
        if (!cancelled && fromContext) {
          applyCompany(fromContext);
          setLoading(false);
          return;
        }
      }

      if (!cancelled) {
        const waitingOnStaffContext = Boolean(user) && (authLoading || campContextLoading);
        if (waitingOnStaffContext) {
          // Wait for auth + CompanyContext before showing "Camp not found".
          return;
        }
        setCompanyId(null);
        setCompanyName("Your Camp");
        setThemeColor(null);
        setLoading(false);
      }
    };

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [searchParams, authLoading, campContextLoading, user, availableCompanies, currentCompany]);

  return { companyId, companySlug, companyName, themeColor, loading };
}

export function parentPortalUrl(slug: string, path: "/parents" | "/parents/portal" = "/parents") {
  return `${path}?company=${encodeURIComponent(slug)}`;
}
