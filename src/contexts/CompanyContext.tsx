import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { applyThemeColor } from '@/utils/themeUtils';
import { useAuth } from './AuthContext';
import { invalidateCampScopedQueries } from '@/lib/queryClient';

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
  const { user, isSuperAdmin: authIsSuperAdmin, loading: authLoading } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Track if initial load has happened to prevent re-setting company on token refresh
  const hasInitializedRef = useRef(false);
  // Track if a company switch is in progress to prevent race conditions
  const isSwitchingRef = useRef(false);

  // Load company data when auth is ready.
  // Include authIsSuperAdmin: on login, user can appear before roles resolve; without this
  // dependency the camp switcher stays hidden until a full page refresh.
  useEffect(() => {
    if (!authLoading && user) {
      loadCompanyData(true);
    } else if (!authLoading && !user) {
      // No user, clear everything
      setCurrentCompany(null);
      setAvailableCompanies([]);
      setLoading(false);
      hasInitializedRef.current = false;
      sessionStorage.removeItem('viewing_company_id');
    }
  }, [authLoading, user?.id, authIsSuperAdmin]);

  // Listen for auth state changes (for sign out)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentCompany(null);
        setAvailableCompanies([]);
        setLoading(false);
        hasInitializedRef.current = false;
        sessionStorage.removeItem('viewing_company_id');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadCompanyData = async (isInitialLoad: boolean = false) => {
    // Skip if already initialized and not initial load
    if (hasInitializedRef.current && !isInitialLoad) {
      return;
    }
    
    // Skip if a company switch is in progress
    if (isSwitchingRef.current) {
      return;
    }

    // Skip if no user (auth already validated this)
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Read saved viewing company early
      const savedViewingId = sessionStorage.getItem('viewing_company_id');

      // Fetch profile + company data in parallel with companies list for super admins or multi-camp users
      // Users with multiple role assignments across camps (like Welsford) need to see all their camps
      const profilePromise = supabase
        .from('profiles')
        .select('company_id, companies(id, name, slug, logo_url, theme_color, zip_code, owl_pay_enabled, camp_type)')
        .eq('id', user.id)
        .single();
        
      // Resolve roles here (not only from AuthContext) so a stale isSuperAdmin=false
      // after login cannot permanently hide the multi-camp switcher.
      const rolesPromise = supabase
        .from('user_roles')
        .select('role, company_id')
        .eq('user_id', user.id);

      const [profileResult, rolesResult] = await Promise.all([profilePromise, rolesPromise]);
      const profile = profileResult.data;
      const roleRows = rolesResult.data || [];
      const isSuperAdminUser =
        authIsSuperAdmin || roleRows.some((r) => String(r.role).toLowerCase() === 'super_admin');

      // Determine which companies the user should have access to in the switcher
      let allowedCompanyIds: string[] = [];
      if (!isSuperAdminUser) {
        const uniqueIds = new Set(
          roleRows
            .map((r) => r.company_id)
            .filter((id): id is string => id !== null)
        );

        // Always include their primary profile company if set
        if (profile?.company_id) {
          uniqueIds.add(profile.company_id);
        }

        allowedCompanyIds = Array.from(uniqueIds);
      }

      // Only fetch the companies the user has access to (or all if super admin).
      // Super admins see inactive camps too (is_active=false is for email/cron only).
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
        // If not super admin and no roles found, they only get their primary company (handled below)
        companiesQuery = supabase.from('companies').select('id').eq('id', '00000000-0000-0000-0000-000000000000'); // Returns empty
      }

      const companiesResult = await companiesQuery;
      const companies = companiesResult.data;

      // For super admins AND multi-camp users, set available companies
      if (companies && companies.length > 0) {
        setAvailableCompanies(companies);
      } else if (profile?.companies && !Array.isArray(profile.companies)) {
        // Fallback for single-camp users
        setAvailableCompanies([profile.companies as unknown as Company]);
      }

      // Determine which company to set as current
      let targetCompany: Company | null = null;

      if (savedViewingId && companies) {
        // Any user with multiple camps and a saved viewing company
        targetCompany = companies.find(c => c.id === savedViewingId) || null;
      }

      if (!targetCompany && companies && profile?.company_id) {
        // Fallback to their primary company
        targetCompany = companies.find(c => c.id === profile.company_id) || null;
      }

      if (!targetCompany && companies && companies.length > 0) {
        // Fallback to first active camp
        targetCompany = companies[0];
      }

      if (!targetCompany && profile?.companies) {
        // Regular user or extreme fallback
        targetCompany = profile.companies as unknown as Company;
      }

      if (targetCompany) {
        setCurrentCompany(targetCompany);
        if (targetCompany.theme_color) {
          applyThemeColor(targetCompany.theme_color, { companySlug: targetCompany.slug });
        }
      }

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
    await loadCompanyData(true);
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
