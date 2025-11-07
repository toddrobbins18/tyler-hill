import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface BirthdayChild {
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
}

export default function DailyNotes() {
  const [birthdayChildren, setBirthdayChildren] = useState<BirthdayChild[]>([]);
  const [meals, setMeals] = useState<MealData[]>([]);
  const [divisionGames, setDivisionGames] = useState<DivisionGame[]>([]);
  const [sportsEvents, setSportsEvents] = useState<SportsEvent[]>([]);
  const [eveningActivities, setEveningActivities] = useState<EveningActivity[]>([]);
  const [dailyContent, setDailyContent] = useState<DailyContent>({});
  const [loading, setLoading] = useState(true);
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();

  // ONLY show for Timber Lake West
  if (currentCompany?.slug !== 'timber-lake-west') {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Daily Wolf</h1>
        <p>This feature is only available for Timber Lake West.</p>
      </div>
    );
  }

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
        .subscribe()
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [currentCompany?.id, currentSeason]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const todayDate = new Date();

      // Fetch birthday children
      const { data: childrenData } = await supabase
        .from('children')
        .select('id, name, date_of_birth')
        .eq('company_id', currentCompany.id)
        .eq('season', currentSeason)
        .eq('status', 'active')
        .not('date_of_birth', 'is', null);

      const todaysBirthdays = childrenData?.filter(child => {
        const birthday = new Date(child.date_of_birth);
        return birthday.getMonth() === todayDate.getMonth() && 
               birthday.getDate() === todayDate.getDate();
      }) || [];
      setBirthdayChildren(todaysBirthdays);

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
        .select('quote_of_the_day, notes')
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
          .division-games-section {
            margin-bottom: 20px;
          }
          .game-item {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #ddd;
            font-size: 13px;
          }
          .division-name {
            font-weight: bold;
            min-width: 140px;
          }
          .game-details {
            flex: 1;
          }
          .menu-section {
            page-break-inside: avoid;
            margin-bottom: 20px;
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
          .athletics-section {
            margin-bottom: 20px;
          }
          .sport-event {
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
          .quote-section {
            font-style: italic;
            text-align: center;
            padding: 20px;
            margin: 20px 0;
            border: 2px solid #000;
            page-break-inside: avoid;
          }
          .quote-text {
            font-size: 16px;
            line-height: 1.6;
          }
          .evening-section {
            margin-bottom: 20px;
          }
          .evening-item {
            padding: 6px 0;
            font-size: 13px;
          }
          .notes-section {
            border: 2px solid #000;
            padding: 16px;
            margin-top: 20px;
            page-break-inside: avoid;
          }
          .notes-content {
            font-size: 13px;
            line-height: 1.6;
          }
          .boxed-section {
            border: 2px solid #000;
            padding: 16px;
            margin-bottom: 16px;
            background: white;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}</style>
      
      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-3xl font-bold">Daily Wolf</h1>
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
              {birthdayChildren.length > 0 ? (
                <div className="birthday-list">
                  {birthdayChildren.map(child => child.name).join(', ')}
                </div>
              ) : (
                <div>No birthdays today</div>
              )}
            </div>

            {/* Division Line-Up Games */}
            <div className="division-games-section">
              <div className="section-title">Division Line-Up Games</div>
              {divisionGames.length > 0 ? (
                divisionGames.map(game => (
                  <div key={game.id} className="game-item">
                    <div className="division-name">{game.divisions?.name || 'General'}</div>
                    <div className="game-details">
                      {game.time && `${game.time} - `}
                      {game.sport_type}
                      {game.opponent && ` vs ${game.opponent}`}
                      {game.location && ` @ ${game.location}`}
                    </div>
                  </div>
                ))
              ) : (
                <div>No division games scheduled</div>
              )}
            </div>

            {/* Menu */}
            <div className="menu-section boxed-section">
              <div className="section-title">Menu</div>
              {['Breakfast', 'Lunch', 'Dinner'].map(mealType => {
                const meal = meals.find(m => m.meal_type === mealType);
                return (
                  <div key={mealType} className="meal-item">
                    <strong>{mealType}</strong>
                    <div>{meal?.items || 'TBD'}</div>
                    {meal?.allergens && (
                      <div className="allergen-info">Allergens: {meal.allergens}</div>
                    )}
                  </div>
                );
              })}
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
