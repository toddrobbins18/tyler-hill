import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';
import { isBirthdayTodayCalendar } from '@/lib/birthdayCalendar';

interface BirthdayRow {
  id: string;
  name: string;
  date_of_birth: string;
}

interface MealData {
  id: string;
  meal_type: string;
  items: string;
  allergens?: string;
}

interface DivisionGame {
  id: string;
  title: string;
  time?: string;
  location?: string;
  opponent?: string;
  sport_type: string;
  divisions?: { name: string };
}

interface SportsEvent {
  id: string;
  title: string;
  time?: string;
  location?: string;
  opponent?: string;
  description?: string;
}

interface EveningActivity {
  id: string;
  title: string;
  time_slot: string;
  location?: string;
}

interface DailyContent {
  quote_of_the_day?: string;
  notes?: string;
  officer_of_day?: string;
  laundry_info?: string;
  phone_calls_info?: string;
}

export default function DailyWolfPrintable() {
  const [birthdayChildren, setBirthdayChildren] = useState<BirthdayRow[]>([]);
  const [birthdayStaff, setBirthdayStaff] = useState<BirthdayRow[]>([]);
  const [meals, setMeals] = useState<MealData[]>([]);
  const [divisionGames, setDivisionGames] = useState<DivisionGame[]>([]);
  const [sportsEvents, setSportsEvents] = useState<SportsEvent[]>([]);
  const [eveningActivities, setEveningActivities] = useState<EveningActivity[]>([]);
  const [dailyContent, setDailyContent] = useState<DailyContent>({});
  const [loading, setLoading] = useState(true);
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();

  useEffect(() => {
    if (!currentCompany?.id) return;
    fetchAllData();

    // Set up realtime subscriptions
    const channels = [
      supabase.channel('children-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'children' }, fetchAllData)
        .subscribe(),
      supabase.channel('meals-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'special_meals' }, fetchAllData)
        .subscribe(),
      supabase.channel('sports-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_calendar' }, fetchAllData)
        .subscribe(),
      supabase.channel('activities-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'special_events_activities' }, fetchAllData)
        .subscribe(),
      supabase.channel('content-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_wolf_content' }, fetchAllData)
        .subscribe(),
      supabase.channel('daily-wolf-staff-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, fetchAllData)
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [currentCompany?.id, currentSeason]);

  const { getDivisionFilter } = usePermissions();

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const todayDate = new Date();
      const divisionFilter = getDivisionFilter();

      // Fetch birthday children with division filtering
      let childrenQuery = supabase
        .from('children')
        .select('id, name, date_of_birth, division_id')
        .eq('company_id', currentCompany.id)
        .eq('season', currentSeason)
        .eq('status', 'active')
        .not('date_of_birth', 'is', null);
      
      // Apply division filter if user has limited access
      if (divisionFilter !== null && divisionFilter.length > 0) {
        childrenQuery = childrenQuery.in('division_id', divisionFilter);
      }

      const { data: childrenData } = await childrenQuery;

      const m = todayDate.getMonth() + 1;
      const d = todayDate.getDate();
      const todaysBirthdays =
        childrenData?.filter((child) => isBirthdayTodayCalendar(child.date_of_birth, m, d)) || [];
      setBirthdayChildren(todaysBirthdays);

      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, date_of_birth')
        .eq('company_id', currentCompany.id)
        .eq('season', currentSeason)
        .eq('status', 'active')
        .not('date_of_birth', 'is', null);

      const staffToday =
        staffData?.filter((staff) => isBirthdayTodayCalendar(staff.date_of_birth, m, d)) || [];
      setBirthdayStaff(staffToday);

      // Fetch meals
      const { data: mealsData } = await supabase
        .from('special_meals')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('date', today)
        .eq('season', currentSeason)
        .order('meal_type');
      setMeals(mealsData || []);

      // Fetch division games with division info
      const { data: sportsData } = await supabase
        .from('sports_calendar')
        .select(`
          *,
          sports_calendar_divisions!inner(
            division_id,
            divisions(name)
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('event_date', today)
        .eq('season', currentSeason)
        .order('time');

      // Transform to flat structure with division name
      const gamesWithDivisions = sportsData?.map(game => ({
        ...game,
        divisions: game.sports_calendar_divisions?.[0]?.divisions
      })) || [];
      setDivisionGames(gamesWithDivisions);

      // Fetch all sports events for athletics section
      const { data: allSportsData } = await supabase
        .from('sports_calendar')
        .select('id, title, time, location, opponent, description')
        .eq('company_id', currentCompany.id)
        .eq('event_date', today)
        .eq('season', currentSeason)
        .order('time');
      setSportsEvents(allSportsData || []);

      // Fetch evening activities
      const { data: activitiesData } = await supabase
        .from('special_events_activities')
        .select('id, title, time_slot, location')
        .eq('company_id', currentCompany.id)
        .eq('event_date', today)
        .eq('season', currentSeason)
        .in('time_slot', ['Evening (5-9 PM)', 'Night (9 PM+)'])
        .order('time_slot');
      setEveningActivities(activitiesData || []);

      // Fetch daily wolf content
      const { data: contentData } = await supabase
        .from('daily_wolf_content')
        .select('quote_of_the_day, notes, officer_of_day, laundry_info, phone_calls_info')
        .eq('company_id', currentCompany.id)
        .eq('date', today)
        .eq('season', currentSeason)
        .maybeSingle();
      setDailyContent(contentData || {});

    } catch (error) {
      console.error('Error fetching Daily Wolf data:', error);
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
            padding: 12px;
          }
          .no-print {
            display: none !important;
          }
          .newspaper-header {
            border-bottom: 3px double #000;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .newspaper-title {
            font-family: Georgia, serif;
            font-size: 36px;
            font-weight: bold;
            text-align: center;
            letter-spacing: 2px;
            margin-bottom: 4px;
          }
          .newspaper-date {
            text-align: center;
            font-size: 11px;
            font-weight: bold;
            margin-top: 4px;
          }
          .section-title {
            font-family: Georgia, serif;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            margin-bottom: 6px;
            margin-top: 8px;
            padding-bottom: 2px;
          }
          .birthday-section {
            margin-bottom: 8px;
            font-size: 10px;
          }
          .birthday-list {
            font-weight: bold;
            font-size: 11px;
            margin-top: 4px;
          }
          .division-games-section {
            margin-bottom: 8px;
          }
          .game-item {
            display: flex;
            padding: 4px 0;
            border-bottom: 1px solid #ddd;
            font-size: 10px;
          }
          .division-name {
            font-weight: bold;
            min-width: 120px;
          }
          .game-details {
            flex: 1;
          }
          .menu-section {
            page-break-inside: avoid;
            margin-bottom: 8px;
          }
          .meal-item {
            margin-bottom: 8px;
            font-size: 10px;
          }
          .meal-item strong {
            font-size: 12px;
            display: block;
            margin-bottom: 2px;
          }
          .allergen-info {
            font-style: italic;
            color: #666;
            margin-top: 2px;
            font-size: 9px;
          }
          .athletics-section {
            margin-bottom: 8px;
          }
          .sport-event {
            display: flex;
            gap: 6px;
            padding: 4px 0;
            border-bottom: 1px dotted #ccc;
            font-size: 10px;
          }
          .event-time {
            font-weight: bold;
            min-width: 70px;
          }
          .quote-section {
            font-style: italic;
            text-align: center;
            padding: 12px;
            margin: 8px 0;
            border: 1px solid #000;
            page-break-inside: avoid;
          }
          .quote-text {
            font-size: 11px;
            line-height: 1.3;
          }
          .evening-section {
            margin-bottom: 8px;
          }
          .evening-item {
            padding: 4px 0;
            font-size: 10px;
          }
          .notes-section {
            border: 1px solid #000;
            padding: 8px;
            margin-top: 8px;
            page-break-inside: avoid;
          }
          .notes-content {
            font-size: 10px;
            line-height: 1.3;
          }
          .boxed-section {
            border: 1px solid #000;
            padding: 8px;
            margin-bottom: 8px;
            background: white;
          }
          .od-section, .laundry-section, .phone-calls-section {
            margin-bottom: 8px;
            font-size: 10px;
          }
          .od-content, .laundry-content, .phone-calls-content {
            padding: 6px;
            background: #f9f9f9;
            border-left: 2px solid #000;
          }
          .admin-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 8px;
          }
          @page {
            margin: 0.3in;
            size: letter;
          }
        }
      `}</style>
      
      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-3xl font-bold">Daily Wolf Printable</h1>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="print-content">
        {/* Newspaper Header */}
        <div className="newspaper-header">
          <div className="newspaper-title">THE DAILY WOLF</div>
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
                  {[...birthdayChildren, ...birthdayStaff].map((p) => p.name).join(', ')}
                </div>
              ) : (
                <div>No birthdays today</div>
              )}
            </div>

            {/* Administrative Info - 3 Column Layout */}
            <div className="admin-grid">
              {/* OD */}
              <div className="od-section">
                <div className="section-title">OD</div>
                <div className="od-content">
                  <p>{dailyContent.officer_of_day || 'TBD'}</p>
                </div>
              </div>

              {/* Laundry Schedule */}
              <div className="laundry-section">
                <div className="section-title">Laundry</div>
                <div className="laundry-content">
                  <p style={{ whiteSpace: 'pre-wrap' }}>{dailyContent.laundry_info || 'TBD'}</p>
                </div>
              </div>

              {/* Phone Calls */}
              <div className="phone-calls-section">
                <div className="section-title">Phone Calls</div>
                <div className="phone-calls-content">
                  <p style={{ whiteSpace: 'pre-wrap' }}>{dailyContent.phone_calls_info || 'TBD'}</p>
                </div>
              </div>
            </div>

            {/* Athletics */}
            <div className="athletics-section">
              <div className="section-title">Athletics</div>
              {sportsEvents.length > 0 ? (
                sportsEvents.map(event => (
                  <div key={event.id} className="sport-event">
                    <div className="event-time">{event.time || 'TBD'}</div>
                    <div className="flex-1">
                      {event.title}
                      {event.opponent && ` vs ${event.opponent}`}
                      {event.location && ` - ${event.location}`}
                    </div>
                  </div>
                ))
              ) : (
                <div>No athletic events scheduled</div>
              )}
            </div>

            {/* Quote of the Day */}
            <div className="quote-section boxed-section">
              <div className="section-title">Quote of the Day</div>
              <div className="quote-text">
                {dailyContent.quote_of_the_day || '"Make today amazing!"'}
              </div>
            </div>

            {/* Evening Activities */}
            <div className="evening-section">
              <div className="section-title">Evening Activities</div>
              {eveningActivities.length > 0 ? (
                eveningActivities.map(activity => (
                  <div key={activity.id} className="evening-item">
                    {activity.time_slot === 'Evening (5-9 PM)' ? '7:00 PM' : '9:00 PM'} - {activity.title}
                    {activity.location && ` @ ${activity.location}`}
                  </div>
                ))
              ) : (
                <div>No evening activities scheduled</div>
              )}
            </div>

            {/* Notes */}
            <div className="notes-section">
              <div className="section-title">Notes</div>
              <div className="notes-content">
                {dailyContent.notes || 'Have a great day at Timber Lake West!'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
