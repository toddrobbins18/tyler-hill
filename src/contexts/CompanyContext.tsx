import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { applyThemeColor } from '@/utils/themeUtils';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_color: string;
  zip_code?: string | null;
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
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const { toast } = useToast();

  // Track if initial load has happened to prevent re-setting company on token refresh
  const hasInitializedRef = useRef(false);
  // Track if a company switch is in progress to prevent race conditions
  const isSwitchingRef = useRef(false);

  useEffect(() => {
    loadCompanyData(true); // Initial load

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 [CompanyContext] Auth state changed:', event);
        if (event === 'SIGNED_IN' && session) {
          console.log('✅ [CompanyContext] User signed in, reloading company data...');
          setTimeout(() => {
            loadCompanyData(true);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 [CompanyContext] User signed out, clearing company data');
          setCurrentCompany(null);
          setAvailableCompanies([]);
          setIsSuperAdmin(false);
          setLoading(false);
          hasInitializedRef.current = false;
          sessionStorage.removeItem('viewing_company_id');
        } else if (event === 'TOKEN_REFRESHED') {
          // Don't reset company on token refresh - just log it
          console.log('🔄 [CompanyContext] Token refreshed, keeping current company');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadCompanyData = async (isInitialLoad: boolean = false) => {
    // Skip if already initialized and not initial load (e.g. token refresh)
    if (hasInitializedRef.current && !isInitialLoad) {
      console.log('🔄 [CompanyContext] Skipping reload - already initialized');
      return;
    }
    
    // Skip if a company switch is in progress
    if (isSwitchingRef.current) {
      console.log('🔄 [CompanyContext] Skipping reload - company switch in progress');
      return;
    }

    try {
      console.log('🔍 [CompanyContext] Loading company data...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ [CompanyContext] No user found');
        setLoading(false);
        return;
      }
      console.log('✅ [CompanyContext] User found:', user.email);

      // Check if super admin
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (roleError) {
        console.error('❌ [CompanyContext] Error checking super admin:', roleError);
      }

      const isSuperAdminUser = !!roleData;
      console.log('🔐 [CompanyContext] Is super admin:', isSuperAdminUser);
      setIsSuperAdmin(isSuperAdminUser);

      // Get user's company
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id, companies(id, name, slug, logo_url, theme_color, zip_code)')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('❌ [CompanyContext] Error fetching profile:', profileError);
      }

      if (profile?.companies) {
        console.log('🏢 [CompanyContext] User company:', (profile.companies as any).name);
        setCurrentCompany(profile.companies as any);
        // Apply theme color
        if ((profile.companies as any).theme_color) {
          applyThemeColor((profile.companies as any).theme_color);
        }
      } else {
        console.warn('⚠️ [CompanyContext] No company found for user');
      }

      // If super admin, load all companies
      if (isSuperAdminUser) {
        console.log('👑 [CompanyContext] Loading all companies for super admin...');
        const { data: companies, error: companiesError } = await supabase
          .from('companies')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (companiesError) {
          console.error('❌ [CompanyContext] Error fetching companies:', companiesError);
        }

        if (companies) {
          console.log('🏢 [CompanyContext] Found companies:', companies.length, companies.map(c => c.name));
          setAvailableCompanies(companies);
          
          // Check if there's a saved viewing company in sessionStorage
          const savedViewingId = sessionStorage.getItem('viewing_company_id');
          console.log('💾 [CompanyContext] Saved viewing ID:', savedViewingId);
          
          if (savedViewingId) {
            const viewingCompany = companies.find(c => c.id === savedViewingId);
            if (viewingCompany) {
              console.log('✅ [CompanyContext] Restoring saved company:', viewingCompany.name);
              setCurrentCompany(viewingCompany);
              applyThemeColor(viewingCompany.theme_color);
            } else {
              console.warn('⚠️ [CompanyContext] Saved company ID not found in companies list');
            }
          } else if (profile?.company_id) {
            // No saved viewing company, set to user's primary company with full record including zip_code
            const defaultCompany = companies.find(c => c.id === profile.company_id);
            if (defaultCompany) {
              console.log('✅ [CompanyContext] Setting default company with zip_code:', defaultCompany.name);
              setCurrentCompany(defaultCompany);
              applyThemeColor(defaultCompany.theme_color);
            }
          }
        } else {
          console.warn('⚠️ [CompanyContext] No companies returned from query');
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
    console.log('🔄 [CompanyContext] switchCompany called with ID:', companyId);
    console.log('🔄 [CompanyContext] Available companies:', availableCompanies.map(c => ({ id: c.id, name: c.name })));
    
    // Set switching flag to prevent race conditions with loadCompanyData
    isSwitchingRef.current = true;
    
    try {
      const company = availableCompanies.find(c => c.id === companyId);
      if (!company) {
        console.error('❌ [CompanyContext] Company not found in available companies!');
        toast({
          title: "Error",
          description: "Company not found",
          variant: "destructive",
        });
        isSwitchingRef.current = false;
        return;
      }

      console.log('✅ [CompanyContext] Switching to company:', company.name, 'Color:', company.theme_color);
      
      // Save to sessionStorage for super admins FIRST
      sessionStorage.setItem('viewing_company_id', companyId);
      console.log('💾 [CompanyContext] Saved to sessionStorage');
      
      // Update state synchronously
      setCurrentCompany(company);
      console.log('✅ [CompanyContext] Current company updated');
      
      // Apply theme color immediately
      if (company.theme_color) {
        console.log('🎨 [CompanyContext] Applying theme color:', company.theme_color);
        applyThemeColor(company.theme_color);
      }
      
      toast({
        title: "Viewing Company",
        description: `Now viewing ${company.name}`,
      });
      
      console.log('✅ [CompanyContext] Company switch completed successfully');
      
      // Clear switching flag after a brief delay to allow state to propagate
      setTimeout(() => {
        isSwitchingRef.current = false;
      }, 500);
    } catch (error) {
      console.error('❌ [CompanyContext] Error switching company:', error);
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
        loading,
        isSuperAdmin,
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
