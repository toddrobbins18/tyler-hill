import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { applyThemeColor } from '@/utils/themeUtils';
import { useAuth } from './AuthContext';
import { invalidateCampScopedQueries } from '@/lib/queryClient';
import { COMPANY_BOOTSTRAP_VERSION, DEFAULT_COMPANY_SLUG } from '@/lib/camps';

const COMPANY_BOOTSTRAP_KEY = 'companyBootstrapVersion';
/** Set on SIGNED_IN so the next load picks North Shore + 2027; not set on tab refresh. */
const LOGIN_DEFAULTS_KEY = 'nest_login_defaults';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_color: string;
  zip_code?: string | null;
  camp_type?: 'overnight' | 'day_camp' | null;
  /** When false, Owl Pay is not offered for this camp (see migration `companies.owl_pay_enabled`). */
  owl_pay_enabled?: boolean | null;
}

interface CompanyContextType {
  currentCompany: Company | null;
  availableCompanies: Company[];
  switchCompany: (companyId: string) => Promise<void>;
  loading: boolean;
  isSuperAdmin: boolean;
  refetchCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin: authIsSuperAdmin, loading: authLoading, refetch: refetchAuth } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Track if initial load has happened to prevent re-setting company on token refresh
  const hasInitializedRef = useRef(false);
  // Track if a company switch is in progress to prevent race conditions
  const isSwitchingRef = useRef(false);
  const currentCompanyRef = useRef<Company | null>(null);

  useEffect(() => {
    currentCompanyRef.current = currentCompany;
  }, [currentCompany]);

  // Load company data once when auth is ready for this user.
  useEffect(() => {
    if (!authLoading && user) {
      void loadCompanyData();
    } else if (!authLoading && !user) {
      setCurrentCompany(null);
      setAvailableCompanies([]);
      setLoading(false);
      hasInitializedRef.current = false;
      sessionStorage.removeItem('viewing_company_id');
      sessionStorage.removeItem(LOGIN_DEFAULTS_KEY);
    }
  }, [authLoading, user?.id]);

  // When super-admin status resolves after init, refresh the camp list without resetting selection.
  useEffect(() => {
    if (!authLoading && user && hasInitializedRef.current) {
      void refreshAvailableCompanies();
    }
  }, [authIsSuperAdmin, authLoading, user?.id]);

  // Only clear camp state on sign-out. Do NOT react to SIGNED_IN here — Supabase
  // fires SIGNED_IN again when the tab regains focus, which must not reset the camp.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentCompany(null);
        setAvailableCompanies([]);
        setLoading(false);
        hasInitializedRef.current = false;
        sessionStorage.removeItem('viewing_company_id');
        sessionStorage.removeItem(LOGIN_DEFAULTS_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  type LoadCompanyOptions = {
    force?: boolean;
    refreshListOnly?: boolean;
  };

  const fetchAllowedCompanies = async () => {
    if (!user) return { companies: [] as Company[], profile: null as any, isSuperAdminUser: false };

    const profilePromise = supabase
      .from('profiles')
      .select('company_id, companies(id, name, slug, logo_url, theme_color, zip_code, owl_pay_enabled, camp_type)')
      .eq('id', user.id)
      .single();

    const rolesPromise = supabase
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', user.id);

    const [profileResult, rolesResult] = await Promise.all([profilePromise, rolesPromise]);
    const profile = profileResult.data;
    const roleRows = rolesResult.data || [];
    const isSuperAdminUser =
      authIsSuperAdmin || roleRows.some((r) => String(r.role).toLowerCase() === 'super_admin');

    let allowedCompanyIds: string[] = [];
    if (!isSuperAdminUser) {
      const uniqueIds = new Set(
        roleRows
          .map((r) => r.company_id)
          .filter((id): id is string => id !== null),
      );
      if (profile?.company_id) {
        uniqueIds.add(profile.company_id);
      }
      allowedCompanyIds = Array.from(uniqueIds);
    }

    let companiesQuery = supabase
      .from('companies')
      .select('id, name, slug, logo_url, theme_color, zip_code, owl_pay_enabled, camp_type')
      .order('name');

    if (!isSuperAdminUser) {
      companiesQuery = companiesQuery.eq('is_active', true);
    }

    if (!isSuperAdminUser && allowedCompanyIds.length > 0) {
      companiesQuery = companiesQuery.in('id', allowedCompanyIds);
    } else if (!isSuperAdminUser) {
      companiesQuery = supabase.from('companies').select('id').eq('id', '00000000-0000-0000-0000-000000000000');
    }

    const companiesResult = await companiesQuery;
    const companies = (companiesResult.data || []) as Company[];

    return { companies, profile, isSuperAdminUser };
  };

  const pickTargetCompany = (
    companies: Company[],
    profile: { company_id?: string | null; companies?: unknown } | null,
    applyLoginDefaults: boolean,
  ): Company | null => {
    if (!companies.length) {
      if (profile?.companies && !Array.isArray(profile.companies)) {
        return profile.companies as Company;
      }
      return null;
    }

    if (applyLoginDefaults) {
      return companies.find((c) => c.slug === DEFAULT_COMPANY_SLUG) ?? companies[0] ?? null;
    }

    const savedCompanyId = sessionStorage.getItem('viewing_company_id');
    if (savedCompanyId) {
      const saved = companies.find((c) => c.id === savedCompanyId);
      if (saved) return saved;
    }

    const active = currentCompanyRef.current;
    if (active) {
      const stillAllowed = companies.find((c) => c.id === active.id);
      if (stillAllowed) return stillAllowed;
    }

    const northShore = companies.find((c) => c.slug === DEFAULT_COMPANY_SLUG);
    if (northShore) return northShore;

    if (profile?.company_id) {
      const profileCompany = companies.find((c) => c.id === profile.company_id);
      if (profileCompany) return profileCompany;
    }

    return companies[0] ?? null;
  };

  const applyTargetCompany = (targetCompany: Company | null) => {
    if (!targetCompany) return;
    setCurrentCompany(targetCompany);
    sessionStorage.setItem('viewing_company_id', targetCompany.id);
    if (targetCompany.theme_color) {
      applyThemeColor(targetCompany.theme_color, { companySlug: targetCompany.slug });
    }
  };

  const refreshAvailableCompanies = async () => {
    if (!user || isSwitchingRef.current) return;

    try {
      const { companies, profile } = await fetchAllowedCompanies();
      if (companies.length > 0) {
        setAvailableCompanies(companies);
      } else if (profile?.companies && !Array.isArray(profile.companies)) {
        setAvailableCompanies([profile.companies as unknown as Company]);
      }

      const active = currentCompanyRef.current;
      if (active && companies.some((c) => c.id === active.id)) {
        return;
      }

      const savedCompanyId = sessionStorage.getItem('viewing_company_id');
      const saved = savedCompanyId ? companies.find((c) => c.id === savedCompanyId) : null;
      if (saved) {
        applyTargetCompany(saved);
      }
    } catch (error) {
      console.error('Error refreshing company list:', error);
    }
  };

  const loadCompanyData = async (options: LoadCompanyOptions = {}) => {
    const { force = false, refreshListOnly = false } = options;

    if (hasInitializedRef.current && !force && !refreshListOnly) {
      return;
    }

    if (isSwitchingRef.current) {
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const bootstrapDone = localStorage.getItem(COMPANY_BOOTSTRAP_KEY);
      if (bootstrapDone !== COMPANY_BOOTSTRAP_VERSION) {
        sessionStorage.removeItem('viewing_company_id');
        localStorage.setItem(COMPANY_BOOTSTRAP_KEY, COMPANY_BOOTSTRAP_VERSION);
      }

      const applyLoginDefaults = sessionStorage.getItem(LOGIN_DEFAULTS_KEY) === '1';
      if (applyLoginDefaults) {
        sessionStorage.removeItem(LOGIN_DEFAULTS_KEY);
      }

      const { companies, profile } = await fetchAllowedCompanies();

      if (companies.length > 0) {
        setAvailableCompanies(companies);
      } else if (profile?.companies && !Array.isArray(profile.companies)) {
        setAvailableCompanies([profile.companies as unknown as Company]);
      }

      if (refreshListOnly) {
        const active = currentCompanyRef.current;
        if (active && companies.some((c) => c.id === active.id)) {
          hasInitializedRef.current = true;
          return;
        }
      }

      const targetCompany = pickTargetCompany(companies, profile, applyLoginDefaults);
      applyTargetCompany(targetCompany);
      hasInitializedRef.current = true;
    } catch (error) {
      console.error('Error loading company data:', error);
      toast({
        title: "Error",
        description: "Failed to load company data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refetchCompanies = async () => {
    await loadCompanyData({ force: true, refreshListOnly: true });
  };

  const switchCompany = async (companyId: string) => {
    isSwitchingRef.current = true;
    
    try {
      const company = availableCompanies.find(c => c.id === companyId);
      if (!company) {
        toast({
          title: "Error",
          description: "Company not found",
          variant: "destructive",
        });
        isSwitchingRef.current = false;
        return;
      }

      // Non-super-admins: RLS uses profiles.company_id, so persist the active camp there.
      if (!authIsSuperAdmin && user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ company_id: companyId })
          .eq('id', user.id);
        if (profileError) throw profileError;
      }

      sessionStorage.setItem('viewing_company_id', companyId);
      
      // Update state synchronously
      setCurrentCompany(company);
      invalidateCampScopedQueries();
      await refetchAuth();
      
      // Apply theme color immediately
      if (company.theme_color) {
        applyThemeColor(company.theme_color, { companySlug: company.slug });
      }
      
      toast({
        title: "Viewing Company",
        description: `Now viewing ${company.name}`,
      });
      
      // Clear switching flag after a brief delay
      setTimeout(() => {
        isSwitchingRef.current = false;
      }, 500);
    } catch (error) {
      console.error('Error switching company:', error);
      isSwitchingRef.current = false;
      toast({
        title: "Error",
        description: "Failed to switch company",
        variant: "destructive",
      });
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        availableCompanies,
        switchCompany,
        loading: loading || authLoading,
        isSuperAdmin: authIsSuperAdmin,
        refetchCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
