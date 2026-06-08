import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { applyThemeColor } from '@/utils/themeUtils';
import { useAuth } from './AuthContext';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_color: string;
  zip_code?: string | null;
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

  // Load company data when auth is ready
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
  }, [authLoading, user?.id]);

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

      // Fetch profile + company data in parallel with companies list for super admins
      const profilePromise = supabase
        .from('profiles')
        .select('company_id, companies(id, name, slug, logo_url, theme_color, zip_code, owl_pay_enabled)')
        .eq('id', user.id)
        .single();

      const companiesPromise = authIsSuperAdmin 
        ? supabase
            .from('companies')
            .select('id, name, slug, logo_url, theme_color, zip_code, owl_pay_enabled')
            .eq('is_active', true)
            .order('name')
        : Promise.resolve({ data: null, error: null });

      const [profileResult, companiesResult] = await Promise.all([profilePromise, companiesPromise]);

      const profile = profileResult.data;
      const companies = companiesResult.data;

      // For super admins, set available companies
      if (authIsSuperAdmin && companies) {
        setAvailableCompanies(companies);
      }

      // Determine which company to set as current
      let targetCompany: Company | null = null;

      if (authIsSuperAdmin && savedViewingId && companies) {
        // Super admin with saved viewing company
        targetCompany = companies.find(c => c.id === savedViewingId) || null;
      }

      if (!targetCompany && authIsSuperAdmin && companies && profile?.company_id) {
        // Super admin fallback to their primary company
        targetCompany = companies.find(c => c.id === profile.company_id) || null;
      }

      if (!targetCompany && authIsSuperAdmin && companies && companies.length > 0) {
        // Super admin with no saved/profile company — default to first active camp
        targetCompany = companies[0];
      }

      if (!targetCompany && profile?.companies) {
        // Regular user or fallback
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

      // Save to sessionStorage for super admins FIRST
      sessionStorage.setItem('viewing_company_id', companyId);
      
      // Update state synchronously
      setCurrentCompany(company);
      
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
