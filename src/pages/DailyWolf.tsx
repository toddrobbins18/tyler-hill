import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Upload, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";

interface DailyWolfDocument {
  id: string;
  date: string;
  file_url: string;
  file_name: string;
  uploaded_by: string;
  created_at: string;
}

export default function DailyWolf() {
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();
  const [documents, setDocuments] = useState<DailyWolfDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchDocuments();
  }, [currentCompany?.id, selectedSeason]);

  const fetchDocuments = async () => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_wolf_documents")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("season", selectedSeason)
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
    } else {
      toast.error("Please select a PDF file");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentCompany?.id) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const timestamp = Date.now();
      const filePath = `${currentCompany.id}/${selectedSeason}/${selectedDate}-${timestamp}-${selectedFile.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("daily-wolf-documents")
        .upload(filePath, selectedFile, {
          contentType: "application/pdf",
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("daily-wolf-documents")
        .getPublicUrl(filePath);

      // Save document reference in database
      const { error } = await supabase
        .from("daily_wolf_documents")
        .insert({
          company_id: currentCompany.id,
          season: selectedSeason,
          date: selectedDate,
          file_name: selectedFile.name,
          file_url: publicUrl,
          uploaded_by: user.id,
        });

      if (error) throw error;

      toast.success("Daily Wolf uploaded successfully");
      setSelectedFile(null);
      fetchDocuments();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleViewPDF = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/daily-wolf-documents/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split('?')[0];
        
        // Delete file from storage
        const { error: storageError } = await supabase.storage
          .from("daily-wolf-documents")
          .remove([filePath]);

        if (storageError) console.error("Storage delete error:", storageError);
      }

      // Delete database record
      const { error } = await supabase
        .from("daily_wolf_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Document deleted");
      fetchDocuments();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Daily Wolf</h1>
        <p className="text-muted-foreground">Upload and view daily wolf documents</p>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Daily Wolf
        </h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div>
            <Label htmlFor="file">PDF File</Label>
            <Input
              id="file"
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="max-w-xs"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? "Uploading..." : "Upload Document"}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Uploaded Documents
        </h2>
        {loading ? (
          <p>Loading...</p>
        ) : documents.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No documents uploaded yet
          </Card>
        ) : (
          documents.map((doc) => (
            <Card key={doc.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{doc.file_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(doc.date).toLocaleDateString()} • Uploaded {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewPDF(doc.file_url)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(doc.id, doc.file_url)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
