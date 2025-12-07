import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { Download, FileText, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/reportExports";
import { format } from "date-fns";

type ReportType = 'incidents' | 'staff_evaluations' | 'camper_reports' | 'awards' | 'sports_events' | 'trips' | 'activities' | 'conflicts' | 'medications' | 'allergies';

export default function ReportingCenter() {
  const [reportType, setReportType] = useState<ReportType>('incidents');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Record<string, any>>({});
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();

  const fetchReportData = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      let data: any[] = [];
      let summaryData: Record<string, any> = {};

      switch (reportType) {
        case 'incidents':
          const { data: incidents } = await supabase
            .from('incident_reports')
            .select('*, children(name)')
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .gte('date', startDate || '1900-01-01')
            .lte('date', endDate || '2100-12-31')
            .order('date', { ascending: false });
          
          data = incidents?.map(i => ({
            Date: i.date,
            Child: i.children?.name || 'Unknown',
            Type: i.type,
            Severity: i.severity,
            Status: i.status,
            Description: i.description,
          })) || [];
          
          summaryData = {
            'Total Incidents': incidents?.length || 0,
            'Open': incidents?.filter(i => i.status === 'open').length || 0,
            'Resolved': incidents?.filter(i => i.status === 'resolved').length || 0,
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
          
          data = awards?.map(a => ({
            Date: a.date,
            Child: a.children?.name || 'Unknown',
            Division: a.children?.divisions?.name || 'N/A',
            Title: a.title,
            Category: a.category,
            Description: a.description,
          })) || [];
          
          summaryData = {
            'Total Awards': awards?.length || 0,
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
            Chaperone: a.chaperone,
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
          
          data = meds?.map(m => ({
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
          
          const uniqueChildren = new Set(meds?.map(m => m.child_id));
          const uniqueMedications = new Set(meds?.map(m => m.medication_name));
          const administeredCount = meds?.filter(m => m.administered).length || 0;
          const pendingCount = meds?.filter(m => !m.administered).length || 0;
          
          summaryData = {
            'Total Medication Entries': meds?.length || 0,
            'Unique Children': uniqueChildren.size,
            'Different Medications': uniqueMedications.size,
            'Administered': administeredCount,
            'Pending': pendingCount,
          };
          break;

        case 'allergies':
          const { data: allergicChildren } = await supabase
            .from('children')
            .select(`
              name,
              allergies,
              medical_notes,
              status,
              divisions (name)
            `)
            .eq('company_id', currentCompany.id)
            .eq('season', selectedSeason)
            .not('allergies', 'is', null)
            .neq('allergies', '')
            .order('name');
          
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
    if (currentCompany?.id) {
      fetchReportData();
    }
  }, [reportType, currentCompany, selectedSeason]);

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

  const sortedData = useMemo(() => {
    if (!sortColumn || reportData.length === 0) return reportData;
    
    return [...reportData].sort((a, b) => {
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
  }, [reportData, sortColumn, sortDirection]);

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
    ];

    // Only add these report types if the company has the corresponding pages
    if (currentCompany?.slug !== 'timber-lake-camp') {
      baseOptions.push(
        { value: 'trips', label: 'Trips' },
        { value: 'activities', label: 'Activities & Field Trips' }
      );
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <Label>&nbsp;</Label>
              <Button onClick={fetchReportData} disabled={loading} className="w-full">
                {loading ? 'Loading...' : 'Generate Report'}
              </Button>
            </div>
          </div>

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
