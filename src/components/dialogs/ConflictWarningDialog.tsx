import { AlertTriangle, Calendar, Clock, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Conflict } from "@/hooks/useConflictDetection";

interface ConflictWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: Conflict[];
  onCancel: () => void;
  onProceed: (overrideReason: string) => void;
  entityName: string;
}

export default function ConflictWarningDialog({
  open,
  onOpenChange,
  conflicts,
  onCancel,
  onProceed,
  entityName,
}: ConflictWarningDialogProps) {
  const [overrideReason, setOverrideReason] = useState("");

  const handleProceed = () => {
    if (!overrideReason.trim()) return;
    onProceed(overrideReason);
    setOverrideReason("");
  };

  const handleCancel = () => {
    setOverrideReason("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <DialogTitle>Schedule Conflict Detected</DialogTitle>
              <DialogDescription>
                {entityName} has {conflicts.length} scheduling conflict{conflicts.length > 1 ? 's' : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            The following conflicts were found. You can proceed anyway by providing a reason for the override.
          </div>

          <div className="space-y-3">
            {conflicts.map((conflict, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3 bg-muted/50">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">
                    {conflict.conflict_type === 'same_day_conflict' ? 'Same Day' : 'Recurring'}
                  </Badge>
                  <span className="text-sm font-medium">{conflict.event2_type}</span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="font-semibold text-foreground">
                    {conflict.event2_name}
                  </div>
                  
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(conflict.event2_date + 'T00:00:00').toLocaleDateString()}</span>
                    </div>
                    {conflict.event2_time && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{conflict.event2_time}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="override-reason" className="text-sm font-medium">
              Override Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="override-reason"
              placeholder="Explain why this conflict can be ignored (e.g., 'Parent approved late pickup', 'Event times don't overlap', etc.)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This reason will be saved for record-keeping purposes.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancel Assignment
          </Button>
          <Button 
            onClick={handleProceed}
            disabled={!overrideReason.trim()}
            variant="destructive"
          >
            Proceed Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
