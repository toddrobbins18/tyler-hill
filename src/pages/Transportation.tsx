import { Plus, MapPin, Clock, Users, Calendar as CalendarIcon, Pencil, Trash2, Upload, UserCheck, LayoutList, Search, X, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AddTripDialog from "@/components/dialogs/AddTripDialog";
import EditTripDialog from "@/components/dialogs/EditTripDialog";
import ManageTripAttendanceDialog from "@/components/dialogs/ManageTripAttendanceDialog";
import { CSVUploader } from "@/components/CSVUploader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTime12Hour } from "@/lib/utils";
import { useSeasonContext } from "@/contexts/SeasonContext";

export default function Transportation() {
  const { currentSeason } = useSeasonContext();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTrip, setEditingTrip] = useState<string | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<string | null>(null);
  const [managingRoster, setManagingRoster] = useState<{ id: string; name: string } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [filterTransportType, setFilterTransportType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "type" | "destination" | "status">("date");
  const [viewingRoster, setViewingRoster] = useState<any>(null);
  const [rosterData, setRosterData] = useState<any>(null);

  useEffect(() => {
    fetchTrips();

    const channel = supabase
      .channel('trips-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => fetchTrips()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sports_event_roster' },
        () => fetchTrips()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_attendees' },
        () => fetchTrips()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sports_event_staff' },
        () => fetchTrips()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTrips = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trips")
      .select(`
        *,
        sports_event:sports_calendar!sports_event_id(
          id,
          title,
          sport_type,
          custom_sport_type,
          meal_options,
          meal_notes
        )
      `)
      .eq("season", currentSeason)
      .order("date", { ascending: false });

    if (!error && data) {
      // Fetch roster counts and staff for sports events
      const sportsEventIds = data.filter(t => t.sports_event_id).map(t => t.sports_event_id);
      
      const tripsWithAttending = await Promise.all(data.map(async (trip) => {
        let attendingCount = 0;
        
        // Count campers from sports event roster
        if (trip.sports_event_id) {
          const { data: rosterData } = await supabase
            .from("sports_event_roster")
            .select("id")
            .eq("event_id", trip.sports_event_id);
          attendingCount += rosterData?.length || 0;
          
          // Count coaches and refs from sports_event_staff
          const { data: staffData } = await supabase
            .from("sports_event_staff")
            .select("id")
            .eq("event_id", trip.sports_event_id);
          attendingCount += staffData?.length || 0;
        }
        
        // Count manual trip attendees
        const { data: tripAttendees } = await supabase
          .from("trip_attendees")
          .select("id")
          .eq("trip_id", trip.id);
        attendingCount += tripAttendees?.length || 0;
        
        // Count additional staff (driver, chaperone)
        if (trip.driver) attendingCount += trip.driver.split(',').length;
        if (trip.chaperone) attendingCount += trip.chaperone.split(',').length;
        
        return {
          ...trip,
          attendingCount
        };
      }));
      
      setTrips(tripsWithAttending);
    }
    setLoading(false);
  };

  const handleViewRoster = async (trip: any) => {
    if (!trip.sports_event_id) return;

    const { data: roster } = await supabase
      .from("sports_event_roster")
      .select(`
        child:children(id, name, age, grade, group_name)
      `)
      .eq("event_id", trip.sports_event_id);

    const { data: staff } = await supabase
      .from("sports_event_staff")
      .select(`
        role,
        staff:staff(id, name, role)
      `)
      .eq("event_id", trip.sports_event_id);

    setRosterData({
      trip,
      children: roster?.map(r => r.child) || [],
      coaches: staff?.filter(s => s.role === "coach").map(s => s.staff) || [],
      refs: staff?.filter(s => s.role === "ref").map(s => s.staff) || [],
    });
    setViewingRoster(trip);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("trips")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete trip");
      console.error(error);
    } else {
      toast.success("Trip deleted successfully");
      fetchTrips();
    }
    setDeletingTrip(null);
  };

  const getStatusColor = (trip: any) => {
    const isPending = !trip.transportation_type || !trip.driver;
    return isPending 
      ? "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20" 
      : "border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20";
  };

  const getStatusBadge = (trip: any) => {
    if (trip.status === 'approved') {
      return <Badge className="bg-green-600 text-white hover:bg-green-700">Approved</Badge>;
    } else if (trip.status === 'pending') {
      return <Badge variant="destructive">Pending Approval</Badge>;
    }
    const isPending = !trip.transportation_type || !trip.driver;
    return isPending ? (
      <Badge variant="destructive">Pending</Badge>
    ) : (
      <Badge className="bg-green-600 text-white hover:bg-green-700">Upcoming</Badge>
    );
  };


  const getMealBadges = (trip: any) => {
    const mealOptions = trip.sports_event?.meal_options || [];
    if (mealOptions.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {mealOptions.map((meal: string) => (
          <Badge key={meal} variant="outline" className="text-xs">
            <Utensils className="h-3 w-3 mr-1" />
            {meal}
          </Badge>
        ))}
      </div>
    );
  };

  const getDaysWithTrips = () => {
    return trips.map(trip => new Date(trip.date));
  };

  const getTripsForDate = (date: Date) => {
    return filteredAndSortedTrips.filter(trip => isSameDay(new Date(trip.date), date));
  };

  const uniqueTypes = Array.from(new Set(trips.map(t => t.type))).filter(Boolean).sort();
  const uniqueEventTypes = Array.from(new Set(trips.map(t => t.event_type))).filter(Boolean).sort();
  const uniqueTransportTypes = Array.from(new Set(trips.map(t => t.transportation_type))).filter(Boolean).sort();
  const uniqueStatuses = Array.from(new Set(trips.map(t => t.status))).filter(Boolean).sort();

  const filteredAndSortedTrips = trips
    .filter(trip => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const searchableFields = [
          trip.name,
          trip.destination,
          trip.driver,
          trip.chaperone,
          trip.type,
          trip.event_type
        ].filter(Boolean).join(" ").toLowerCase();
        
        if (!searchableFields.includes(search)) return false;
      }

      // Type filter
      if (filterType !== "all" && trip.type !== filterType) return false;

      // Event type filter
      if (filterEventType !== "all" && trip.event_type !== filterEventType) return false;

      // Transport type filter
      if (filterTransportType !== "all" && trip.transportation_type !== filterTransportType) return false;

      // Status filter
      if (filterStatus !== "all" && trip.status !== filterStatus) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "type") {
        return (a.type || "").localeCompare(b.type || "");
      } else if (sortBy === "destination") {
        return (a.destination || "").localeCompare(b.destination || "");
      } else if (sortBy === "status") {
        return (a.status || "").localeCompare(b.status || "");
      }
      
      // Default: sort by date
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      
      // If same date, sort by departure time
      if (a.departure_time && b.departure_time) {
        return a.departure_time.localeCompare(b.departure_time);
      }
      return a.departure_time ? -1 : b.departure_time ? 1 : 0;
    });

  const activeFilterCount = (searchTerm ? 1 : 0) + 
    (filterType !== "all" ? 1 : 0) + 
    (filterEventType !== "all" ? 1 : 0) + 
    (filterTransportType !== "all" ? 1 : 0) + 
    (filterStatus !== "all" ? 1 : 0);

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterEventType("all");
    setFilterTransportType("all");
    setFilterStatus("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Transportation</h1>
          <p className="text-muted-foreground">Manage field trips and sporting event transportation</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 border rounded-md p-1 bg-muted/50">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-4 w-4 mr-2" />
              List
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendar
            </Button>
          </div>
          <CSVUploader tableName="trips" onUploadComplete={fetchTrips} />
          <AddTripDialog onSuccess={fetchTrips} />
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search trips..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterEventType} onValueChange={setFilterEventType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Event Types</SelectItem>
                {uniqueEventTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTransportType} onValueChange={setFilterTransportType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transport Types</SelectItem>
                {uniqueTransportTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Sort by Date</SelectItem>
                <SelectItem value="type">Sort by Type</SelectItem>
                <SelectItem value="destination">Sort by Destination</SelectItem>
                <SelectItem value="status">Sort by Status</SelectItem>
              </SelectContent>
            </Select>

            {activeFilterCount > 0 && (
              <Button variant="ghost" onClick={clearAllFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear ({activeFilterCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : viewMode === 'calendar' ? (
        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
          <Card className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{
                hasTrip: getDaysWithTrips()
              }}
              modifiersClassNames={{
                hasTrip: "bg-primary/20 font-bold"
              }}
              className="rounded-md border"
            />
          </Card>
          <div>
            <h2 className="text-xl font-semibold mb-4">
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
            </h2>
            {selectedDate && getTripsForDate(selectedDate).length > 0 ? (
              <div className="space-y-4">
                {getTripsForDate(selectedDate).map((trip) => (
                  <Card key={trip.id} className={`shadow-card hover:shadow-md transition-all group ${getStatusColor(trip)}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-xl">{trip.name}</CardTitle>
                            <Badge variant="secondary">{trip.type}</Badge>
                            {getStatusBadge(trip)}
                          </div>
                          <CardDescription>
                            Destination: {trip.destination || "N/A"}
                          </CardDescription>
                          {getMealBadges(trip)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setManagingRoster({ id: trip.id, name: trip.name })}
                          >
                            <UserCheck className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setEditingTrip(trip.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeletingTrip(trip.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Departure: </span>
                          <span className="font-medium">{trip.departure_time ? formatTime12Hour(trip.departure_time) : "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Return: </span>
                          <span className="font-medium">{trip.return_time ? formatTime12Hour(trip.return_time) : "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Attending: </span>
                          <span className="font-medium">{trip.attendingCount || 0} people</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Chaperone: </span>
                          <span className="font-medium">{trip.chaperone || "N/A"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No trips scheduled for this date</p>
              </div>
            )}
          </div>
        </div>
      ) : filteredAndSortedTrips.length > 0 ? (
        <div className="grid gap-6">
          {filteredAndSortedTrips.map((trip) => (
            <Card key={trip.id} className={`shadow-card hover:shadow-md transition-all group ${getStatusColor(trip)}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{trip.name}</CardTitle>
                      <Badge variant="secondary">{trip.type}</Badge>
                      {getStatusBadge(trip)}
                    </div>
                    <CardDescription>
                      Destination: {trip.destination || "N/A"}
                    </CardDescription>
                    <CardDescription className="mt-1">
                      Chaperone: {trip.chaperone || "N/A"}
                    </CardDescription>
                    {getMealBadges(trip)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        trip.status === "confirmed" 
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-warning/10 text-warning border-warning/20"
                      }
                    >
                      {trip.status || "Upcoming"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setManagingRoster({ id: trip.id, name: trip.name })}
                      title="Manage Roster"
                    >
                      <UserCheck className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setEditingTrip(trip.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={() => setDeletingTrip(trip.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="text-sm font-semibold">{new Date(trip.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary/10">
                      <Users className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Attending</p>
                      <p className="text-lg font-semibold">{trip.attendingCount || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <Clock className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Departure</p>
                      <p className="text-sm font-semibold">{trip.departure_time ? formatTime12Hour(trip.departure_time) : "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Return</p>
                      <p className="text-sm font-semibold">{trip.return_time ? formatTime12Hour(trip.return_time) : "N/A"}</p>
                    </div>
                  </div>
                </div>

                {trip.sports_event_id && trip.attendingCount !== null && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${trip.attendingCount === 0 ? 'bg-red-100 dark:bg-red-950' : 'bg-green-100 dark:bg-green-950'}`}>
                          <Users className={`h-5 w-5 ${trip.attendingCount === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Sports Event Roster</p>
                          <p className="text-lg font-semibold">{trip.attendingCount} people total</p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewRoster(trip)}
                      >
                        View Roster
                      </Button>
                    </div>
                  </div>
                )}

                {(trip.meal || trip.event_type || trip.event_length || trip.transportation_type || trip.driver) && (
                  <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                    {trip.meal && (
                      <div>
                        <span className="text-muted-foreground">Meal: </span>
                        <span className="font-medium">{trip.meal}</span>
                      </div>
                    )}
                    {trip.event_type && (
                      <div>
                        <span className="text-muted-foreground">Event Type: </span>
                        <span className="font-medium">{trip.event_type}</span>
                      </div>
                    )}
                    {trip.event_length && (
                      <div>
                        <span className="text-muted-foreground">Duration: </span>
                        <span className="font-medium">{trip.event_length}</span>
                      </div>
                    )}
                    {trip.transportation_type && (
                      <div>
                        <span className="text-muted-foreground">Transport: </span>
                        <span className="font-medium">{trip.transportation_type}</span>
                      </div>
                    )}
                    {trip.driver && (
                      <div>
                        <span className="text-muted-foreground">Driver: </span>
                        <span className="font-medium">{trip.driver}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No trips match your filters</p>
        </div>
      )}

      {editingTrip && (
        <EditTripDialog
          tripId={editingTrip}
          open={!!editingTrip}
          onOpenChange={(open) => !open && setEditingTrip(null)}
          onSuccess={fetchTrips}
        />
      )}

      {managingRoster && (
        <ManageTripAttendanceDialog
          tripId={managingRoster.id}
          tripName={managingRoster.name}
          open={!!managingRoster}
          onOpenChange={(open) => !open && setManagingRoster(null)}
        />
      )}

      <AlertDialog open={!!deletingTrip} onOpenChange={(open) => !open && setDeletingTrip(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the trip.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingTrip && handleDelete(deletingTrip)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Roster Dialog */}
      {viewingRoster && rosterData && (
        <Dialog open={!!viewingRoster} onOpenChange={() => { setViewingRoster(null); setRosterData(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Sports Event Roster: {viewingRoster.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Campers Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Campers ({rosterData.children.length})
                </h3>
                {rosterData.children.length > 0 ? (
                  <div className="space-y-2">
                    {rosterData.children.map((child: any) => (
                      <div key={child.id} className="p-3 bg-muted rounded-lg flex items-center justify-between">
                        <span className="font-medium">{child.name}</span>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          {child.age && <span>Age: {child.age}</span>}
                          {child.grade && <span>Grade: {child.grade}</span>}
                          {child.group_name && <span>Group: {child.group_name}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No campers in roster</p>
                )}
              </div>

              {/* Coaches Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Coaches ({rosterData.coaches.length})</h3>
                {rosterData.coaches.length > 0 ? (
                  <div className="space-y-2">
                    {rosterData.coaches.map((coach: any) => (
                      <div key={coach.id} className="p-3 bg-muted rounded-lg flex items-center justify-between">
                        <span className="font-medium">{coach.name}</span>
                        {coach.role && <Badge variant="secondary">{coach.role}</Badge>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No coaches assigned</p>
                )}
              </div>

              {/* Refs Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Referees ({rosterData.refs.length})</h3>
                {rosterData.refs.length > 0 ? (
                  <div className="space-y-2">
                    {rosterData.refs.map((ref: any) => (
                      <div key={ref.id} className="p-3 bg-muted rounded-lg flex items-center justify-between">
                        <span className="font-medium">{ref.name}</span>
                        {ref.role && <Badge variant="secondary">{ref.role}</Badge>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No referees assigned</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
