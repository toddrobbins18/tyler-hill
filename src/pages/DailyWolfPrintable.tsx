import { useEffect, useState, type ReactNode } from 'react';
import { Printer, Cake, UtensilsCrossed, Trophy, Sparkles, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface MealData {
  id: string;
  meal_type: string;
  items: string;
  description?: string;
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

interface SpecialEvent {
  id: string;
  title: string;
  time_slot: string;
  location?: string;
  description?: string;
}

interface DailyContent {
  quote_of_the_day?: string;
  notes?: string;
  officer_of_day?: string;
  laundry_info?: string;
  phone_calls_info?: string;
}

const MEAL_ORDER = ['breakfast', 'lunch', 'snack', 'dinner'] as const;

function SectionCard({
  title,
  icon,
  children,
  className = '',
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`overflow-hidden shadow-sm print:shadow-none ${className}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="font-serif text-sm uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 text-sm leading-relaxed">{children}</CardContent>
    </Card>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground italic">{children}</p>;
}

export default function DailyWolfPrintable() {
  const [birthdayChildren, setBirthdayChildren] = useState<BirthdayRow[]>([]);
  const [birthdayStaff, setBirthdayStaff] = useState<BirthdayRow[]>([]);
  const [meals, setMeals] = useState<MealData[]>([]);
  const [divisionGames, setDivisionGames] = useState<DivisionGame[]>([]);
  const [sportsEvents, setSportsEvents] = useState<SportsEvent[]>([]);
  const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([]);
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, fetchAllData)
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
      const today = format(new Date(), 'yyyy-MM-dd');
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

      const m = todayDate.getMonth() + 1;
      const d = todayDate.getDate();
      const todaysBirthdays =
        (childrenRaw || [])
          .filter((child) => isActiveRosterStatus(child.status))
          .filter((child) => isBirthdayTodayCalendar(child.date_of_birth, m, d)) || [];
      setBirthdayChildren(todaysBirthdays);

      const { data: staffRaw } = await supabase
        .from('staff')
        .select('id, name, date_of_birth, status')
        .eq('company_id', currentCompany.id)
        .eq('season', currentSeason)
        .not('date_of_birth', 'is', null);

      const staffToday =
        (staffRaw || [])
          .filter((staff) => isActiveRosterStatus(staff.status))
          .filter((staff) => isBirthdayTodayCalendar(staff.date_of_birth, m, d)) || [];
      setBirthdayStaff(staffToday);

      // Menu: match Menu page — include rows for this season or season=null (legacy inserts omit season)
      let menuQuery = supabase
        .from('menu_items')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('date', today)
        .order('meal_type');
      if (currentSeason) {
        menuQuery = menuQuery.or(`season.eq.${currentSeason},season.is.null`);
      }
      const { data: mealsData } = await menuQuery;
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
        .select('id, title, time, start_time_field, depart_time, location, opponent, description')
        .eq('company_id', currentCompany.id)
        .eq('event_date', today)
        .eq('season', currentSeason)
        .order('time');
      setSportsEvents(allSportsData || []);

      // Special events: by date + company (Dashboard pattern); prefer current season, fall back to all for today
      const { data: activitiesData } = await supabase
        .from('special_events_activities')
        .select('id, title, time_slot, location, description, season')
        .eq('company_id', currentCompany.id)
        .eq('event_date', today)
        .order('time_slot');
      const allTodayEvents = activitiesData || [];
      if (currentSeason) {
        const seasonMatched = allTodayEvents.filter(
          (e) => !e.season || e.season === currentSeason,
        );
        setSpecialEvents(seasonMatched.length > 0 ? seasonMatched : allTodayEvents);
      } else {
        setSpecialEvents(allTodayEvents);
      }

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
  const birthdayNames = [...birthdayChildren, ...birthdayStaff].map((p) => p.name);
  const hasBirthdays = birthdayNames.length > 0;

  const mealByType = (type: string) =>
    meals.find((m) => (m.meal_type || '').toLowerCase() === type);

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 12px;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
          @page { margin: 0.35in; size: letter; }
        }
      `}</style>

      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-3xl font-bold">Daily Wolf Printable</h1>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="print-content rounded-xl border border-border bg-card shadow-lg overflow-hidden print:shadow-none print:rounded-none">
        {/* Masthead */}
        <header className="text-center border-b-4 border-double border-foreground/80 bg-muted/40 px-6 py-8">
          <p className="font-serif text-4xl md:text-5xl font-bold tracking-[0.2em] text-foreground">
            THE DAILY WOLF
          </p>
          <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Timber Lake West
          </p>
          <p className="mt-3 text-base font-medium text-foreground">{today}</p>
        </header>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading today&apos;s bulletin…</div>
        ) : (
          <div className="p-4 md:p-6 space-y-5">
            {/* Birthdays */}
            <div
              className={`rounded-lg border px-4 py-3 ${
                hasBirthdays
                  ? 'border-amber-300/60 bg-amber-50 dark:bg-amber-950/25'
                  : 'border-border bg-muted/20'
              }`}
            >
              <div className="flex items-center gap-2 font-serif text-sm font-bold uppercase tracking-wide text-foreground mb-1">
                <Cake className="h-4 w-4 shrink-0" />
                Birthday Wishes
              </div>
              {hasBirthdays ? (
                <p className="text-base font-semibold text-foreground">
                  🎉 {birthdayNames.join(', ')}
                </p>
              ) : (
                <EmptyLine>No birthdays today</EmptyLine>
              )}
            </div>

            {/* Menu */}
            <SectionCard title="Menu" icon={<UtensilsCrossed className="h-4 w-4 text-primary" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {MEAL_ORDER.map((mealType) => {
                  const meal = mealByType(mealType);
                  const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
                  return (
                    <div
                      key={mealType}
                      className="rounded-md border border-border bg-background/80 p-3 min-h-[4.5rem]"
                    >
                      <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1">
                        {label}
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {(meal?.items || meal?.description)?.trim() || ''}
                      </p>
                      {meal?.allergens && (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          Allergens: {meal.allergens}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            {/* Super OD / Laundry / Phone */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SectionCard title="Super OD">
                <p className="font-medium text-foreground">
                  {dailyContent.officer_of_day?.trim() || 'TBD'}
                </p>
              </SectionCard>
              <SectionCard title="Laundry">
                <p className="whitespace-pre-wrap font-medium text-foreground">
                  {dailyContent.laundry_info?.trim() || 'TBD'}
                </p>
              </SectionCard>
              <SectionCard title="Phone Calls">
                <p className="whitespace-pre-wrap font-medium text-foreground">
                  {dailyContent.phone_calls_info?.trim() || 'TBD'}
                </p>
              </SectionCard>
            </div>

            {/* Athletics + Special Events */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard
                title="Athletics"
                icon={<Trophy className="h-4 w-4 text-primary" />}
              >
                {sportsEvents.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {sportsEvents.map((event) => (
                      <li key={event.id} className="flex gap-3 py-2 first:pt-0 last:pb-0">
                        <span className="shrink-0 w-16 text-xs font-bold text-primary">
                          {formatTime12Hour(event.start_time_field || event.time || event.depart_time) || event.start_time_field || event.time || event.depart_time || 'TBD'}
                        </span>
                        <span className="text-foreground">
                          {event.title}
                          {event.opponent && (
                            <span className="text-muted-foreground"> vs {event.opponent}</span>
                          )}
                          {event.location && (
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {event.location}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>No athletic events scheduled</EmptyLine>
                )}
              </SectionCard>

              <SectionCard
                title="Special Events"
                icon={<Sparkles className="h-4 w-4 text-primary" />}
              >
                {specialEvents.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {specialEvents.map((event) => (
                      <li key={event.id} className="py-2 first:pt-0 last:pb-0">
                        <p className="font-medium text-foreground">
                          <span className="text-primary text-xs font-bold uppercase mr-2">
                            {event.time_slot || 'TBD'}
                          </span>
                          {event.title}
                          {event.location && (
                            <span className="text-muted-foreground"> @ {event.location}</span>
                          )}
                        </p>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {event.description}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>No special events scheduled</EmptyLine>
                )}
              </SectionCard>
            </div>

            {/* Quote */}
            <div className="rounded-lg border-2 border-foreground/20 bg-muted/30 px-6 py-5 text-center">
              <div className="flex items-center justify-center gap-2 font-serif text-sm font-bold uppercase tracking-wide text-foreground mb-2">
                <Quote className="h-4 w-4" />
                Quote of the Day
              </div>
              <p className="font-serif text-lg italic text-foreground leading-snug">
                {dailyContent.quote_of_the_day?.trim()
                  ? `"${dailyContent.quote_of_the_day.trim()}"`
                  : '"Make today amazing!"'}
              </p>
            </div>

            {/* Notes */}
            <SectionCard title="Notes">
              <p className="whitespace-pre-wrap text-foreground">
                {dailyContent.notes?.trim() || 'Have a great day at Timber Lake West!'}
              </p>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
