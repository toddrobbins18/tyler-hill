import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, HelpCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import JSONFormatGuide from "./dialogs/JSONFormatGuide";
import { 
  childSchema, staffSchema, awardSchema, dailyNoteSchema, tripSchema, menuItemSchema,
  incidentReportSchema, medicationSchema, calendarEventSchema, sportsCalendarSchema
} from "@/lib/validationSchemas";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface JSONUploaderProps {
  tableName: string;
  onUploadComplete?: () => void;
}

export default function JSONUploader({ tableName, onUploadComplete }: JSONUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadStats, setUploadStats] = useState<{
    total: number;
    newRecords: number;
    duplicates: number;
  } | null>(null);
  const [failedRecords, setFailedRecords] = useState<Array<{ record: any; error: string }>>([]);

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error("Please upload a JSON file");
      return;
    }

    setPendingFile(file);
    event.target.value = ''; // Reset input
    
    // For large files, show confirmation dialog
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (Array.isArray(data) && data.length > 100) {
        setShowConfirmDialog(true);
      } else {
        // Small files, upload immediately
        await processUpload(file);
      }
    } catch (error) {
      toast.error("Invalid JSON format");
    }
  };

  const handleFileUpload = async () => {
    setShowConfirmDialog(false);
    if (pendingFile) {
      await processUpload(pendingFile);
      setPendingFile(null);
    }
  };

  const processUpload = async (file: File) => {
    setUploading(true);
    setFailedRecords([]);

    try {
      const text = await file.text();
      let data = JSON.parse(text);

      if (!Array.isArray(data)) {
        toast.error("JSON file must contain an array of objects");
        setUploading(false);
        return;
      }

      if (data.length === 0) {
        toast.error("JSON file is empty");
        setUploading(false);
        return;
      }

      // Limit to 2500 records for bulk imports
      if (data.length > 2500) {
        toast.error("JSON file too large. Maximum 2500 records allowed.");
        setUploading(false);
        return;
      }

      // Transform camper data if needed (first/last → name, _id → person_id)
      const transformCamperData = (record: any) => {
        if (record.first && record.last) {
          const transformed: any = {
            name: `${record.first} ${record.last}`.trim(),
            person_id: record._id,
          };
          
          // Copy over other fields that might exist
          const excludeFields = ['first', 'last', '_id', '__v', 'winner_ids'];
          Object.keys(record).forEach(key => {
            if (!excludeFields.includes(key)) {
              transformed[key] = record[key];
            }
          });
          
          return transformed;
        }
        return record;
      };

      // Auto-detect and transform if needed
      const needsTransformation = data.some((record: any) => record.first && record.last);
      if (needsTransformation && tableName === 'children') {
        toast.info("Detected camper format - transforming data...");
        data = data.map(transformCamperData);
      }

      // Transform MongoDB incident reports format
      if (tableName === 'incident_reports') {
        toast.info("Processing incident report format...");
        
        // First, collect all unique camper IDs for batch lookup
        const allCamperIds = new Set<string>();
        data.forEach((record: any) => {
          if (record.campers && Array.isArray(record.campers)) {
            record.campers.forEach((id: string) => allCamperIds.add(id));
          }
        });
        
        // Batch lookup children UUIDs by person_id
        const camperIdMap = new Map<string, string>(); // MongoDB ID -> UUID
        if (allCamperIds.size > 0) {
          toast.loading(`Looking up ${allCamperIds.size} camper IDs...`, { id: 'camper-lookup' });
          const { data: childrenData, error } = await supabase
            .from('children')
            .select('id, person_id')
            .in('person_id', Array.from(allCamperIds));
          
          if (childrenData) {
            childrenData.forEach(child => {
              if (child.person_id) {
                camperIdMap.set(child.person_id, child.id);
              }
            });
            toast.success(`Mapped ${camperIdMap.size} of ${allCamperIds.size} campers`, { id: 'camper-lookup' });
          } else if (error) {
            console.error("Error looking up campers:", error);
            toast.error("Failed to lookup camper IDs", { id: 'camper-lookup' });
          }
        }
        
        // Report any unmapped campers
        const unmappedCampers = Array.from(allCamperIds).filter(id => !camperIdMap.has(id));
        if (unmappedCampers.length > 0) {
          console.warn(`Could not find ${unmappedCampers.length} campers in database:`, unmappedCampers);
          toast.warning(`${unmappedCampers.length} camper IDs could not be mapped - incidents will be created without these children`);
        }
        
        // Transform each record
        data = data.map((record: any) => {
          const transformed: any = {};
          
          // Map campers array to child_ids using lookup
          if (record.campers && Array.isArray(record.campers)) {
            transformed.child_ids = record.campers
              .map((camperId: string) => camperIdMap.get(camperId))
              .filter(Boolean); // Remove any unmapped IDs
          } else {
            transformed.child_ids = [];
          }
          
          // Keep tags array
          transformed.tags = record.tags && Array.isArray(record.tags) ? record.tags : [];
          
          // Handle reporter - extract $oid value but store in reported_by text field
          // since staff table is empty
          if (record.reporter && record.reporter.$oid) {
            transformed.reported_by = `Imported - Reporter ID: ${record.reporter.$oid}`;
          } else if (record.reported_by) {
            transformed.reported_by = record.reported_by;
          }
          
          // Extract description
          if (record.description) {
            transformed.description = record.description;
          } else if (record.comments) {
            transformed.description = record.comments;
          } else {
            transformed.description = "No description provided";
          }
          
          // Map date format
          if (record.date) {
            if (record.date.$date) {
              transformed.date = new Date(record.date.$date).toISOString().split('T')[0];
            } else {
              transformed.date = new Date(record.date).toISOString().split('T')[0];
            }
          }
          
          // Defaults
          transformed.type = record.type || "other";
          transformed.severity = record.severity || "medium";
          transformed.status = record.status || "open";
          
          // Copy season if present
          if (record.season) transformed.season = record.season;
          
          return transformed;
        });
      }

      // Check for duplicates if dealing with children table and person_id exists
      let duplicateCount = 0;
      if (tableName === 'children') {
        const personIds = data.map((record: any) => record.person_id).filter(Boolean);
        
        if (personIds.length > 0) {
          toast.loading(`Checking for existing records (${personIds.length} IDs to check)...`, { id: 'duplicate-check' });
          
          // Check duplicates in batches to avoid query size limits
          const checkBatchSize = 500;
          const existingPersonIds = new Set<string>();
          
          for (let i = 0; i < personIds.length; i += checkBatchSize) {
            const batch = personIds.slice(i, i + checkBatchSize);
            const progress = `${i + batch.length}/${personIds.length}`;
            
            toast.loading(`Checking duplicates... (${progress})`, { id: 'duplicate-check' });
            
            const { data: existingRecords } = await supabase
              .from('children')
              .select('person_id')
              .in('person_id', batch);
            
            existingRecords?.forEach(r => existingPersonIds.add(r.person_id));
          }
          
          const originalLength = data.length;
          data = data.filter((record: any) => !existingPersonIds.has(record.person_id));
          duplicateCount = originalLength - data.length;
          
          toast.dismiss('duplicate-check');
          
          if (duplicateCount > 0) {
            toast.info(`Found ${duplicateCount} duplicate records. Uploading ${data.length} new records.`);
          } else {
            toast.success(`All ${data.length} records are new. Ready to upload.`);
          }
        }
      }

      // Select appropriate schema based on table
      let schema;
      
      if (tableName === 'children') {
        schema = childSchema;
      } else if (tableName === 'staff') {
        schema = staffSchema;
      } else if (tableName === 'awards') {
        schema = awardSchema;
      } else if (tableName === 'daily_notes') {
        schema = dailyNoteSchema;
      } else if (tableName === 'trips') {
        schema = tripSchema;
      } else if (tableName === 'menu_items') {
        schema = menuItemSchema;
      } else if (tableName === 'incident_reports') {
        schema = incidentReportSchema;
      } else if (tableName === 'medication_logs') {
        schema = medicationSchema;
      } else if (tableName === 'master_calendar') {
        schema = calendarEventSchema;
      } else if (tableName === 'sports_calendar') {
        schema = sportsCalendarSchema;
      } else {
        toast.error(`Unsupported table: ${tableName}`);
        setUploading(false);
        return;
      }

      if (data.length === 0) {
        toast.info("No new records to upload.");
        setUploading(false);
        return;
      }

      // Validate each record
      const validatedRows: any[] = [];
      const validationErrors: Array<{ record: any; error: string; index: number }> = [];

      for (let i = 0; i < data.length; i++) {
        try {
          const validated = schema.parse(data[i]);
          validatedRows.push(validated);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorMsg = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(", ");
            validationErrors.push({ record: data[i], error: errorMsg, index: i + 1 });
          } else {
            validationErrors.push({ record: data[i], error: "Invalid data format", index: i + 1 });
          }
        }
      }

      if (validationErrors.length > 0) {
        console.error("Validation errors:", validationErrors);
        toast.error(`Validation failed for ${validationErrors.length} records. Check console for details.`);
        setFailedRecords(validationErrors);
        setUploading(false);
        return;
      }

      // Batch processing for large uploads
      const batchSize = 100;
      const totalBatches = Math.ceil(validatedRows.length / batchSize);
      let successCount = 0;
      const batchFailures: Array<{ batchNumber: number; records: any[]; error: string }> = [];

      for (let i = 0; i < validatedRows.length; i += batchSize) {
        const batch = validatedRows.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const recordRange = `${i + 1}-${Math.min(i + batchSize, validatedRows.length)}`;
        
        toast.loading(`Uploading records ${recordRange} of ${validatedRows.length} (batch ${batchNumber}/${totalBatches})...`, { 
          id: 'batch-upload' 
        });
        
        // Special handling for incident reports with child_ids
        if (tableName === 'incident_reports') {
          const incidentsToInsert = batch.map(record => {
            const { child_ids, ...incidentData } = record;
            return incidentData;
          });
          
          const { data: insertedIncidents, error: batchError } = await supabase
            .from('incident_reports')
            .insert(incidentsToInsert)
            .select();
          
          if (batchError) {
            console.error(`Batch ${batchNumber} (records ${recordRange}) failed:`, batchError);
            batchFailures.push({ 
              batchNumber, 
              records: batch,
              error: batchError.message 
            });
          } else if (insertedIncidents) {
            // Now insert into incident_children junction table
            const junctionRecords: any[] = [];
            for (let j = 0; j < insertedIncidents.length; j++) {
              const incident = insertedIncidents[j];
              const originalRecord = batch[j];
              if (originalRecord.child_ids && Array.isArray(originalRecord.child_ids)) {
                for (const child_id of originalRecord.child_ids) {
                  junctionRecords.push({
                    incident_id: incident.id,
                    child_id: child_id
                  });
                }
              }
            }
            
            if (junctionRecords.length > 0) {
              const { error: junctionError } = await supabase
                .from('incident_children')
                .insert(junctionRecords);
              
              if (junctionError) {
                console.error(`Junction table insert failed for batch ${batchNumber}:`, junctionError);
              }
            }
            
            successCount += batch.length;
          }
        } else {
          // Standard insert for other tables
          const { error: batchError } = await supabase.from(tableName as any).insert(batch as any);
          
          if (batchError) {
            console.error(`Batch ${batchNumber} (records ${recordRange}) failed:`, batchError);
            batchFailures.push({ 
              batchNumber, 
              records: batch,
              error: batchError.message 
            });
          } else {
            successCount += batch.length;
          }
        }
      }

      toast.dismiss('batch-upload');

      // Store failed records for download
      const allFailedRecords = batchFailures.flatMap(f => 
        f.records.map(record => ({ record, error: f.error }))
      );
      setFailedRecords(allFailedRecords);

      // Show results
      if (batchFailures.length > 0) {
        const failedCount = allFailedRecords.length;
        toast.warning(
          `Uploaded ${successCount} records successfully. ${failedCount} records failed. Click download button to see failed records.`,
          { duration: 10000 }
        );
      } else {
        const message = duplicateCount > 0 
          ? `Successfully uploaded ${validatedRows.length} new records (${duplicateCount} duplicates skipped)`
          : `Successfully uploaded all ${validatedRows.length} records`;
        toast.success(message);
      }
      
      setUploadStats({
        total: data.length + duplicateCount,
        newRecords: successCount,
        duplicates: duplicateCount
      });
      
      onUploadComplete?.();
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error("Invalid JSON format. Please check your file.");
      } else {
        console.error('Upload error:', error);
        toast.error("Failed to upload JSON. Please check the format and try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  const downloadFailedRecords = () => {
    if (failedRecords.length === 0) return;
    
    const errorReport = failedRecords.map((item, idx) => ({
      index: idx + 1,
      error: item.error,
      record: item.record
    }));
    
    const blob = new Blob([JSON.stringify(errorReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed-records-${tableName}-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Downloaded failed records report");
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept=".json"
          onChange={handleFileSelection}
          disabled={uploading}
          className="hidden"
          id={`json-upload-${tableName}`}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowGuide(true)}
          title="View JSON Format Guide"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
        {failedRecords.length > 0 && (
          <Button
            variant="outline"
            size="icon"
            onClick={downloadFailedRecords}
            title="Download Failed Records"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => document.getElementById(`json-upload-${tableName}`)?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload JSON"}
        </Button>
      </div>
      
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Large Upload</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingFile && (
                <>
                  You're about to upload a large JSON file. This may take several minutes.
                  <div className="mt-4 space-y-2 text-sm">
                    <div>• The system will check for duplicate records</div>
                    <div>• Progress will be shown for each batch</div>
                    <div>• If errors occur, you can download a report</div>
                    <div>• Please don't close this page during upload</div>
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFileUpload}>Start Upload</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <JSONFormatGuide open={showGuide} onOpenChange={setShowGuide} />
    </>
  );
}

export { JSONUploader };
