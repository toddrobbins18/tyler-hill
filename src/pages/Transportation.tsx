import { Plus, MapPin, Clock, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const trips = [
  { 
    id: 1, 
    name: "Science Museum Field Trip", 
    type: "Field Trip",
    destination: "City Science Museum",
    chaperone: "Mrs. Anderson & Mr. Wilson",
    vehicle: "Bus #101",
    children: 28,
    departureTime: "9:00 AM",
    returnTime: "2:30 PM",
    date: "Nov 15, 2024",
    status: "scheduled"
  },
  { 
    id: 2, 
    name: "Soccer Championship", 
    type: "Sporting Event",
    destination: "Riverside Sports Complex",
    chaperone: "Coach Martinez",
    vehicle: "Van #201",
    children: 15,
    departureTime: "8:30 AM",
    returnTime: "12:00 PM",
    date: "Nov 12, 2024",
    status: "confirmed"
  },
  { 
    id: 3, 
    name: "Art Gallery Tour", 
    type: "Field Trip",
    destination: "Downtown Art Gallery",
    chaperone: "Ms. Thompson",
    vehicle: "Bus #102",
    children: 22,
    departureTime: "10:00 AM",
    returnTime: "1:30 PM",
    date: "Nov 18, 2024",
    status: "scheduled"
  },
  { 
    id: 4, 
    name: "Basketball Tournament", 
    type: "Sporting Event",
    destination: "Lincoln High School",
    chaperone: "Coach Davis & Mrs. Lee",
    vehicle: "Van #202",
    children: 12,
    departureTime: "1:00 PM",
    returnTime: "5:00 PM",
    date: "Nov 20, 2024",
    status: "confirmed"
  },
];

export default function Transportation() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Transportation</h1>
          <p className="text-muted-foreground">Manage field trips and sporting event transportation</p>
        </div>
        <Button className="shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Trip
        </Button>
      </div>

      <div className="grid gap-6">
        {trips.map((trip) => (
          <Card key={trip.id} className="shadow-card hover:shadow-md transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-xl">{trip.name}</CardTitle>
                    <Badge variant="secondary">{trip.type}</Badge>
                  </div>
                  <CardDescription>
                    Destination: {trip.destination}
                  </CardDescription>
                  <CardDescription className="mt-1">
                    Chaperone: {trip.chaperone} | Vehicle: {trip.vehicle}
                  </CardDescription>
                </div>
                <Badge 
                  variant="outline"
                  className={
                    trip.status === "confirmed" 
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-warning/10 text-warning border-warning/20"
                  }
                >
                  {trip.status === "confirmed" ? "Confirmed" : "Scheduled"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="text-sm font-semibold">{trip.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <Users className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Children</p>
                    <p className="text-lg font-semibold">{trip.children}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Clock className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Departure</p>
                    <p className="text-sm font-semibold">{trip.departureTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Return</p>
                    <p className="text-sm font-semibold">{trip.returnTime}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
