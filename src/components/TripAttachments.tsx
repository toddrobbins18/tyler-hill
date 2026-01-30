import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Paperclip, Trash2, Download, Upload, FileText, Bus, File } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  created_at: string;
}

interface TripAttachmentsProps {
  tripId: string;
  isMultiDay?: boolean;
}

export default function TripAttachments({ tripId, isMultiDay = false }: TripAttachmentsProps) {
  const { currentCompany } = useCompany();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileType, setFileType] = useState<string>("other");

  useEffect(() => {
    fetchAttachments();
  }, [tripId]);

  const fetchAttachments = async () => {
    const { data, error } = await supabase
      .from("trip_attachments")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAttachments(data);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentCompany?.id) return;

    setUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${tripId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("trip-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("trip-attachments")
        .getPublicUrl(fileName);

      // Save attachment record
      const { error: insertError } = await supabase
        .from("trip_attachments")
        .insert({
          trip_id: tripId,
          company_id: currentCompany.id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: fileType,
          uploaded_by: user.id,
        });

      if (insertError) throw insertError;

      toast.success("File uploaded successfully");
      fetchAttachments();
    } catch (error: any) {
      toast.error("Failed to upload file: " + error.message);
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from("trip_attachments")
        .delete()
        .eq("id", attachment.id);

      if (error) throw error;

      toast.success("Attachment deleted");
      fetchAttachments();
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  const getFileIcon = (type: string | null) => {
    switch (type) {
      case "itinerary":
        return <FileText className="h-4 w-4" />;
      case "bus_confirmation":
        return <Bus className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getFileTypeLabel = (type: string | null) => {
    switch (type) {
      case "itinerary":
        return "Itinerary";
      case "bus_confirmation":
        return "Bus Confirmation";
      default:
        return "Other";
    }
  };

  // Only show for multi-day trips
  if (!isMultiDay) return null;

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        <Label className="text-base font-semibold">Attachments</Label>
      </div>
      <p className="text-sm text-muted-foreground">
        Upload itineraries, bus confirmations, and other trip documents
      </p>

      {/* Upload section */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label htmlFor="file-type" className="text-sm">File Type</Label>
          <Select value={fileType} onValueChange={setFileType}>
            <SelectTrigger id="file-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="itinerary">Itinerary</SelectItem>
              <SelectItem value="bus_confirmation">Bus Confirmation</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="file-upload" className="cursor-pointer">
            <Button asChild disabled={uploading} variant="outline">
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload File"}
              </span>
            </Button>
          </Label>
          <Input
            id="file-upload"
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          />
        </div>
      </div>

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getFileIcon(attachment.file_type)}
                <div>
                  <p className="font-medium text-sm">{attachment.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getFileTypeLabel(attachment.file_type)} • {new Date(attachment.created_at).toLocaleDateString('en-US')}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  asChild
                >
                  <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleDelete(attachment)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No attachments yet. Upload itineraries or bus confirmations above.
        </p>
      )}
    </div>
  );
}