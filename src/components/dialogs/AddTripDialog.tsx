import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, CalendarRange } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { tripSchema } from "@/lib/validationSchemas";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { StaffMultiSelect } from "@/components/StaffMultiSelect";

interface AddTripDialogProps {
  onSuccess: () => void;
}

export default function AddTripDialog({ onSuccess }: AddTripDialogProps) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof tripSchema>>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      name: "",
      type: "Field Trip",
      destination: "",
      date: new Date().toISOString().split('T')[0],
      end_date: "",
      is_multi_day: false,
      departure_time: "",
      return_time: "",
      chaperone: "",
      capacity: undefined,
      status: "pending",
    },
  });

  const isMultiDay = form.watch("is_multi_day");
  const startDate = form.watch("date");
  const endDate = form.watch("end_date");

  // Calculate trip duration for display
  const getTripDuration = () => {
    if (!isMultiDay || !startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const tripDuration = getTripDuration();

  const onSubmit = async (values: z.infer<typeof tripSchema>) => {
    try {
      const insertData: any = {
        name: values.name,
        type: values.type,
        date: values.date,
        end_date: values.is_multi_day ? values.end_date : null,
        is_multi_day: values.is_multi_day || false,
        destination: values.destination ?? null,
        departure_time: values.departure_time ?? null,
        return_time: values.return_time ?? null,
        chaperone: values.chaperone ?? null,
        capacity: values.capacity ?? null,
        status: values.status ?? "pending",
        company_id: currentCompany?.id,
        season: currentSeason,
      };

      const { error } = await supabase
        .from("trips")
        .insert([insertData]);

      if (error) {
        toast.error("Failed to add trip");
        console.error(error);
      } else {
        toast.success("Trip added successfully");
        onSuccess();
        setOpen(false);
        form.reset();
      }
    } catch (error) {
      toast.error("Failed to add trip");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Trip
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Trip</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Fields marked with <span className="text-destructive">*</span> are required
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trip Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Science Museum Visit" {...field} />
                  </FormControl>
                  <FormDescription>Descriptive name for this trip or event</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Field Trip">Field Trip</SelectItem>
                      <SelectItem value="Sporting Event">Sporting Event</SelectItem>
                      <SelectItem value="Staff Bus">Staff Bus</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination</FormLabel>
                  <FormControl>
                    <Input placeholder="Where are you going?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Multi-day toggle */}
            <FormField
              control={form.control}
              name="is_multi_day"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <CalendarRange className="h-4 w-4" />
                      Multi-Day Trip
                    </FormLabel>
                    <FormDescription>
                      Enable this for trips spanning multiple days
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) {
                          form.setValue("end_date", "");
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Date fields */}
            <div className={`grid ${isMultiDay ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isMultiDay ? "Start Date" : "Date"}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isMultiDay && (
                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          min={startDate}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Duration badge */}
            {isMultiDay && tripDuration && tripDuration > 1 && (
              <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                <CalendarRange className="h-3 w-3" />
                {tripDuration}-Day Trip
              </Badge>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="departure_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departure Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="return_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Return Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="chaperone"
              render={({ field }) => (
                <FormItem>
                  <StaffMultiSelect
                    value={field.value || ""}
                    onChange={field.onChange}
                    label="Staff"
                    placeholder="Search staff to assign..."
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Maximum number of children" 
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Adding..." : "Add Trip"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}