import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Upload, Pencil, Users, Link, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { Separator } from "@/components/ui/separator";

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_color: string;
  is_active: boolean;
  campminder_sync_enabled: boolean;
  campminder_last_sync_at: string | null;
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
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [newCompany, setNewCompany] = useState<Partial<Company>>({
    name: '',
    slug: '',
    theme_color: '#0066cc',
    is_active: true,
  });
  
  // CampMinder integration state
  const [campminderApiKey, setCampminderApiKey] = useState('');
  const [campminderSubscriptionKey, setCampminderSubscriptionKey] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { refetchCompanies } = useCompany();

  useEffect(() => {
    fetchCompanies();
  }, []);

  // Reset CampMinder state when editing company changes
  useEffect(() => {
    if (editingCompany) {
      setCampminderApiKey('');
      setCampminderSubscriptionKey('');
      setConnectionStatus('idle');
      setConnectionError(null);
    }
  }, [editingCompany?.id]);

  const fetchCompanies = async () => {
    try {
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select('id, name, slug, logo_url, theme_color, is_active, campminder_sync_enabled, campminder_last_sync_at')
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

  const handleCreateCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      // Generate slug from name if not provided
      const slug = newCompany.slug || newCompany.name?.toLowerCase().replace(/\s+/g, '-') || '';

      // Check if slug is unique
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existingCompany) {
        toast({
          title: "Error",
          description: "A company with this slug already exists",
          variant: "destructive",
        });
        return;
      }

      let logoUrl = null;

      // Upload logo if file selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${slug}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(fileName, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('company-logos')
          .getPublicUrl(fileName);

        logoUrl = publicUrl;
      }

      const { error } = await supabase
        .from('companies')
        .insert({
          name: newCompany.name!,
          slug,
          theme_color: newCompany.theme_color || '#0066cc',
          logo_url: logoUrl,
          is_active: newCompany.is_active ?? true,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company created successfully",
      });

      setCreatingCompany(false);
      setNewCompany({
        name: '',
        slug: '',
        theme_color: '#0066cc',
        is_active: true,
      });
      setLogoFile(null);
      fetchCompanies();
      refetchCompanies();
    } catch (error) {
      console.error('Error creating company:', error);
      toast({
        title: "Error",
        description: "Failed to create company",
        variant: "destructive",
      });
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

      // Build update object
      const updateData: Record<string, unknown> = {
        name: editingCompany.name,
        theme_color: editingCompany.theme_color,
        logo_url: logoUrl,
        is_active: editingCompany.is_active,
        campminder_sync_enabled: editingCompany.campminder_sync_enabled,
      };

      // If CampMinder credentials are provided, encrypt and store them
      if (campminderApiKey && campminderSubscriptionKey) {
        // Encrypt API key
        const { data: encryptedApiKey, error: apiKeyError } = await supabase
          .rpc('encrypt_secret', { secret: campminderApiKey });
        
        if (apiKeyError) throw apiKeyError;

        // Encrypt subscription key
        const { data: encryptedSubKey, error: subKeyError } = await supabase
          .rpc('encrypt_secret', { secret: campminderSubscriptionKey });
        
        if (subKeyError) throw subKeyError;

        updateData.campminder_api_key_encrypted = encryptedApiKey;
        updateData.campminder_subscription_key_encrypted = encryptedSubKey;
      }

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', editingCompany.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company updated successfully",
      });

      setEditingCompany(null);
      setLogoFile(null);
      setCampminderApiKey('');
      setCampminderSubscriptionKey('');
      setConnectionStatus('idle');
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

  const handleTestConnection = async () => {
    if (!editingCompany) return;
    
    setTestingConnection(true);
    setConnectionStatus('idle');
    setConnectionError(null);

    try {
      // If new credentials are provided, save them first
      if (campminderApiKey && campminderSubscriptionKey) {
        // Encrypt and save credentials temporarily for testing
        const { data: encryptedApiKey, error: apiKeyError } = await supabase
          .rpc('encrypt_secret', { secret: campminderApiKey });
        
        if (apiKeyError) throw apiKeyError;

        const { data: encryptedSubKey, error: subKeyError } = await supabase
          .rpc('encrypt_secret', { secret: campminderSubscriptionKey });
        
        if (subKeyError) throw subKeyError;

        // Update credentials first
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            campminder_api_key_encrypted: encryptedApiKey,
            campminder_subscription_key_encrypted: encryptedSubKey,
          })
          .eq('id', editingCompany.id);

        if (updateError) throw updateError;
      }

      // Call test connection edge function
      const { data, error } = await supabase.functions.invoke('test-campminder-connection', {
        body: { company_id: editingCompany.id },
      });

      if (error) throw error;

      if (data?.success) {
        setConnectionStatus('success');
        toast({
          title: "Connection Successful",
          description: "CampMinder API credentials are valid",
        });
      } else {
        setConnectionStatus('error');
        setConnectionError(data?.error || 'Connection failed');
        toast({
          title: "Connection Failed",
          description: data?.error || "Could not connect to CampMinder",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error('Error testing connection:', error);
      setConnectionStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConnectionError(errorMessage);
      toast({
        title: "Error",
        description: "Failed to test connection",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Management
              </CardTitle>
              <CardDescription>
                Manage all companies in the multi-tenant system
              </CardDescription>
            </div>
            <Dialog open={creatingCompany} onOpenChange={setCreatingCompany}>
              <DialogTrigger asChild>
                <Button>
                  <Building2 className="h-4 w-4 mr-2" />
                  Create New Company
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New Company</DialogTitle>
                  <DialogDescription>
                    Add a new company to the multi-tenant system
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateCompany} className="space-y-4">
                  <div>
                    <Label htmlFor="new-name">Company Name</Label>
                    <Input
                      id="new-name"
                      value={newCompany.name || ''}
                      onChange={(e) => {
                        const name = e.target.value;
                        setNewCompany(prev => ({ 
                          ...prev, 
                          name,
                          slug: name.toLowerCase().replace(/\s+/g, '-')
                        }));
                      }}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-slug">Slug</Label>
                    <Input
                      id="new-slug"
                      value={newCompany.slug || ''}
                      onChange={(e) => setNewCompany(prev => ({ 
                        ...prev, 
                        slug: e.target.value.toLowerCase().replace(/\s+/g, '-')
                      }))}
                      placeholder="company-slug"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-theme_color">Theme Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="new-theme_color"
                        type="color"
                        value={newCompany.theme_color || '#0066cc'}
                        onChange={(e) => setNewCompany(prev => ({ 
                          ...prev, 
                          theme_color: e.target.value
                        }))}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={newCompany.theme_color || '#0066cc'}
                        onChange={(e) => setNewCompany(prev => ({ 
                          ...prev, 
                          theme_color: e.target.value
                        }))}
                        placeholder="#0066cc"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="new-logo">Company Logo (Optional)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="new-logo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      />
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="new-is_active"
                      checked={newCompany.is_active ?? true}
                      onChange={(e) => setNewCompany(prev => ({ 
                        ...prev, 
                        is_active: e.target.checked
                      }))}
                      className="rounded"
                    />
                    <Label htmlFor="new-is_active">Active</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCreatingCompany(false);
                        setNewCompany({
                          name: '',
                          slug: '',
                          theme_color: '#0066cc',
                          is_active: true,
                        });
                        setLogoFile(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create Company</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
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
                        {company.campminder_sync_enabled && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
                            <Link className="h-3 w-3" />
                            CampMinder Connected
                            {company.campminder_last_sync_at && (
                              <span className="text-muted-foreground ml-1">
                                (Last sync: {new Date(company.campminder_last_sync_at).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                        )}
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
                        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Edit Company</DialogTitle>
                            <DialogDescription>
                              Update company details, logo, and integrations
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
                            
                            <Separator className="my-4" />
                            
                            {/* CampMinder Integration Section */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Link className="h-4 w-4" />
                                <Label className="text-base font-semibold">CampMinder Integration</Label>
                              </div>
                              
                              <div>
                                <Label htmlFor="campminder_api_key">API Key</Label>
                                <Input
                                  id="campminder_api_key"
                                  type="password"
                                  value={campminderApiKey}
                                  onChange={(e) => setCampminderApiKey(e.target.value)}
                                  placeholder="Enter API Key (leave blank to keep existing)"
                                />
                              </div>
                              
                              <div>
                                <Label htmlFor="campminder_subscription_key">Subscription Key</Label>
                                <Input
                                  id="campminder_subscription_key"
                                  type="password"
                                  value={campminderSubscriptionKey}
                                  onChange={(e) => setCampminderSubscriptionKey(e.target.value)}
                                  placeholder="Enter Subscription Key (leave blank to keep existing)"
                                />
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id="campminder_sync_enabled"
                                  checked={editingCompany?.campminder_sync_enabled || false}
                                  onChange={(e) => setEditingCompany(prev => 
                                    prev ? { ...prev, campminder_sync_enabled: e.target.checked } : null
                                  )}
                                  className="rounded"
                                />
                                <Label htmlFor="campminder_sync_enabled">Enable CampMinder Sync</Label>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleTestConnection}
                                  disabled={testingConnection}
                                >
                                  {testingConnection ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Testing...
                                    </>
                                  ) : (
                                    'Test Connection'
                                  )}
                                </Button>
                                
                                {connectionStatus === 'success' && (
                                  <span className="flex items-center gap-1 text-sm text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    Connected
                                  </span>
                                )}
                                
                                {connectionStatus === 'error' && (
                                  <span className="flex items-center gap-1 text-sm text-destructive">
                                    <XCircle className="h-4 w-4" />
                                    {connectionError || 'Failed'}
                                  </span>
                                )}
                              </div>
                              
                              {editingCompany?.campminder_last_sync_at && (
                                <p className="text-xs text-muted-foreground">
                                  Last sync: {new Date(editingCompany.campminder_last_sync_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                            
                            <Separator className="my-4" />
                            
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
                                  setCampminderApiKey('');
                                  setCampminderSubscriptionKey('');
                                  setConnectionStatus('idle');
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
