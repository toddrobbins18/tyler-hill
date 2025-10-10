import { Plus, MapPin, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const routes = [
  { 
    id: 1, 
    name: "Route A - North District", 
    driver: "John Smith", 
    vehicle: "Bus #101",
    stops: 8,
    children: 24,
    departureTime: "7:30 AM",
    status: "on-time"
  },
  { 
    id: 2, 
    name: "Route B - East District", 
    driver: "Maria Garcia", 
    vehicle: "Bus #102",
    stops: 6,
    children: 18,
    departureTime: "7:45 AM",
    status: "on-time"
  },
  { 
    id: 3, 
    name: "Route C - South District", 
    driver: "David Lee", 
    vehicle: "Van #201",
    stops: 5,
    children: 12,
    departureTime: "8:00 AM",
    status: "delayed"
  },
  { 
    id: 4, 
    name: "Route D - West District", 
    driver: "Sarah Johnson", 
    vehicle: "Bus #103",
    stops: 7,
    children: 21,
    departureTime: "7:30 AM",
    status: "on-time"
  },
];

export default function Transportation() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Transportation</h1>
          <p className="text-muted-foreground">Manage routes, schedules, and transportation logistics</p>
        </div>
        <Button className="shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Route
        </Button>
      </div>

      <div className="grid gap-6">
        {routes.map((route) => (
          <Card key={route.id} className="shadow-card hover:shadow-md transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl mb-1">{route.name}</CardTitle>
                  <CardDescription>
                    Driver: {route.driver} | Vehicle: {route.vehicle}
                  </CardDescription>
                </div>
                <Badge 
                  variant="outline"
                  className={
                    route.status === "on-time" 
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-warning/10 text-warning border-warning/20"
                  }
                >
                  {route.status === "on-time" ? "On Time" : "Delayed"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stops</p>
                    <p className="text-lg font-semibold">{route.stops}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <Users className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Children</p>
                    <p className="text-lg font-semibold">{route.children}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Clock className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Departure</p>
                    <p className="text-lg font-semibold">{route.departureTime}</p>
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
