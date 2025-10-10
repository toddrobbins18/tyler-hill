import { Plus, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

const notes = [
  {
    id: 1,
    title: "Morning Assembly Announcement",
    content: "Great participation today! Special recognition for the choir group's performance.",
    author: "Sarah Johnson",
    role: "Program Director",
    date: "Today, 9:30 AM",
    category: "general"
  },
  {
    id: 2,
    title: "Safety Drill Completed",
    content: "Fire drill conducted successfully. All children evacuated in 3 minutes 45 seconds. Great job everyone!",
    author: "Mike Chen",
    role: "Safety Coordinator",
    date: "Today, 11:00 AM",
    category: "safety"
  },
  {
    id: 3,
    title: "Field Trip Update",
    content: "Museum visit scheduled for next Friday. Permission slips due by Wednesday. Bus departure at 9:00 AM.",
    author: "Lisa Brown",
    role: "Activities Coordinator",
    date: "Yesterday, 2:15 PM",
    category: "event"
  },
  {
    id: 4,
    title: "Lunch Menu Change",
    content: "Thursday's lunch changed to accommodate dietary restrictions. New menu posted in kitchen.",
    author: "Tom Wilson",
    role: "Food Services",
    date: "Yesterday, 8:30 AM",
    category: "food"
  },
];

export default function DailyNotes() {
  const [showAddNote, setShowAddNote] = useState(false);

  const getCategoryColor = (category: string) => {
    const colors = {
      general: "bg-primary/10 text-primary border-primary/20",
      safety: "bg-destructive/10 text-destructive border-destructive/20",
      event: "bg-secondary/10 text-secondary border-secondary/20",
      food: "bg-accent/10 text-accent border-accent/20",
    };
    return colors[category as keyof typeof colors] || colors.general;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Daily Notes</h1>
          <p className="text-muted-foreground">Share updates and important information with your team</p>
        </div>
        <Button onClick={() => setShowAddNote(!showAddNote)} className="shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      {showAddNote && (
        <Card className="shadow-card border-primary/20">
          <CardHeader>
            <CardTitle>New Note</CardTitle>
            <CardDescription>Share an update with your team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input 
              type="text" 
              placeholder="Note title..." 
              className="w-full px-4 py-2 rounded-lg border border-input bg-background"
            />
            <Textarea 
              placeholder="Write your note here..." 
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddNote(false)}>
                Cancel
              </Button>
              <Button>Post Note</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {notes.map((note) => (
          <Card key={note.id} className="shadow-card hover:shadow-md transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-xl">{note.title}</CardTitle>
                    <Badge variant="outline" className={getCategoryColor(note.category)}>
                      {note.category}
                    </Badge>
                  </div>
                  <CardDescription className="text-base">{note.content}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{note.author}</span>
                    <span className="text-muted-foreground">• {note.role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{note.date}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
