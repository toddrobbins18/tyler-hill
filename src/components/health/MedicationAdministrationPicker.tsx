import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { medicationRowKey, sortMedicationsByScheduledTime } from "@/lib/medicationSchedule";
import { parseMedicationMealTimeLabels } from "@/lib/medicationMealTimeDisplay";

export type MedicationPickerItem = {
  id: string;
  date: string;
  medication_name?: string;
  dosage?: string | null;
  meal_time?: string[] | string | null;
  scheduled_time?: string | null;
  _displayDate?: string;
  children?: { division?: { name?: string | null } | null } | null;
};

type MedicationAdministrationPickerProps = {
  medications: MedicationPickerItem[];
  divisionName?: string | null;
  selectedKeys: Set<string>;
  onSelectedKeysChange: (keys: Set<string>) => void;
  disabled?: boolean;
  emptyMessage?: string;
};

export function MedicationAdministrationPicker({
  medications,
  divisionName,
  selectedKeys,
  onSelectedKeysChange,
  disabled = false,
  emptyMessage = "No pending medications for today.",
}: MedicationAdministrationPickerProps) {
  const sortedMeds = useMemo(
    () => sortMedicationsByScheduledTime(medications),
    [medications],
  );

  if (sortedMeds.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const toggle = (key: string, checked: boolean) => {
    const next = new Set(selectedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    onSelectedKeysChange(next);
  };

  return (
    <div className="space-y-2">
      {sortedMeds.map((med) => {
        const key = medicationRowKey(med);
        const mealLabels = parseMedicationMealTimeLabels(
          med.meal_time,
          divisionName ?? med.children?.division?.name,
        );
        return (
          <label
            key={key}
            className="flex items-start gap-3 rounded-lg border bg-background p-3 cursor-pointer"
          >
            <Checkbox
              checked={selectedKeys.has(key)}
              disabled={disabled}
              onCheckedChange={(checked) => toggle(key, checked === true)}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <p className="font-medium leading-tight">{med.medication_name || "Medication"}</p>
              {med.dosage ? (
                <p className="text-sm text-muted-foreground">{med.dosage}</p>
              ) : null}
              {mealLabels.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {mealLabels.map((label) => (
                    <Badge key={label} variant="outline" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
        );
      })}
    </div>
  );
}

type MedicationAdministrationPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camperName: string;
  medications: MedicationPickerItem[];
  divisionName?: string | null;
  onConfirm: (selected: MedicationPickerItem[]) => Promise<void> | void;
  confirming?: boolean;
};

export function MedicationAdministrationPickerDialog({
  open,
  onOpenChange,
  camperName,
  medications,
  divisionName,
  onConfirm,
  confirming = false,
}: MedicationAdministrationPickerDialogProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setSelectedKeys(new Set());
  }, [open, medications]);

  const sortedMeds = useMemo(
    () => sortMedicationsByScheduledTime(medications),
    [medications],
  );

  const selectedMeds = sortedMeds.filter((med) =>
    selectedKeys.has(medicationRowKey(med)),
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded-lg border bg-background shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="med-picker-title"
      >
        <div className="space-y-1 border-b p-4">
          <h2 id="med-picker-title" className="text-lg font-semibold">
            Select medications to administer
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose which medication(s) to give to {camperName}. Nothing is marked until you confirm.
          </p>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-4">
          <MedicationAdministrationPicker
            medications={medications}
            divisionName={divisionName}
            selectedKeys={selectedKeys}
            onSelectedKeysChange={setSelectedKeys}
            disabled={confirming}
          />
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void onConfirm(selectedMeds)}
            disabled={confirming || selectedMeds.length === 0}
          >
            {confirming
              ? "Saving..."
              : `Mark ${selectedMeds.length} selected as administered`}
          </Button>
        </div>
      </div>
    </div>
  );
}
