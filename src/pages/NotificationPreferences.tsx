import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Clock, Mail, Plus, X, Save } from "lucide-react";

interface NotificationPreference {
  id?: string;
  notification_type: string;
  enabled: boolean;
  timing_options: string[];
  delivery_methods: string[];
}

const NOTIFICATION_TYPES = [
  { value: 'sports_academy', label: 'Sports Academy', description: 'Alerts for sports academy sessions' },
  { value: 'tutoring_therapy', label: 'Tutoring & Therapy', description: 'Scheduled tutoring/therapy reminders' },
  { value: 'appointments', label: 'Appointments', description: 'Medical and other appointments' },
  { value: 'activities_field_trips', label: 'Activities & Field Trips', description: 'Upcoming activities and trips' },
  { value: 'sports_events', label: 'Sports Events', description: 'Scheduled games and sports events' },
  { value: 'calendar_events', label: 'Calendar Events', description: 'Master calendar events' },
  { value: 'incident_reports', label: 'Incident Reports', description: 'When incidents are reported' },
  { value: 'health_center', label: 'Health Center', description: 'Health center admissions/discharges' },
];

const DELIVERY_METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'in_app', label: 'In-App' },
];

export default function NotificationPreferences() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customTiming, setCustomTiming] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPreferences();
  }, [currentCompany?.id, user?.id]);

  const fetchPreferences = async () => {
    if (!currentCompany?.id || !user?.id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .eq('company_id', currentCompany.id);

    if (error) {
      console.error('Error fetching preferences:', error);
      toast.error('Failed to load notification preferences');
    } else {
      // Initialize with defaults if not set
      const existingPrefs = data || [];
      const allPrefs = NOTIFICATION_TYPES.map(type => {
        const existing = existingPrefs.find(p => p.notification_type === type.value);
        if (existing) {
          return {
            id: existing.id,
            notification_type: existing.notification_type,
            enabled: existing.enabled ?? false,
            timing_options: Array.isArray(existing.timing_options) ? existing.timing_options as string[] : [],
            delivery_methods: Array.isArray(existing.delivery_methods) ? existing.delivery_methods as string[] : ['email'],
          };
        }
        return {
          notification_type: type.value,
          enabled: false,
          timing_options: [],
          delivery_methods: ['email'],
        };
      });
      setPreferences(allPrefs);
    }
    setLoading(false);
  };

  const updatePreference = (type: string, updates: Partial<NotificationPreference>) => {
    setPreferences(prev => prev.map(p => 
      p.notification_type === type ? { ...p, ...updates } : p
    ));
  };

  const addCustomTiming = (type: string) => {
    const timing = customTiming[type];
    if (!timing) return;
    
    const pref = preferences.find(p => p.notification_type === type);
    if (pref && !pref.timing_options.includes(timing)) {
      updatePreference(type, { timing_options: [...pref.timing_options, timing] });
      setCustomTiming(prev => ({ ...prev, [type]: '' }));
    }
  };

  const removeTiming = (type: string, timing: string) => {
    const pref = preferences.find(p => p.notification_type === type);
    if (pref) {
      updatePreference(type, { timing_options: pref.timing_options.filter(t => t !== timing) });
    }
  };

  const handleSave = async () => {
    if (!currentCompany?.id || !user?.id) return;
    
    setSaving(true);
    try {
      // Upsert all preferences
      for (const pref of preferences) {
        const { error } = await supabase
          .from('user_notification_preferences')
          .upsert({
            user_id: user.id,
            company_id: currentCompany.id,
            notification_type: pref.notification_type,
            enabled: pref.enabled,
            timing_options: pref.timing_options,
            delivery_methods: pref.delivery_methods,
          }, { onConflict: 'user_id,company_id,notification_type' });

        if (error) throw error;
      }
      
      toast.success('Notification preferences saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Notification Preferences</h1>
          <p className="text-muted-foreground">Configure your personal notification settings</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-4">
        {NOTIFICATION_TYPES.map(type => {
          const pref = preferences.find(p => p.notification_type === type.value);
          if (!pref) return null;

          return (
            <Card key={type.value}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{type.label}</CardTitle>
                      <CardDescription>{type.description}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={pref.enabled}
                    onCheckedChange={(enabled) => updatePreference(type.value, { enabled })}
                  />
                </div>
              </CardHeader>
              
              {pref.enabled && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Delivery Methods
                    </Label>
                    <div className="flex gap-4">
                      {DELIVERY_METHODS.map(method => (
                        <label key={method.value} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={pref.delivery_methods.includes(method.value)}
                            onCheckedChange={(checked) => {
                              const methods = checked
                                ? [...pref.delivery_methods, method.value]
                                : pref.delivery_methods.filter(m => m !== method.value);
                              updatePreference(type.value, { delivery_methods: methods });
                            }}
                          />
                          {method.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Alert Timing (when to receive alerts)
                    </Label>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      {pref.timing_options.map(timing => (
                        <Badge key={timing} variant="secondary" className="gap-1">
                          {timing}
                          <button
                            type="button"
                            onClick={() => removeTiming(type.value, timing)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {pref.timing_options.length === 0 && (
                        <span className="text-sm text-muted-foreground">No timing set - add when you want to be notified</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., 1 hour before, morning of, 30 minutes before"
                        value={customTiming[type.value] || ''}
                        onChange={(e) => setCustomTiming(prev => ({ ...prev, [type.value]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomTiming(type.value);
                          }
                        }}
                        className="flex-1"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        onClick={() => addCustomTiming(type.value)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Examples: "morning of", "1 hour before", "day before at 8am", "15 minutes before"
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}