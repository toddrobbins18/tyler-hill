import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { applyThemeColor } from '@/utils/themeUtils';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_color: string;
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

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
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
        .select('company_id, companies(id, name, slug, logo_url, theme_color)')
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
          }
        } else {
          console.warn('⚠️ [CompanyContext] No companies returned from query');
        }
      }
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
    await loadCompanyData();
  };

  const switchCompany = async (companyId: string) => {
    console.log('🔄 [CompanyContext] switchCompany called with ID:', companyId);
    console.log('🔄 [CompanyContext] Available companies:', availableCompanies.map(c => ({ id: c.id, name: c.name })));
    
    try {
      const company = availableCompanies.find(c => c.id === companyId);
      if (!company) {
        console.error('❌ [CompanyContext] Company not found in available companies!');
        toast({
          title: "Error",
          description: "Company not found",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ [CompanyContext] Switching to company:', company.name, 'Color:', company.theme_color);
      
      // Save to sessionStorage for super admins
      sessionStorage.setItem('viewing_company_id', companyId);
      console.log('💾 [CompanyContext] Saved to sessionStorage');
      
      setCurrentCompany(company);
      console.log('✅ [CompanyContext] Current company updated');
      
      // Apply theme color immediately
      if (company.theme_color) {
        console.log('🎨 [CompanyContext] Applying theme color:', company.theme_color);
        applyThemeColor(company.theme_color);
        
        // Force re-render after a brief delay to ensure DOM updates
        setTimeout(() => {
          console.log('🔄 [CompanyContext] Re-applying theme after timeout');
          applyThemeColor(company.theme_color);
        }, 100);
      }
      
      toast({
        title: "Viewing Company",
        description: `Now viewing ${company.name}`,
      });
      
      console.log('✅ [CompanyContext] Company switch completed successfully');
    } catch (error) {
      console.error('❌ [CompanyContext] Error switching company:', error);
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
