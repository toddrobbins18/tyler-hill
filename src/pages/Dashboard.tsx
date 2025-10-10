import { Users, Truck, FileText, Award } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const recentNotes = [
    { id: 1, title: "Morning Assembly Update", author: "Sarah Johnson", time: "2 hours ago" },
    { id: 2, title: "Field Trip Reminder", author: "Mike Chen", time: "5 hours ago" },
    { id: 3, title: "New Safety Protocols", author: "Lisa Brown", time: "1 day ago" },
  ];

  const upcomingEvents = [
    { id: 1, title: "Parent-Teacher Conference", date: "Tomorrow, 2:00 PM" },
    { id: 2, title: "Sports Day", date: "Friday, 9:00 AM" },
    { id: 3, title: "Science Fair", date: "Next Monday" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Children"
          value={156}
          icon={Users}
          trend="+12 this month"
          variant="default"
        />
        <StatCard
          title="Active Routes"
          value={8}
          icon={Truck}
          trend="All on schedule"
          variant="success"
        />
        <StatCard
          title="Today's Notes"
          value={5}
          icon={FileText}
          trend="3 pending review"
          variant="info"
        />
        <StatCard
          title="Achievements"
          value={23}
          icon={Award}
          trend="This week"
          variant="warning"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Recent Notes</CardTitle>
            <CardDescription>Latest updates from your team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentNotes.map((note) => (
              <div key={note.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="space-y-1">
                  <p className="font-medium text-sm">{note.title}</p>
                  <p className="text-xs text-muted-foreground">by {note.author}</p>
                </div>
                <span className="text-xs text-muted-foreground">{note.time}</span>
              </div>
            ))}
            <Button variant="outline" className="w-full">View All Notes</Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
            <CardDescription>Don't miss these important dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <p className="font-medium text-sm">{event.title}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{event.date}</span>
              </div>
            ))}
            <Button variant="outline" className="w-full">View Calendar</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
