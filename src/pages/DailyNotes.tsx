import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface ScheduleEvent {
  id: string;
  time: string;
  title: string;
  location: string;
  type: 'sports' | 'activity';
  isFeatured?: boolean;
  opponent?: string;
  meal_options?: string[];
  meal_notes?: string;
  description?: string;
}

export default function DailyNotes() {
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
  const [featuredEvent, setFeaturedEvent] = useState<ScheduleEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const { currentSeason } = useSeasonContext();

  useEffect(() => {
    fetchSchedule();

    const sportsChannel = supabase
      .channel('sports-calendar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_calendar' }, fetchSchedule)
      .subscribe();

    const eventsChannel = supabase
      .channel('special-events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_events_activities' }, fetchSchedule)
      .subscribe();

    return () => {
      supabase.removeChannel(sportsChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, [currentSeason]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // Fetch sports calendar events
      const { data: sportsData } = await supabase
        .from('sports_calendar')
        .select('*')
        .eq('event_date', today)
        .eq('season', currentSeason)
        .order('time');

      // Fetch evening/night activities
      const { data: activitiesData } = await supabase
        .from('special_events_activities')
        .select('*')
        .eq('event_date', today)
        .eq('season', currentSeason)
        .in('time_slot', ['Evening (5-9 PM)', 'Night (9 PM+)'])
        .order('time_slot');

      const events: ScheduleEvent[] = [
        ...(sportsData || []).map(event => ({
          id: event.id,
          type: 'sports' as const,
          time: event.time || '',
          title: event.title,
          location: event.location || '',
          opponent: event.opponent,
          meal_options: event.meal_options,
          meal_notes: event.meal_notes,
          description: event.description,
          isFeatured: false,
        })),
        ...(activitiesData || []).map(activity => ({
          id: activity.id,
          type: 'activity' as const,
          time: activity.time_slot === 'Evening (5-9 PM)' ? '7:00 PM' : '9:00 PM',
          title: activity.title,
          location: activity.location || '',
          description: activity.description,
          isFeatured: false,
        }))
      ];

      // Mark first sports event as featured if exists
      const firstSportsEvent = events.find(e => e.type === 'sports');
      if (firstSportsEvent) {
        firstSportsEvent.isFeatured = true;
        setFeaturedEvent(firstSportsEvent);
      }

      setScheduleEvents(events);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <div className="container mx-auto p-4">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .newspaper-header {
            border-bottom: 4px double #000;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .newspaper-title {
            font-family: Georgia, serif;
            font-size: 48px;
            font-weight: bold;
            text-align: center;
            letter-spacing: 2px;
            margin-bottom: 8px;
          }
          .newspaper-tagline {
            text-align: center;
            font-size: 12px;
            letter-spacing: 3px;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 4px 0;
            margin-bottom: 4px;
          }
          .newspaper-date {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 16px;
          }
          .section-title {
            font-family: Georgia, serif;
            font-size: 20px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 2px solid #000;
            margin-bottom: 12px;
            padding-bottom: 4px;
          }
          .schedule-item {
            display: flex;
            gap: 16px;
            padding: 8px 0;
            border-bottom: 1px dotted #ccc;
            font-size: 13px;
          }
          .schedule-time {
            font-weight: bold;
            min-width: 80px;
          }
          .boxed-section {
            border: 2px solid #000;
            padding: 16px;
            margin-bottom: 16px;
            background: white;
          }
          .featured-title {
            font-family: Georgia, serif;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 12px;
            text-align: center;
          }
          .two-column-layout {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 16px;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}</style>
      
      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-3xl font-bold">Daily News</h1>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="print-content">
        {/* Newspaper Header */}
        <div className="newspaper-header">
          <div className="newspaper-title">TYLER HILL DAILY NEWS</div>
          <div className="newspaper-tagline">LIVE THIS MOMENT | HOME OF THE BEARS</div>
          <div className="newspaper-date">{today}</div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            {/* Schedule Section */}
            <div className="mb-6">
              <div className="section-title">Today's Schedule</div>
              {scheduleEvents.filter(e => !e.isFeatured).length > 0 ? (
                <div>
                  {scheduleEvents.filter(e => !e.isFeatured).map((event) => (
                    <div key={event.id} className="schedule-item">
                      <div className="schedule-time">{event.time}</div>
                      <div className="flex-1">
                        <strong>{event.title}</strong>
                        {event.location && ` - ${event.location}`}
                        {event.opponent && ` vs ${event.opponent}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No additional events scheduled
                </div>
              )}
            </div>

            {/* Two Column Layout */}
            <div className="two-column-layout">
              {/* Featured Event */}
              {featuredEvent ? (
                <div className="boxed-section">
                  <div className="section-title" style={{ fontSize: '16px' }}>Featured Event</div>
                  <div className="featured-title">{featuredEvent.title}</div>
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    {featuredEvent.time && (
                      <div><strong>Time:</strong> {featuredEvent.time}</div>
                    )}
                    {featuredEvent.location && (
                      <div><strong>Location:</strong> {featuredEvent.location}</div>
                    )}
                    {featuredEvent.opponent && (
                      <div><strong>Opponent:</strong> {featuredEvent.opponent}</div>
                    )}
                    {featuredEvent.meal_options && featuredEvent.meal_options.length > 0 && (
                      <div><strong>Meal:</strong> {featuredEvent.meal_options.join(', ')}</div>
                    )}
                    {featuredEvent.meal_notes && (
                      <div><strong>Notes:</strong> {featuredEvent.meal_notes}</div>
                    )}
                    {featuredEvent.description && (
                      <div style={{ marginTop: '8px' }}>{featuredEvent.description}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="boxed-section">
                  <div className="section-title" style={{ fontSize: '16px' }}>Featured Event</div>
                  <div className="text-center py-8 text-muted-foreground">
                    No featured event today
                  </div>
                </div>
              )}

              {/* Meal Schedule */}
              <div className="boxed-section">
                <div className="section-title" style={{ fontSize: '16px' }}>Da Bears' Buffet</div>
                <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ fontSize: '15px' }}>Breakfast</strong>
                    <div style={{ marginLeft: '12px', color: '#666' }}>7:30 AM - 8:30 AM</div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ fontSize: '15px' }}>Lunch</strong>
                    <div style={{ marginLeft: '12px', color: '#666' }}>12:30 PM - 1:30 PM</div>
                  </div>
                  <div>
                    <strong style={{ fontSize: '15px' }}>Dinner</strong>
                    <div style={{ marginLeft: '12px', color: '#666' }}>6:00 PM - 7:00 PM</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
