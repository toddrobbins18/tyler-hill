import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmailConfig {
  id: string;
  email_type: string;
  recipient_tags: string[];
  enabled: boolean;
  updated_at: string;
}

const EMAIL_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  incident_report: {
    label: "Incident Reports",
    description: "When new incident reports are created or updated"
  },
  missed_medication: {
    label: "Missed Medication Alerts",
    description: "When scheduled medications are not administered"
  },
  transportation_event: {
    label: "Transportation Events",
    description: "When trips or field trips are created or updated"
  },
  health_center_admission: {
    label: "Health Center Admissions",
    description: "When a child is admitted to the health center"
  },
  health_center_checkout: {
    label: "Health Center Checkouts",
    description: "When a child checks out from the health center"
  },
  sports_event_update: {
    label: "Sports Event Updates",
    description: "When sports events are created or updated"
  },
  trip_update: {
    label: "Trip Updates",
    description: "When trips are created or updated"
  },
  user_approval_request: {
    label: "User Approval Requests",
    description: "When new users request approval"
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
  "admin_staff"
];

const TAG_COLORS: Record<string, string> = {
  nurse: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  transportation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  food_service: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  specialist: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  division_leader: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  director: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  general_staff: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  admin_staff: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200"
};

export default function AutomatedEmailConfig() {
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from("automated_email_config")
        .select("*")
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
                <div className="space-y-3">
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
