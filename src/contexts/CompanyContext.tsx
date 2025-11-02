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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if super admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      const isSuperAdminUser = !!roleData;
      setIsSuperAdmin(isSuperAdminUser);

      // Get user's company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, companies(id, name, slug, logo_url, theme_color)')
        .eq('id', user.id)
        .single();

      if (profile?.companies) {
        setCurrentCompany(profile.companies as any);
        // Apply theme color
        if ((profile.companies as any).theme_color) {
          applyThemeColor((profile.companies as any).theme_color);
        }
      }

      // If super admin, load all companies
      if (isSuperAdminUser) {
        const { data: companies } = await supabase
          .from('companies')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (companies) {
          setAvailableCompanies(companies);
          
          // Check if there's a saved viewing company in sessionStorage
          const savedViewingId = sessionStorage.getItem('viewing_company_id');
          if (savedViewingId) {
            const viewingCompany = companies.find(c => c.id === savedViewingId);
            if (viewingCompany) {
              setCurrentCompany(viewingCompany);
              applyThemeColor(viewingCompany.theme_color);
            }
          }
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
    try {
      const company = availableCompanies.find(c => c.id === companyId);
      if (company) {
        console.log('🔄 Switching to company:', company.name, 'Color:', company.theme_color);
        
        // Save to sessionStorage for super admins
        sessionStorage.setItem('viewing_company_id', companyId);
        setCurrentCompany(company);
        
        // Apply theme color immediately
        if (company.theme_color) {
          applyThemeColor(company.theme_color);
          
          // Force re-render after a brief delay to ensure DOM updates
          setTimeout(() => {
            console.log('🔄 Re-applying theme after timeout');
            applyThemeColor(company.theme_color);
          }, 100);
        }
        
        toast({
          title: "Viewing Company",
          description: `Now viewing ${company.name}`,
        });
      }
    } catch (error) {
      console.error('Error switching company:', error);
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
