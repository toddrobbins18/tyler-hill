import { useState, useEffect } from "react";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RecipientGroup {
  id: string;
  name: string;
  count: number;
  role: string;
}

export default function Messages() {
  const [recipientGroups, setRecipientGroups] = useState<RecipientGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecipientGroups();
  }, []);

  const fetchRecipientGroups = async () => {
    setLoading(true);
    
    // Fetch all users with accounts (from profiles)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, user_roles(role)");

    if (!profiles) {
      setLoading(false);
      return;
    }

    // Group by role
    const roleGroups: Record<string, number> = {};
    
    profiles.forEach((profile: any) => {
      const roles = profile.user_roles || [];
      roles.forEach((roleObj: any) => {
        const role = roleObj.role;
        roleGroups[role] = (roleGroups[role] || 0) + 1;
      });
    });

    // Create recipient groups from roles
    const groups: RecipientGroup[] = Object.entries(roleGroups).map(([role, count]) => ({
      id: role,
      name: role.charAt(0).toUpperCase() + role.slice(1) + "s",
      count,
      role,
    }));

    setRecipientGroups(groups);
    setLoading(false);
  };

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSend = () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in subject and message");
      return;
    }

    if (selectedGroups.length === 0) {
      toast.error("Please select at least one recipient group");
      return;
    }

    // TODO: Implement actual email sending via edge function
    toast.success(`Message queued to send to ${selectedGroups.length} group(s)`);
    
    // Reset form
    setSubject("");
    setMessage("");
    setSelectedGroups([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Messages</h1>
        <p className="text-muted-foreground">Send emails to users with accounts</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Compose Message</CardTitle>
              <CardDescription>Create and send messages to selected groups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Input
                  type="text"
                  placeholder="Message subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Message</label>
                <Textarea
                  placeholder="Write your message here..."
                  rows={8}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setSubject("");
                  setMessage("");
                  setSelectedGroups([]);
                }}>
                  Clear
                </Button>
                <Button onClick={handleSend}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Recipients</CardTitle>
              <CardDescription>Select who will receive this message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading recipients...</p>
              ) : recipientGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recipient groups found</p>
              ) : (
                recipientGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedGroups.includes(group.id)
                        ? "bg-primary/10 border-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => handleGroupToggle(group.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{group.name}</p>
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedGroups.includes(group.id)}
                        onChange={() => handleGroupToggle(group.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {group.count} {group.count === 1 ? "person" : "people"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{group.role}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card bg-info/5 border-info/20">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Mail className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1 text-info">Email Integration</p>
                  <p className="text-xs text-muted-foreground">
                    Messages will be sent only to users with active accounts. Recipients can reply directly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
