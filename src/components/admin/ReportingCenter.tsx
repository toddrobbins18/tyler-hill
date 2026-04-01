import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Download, FileText, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/reportExports";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { sortDivisionsGirlsFirst } from "@/lib/divisionUtils";
import BirthdayReportTable from "./BirthdayReportTable";

type ReportType = 'incidents' | 'staff_evaluations' | 'camper_reports' | 'awards' | 'sports_events' | 'trips' | 'activities' | 'conflicts' | 'medications' | 'allergies' | 're_enrollment' | 'appointments' | 'tshirt_sizes' | 'birthdays';

export default function ReportingCenter() {
  const [reportType, setReportType] = useState<ReportType>('incidents');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [birthdayData, setBirthdayData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Record<string, any>>({});
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();
  const { getDivisionFilter, userDivisions, loading: permissionsLoading } = usePermissions();

  // Get allowed divisions for the current user
  const allowedDivisionIds = getDivisionFilter();

  // Fetch divisions on mount - filter by user's allowed divisions
  useEffect(() => {
    const fetchDivisions = async () => {
      if (!currentCompany?.id) return;
      
      let query = supabase
        .from("divisions")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true);
      
      // If user has division restrictions, only fetch those divisions
      if (allowedDivisionIds !== null && allowedDivisionIds.length > 0) {
        query = query.in("id", allowedDivisionIds);
      } else if (allowedDivisionIds !== null && allowedDivisionIds.length === 0) {
        // User has no division access
        setDivisions([]);
        return;
      }
      
      const { data } = await query;
      if (data) {
        setDivisions(sortDivisionsGirlsFirst(data));
      }
    };
    fetchDivisions();
  }, [currentCompany?.id, allowedDivisionIds]);

  const fetchReportData = async () => {
    if (!currentCompany?.id) return;
    
    // If user has restricted divisions but none assigned, show no data
    if (allowedDivisionIds !== null && allowedDivisionIds.length === 0) {
      setReportData([]);
      setSummary({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let data: any[] = [];
      let summaryData: Record<string, any> = {};

      switch (reportType) {
        case 'incidents':
          // Incidents are linked to children, so we need to filter by child's division
          let incidentsQuery = supabase
            .from('incident_reports')
            .select('*, children(name, division_id)')
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .gte('date', startDate || '1900-01-01')
            .lte('date', endDate || '2100-12-31')
            .order('date', { ascending: false });
          
          const { data: incidents } = await incidentsQuery;
          
          // Filter by allowed divisions if user has restrictions
          const filteredIncidents = allowedDivisionIds 
            ? incidents?.filter(i => i.children?.division_id && allowedDivisionIds.includes(i.children.division_id))
            : incidents;
          
          data = filteredIncidents?.map(i => ({
            Date: i.date,
            Child: i.children?.name || 'Unknown',
            Type: i.type,
            Severity: i.severity,
            Status: i.status,
            Description: i.description,
          })) || [];
          
          summaryData = {
            'Total Incidents': filteredIncidents?.length || 0,
            'Open': filteredIncidents?.filter(i => i.status === 'open').length || 0,
            'Resolved': filteredIncidents?.filter(i => i.status === 'resolved').length || 0,
          };
          break;

        case 'staff_evaluations':
          const { data: evals } = await supabase
            .from('staff_evaluations')
            .select('*')
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .gte('date', startDate || '1900-01-01')
            .lte('date', endDate || '2100-12-31')
            .order('date', { ascending: false });
          
          // Get staff names separately
          const staffIds = [...new Set(evals?.map(e => e.staff_id).filter(Boolean))];
          const { data: staffData } = await supabase
            .from('staff')
            .select('id, name')
            .in('id', staffIds);
          
          const staffMap = new Map(staffData?.map(s => [s.id, s.name]));
          
          data = evals?.map(e => ({
            Date: e.date,
            Staff: staffMap.get(e.staff_id!) || 'Unknown',
            Category: e.category,
            Rating: e.rating,
            Evaluator: e.evaluator,
            Comments: e.comments,
          })) || [];
          
          const avgRating = evals?.reduce((sum, e) => sum + (Number(e.rating) || 0), 0) / (evals?.length || 1);
          summaryData = {
            'Total Evaluations': evals?.length || 0,
            'Average Rating': avgRating.toFixed(2),
          };
          break;

        case 'awards':
          const { data: awards } = await supabase
            .from('awards')
            .select(`
              *, 
              children(
                name,
                division_id,
                divisions(name)
              )
            `)
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .gte('date', startDate || '1900-01-01')
            .lte('date', endDate || '2100-12-31')
            .order('date', { ascending: false });
          
          // Filter by allowed divisions if user has restrictions
          const filteredAwards = allowedDivisionIds 
            ? awards?.filter(a => a.children?.division_id && allowedDivisionIds.includes(a.children.division_id))
            : awards;
          
          data = filteredAwards?.map(a => ({
            Date: a.date,
            Child: a.children?.name || 'Unknown',
            Division: a.children?.divisions?.name || 'N/A',
            Title: a.title,
            Category: a.category,
            Description: a.description,
          })) || [];
          
          summaryData = {
            'Total Awards': filteredAwards?.length || 0,
          };
          break;

        case 'sports_events':
          const { data: sports } = await supabase
            .from('sports_calendar')
            .select('*')
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .gte('event_date', startDate || '1900-01-01')
            .lte('event_date', endDate || '2100-12-31')
            .order('event_date', { ascending: false });
          
          data = sports?.map(s => ({
            Date: s.event_date,
            Title: s.title,
            Sport: s.sport_type,
            Team: s.team,
            Opponent: s.opponent,
            Location: s.location,
            Time: s.time,
          })) || [];
          
          summaryData = {
            'Total Events': sports?.length || 0,
          };
          break;

        case 'trips':
          const { data: trips } = await supabase
            .from('trips')
            .select('*')
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .gte('date', startDate || '1900-01-01')
            .lte('date', endDate || '2100-12-31')
            .order('date', { ascending: false });
          
          data = trips?.map(t => ({
            Date: t.date,
            Name: t.name,
            Type: t.type,
            Destination: t.destination,
            Departure: t.departure_time,
            Return: t.return_time,
            Status: t.status,
          })) || [];
          
          summaryData = {
            'Total Trips': trips?.length || 0,
          };
          break;

        case 'activities':
          const { data: activities } = await supabase
            .from('activities_field_trips')
            .select('*')
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .gte('event_date', startDate || '1900-01-01')
            .lte('event_date', endDate || '2100-12-31')
            .order('event_date', { ascending: false });
          
          data = activities?.map(a => ({
            Date: a.event_date,
            Title: a.title,
            Type: a.activity_type,
            Location: a.location,
            Time: a.time,
            Staff: a.chaperone,
          })) || [];
          
          summaryData = {
            'Total Activities': activities?.length || 0,
          };
          break;

        case 'conflicts':
          const { data: conflicts } = await supabase
            .from('schedule_conflicts')
            .select('*')
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .gte('event1_date', startDate || '1900-01-01')
            .lte('event1_date', endDate || '2100-12-31')
            .order('detected_at', { ascending: false });
          
          data = conflicts?.map(c => ({
            'Detected': format(new Date(c.detected_at), 'yyyy-MM-dd HH:mm'),
            'Entity': c.entity_name,
            'Type': c.entity_type,
            'Conflict Type': c.conflict_type,
            'Event 1': `${c.event1_type} - ${c.event1_name}`,
            'Event 2': `${c.event2_type} - ${c.event2_name}`,
            'Date': c.event1_date,
            'Resolved': c.resolved ? 'Yes' : 'No',
            'Override Reason': c.override_reason || 'N/A',
          })) || [];
          
          summaryData = {
            'Total Conflicts': conflicts?.length || 0,
            'Unresolved': conflicts?.filter(c => !c.resolved).length || 0,
            'Resolved': conflicts?.filter(c => c.resolved).length || 0,
          };
          break;

        case 'medications':
          const { data: meds } = await supabase
            .from('medication_logs')
            .select(`
              *,
              children (
                name,
                division_id,
                divisions (name)
              )
            `)
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .gte('date', startDate || '1900-01-01')
            .lte('date', endDate || '2100-12-31')
            .order('date', { ascending: false });
          
          // Filter by allowed divisions if user has restrictions
          const filteredMeds = allowedDivisionIds 
            ? meds?.filter(m => m.children?.division_id && allowedDivisionIds.includes(m.children.division_id))
            : meds;
          
          data = filteredMeds?.map(m => ({
            Date: m.date,
            Child: m.children?.name || 'Unknown',
            Division: m.children?.divisions?.name || 'N/A',
            Medication: m.medication_name,
            Dosage: m.dosage || 'N/A',
            'Meal Time': Array.isArray(m.meal_time) ? m.meal_time.join(', ') : m.meal_time || 'N/A',
            'Scheduled Time': m.scheduled_time || 'N/A',
            Administered: m.administered ? 'Yes' : 'No',
            Notes: m.notes || '',
          })) || [];
          
          const uniqueChildren = new Set(filteredMeds?.map(m => m.child_id));
          const uniqueMedications = new Set(filteredMeds?.map(m => m.medication_name));
          const administeredCount = filteredMeds?.filter(m => m.administered).length || 0;
          const pendingCount = filteredMeds?.filter(m => !m.administered).length || 0;
          
          summaryData = {
            'Total Medication Entries': filteredMeds?.length || 0,
            'Unique Children': uniqueChildren.size,
            'Different Medications': uniqueMedications.size,
            'Administered': administeredCount,
            'Pending': pendingCount,
          };
          break;

        case 'allergies':
          let allergiesQuery = supabase
            .from('children')
            .select(`
              name,
              allergies,
              medical_notes,
              status,
              division_id,
              divisions (name)
            `)
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .not('allergies', 'is', null)
            .neq('allergies', '');
          
          // Filter by allowed divisions if user has restrictions
          if (allowedDivisionIds !== null && allowedDivisionIds.length > 0) {
            allergiesQuery = allergiesQuery.in('division_id', allowedDivisionIds);
          }
          
          const { data: allergicChildren } = await allergiesQuery.order('name');
          
          data = allergicChildren?.map(c => ({
            Child: c.name,
            Division: c.divisions?.name || 'No Division',
            Allergies: c.allergies,
            'Medical Notes': c.medical_notes || 'None',
            Status: c.status || 'active',
          })) || [];
          
          const totalWithAllergies = allergicChildren?.length || 0;
          const activeWithAllergies = allergicChildren?.filter(c => c.status === 'active').length || 0;
          const byDivision: Record<string, number> = {};
          
          allergicChildren?.forEach(c => {
            const divName = c.divisions?.name || 'No Division';
            byDivision[divName] = (byDivision[divName] || 0) + 1;
          });
          
          summaryData = {
            'Total Children with Allergies': totalWithAllergies,
            'Active with Allergies': activeWithAllergies,
            'Most Affected Division': Object.entries(byDivision).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
          };
          break;

        case 're_enrollment':
          // Fetch all campers across all seasons for this company
          const { data: allCampers } = await supabase
            .from('children')
            .select(`
              person_id,
              name,
              season,
              division_id,
              divisions(name),
              grade,
              gender,
              session,
              status
            `)
            .eq('company_id', currentCompany.id)
            .not('person_id', 'is', null);

          // Group by person_id to identify unique campers across seasons
          const camperHistory = new Map<string, {
            name: string;
            person_id: string;
            seasons: string[];
            latestDivision: string | null;
            latestGrade: string | null;
            gender: string | null;
            latestSession: string | null;
            latestStatus: string | null;
          }>();

          // Sort by season to ensure latest info is captured
          const sortedCampers = allCampers?.sort((a, b) => 
            (a.season || '').localeCompare(b.season || '')
          ) || [];

          sortedCampers.forEach(c => {
            if (!c.person_id) return;
            
            if (!camperHistory.has(c.person_id)) {
              camperHistory.set(c.person_id, {
                name: c.name,
                person_id: c.person_id,
                seasons: [],
                latestDivision: null,
                latestGrade: null,
                gender: c.gender,
                latestSession: null,
                latestStatus: null,
              });
            }
            
            const entry = camperHistory.get(c.person_id)!;
            if (c.season && !entry.seasons.includes(c.season)) {
              entry.seasons.push(c.season);
            }
            // Update with latest info
            entry.name = c.name;
            entry.latestDivision = (c.divisions as any)?.name || entry.latestDivision;
            entry.latestGrade = c.grade || entry.latestGrade;
            entry.latestSession = c.session || entry.latestSession;
            entry.latestStatus = c.status || entry.latestStatus;
          });

          // Get all unique seasons sorted
          const allSeasons = [...new Set(sortedCampers.map(c => c.season).filter(Boolean))].sort();
          
          // Transform to report data
          data = Array.from(camperHistory.values()).map(c => ({
            Name: c.name,
            'Person ID': c.person_id,
            'Years Attended': c.seasons.length,
            'Seasons': c.seasons.sort().join(', '),
            'First Season': c.seasons.sort()[0] || 'N/A',
            'Latest Division': c.latestDivision || 'N/A',
            'Latest Grade': c.latestGrade || 'N/A',
            Gender: c.gender || 'N/A',
            'Latest Session': c.latestSession || 'N/A',
            [`In ${selectedSeason}`]: c.seasons.includes(selectedSeason) ? 'Yes' : 'No',
          }));

          // Calculate summary statistics
          const totalUniqueCampers = camperHistory.size;
          const enrolledCurrentSeason = Array.from(camperHistory.values()).filter(c => 
            c.seasons.includes(selectedSeason)
          ).length;
          const returningCampers = Array.from(camperHistory.values()).filter(c => 
            c.seasons.includes(selectedSeason) && c.seasons.length > 1
          ).length;
          const newCampers = Array.from(camperHistory.values()).filter(c => 
            c.seasons.includes(selectedSeason) && c.seasons.length === 1
          ).length;
          
          // Calculate retention rate (returning / enrolled in previous season)
          // Skip 2025 as comparison baseline since that data is incomplete/skewed
          const currentSeasonIndex = allSeasons.indexOf(selectedSeason);
          let previousSeason: string | null = null;
          
          // Find previous season, skipping 2025
          for (let i = currentSeasonIndex - 1; i >= 0; i--) {
            if (allSeasons[i] !== '2025') {
              previousSeason = allSeasons[i];
              break;
            }
          }
          
          let retentionRate = 'N/A';
          
          if (previousSeason) {
            const enrolledPreviousSeason = Array.from(camperHistory.values()).filter(c => 
              c.seasons.includes(previousSeason!)
            ).length;
            const returnedFromPrevious = Array.from(camperHistory.values()).filter(c => 
              c.seasons.includes(previousSeason!) && c.seasons.includes(selectedSeason)
            ).length;
            
            if (enrolledPreviousSeason > 0) {
              retentionRate = `${((returnedFromPrevious / enrolledPreviousSeason) * 100).toFixed(1)}%`;
            }
          }

          // Calculate average tenure
          const avgTenure = totalUniqueCampers > 0 
            ? (Array.from(camperHistory.values()).reduce((sum, c) => sum + c.seasons.length, 0) / totalUniqueCampers).toFixed(1)
            : '0';

          summaryData = {
            'Total Unique Campers (All Time)': totalUniqueCampers,
            [`Enrolled in ${selectedSeason}`]: enrolledCurrentSeason,
            'Returning Campers': returningCampers,
            'New Campers': newCampers,
            [`Retention Rate${previousSeason ? ` (from ${previousSeason})` : ''}`]: retentionRate,
            'Avg Years Attended': avgTenure,
          };
          break;

        case 'appointments':
          const { data: appointments } = await supabase
            .from('appointments')
            .select(`
              *,
              child:child_id(name, division_id, divisions(name)),
              staff:staff_id(name, department)
            `)
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .gte('appointment_date', startDate || '1900-01-01')
            .lte('appointment_date', endDate || '2100-12-31')
            .order('appointment_date', { ascending: false });
          
          // Filter by allowed divisions if user has restrictions (only for child appointments)
          const filteredAppointments = allowedDivisionIds 
            ? appointments?.filter(a => {
                // If it's a staff appointment, include it
                if (a.staff_id && !a.child_id) return true;
                // If it's a child appointment, check division access
                return a.child?.division_id && allowedDivisionIds.includes(a.child.division_id);
              })
            : appointments;
          
          data = filteredAppointments?.map(a => ({
            Date: a.appointment_date,
            Time: a.appointment_time || 'N/A',
            Person: a.child?.name || a.staff?.name || 'Unknown',
            'Person Type': a.child_id ? 'Camper' : 'Staff',
            Division: a.child?.divisions?.name || (a.staff?.department || 'N/A'),
            Type: a.appointment_type,
            Provider: a.provider_name || 'N/A',
            Location: a.location || 'N/A',
            Status: a.status,
            Outcome: a.outcome || 'N/A',
            'Follow-up Required': a.follow_up_required ? 'Yes' : 'No',
            'Follow-up Date': a.follow_up_date || 'N/A',
            Notes: a.notes || '',
          })) || [];
          
          const totalAppointments = filteredAppointments?.length || 0;
          const scheduledCount = filteredAppointments?.filter(a => a.status === 'scheduled').length || 0;
          const completedCount = filteredAppointments?.filter(a => a.status === 'completed').length || 0;
          const cancelledCount = filteredAppointments?.filter(a => a.status === 'cancelled').length || 0;
          const noShowCount = filteredAppointments?.filter(a => a.status === 'no_show').length || 0;
          const camperAppointments = filteredAppointments?.filter(a => a.child_id).length || 0;
          const staffAppointments = filteredAppointments?.filter(a => a.staff_id).length || 0;
          const followUpRequired = filteredAppointments?.filter(a => a.follow_up_required).length || 0;
          
          // Group by type
          const byType: Record<string, number> = {};
          filteredAppointments?.forEach(a => {
            byType[a.appointment_type] = (byType[a.appointment_type] || 0) + 1;
          });
          const mostCommonType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
          
          summaryData = {
            'Total Appointments': totalAppointments,
            'Scheduled': scheduledCount,
            'Completed': completedCount,
            'Cancelled': cancelledCount,
            'No Show': noShowCount,
            'Camper Appointments': camperAppointments,
            'Staff Appointments': staffAppointments,
            'Follow-up Required': followUpRequired,
            'Most Common Type': mostCommonType,
          };
          break;

        case 'tshirt_sizes':
          // Fetch campers with t-shirt sizes
          let camperSizesQuery = supabase
            .from('children')
            .select(`
              name,
              tshirt_size,
              division_id,
              divisions (name),
              gender,
              status
            `)
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .eq('status', 'active');
          
          if (allowedDivisionIds !== null && allowedDivisionIds.length > 0) {
            camperSizesQuery = camperSizesQuery.in('division_id', allowedDivisionIds);
          }
          
          const { data: camperSizes } = await camperSizesQuery.order('name');
          
          // Fetch staff with t-shirt sizes
          const { data: staffSizes } = await supabase
            .from('staff')
            .select('name, tshirt_size, department, role, status')
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .eq('status', 'active')
            .order('name');
          
          // Combine data
          const camperRows = camperSizes?.map(c => ({
            Name: c.name,
            Type: 'Camper',
            Division: c.divisions?.name || 'No Division',
            'T-Shirt Size': c.tshirt_size || 'Not Set',
            Gender: c.gender || 'N/A',
          })) || [];
          
          const staffRows = staffSizes?.map(s => ({
            Name: s.name,
            Type: 'Staff',
            Division: s.department || 'N/A',
            'T-Shirt Size': s.tshirt_size || 'Not Set',
            Gender: 'N/A',
          })) || [];
          
          data = [...camperRows, ...staffRows];
          
          // Size breakdown
          const sizeCounts: Record<string, number> = {};
          const camperSizeCounts: Record<string, number> = {};
          const staffSizeCounts: Record<string, number> = {};
          
          camperRows.forEach(r => {
            const size = r['T-Shirt Size'];
            sizeCounts[size] = (sizeCounts[size] || 0) + 1;
            camperSizeCounts[size] = (camperSizeCounts[size] || 0) + 1;
          });
          
          staffRows.forEach(r => {
            const size = r['T-Shirt Size'];
            sizeCounts[size] = (sizeCounts[size] || 0) + 1;
            staffSizeCounts[size] = (staffSizeCounts[size] || 0) + 1;
          });
          
          const notSetCount = sizeCounts['Not Set'] || 0;
          const totalWithSize = data.length - notSetCount;
          
          summaryData = {
            'Total People': data.length,
            'Campers': camperRows.length,
            'Staff': staffRows.length,
            'With Size Set': totalWithSize,
            'Missing Size': notSetCount,
            ...Object.fromEntries(
              Object.entries(sizeCounts)
                .filter(([k]) => k !== 'Not Set')
                .sort((a, b) => b[1] - a[1])
            ),
          };
          break;

        case 'birthdays':
          let birthdayQuery = supabase
            .from('children')
            .select(`
              id,
              name,
              date_of_birth,
              division_id,
              divisions (name),
              gender,
              birthday_cake_type,
              birthday_cake_message,
              birthday_frosting_colors,
              birthday_toppings,
              birthday_cake_allergies,
              birthday_party_type,
              birthday_party_comments,
              birthday_cake_meal,
              birthday_group,
              status
            `)
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .eq('status', 'active');

          if (allowedDivisionIds !== null && allowedDivisionIds.length > 0) {
            birthdayQuery = birthdayQuery.in('division_id', allowedDivisionIds);
          }

          const { data: birthdayCampers } = await birthdayQuery.order('name');

          // Also fetch staff with birthdays
          const { data: birthdayStaff } = await supabase
            .from('staff')
            .select('id, name, date_of_birth, department, role, status')
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .eq('status', 'active')
            .order('name');

          const camperBirthdayRows = birthdayCampers?.map(c => ({
            Name: c.name,
            Type: 'Camper',
            Division: (c.divisions as any)?.name || 'N/A',
            'Date of Birth': c.date_of_birth || 'N/A',
            'Birthday Month': c.date_of_birth ? format(new Date(c.date_of_birth + 'T12:00:00'), 'MMMM') : 'N/A',
            'Cake Type': c.birthday_cake_type || 'Not Set',
            'Cake Message': c.birthday_cake_message || '',
            'Frosting Colors': Array.isArray(c.birthday_frosting_colors) ? c.birthday_frosting_colors.join(', ') : c.birthday_frosting_colors || '',
            'Toppings': Array.isArray(c.birthday_toppings) ? c.birthday_toppings.join(', ') : c.birthday_toppings || '',
            'Cake Allergies': Array.isArray(c.birthday_cake_allergies) ? c.birthday_cake_allergies.join(', ') : c.birthday_cake_allergies || '',
            'Party Type': c.birthday_party_type || '',
            'Party Comments': c.birthday_party_comments || '',
            'Cake Meal': c.birthday_cake_meal || '',
            'Birthday Group': c.birthday_group || '',
          })) || [];

          const staffBirthdayRows = birthdayStaff?.filter(s => s.date_of_birth).map(s => ({
            Name: s.name,
            Type: 'Staff',
            Division: s.department || 'N/A',
            'Date of Birth': s.date_of_birth || 'N/A',
            'Birthday Month': s.date_of_birth ? format(new Date(s.date_of_birth + 'T12:00:00'), 'MMMM') : 'N/A',
            'Cake Type': '',
            'Cake Message': '',
            'Frosting Colors': '',
            'Toppings': '',
            'Cake Allergies': '',
            'Party Type': '',
            'Party Comments': '',
            'Cake Meal': '',
            'Birthday Group': '',
          })) || [];

          data = [...camperBirthdayRows, ...staffBirthdayRows];

          // Month breakdown
          const monthCounts: Record<string, number> = {};
          data.forEach(r => {
            const month = r['Birthday Month'];
            if (month && month !== 'N/A') {
              monthCounts[month] = (monthCounts[month] || 0) + 1;
            }
          });

          const withCakePrefs = camperBirthdayRows.filter(r => r['Cake Type'] !== 'Not Set').length;

          summaryData = {
            'Total People': data.length,
            'Campers': camperBirthdayRows.length,
            'Staff': staffBirthdayRows.length,
            'Campers with Cake Preferences': withCakePrefs,
            'Missing Cake Preferences': camperBirthdayRows.length - withCakePrefs,
          };
          break;
      }

      setReportData(data);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({ title: "Error loading report data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentCompany?.id && !permissionsLoading) {
      fetchReportData();
    }
  }, [reportType, currentCompany, selectedSeason, allowedDivisionIds, permissionsLoading]);

  useEffect(() => {
    setSortColumn(null);
    setSortDirection('asc');
  }, [reportData]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter report data by selected divisions
  const filteredReportData = useMemo(() => {
    if (selectedDivisions.length === 0) return reportData;
    
    // Only filter reports that have a Division column
    return reportData.filter(row => {
      const divisionValue = row['Division'];
      if (!divisionValue) return true; // Include rows without division info
      
      // Get division names from selected IDs
      const selectedDivisionNames = divisions
        .filter(d => selectedDivisions.includes(d.id))
        .map(d => d.name);
      
      return selectedDivisionNames.includes(divisionValue);
    });
  }, [reportData, selectedDivisions, divisions]);

  const sortedData = useMemo(() => {
    if (!sortColumn || filteredReportData.length === 0) return filteredReportData;
    
    return [...filteredReportData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      // Handle null/undefined
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Detect and handle dates (YYYY-MM-DD format)
      const isDate = /^\d{4}-\d{2}-\d{2}/.test(String(aVal));
      if (isDate) {
        const dateA = new Date(aVal).getTime();
        const dateB = new Date(bVal).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // Handle numbers
      const numA = Number(aVal);
      const numB = Number(bVal);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      
      // Handle strings (case-insensitive)
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredReportData, sortColumn, sortDirection]);

  const handleExportCSV = () => {
    const filename = `${reportType}_report`;
    exportToCSV(reportData, filename);
    toast({ title: "CSV exported successfully" });
  };

  const handleExportPDF = () => {
    const filename = `${reportType}_report`;
    
    const titleMap: Record<ReportType, string> = {
      incidents: 'INCIDENT REPORTS',
      staff_evaluations: 'STAFF EVALUATIONS',
      camper_reports: 'CAMPER REPORTS',
      awards: 'AWARDS',
      sports_events: 'SPORTS EVENTS',
      trips: 'TRIPS',
      activities: 'ACTIVITIES & FIELD TRIPS',
      conflicts: 'SCHEDULE CONFLICTS',
      medications: 'MEDICATION SCHEDULE',
      allergies: 'ALLERGY REPORT',
      re_enrollment: 'RE-ENROLLMENT REPORT',
      appointments: 'APPOINTMENTS REPORT',
      tshirt_sizes: 'T-SHIRT SIZE REPORT',
      birthdays: 'BIRTHDAY REPORT',
    };
    
    const title = titleMap[reportType] || reportType.replace('_', ' ').toUpperCase();
    const dateRange = startDate && endDate ? `${startDate} to ${endDate}` : 'All Dates';
    
    exportToPDF(reportData, filename, title, currentCompany?.name, dateRange, summary);
    toast({ title: "PDF exported successfully" });
  };

  // Get report options based on company's available pages
  const reportTypeOptions = useMemo(() => {
    const baseOptions = [
      { value: 'incidents', label: 'Incident Reports' },
      { value: 'staff_evaluations', label: 'Staff Evaluations' },
      { value: 'awards', label: 'Awards' },
      { value: 'sports_events', label: 'Sports Events' },
      { value: 'conflicts', label: 'Schedule Conflicts' },
      { value: 'medications', label: 'Medication Schedule' },
      { value: 'allergies', label: 'Allergy Report' },
      { value: 're_enrollment', label: 'Re-Enrollment Report' },
      { value: 'tshirt_sizes', label: 'T-Shirt Sizes' },
      { value: 'birthdays', label: 'Birthday Report' },
    ];

    // Only add these report types if the company has the corresponding pages
    if (currentCompany?.slug !== 'timber-lake-camp') {
      baseOptions.push(
        { value: 'trips', label: 'Trips' },
        { value: 'activities', label: 'Activities & Field Trips' }
      );
    }

    // Add appointments report for camps that have appointments enabled
    const appointmentCamps = ['tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west', 'trails-end-camp'];
    if (currentCompany?.slug && appointmentCamps.includes(currentCompany.slug)) {
      baseOptions.push({ value: 'appointments', label: 'Appointments Report' });
    }

    return baseOptions;
  }, [currentCompany?.slug]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Master Reporting Center
          </CardTitle>
          <CardDescription>
            Generate comprehensive reports and export data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Filter by Division</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Filter className="h-4 w-4 mr-2" />
                    {selectedDivisions.length === 0 
                      ? "All Divisions" 
                      : `${selectedDivisions.length} selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Select Divisions</span>
                      {selectedDivisions.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedDivisions([])}
                          className="h-auto py-1 px-2 text-xs"
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {divisions.map((div) => (
                        <div key={div.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`report-div-${div.id}`}
                            checked={selectedDivisions.includes(div.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDivisions([...selectedDivisions, div.id]);
                              } else {
                                setSelectedDivisions(selectedDivisions.filter(id => id !== div.id));
                              }
                            }}
                          />
                          <label 
                            htmlFor={`report-div-${div.id}`} 
                            className="text-sm cursor-pointer flex-1"
                          >
                            {div.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={fetchReportData} disabled={loading} className="w-full">
                {loading ? 'Loading...' : 'Generate Report'}
              </Button>
            </div>
          </div>

          {/* Show selected division badges */}
          {selectedDivisions.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Filtering by:</span>
              {selectedDivisions.map((divId) => {
                const div = divisions.find(d => d.id === divId);
                return div ? (
                  <Badge key={divId} variant="secondary" className="flex items-center gap-1">
                    {div.name}
                    <button
                      onClick={() => setSelectedDivisions(selectedDivisions.filter(id => id !== divId))}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : null;
              })}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedDivisions([])}
                className="h-auto py-1 px-2 text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
          {Object.keys(summary).length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(summary).map(([key, value]) => (
                <Card key={key}>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-sm text-muted-foreground">{key}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {reportData.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleExportCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={handleExportPDF} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        {Object.keys(reportData[0]).map((header) => (
                          <th 
                            key={header} 
                            className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/80 transition-colors select-none"
                            onClick={() => handleSort(header)}
                          >
                            <div className="flex items-center gap-2">
                              <span>{header}</span>
                              {sortColumn === header ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="h-4 w-4 text-primary" />
                                ) : (
                                  <ArrowDown className="h-4 w-4 text-primary" />
                                )
                              ) : (
                                <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sortedData.map((row, index) => (
                        <tr key={index} className="hover:bg-muted/50">
                          {Object.values(row).map((value: any, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-3 text-sm">
                              {value?.toString() || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && reportData.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No data available for the selected criteria</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
