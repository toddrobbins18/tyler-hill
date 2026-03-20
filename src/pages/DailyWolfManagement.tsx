import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { CalendarColorSettings } from '@/components/CalendarColorSettings';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import CSVUploader from '@/components/CSVUploader';
import { validateAndRefreshSession } from '@/lib/sessionUtils';
import { getAuthenticatedSupabaseClient } from '@/lib/authenticatedSupabaseClient';

interface DailyWolfContent {
  id?: string;
  officer_of_day: string;
  laundry_info: string;
  phone_calls_info: string;
  quote_of_the_day: string;
  notes: string;
  picture_day: string;
  outside_event: string;
  staff_days_off: string;
  od_notes: string;
}

export default function DailyWolfManagement() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [content, setContent] = useState<DailyWolfContent>({
    officer_of_day: '',
    laundry_info: '',
    phone_calls_info: '',
    quote_of_the_day: '',
    notes: '',
    picture_day: '',
    outside_event: '',
    staff_days_off: '',
    od_notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const isTimberLakeWest = currentCompany?.slug === 'timber-lake-west';
  const isTimberLakeCamp = currentCompany?.slug === 'timber-lake-camp';
  const odLabel = isTimberLakeWest ? 'Super OD' : 'OD';
  const odDescription = isTimberLakeWest ? 'Super OD information' : 'Officer of the Day information';
  const pageTitle = isTimberLakeCamp ? 'Tiger Times' : 'Daily Wolf Management';
  const pageDescription = isTimberLakeCamp ? 'Manage daily content for Tiger Times' : 'Manage daily content for The Daily Wolf';

  const tigerTimesDefaultColors: Record<string, string> = {
    "Laundry": "#3b82f6",
    "Phone Calls": "#ef4444",
    "Outside Events": "#eab308",
    "Staff Days Off": "#7dd3fc",
    "OD Notes": "#ff69b4",
  };
  const [tigerTimesColors, setTigerTimesColors] = useState<Record<string, string>>(tigerTimesDefaultColors);

  useEffect(() => {
    fetchContent();
  }, [selectedDate, currentCompany, currentSeason]);

  useEffect(() => {
    if (!currentCompany) return;

    const channel = supabase
      .channel('daily_wolf_content_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_wolf_content',
          filter: `company_id=eq.${currentCompany.id}`,
        },
        () => {
          fetchContent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany, selectedDate, currentSeason]);

  const fetchContent = async () => {
    if (!currentCompany) return;

    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('daily_wolf_content')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('date', dateStr)
        .eq('season', currentSeason)
        .maybeSingle();

      if (error) {
        console.error('Error fetching content:', error);
        toast({
          title: 'Error',
          description: `Failed to load content: ${error.message}`,
          variant: 'destructive',
        });
        throw error;
      }

      if (data) {
        setContent({
          id: data.id,
          officer_of_day: data.officer_of_day || '',
          laundry_info: data.laundry_info || '',
          phone_calls_info: data.phone_calls_info || '',
          quote_of_the_day: data.quote_of_the_day || '',
          notes: data.notes || '',
          picture_day: (data as any).picture_day || '',
          outside_event: (data as any).outside_event || '',
          staff_days_off: (data as any).staff_days_off || '',
          od_notes: (data as any).od_notes || '',
        });
      } else {
        setContent({
          officer_of_day: '',
          laundry_info: '',
          phone_calls_info: '',
          quote_of_the_day: '',
          notes: '',
          picture_day: '',
          outside_event: '',
          staff_days_off: '',
          od_notes: '',
        });
      }
    } catch (error: any) {
      console.error('Error fetching content:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to load content',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveField = async (field: keyof DailyWolfContent, value: string) => {
    if (!currentCompany) return;

    try {
      setSaving(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Create authenticated client with explicit JWT token
      const authenticatedClient = await getAuthenticatedSupabaseClient();

      if (content.id) {
        // Update existing record
        const { error } = await authenticatedClient
          .from('daily_wolf_content')
          .update({ [field]: value })
          .eq('id', content.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
      } else {
        // Create new record
        const { data, error } = await authenticatedClient
          .from('daily_wolf_content')
          .insert({
            company_id: currentCompany.id,
            date: dateStr,
            season: currentSeason,
            [field]: value,
          })
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        if (data) {
          setContent((prev) => ({ ...prev, id: data.id }));
        }
      }

      toast({
        title: 'Saved',
        description: 'Content updated successfully',
      });
    } catch (error: any) {
      console.error('Error saving content:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save content. Please check your permissions.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: keyof DailyWolfContent, value: string) => {
    setContent((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldBlur = (field: keyof DailyWolfContent, value: string) => {
    saveField(field, value);
  };

  const createTodaysEntry = async () => {
    if (!currentCompany) return;

    try {
      setSaving(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Create authenticated client with explicit JWT token
      const authenticatedClient = await getAuthenticatedSupabaseClient();

      const { data, error } = await authenticatedClient
        .from('daily_wolf_content')
        .insert({
          company_id: currentCompany.id,
          date: dateStr,
          season: currentSeason,
          officer_of_day: '',
          laundry_info: '',
          phone_calls_info: '',
          quote_of_the_day: '',
          notes: '',
        })
        .select()
        .single();

      if (error) {
        console.error('Create entry error:', error);
        throw error;
      }
      if (data) {
        setContent({
          id: data.id,
          officer_of_day: '',
          laundry_info: '',
          phone_calls_info: '',
          quote_of_the_day: '',
          notes: '',
          picture_day: '',
          outside_event: '',
          staff_days_off: '',
          od_notes: '',
        });
      }

      toast({
        title: 'Created',
        description: 'New entry created successfully',
      });
    } catch (error: any) {
      console.error('Error creating entry:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create entry. Please check your permissions.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">{pageTitle}</h1>
        <p className="text-muted-foreground mt-2">
          {pageDescription}
        </p>
      </div>

      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Label>Select Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[280px] justify-start text-left font-normal mt-2',
                  !selectedDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-2">
          {isTimberLakeCamp && (
            <CalendarColorSettings
              calendarId="tiger-times"
              defaultColors={tigerTimesDefaultColors}
              onColorsChange={setTigerTimesColors}
            />
          )}
          <CSVUploader tableName="daily_wolf_content" onUploadComplete={fetchContent} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !content.id ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">No content exists for this date.</p>
            <Button onClick={createTodaysEntry} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Entry
            </Button>
          </CardContent>
        </Card>
      ) : isTimberLakeCamp ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card style={{ borderTopWidth: '3px', borderTopColor: tigerTimesColors["Laundry"] }}>
            <CardHeader>
              <CardTitle>👕 Laundry</CardTitle>
              <CardDescription>Laundry schedule and information</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content.laundry_info}
                onChange={(e) => handleFieldChange('laundry_info', e.target.value)}
                onBlur={(e) => handleFieldBlur('laundry_info', e.target.value)}
                placeholder="Enter laundry information"
                rows={4}
                disabled={saving}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📞 Phone Calls</CardTitle>
              <CardDescription>Phone call schedule and notes</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content.phone_calls_info}
                onChange={(e) => handleFieldChange('phone_calls_info', e.target.value)}
                onBlur={(e) => handleFieldBlur('phone_calls_info', e.target.value)}
                placeholder="Enter phone call information"
                rows={4}
                disabled={saving}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🌐 Outside Event</CardTitle>
              <CardDescription>External events and activities</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content.outside_event}
                onChange={(e) => handleFieldChange('outside_event', e.target.value)}
                onBlur={(e) => handleFieldBlur('outside_event', e.target.value)}
                placeholder="Enter outside event details"
                rows={4}
                disabled={saving}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>💗 OD Notes</CardTitle>
              <CardDescription>Officer of the Day notes</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content.od_notes}
                onChange={(e) => handleFieldChange('od_notes', e.target.value)}
                onBlur={(e) => handleFieldBlur('od_notes', e.target.value)}
                placeholder="Enter OD notes"
                rows={4}
                disabled={saving}
              />
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>🗓️ Staff Days Off</CardTitle>
              <CardDescription>Staff schedule and days off information</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content.staff_days_off}
                onChange={(e) => handleFieldChange('staff_days_off', e.target.value)}
                onBlur={(e) => handleFieldBlur('staff_days_off', e.target.value)}
                placeholder="Enter staff days off information"
                rows={6}
                disabled={saving}
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{odLabel}</CardTitle>
              <CardDescription>{odDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={content.officer_of_day}
                onChange={(e) => handleFieldChange('officer_of_day', e.target.value)}
                onBlur={(e) => handleFieldBlur('officer_of_day', e.target.value)}
                placeholder="Enter OD name/details"
                disabled={saving}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quote of the Day</CardTitle>
              <CardDescription>Daily inspirational quote</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={content.quote_of_the_day}
                onChange={(e) => handleFieldChange('quote_of_the_day', e.target.value)}
                onBlur={(e) => handleFieldBlur('quote_of_the_day', e.target.value)}
                placeholder="Enter quote"
                disabled={saving}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Laundry Schedule</CardTitle>
              <CardDescription>Laundry times and information</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content.laundry_info}
                onChange={(e) => handleFieldChange('laundry_info', e.target.value)}
                onBlur={(e) => handleFieldBlur('laundry_info', e.target.value)}
                placeholder="Enter laundry schedule"
                rows={4}
                disabled={saving}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Phone Calls</CardTitle>
              <CardDescription>Phone call schedule and notes</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content.phone_calls_info}
                onChange={(e) => handleFieldChange('phone_calls_info', e.target.value)}
                onBlur={(e) => handleFieldBlur('phone_calls_info', e.target.value)}
                placeholder="Enter phone call information"
                rows={4}
                disabled={saving}
              />
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>General Notes</CardTitle>
              <CardDescription>Additional daily notes and announcements</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                onBlur={(e) => handleFieldBlur('notes', e.target.value)}
                placeholder="Enter general notes"
                rows={6}
                disabled={saving}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
