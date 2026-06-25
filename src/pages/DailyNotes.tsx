import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';
import { isActiveRosterStatus, isBirthdayTodayCalendar } from '@/lib/birthdayCalendar';
import { formatTime12Hour } from '@/lib/utils';

interface BirthdayRow {
  id: string;
  name: string;
  date_of_birth: string;
}

interface MenuItem {
  id: string;
  meal_type: string;
  items: string;
  allergens?: string;
}

interface ScheduleEvent {
  id: string;
  title: string;
  time?: string;
  location?: string;
  type: string;
  description?: string;
}

export default function DailyNotes() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [birthdayChildren, setBirthdayChildren] = useState<BirthdayRow[]>([]);
  const [birthdayStaff, setBirthdayStaff] = useState<BirthdayRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { getDivisionFilter, loading: permissionsLoading, userDivisions } = usePermissions();

  // Redirect Timber Lake West to their separate Daily Wolf page
  useEffect(() => {
    if (currentCompany?.slug === 'timber-lake-west') {
      navigate('/daily-wolf-printable');
    }
  }, [currentCompany?.slug, navigate]);

  useEffect(() => {
    // Wait for permissions to load before fetching
    if (!currentCompany?.id || currentCompany?.slug === 'timber-lake-west' || permissionsLoading) return;
    fetchAllData();

    // Set up realtime subscriptions
    const channels = [
      supabase.channel('children-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'children' }, fetchAllData)
        .subscribe(),
      supabase.channel('menu-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, fetchAllData)
        .subscribe(),
      supabase.channel('sports-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_calendar' }, fetchAllData)
        .subscribe(),
      supabase.channel('activities-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'activities_field_trips' }, fetchAllData)
        .subscribe(),
      supabase.channel('special-events-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'special_events_activities' }, fetchAllData)
        .subscribe(),
      supabase.channel('daily-notes-staff-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, fetchAllData)
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [currentCompany?.id, currentSeason, permissionsLoading, userDivisions]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const todayDate = new Date();
      const divisionFilter = getDivisionFilter();

      // Fetch birthday children with division filtering
      let childrenQuery = supabase
        .from('children')
        .select('id, name, date_of_birth, division_id, status')
        .eq('company_id', currentCompany.id)
        .eq('season', currentSeason)
        .not('date_of_birth', 'is', null);
      
      // Apply division filter if user has limited access
      if (divisionFilter !== null && divisionFilter.length > 0) {
        childrenQuery = childrenQuery.in('division_id', divisionFilter);
      }

      const { data: childrenRaw } = await childrenQuery;

      const todaysBirthdays = (childrenRaw || [])
        .filter((child) => isActiveRosterStatus(child.status))
        .filter((child) =>
          isBirthdayTodayCalendar(child.date_of_birth, todayDate.getMonth() + 1, todayDate.getDate()),
        );
      setBirthdayChildren(todaysBirthdays);

      let staffQuery = supabase
        .from('staff')
        .select('id, name, date_of_birth, status')
        .eq('company_id', currentCompany.id)
        .eq('season', currentSeason)
        .not('date_of_birth', 'is', null);

      const { data: staffRaw } = await staffQuery;

      const staffToday = (staffRaw || [])
        .filter((staff) => isActiveRosterStatus(staff.status))
        .filter((staff) =>
          isBirthdayTodayCalendar(staff.date_of_birth, todayDate.getMonth() + 1, todayDate.getDate()),
        );
      setBirthdayStaff(staffToday);

      // Fetch menu items
      const { data: menuData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('date', today)
        .eq('season', currentSeason)
        .order('meal_type');
      setMenuItems(menuData || []);

      // Fetch schedule events from multiple sources
      const events: ScheduleEvent[] = [];

      // Sports calendar
      const { data: sportsData } = await supabase
        .from('sports_calendar')
        .select('id, title, time, start_time_field, depart_time, location, description')
        .eq('company_id', currentCompany.id)
        .eq('event_date', today)
        .eq('season', currentSeason)
        .order('time');
      
      if (sportsData) {
        events.push(...sportsData.map(e => ({
          ...e,
          type: 'Sports',
          time: formatTime12Hour(e.start_time_field || e.time || e.depart_time) || e.start_time_field || e.time || e.depart_time
        })));
      }

      // Activities & Field Trips
      const { data: activitiesData } = await supabase
        .from('activities_field_trips')
        .select('id, title, time, location, description')
        .eq('company_id', currentCompany.id)
        .eq('event_date', today)
        .eq('season', currentSeason)
        .order('time');
      
      if (activitiesData) {
        events.push(...activitiesData.map(e => ({ ...e, type: 'Activity' })));
      }

      // Special Events
      const { data: specialEventsData } = await supabase
        .from('special_events_activities')
        .select('id, title, time_slot, location, description')
        .eq('company_id', currentCompany.id)
        .eq('event_date', today)
        .eq('season', currentSeason)
        .order('time_slot');
      
      if (specialEventsData) {
        events.push(...specialEventsData.map(e => ({ 
          id: e.id, 
          title: e.title, 
          time: e.time_slot, 
          location: e.location, 
          description: e.description,
          type: 'Special Event' 
        })));
      }

      // Sort all events by time
      events.sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });

      setScheduleEvents(events);

    } catch (error) {
      console.error('Error fetching daily news data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const today = format(new Date(), 'EEEE, MMMM d, yyyy');
  const campName = currentCompany?.slug === 'tyler-hill-camp' ? 'Tyler Hill' : 'Timber Lake';
  const campSubtitle = currentCompany?.slug === 'tyler-hill-camp' ? 'HOME OF THE BEARS' : '';

  if (currentCompany?.slug === 'timber-lake-west') {
    return null; // Will redirect via useEffect
  }

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
            margin-bottom: 20px;
          }
          .newspaper-title {
            font-family: Georgia, serif;
            font-size: 52px;
            font-weight: bold;
            text-align: center;
            letter-spacing: 3px;
            margin-bottom: 4px;
          }
          .newspaper-subtitle {
            font-family: Georgia, serif;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            letter-spacing: 2px;
            margin-bottom: 8px;
          }
          .newspaper-date {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            margin-top: 8px;
          }
          .section-title {
            font-family: Georgia, serif;
            font-size: 20px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 2px solid #000;
            margin-bottom: 12px;
            margin-top: 20px;
            padding-bottom: 4px;
          }
          .birthday-section {
            margin-bottom: 20px;
            font-size: 14px;
          }
          .birthday-list {
            font-weight: bold;
            font-size: 15px;
            margin-top: 8px;
          }
          .schedule-section {
            margin-bottom: 20px;
          }
          .schedule-item {
            display: flex;
            gap: 12px;
            padding: 8px 0;
            border-bottom: 1px dotted #ccc;
            font-size: 13px;
          }
          .event-time {
            font-weight: bold;
            min-width: 80px;
          }
          .event-type {
            font-style: italic;
            color: #666;
            font-size: 12px;
          }
          .menu-section {
            page-break-inside: avoid;
            margin-bottom: 20px;
            border: 2px solid #000;
            padding: 16px;
            background: white;
          }
          .meal-item {
            margin-bottom: 16px;
            font-size: 13px;
          }
          .meal-item strong {
            font-size: 15px;
            display: block;
            margin-bottom: 4px;
          }
          .allergen-info {
            font-style: italic;
            color: #666;
            margin-top: 4px;
            font-size: 12px;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}</style>
      
      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-3xl font-bold">{campName} Daily News</h1>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="print-content">
        {/* Newspaper Header */}
        <div className="newspaper-header">
          <div className="newspaper-title">{campName.toUpperCase()} DAILY NEWS</div>
          {campSubtitle && <div className="newspaper-subtitle">{campSubtitle}</div>}
          <div className="newspaper-date">{today}</div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            {/* Birthday Wishes */}
            <div className="birthday-section">
              <div className="section-title">Birthday Wishes</div>
              {birthdayChildren.length + birthdayStaff.length > 0 ? (
                <div className="birthday-list">
                  🎉 {[...birthdayChildren, ...birthdayStaff].map((p) => p.name).join(', ')}
                </div>
              ) : (
                <div>No birthdays today</div>
              )}
            </div>

            {/* Today's Schedule */}
            <div className="schedule-section">
              <div className="section-title">Today's Schedule</div>
              {scheduleEvents.length > 0 ? (
                scheduleEvents.map(event => (
                  <div key={event.id} className="schedule-item">
                    <div className="event-time">{event.time || 'TBD'}</div>
                    <div className="flex-1">
                      <div>{event.title}</div>
                      {event.location && <div className="event-type">@ {event.location}</div>}
                      {event.description && <div className="event-type">{event.description}</div>}
                    </div>
                    <div className="event-type">[{event.type}]</div>
                  </div>
                ))
              ) : (
                <div>No events scheduled for today</div>
              )}
            </div>

            {/* Menu */}
            <div className="menu-section">
              <div className="section-title">Today's Menu</div>
              {['breakfast', 'lunch', 'snack', 'dinner'].map(mealType => {
                const meal = menuItems.find(m => m.meal_type.toLowerCase() === mealType);
                return (
                  <div key={mealType} className="meal-item">
                    <strong>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</strong>
                    <div>{meal?.items || 'TBD'}</div>
                    {meal?.allergens && (
                      <div className="allergen-info">⚠️ Allergens: {meal.allergens}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
