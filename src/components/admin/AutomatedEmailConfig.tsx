import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Clock } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { Checkbox } from "@/components/ui/checkbox";

interface EmailConfig {
  id: string;
  email_type: string;
  recipient_tags: string[];
  enabled: boolean;
  updated_at: string;
  send_timing: string[];
}

const EMAIL_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  incident_report: {
    label: "Incident Reports",
    description: "Division leaders see only their divisions"
  },
  missed_medication: {
    label: "Missed Medication Alerts",
    description: "When scheduled medications are not administered - division leaders see only their divisions"
  },
  transportation_events: {
    label: "Transportation Events",
    description: "When transportation events are scheduled or updated"
  },
  health_center_admission: {
    label: "Health Center Admissions",
    description: "Division leaders see only their divisions"
  },
  health_center_checkout: {
    label: "Health Center Checkouts",
    description: "Division leaders see only their divisions"
  },
  sports_event_home: {
    label: "Sports Events (Home)",
    description: "Division leaders see only their divisions, specialists see only their sports"
  },
  sports_event_away: {
    label: "Sports Events (Away)",
    description: "Division leaders see only their divisions, specialists see only their sports"
  },
  trip_update: {
    label: "Trip Updates",
    description: "Division leaders see only their divisions"
  },
  tutoring_therapy: {
    label: "Tutoring & Therapy",
    description: "Division leaders see only their divisions"
  },
  sports_academy: {
    label: "Sports Academy",
    description: "Division leaders see only their divisions, specialists see only their sports"
  },
  user_approval_request: {
    label: "User Approval Requests",
    description: "When new users request access to the system"
  },
  appointment: {
    label: "Appointments",
    description: "Medical and therapy appointments - division leaders see only their divisions"
  }
};

const AVAILABLE_TAGS = [
  "nurse",
  "transportation",
  "food_service",
  "specialist",
  "division_leader",
  "director",
  "general_staff",
  "admin_staff",
  "head_of_girls_side",
  "head_of_boys_side"
];

const TAG_COLORS: Record<string, string> = {
  nurse: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  transportation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  food_service: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  specialist: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  division_leader: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  director: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  general_staff: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  admin_staff: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  head_of_girls_side: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  head_of_boys_side: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200"
};

const TIMING_OPTIONS: Record<string, {
  value: string;
  label: string;
  description: string;
  applicableTo: string[];
}> = {
  on_create: {
    value: 'on_create',
    label: 'When Created',
    description: 'Send immediately when record is created',
    applicableTo: ['all']
  },
  on_update: {
    value: 'on_update',
    label: 'When Updated',
    description: 'Send immediately when record is updated',
    applicableTo: ['all']
  },
  day_before: {
    value: 'day_before',
    label: 'Day Before',
    description: 'Send 24 hours before the event',
    applicableTo: ['sports_event_home', 'sports_event_away', 'trip_update', 'transportation_events', 'tutoring_therapy', 'sports_academy', 'appointment']
  },
  morning_of: {
    value: 'morning_of',
    label: 'Morning Of (8 AM)',
    description: 'Send at 8:00 AM on the event day',
    applicableTo: ['sports_event_home', 'sports_event_away', 'trip_update']
  },
  '2_hours_before': {
    value: '2_hours_before',
    label: '2 Hours Before',
    description: 'Send 2 hours before event time',
    applicableTo: ['sports_event_home', 'sports_event_away', 'trip_update']
  },
  '4_hours_before': {
    value: '4_hours_before',
    label: '4 Hours Before',
    description: 'Send 4 hours before event time',
    applicableTo: ['sports_event_home', 'sports_event_away', 'trip_update']
  },
  '1_week_before': {
    value: '1_week_before',
    label: '1 Week Before',
    description: 'Send 7 days before the event',
    applicableTo: ['sports_event_home', 'sports_event_away', 'trip_update']
  }
};

export default function AutomatedEmailConfig() {
  const { currentCompany, isSuperAdmin } = useCompany();
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (currentCompany) {
      fetchConfigs();
    }
  }, [currentCompany?.id]);

  const fetchConfigs = async () => {
    if (!currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from("automated_email_config")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("email_type");

      if (error) throw error;
      setConfigs(data || []);
    } catch (error: any) {
      console.error("Error fetching email configs:", error);
      toast.error("Failed to load email configurations");
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (id: string, updates: Partial<EmailConfig>) => {
    setUpdating(id);
    try {
      const { error } = await supabase
        .from("automated_email_config")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      setConfigs(configs.map(c => c.id === id ? { ...c, ...updates } : c));
      toast.success("Configuration updated");
    } catch (error: any) {
      console.error("Error updating config:", error);
      toast.error("Failed to update configuration");
    } finally {
      setUpdating(null);
    }
  };

  const toggleTag = (configId: string, tag: string, currentTags: string[]) => {
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    updateConfig(configId, { recipient_tags: newTags });
  };

  const toggleTiming = (configId: string, timing: string, currentTimings: string[]) => {
    const newTimings = currentTimings.includes(timing)
      ? currentTimings.filter(t => t !== timing)
      : [...currentTimings, timing];
    updateConfig(configId, { send_timing: newTimings });
  };

  const getApplicableTimings = (emailType: string) => {
    return Object.values(TIMING_OPTIONS).filter(option => 
      option.applicableTo.includes('all') || option.applicableTo.includes(emailType)
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Automated Email Configuration</h2>
        <p className="text-muted-foreground">
          Configure which user tags receive automated email notifications for different events.
        </p>
      </div>

      {isSuperAdmin && currentCompany && (
        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-sm">
              👑 Super Admin View
            </CardTitle>
            <CardDescription>
              Currently viewing email configurations for: <strong>{currentCompany.name}</strong>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4">
        {configs.map((config) => {
          const typeInfo = EMAIL_TYPE_LABELS[config.email_type];
          
          return (
            <Card key={config.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-lg">{typeInfo?.label || config.email_type}</CardTitle>
                    </div>
                    <CardDescription>{typeInfo?.description || "Automated email notification"}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Enabled</span>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(enabled) => updateConfig(config.id, { enabled })}
                      disabled={updating === config.id}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Recipient Tags
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_TAGS.map((tag) => {
                        const isSelected = config.recipient_tags.includes(tag);
                        return (
                          <Button
                            key={tag}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleTag(config.id, tag, config.recipient_tags)}
                            disabled={updating === config.id}
                            className="h-7"
                          >
                            {tag.replace(/_/g, " ")}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {config.recipient_tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      {config.recipient_tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className={TAG_COLORS[tag] || ""}
                        >
                          {tag.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <label className="text-sm font-medium text-foreground">
                        Send Timing (select multiple)
                      </label>
                    </div>
                    <div className="grid gap-3">
                      {getApplicableTimings(config.email_type).map((timing) => {
                        const isSelected = config.send_timing?.includes(timing.value) || false;
                        return (
                          <div key={timing.value} className="flex items-start space-x-3">
                            <Checkbox
                              id={`${config.id}-${timing.value}`}
                              checked={isSelected}
                              onCheckedChange={() => 
                                toggleTiming(config.id, timing.value, config.send_timing || ['on_create'])
                              }
                              disabled={updating === config.id}
                            />
                            <div className="grid gap-1 leading-none">
                              <label
                                htmlFor={`${config.id}-${timing.value}`}
                                className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {timing.label}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {timing.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {config.send_timing && config.send_timing.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Selected timings:</p>
                        <div className="flex flex-wrap gap-2">
                          {config.send_timing.map((timing) => (
                            <Badge key={timing} variant="outline" className="text-xs">
                              {TIMING_OPTIONS[timing]?.label || timing}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Last updated: {new Date(config.updated_at).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
