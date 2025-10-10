import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function Messages() {
  const recipientGroups = [
    { id: 1, name: "All Staff", count: 24, role: "staff" },
    { id: 2, name: "Transportation Team", count: 8, role: "driver" },
    { id: 3, name: "Program Directors", count: 5, role: "director" },
    { id: 4, name: "All Parents", count: 156, role: "parent" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Messages</h1>
        <p className="text-muted-foreground">Send emails to specific groups based on role</p>
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
                <input 
                  type="text" 
                  placeholder="Message subject..." 
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Message</label>
                <Textarea 
                  placeholder="Write your message here..." 
                  rows={8}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline">Save Draft</Button>
                <Button>
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
              {recipientGroups.map((group) => (
                <div 
                  key={group.id}
                  className="p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm">{group.name}</p>
                    <input type="checkbox" className="rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {group.count} people
                    </Badge>
                    <span className="text-xs text-muted-foreground">{group.role}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card bg-info/5 border-info/20">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Mail className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1 text-info">Email Integration</p>
                  <p className="text-xs text-muted-foreground">
                    Messages will be sent via email to all selected groups. Recipients can reply directly.
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
