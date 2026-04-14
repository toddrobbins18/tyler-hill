import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Upload, CalendarIcon, FileText, Trash2, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Division {
  id: string;
  name: string;
  gender: string;
}

interface DivisionSchedule {
  id: string;
  division_id: string;
  schedule_date: string;
  file_name: string;
  file_url: string;
  description: string | null;
  season: string;
  created_at: string;
  division?: Division;
}

export default function DivisionScheduleUploader() {
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();
  
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [schedules, setSchedules] = useState<DivisionSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  
  // Upload form state
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchDivisions();
      fetchSchedules();
    }
  }, [currentCompany?.id, selectedSeason]);

  const fetchDivisions = async () => {
    if (!currentCompany?.id) return;

    const { data, error } = await supabase
      .from("divisions")
      .select("id, name, gender")
      .eq("company_id", currentCompany.id)
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      console.error("Error fetching divisions:", error);
    } else {
      setDivisions(sortDivisionsAlternatingGender(data || []));
    }
  };

  const fetchSchedules = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("division_schedules")
      .select(`
        *,
        division:divisions(id, name, gender)
      `)
      .eq("company_id", currentCompany.id)
      .eq("season", selectedSeason)
      .order("schedule_date", { ascending: false });

    if (error) {
      console.error("Error fetching schedules:", error);
      toast.error("Failed to load schedules");
    } else {
      setSchedules((data as any[]) || []);
    }
    setLoading(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Accept PDF, images, and common document formats
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF, image, or Word document");
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error("File size must be less than 10MB");
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedDivision || !currentCompany?.id) {
      toast.error("Please select a division and file");
      return;
    }

    setUploading(true);

    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${currentCompany.id}/${selectedDivision}/${format(selectedDate, 'yyyy-MM-dd')}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('division-schedules')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('division-schedules')
        .getPublicUrl(fileName);

      // Create database record
      const { error: dbError } = await supabase
        .from("division_schedules")
        .insert({
          company_id: currentCompany.id,
          division_id: selectedDivision,
          schedule_date: format(selectedDate, 'yyyy-MM-dd'),
          file_name: selectedFile.name,
          file_url: urlData.publicUrl,
          description: description || null,
          season: selectedSeason
        });

      if (dbError) throw dbError;

      toast.success("Schedule uploaded successfully");
      setShowUploadDialog(false);
      resetForm();
      fetchSchedules();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload schedule");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (schedule: DivisionSchedule) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;

    try {
      // Delete from storage
      const filePath = schedule.file_url.split('/division-schedules/')[1];
      if (filePath) {
        await supabase.storage.from('division-schedules').remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from("division_schedules")
        .delete()
        .eq("id", schedule.id);

      if (error) throw error;

      toast.success("Schedule deleted");
      fetchSchedules();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete schedule");
    }
  };

  const resetForm = () => {
    setSelectedDivision("");
    setSelectedDate(new Date());
    setDescription("");
    setSelectedFile(null);
  };

  const getSignedUrl = async (fileUrl: string) => {
    const filePath = fileUrl.split('/division-schedules/')[1];
    if (!filePath) return fileUrl;

    const { data } = await supabase.storage
      .from('division-schedules')
      .createSignedUrl(filePath, 3600);

    return data?.signedUrl || fileUrl;
  };

  const handleView = async (schedule: DivisionSchedule) => {
    const url = await getSignedUrl(schedule.file_url);
    window.open(url, '_blank');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Division Schedules
          </CardTitle>
          <CardDescription>
            Upload and manage daily schedules for each division
          </CardDescription>
        </div>
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload Division Schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Division *</Label>
                <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select division" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map((div) => (
                      <SelectItem key={div.id} value={div.id}>
                        {div.name} ({div.gender === 'male' ? 'Boys' : 'Girls'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Schedule Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="Add a description for this schedule..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Schedule File *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="schedule-file-input"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('schedule-file-input')?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {selectedFile ? selectedFile.name : "Choose file"}
                  </Button>
                  {selectedFile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Accepted formats: PDF, JPG, PNG, GIF, DOC, DOCX (max 10MB)
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setShowUploadDialog(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={uploading || !selectedFile || !selectedDivision}>
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No schedules uploaded yet</p>
            <p className="text-sm">Upload a schedule to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>{format(new Date(schedule.schedule_date), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {(schedule.division as any)?.name || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {schedule.file_name}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {schedule.description || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(schedule)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(schedule)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
