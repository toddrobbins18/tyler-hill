import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Upload, Pencil, Users } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_color: string;
  is_active: boolean;
}

interface CompanyStats {
  users: number;
  children: number;
  staff: number;
}

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyStats, setCompanyStats] = useState<Record<string, CompanyStats>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { refetchCompanies } = useCompany();

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;

      if (companiesData) {
        setCompanies(companiesData);
        
        // Fetch stats for each company
        const stats: Record<string, CompanyStats> = {};
        for (const company of companiesData) {
          const [usersResult, childrenResult, staffResult] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
            supabase.from('children').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
            supabase.from('staff').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
          ]);

          stats[company.id] = {
            users: usersResult.count || 0,
            children: childrenResult.count || 0,
            staff: staffResult.count || 0,
          };
        }
        setCompanyStats(stats);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCompany) return;

    try {
      let logoUrl = editingCompany.logo_url;

      // Upload logo if file selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${editingCompany.slug}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('company-logos')
          .getPublicUrl(fileName);

        logoUrl = publicUrl;
      }

      const { error } = await supabase
        .from('companies')
        .update({
          name: editingCompany.name,
          theme_color: editingCompany.theme_color,
          logo_url: logoUrl,
          is_active: editingCompany.is_active,
        })
        .eq('id', editingCompany.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company updated successfully",
      });

      setEditingCompany(null);
      setLogoFile(null);
      fetchCompanies();
      refetchCompanies();
    } catch (error) {
      console.error('Error updating company:', error);
      toast({
        title: "Error",
        description: "Failed to update company",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Management
          </CardTitle>
          <CardDescription>
            Manage all companies in the multi-tenant system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {companies.map((company) => (
              <Card key={company.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {company.logo_url && (
                        <img 
                          src={company.logo_url} 
                          alt={company.name}
                          className="h-16 w-16 object-contain rounded"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold text-lg">{company.name}</h3>
                        <p className="text-sm text-muted-foreground">{company.slug}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {companyStats[company.id]?.users || 0} users
                          </span>
                          <span>{companyStats[company.id]?.children || 0} children</span>
                          <span>{companyStats[company.id]?.staff || 0} staff</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded border-2"
                        style={{ backgroundColor: company.theme_color }}
                        title={company.theme_color}
                      />
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingCompany(company)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>Edit Company</DialogTitle>
                            <DialogDescription>
                              Update company details, logo, and theme color
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleUpdateCompany} className="space-y-4">
                            <div>
                              <Label htmlFor="name">Company Name</Label>
                              <Input
                                id="name"
                                value={editingCompany?.name || ''}
                                onChange={(e) => setEditingCompany(prev => 
                                  prev ? { ...prev, name: e.target.value } : null
                                )}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="theme_color">Theme Color</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="theme_color"
                                  type="color"
                                  value={editingCompany?.theme_color || '#0066cc'}
                                  onChange={(e) => setEditingCompany(prev => 
                                    prev ? { ...prev, theme_color: e.target.value } : null
                                  )}
                                  className="w-20 h-10"
                                />
                                <Input
                                  type="text"
                                  value={editingCompany?.theme_color || '#0066cc'}
                                  onChange={(e) => setEditingCompany(prev => 
                                    prev ? { ...prev, theme_color: e.target.value } : null
                                  )}
                                  placeholder="#0066cc"
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="logo">Company Logo</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  id="logo"
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                                />
                                <Upload className="h-5 w-5 text-muted-foreground" />
                              </div>
                              {editingCompany?.logo_url && (
                                <div className="mt-2">
                                  <img 
                                    src={editingCompany.logo_url} 
                                    alt="Current logo"
                                    className="h-20 w-20 object-contain rounded border"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="is_active"
                                checked={editingCompany?.is_active || false}
                                onChange={(e) => setEditingCompany(prev => 
                                  prev ? { ...prev, is_active: e.target.checked } : null
                                )}
                                className="rounded"
                              />
                              <Label htmlFor="is_active">Active</Label>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setEditingCompany(null);
                                  setLogoFile(null);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button type="submit">Save Changes</Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
