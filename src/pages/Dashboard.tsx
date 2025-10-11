import { Users, Truck, FileText, Award, Utensils, Calendar as CalendarIcon, MapPin } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const recentNotes = [
    { id: 1, title: "Morning Assembly Update", author: "Sarah Johnson", time: "2 hours ago" },
    { id: 2, title: "Field Trip Reminder", author: "Mike Chen", time: "5 hours ago" },
    { id: 3, title: "New Safety Protocols", author: "Lisa Brown", time: "1 day ago" },
  ];

  const upcomingEvents = [
    { id: 1, title: "Parent-Teacher Conference", date: "Tomorrow, 2:00 PM", type: "meeting" },
    { id: 2, title: "Sports Day", date: "Friday, 9:00 AM", type: "event" },
    { id: 3, title: "Science Fair", date: "Next Monday", type: "event" },
    { id: 4, title: "Soccer Championship", date: "Nov 12, 8:30 AM", type: "trip" },
    { id: 5, title: "Pizza Day", date: "Wednesday", type: "menu" },
  ];

  const todaysMenu = {
    breakfast: "Pancakes, Fresh Fruit, Milk",
    lunch: "Chicken Tenders, Mac & Cheese, Green Beans, Apple Slices",
    snack: "Goldfish Crackers, String Cheese",
    specialNotes: "Nut-free facility"
  };

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-accent/10">
                <Utensils className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle>Today's Menu</CardTitle>
                <CardDescription>What's being served today</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Breakfast</p>
                <p className="text-sm">{todaysMenu.breakfast}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Lunch</p>
                <p className="text-sm">{todaysMenu.lunch}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Snack</p>
                <p className="text-sm">{todaysMenu.snack}</p>
              </div>
            </div>
            <div className="p-2 rounded bg-info/10 border border-info/20">
              <p className="text-xs text-info-foreground">{todaysMenu.specialNotes}</p>
            </div>
          </CardContent>
        </Card>

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
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>Calendar & schedule</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-sm mb-1">{event.title}</p>
                  <span className="text-xs text-muted-foreground">{event.date}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {event.type === "trip" && <MapPin className="h-3 w-3 mr-1" />}
                  {event.type === "menu" && <Utensils className="h-3 w-3 mr-1" />}
                  {event.type}
                </Badge>
              </div>
            ))}
            <Button variant="outline" className="w-full">View Full Calendar</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
