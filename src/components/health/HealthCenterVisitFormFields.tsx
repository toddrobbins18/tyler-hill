import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HEALTH_VISIT_CALLED_HOME_OPTIONS,
  HEALTH_VISIT_LOCATIONS,
  HEALTH_VISIT_NURSE_NAMES,
  HEALTH_VISIT_REASON_SUGGESTIONS,
  HEALTH_VISIT_TREATMENTS,
  HEALTH_VISIT_YES_NO,
  type HealthCenterVisitExtraFields,
} from "@/lib/healthCenterVisitOptions";

export type HealthCenterVisitFormState = HealthCenterVisitExtraFields & {
  reason: string;
  notes: string;
};

export const emptyHealthCenterVisitForm = (): HealthCenterVisitFormState => ({
  reason: "",
  treatment: "",
  incident_location: "",
  group_name: "",
  counselor_name: "",
  nurse_name: "",
  sent_home: "",
  called_home: "",
  notes: "",
});

type Props = {
  value: HealthCenterVisitFormState;
  onChange: (next: HealthCenterVisitFormState) => void;
  groupOptions: string[];
  counselorOptions: string[];
  nurseOptions: string[];
  disabled?: boolean;
};

function SuggestInput({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const listId = `${id}-suggestions`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </div>
  );
}

export function HealthCenterVisitFormFields({
  value,
  onChange,
  groupOptions,
  counselorOptions,
  nurseOptions,
  disabled,
}: Props) {
  const patch = (partial: Partial<HealthCenterVisitFormState>) =>
    onChange({ ...value, ...partial });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2 space-y-2">
        <Label htmlFor="visit-reason">Reason</Label>
        <Textarea
          id="visit-reason"
          value={value.reason}
          onChange={(e) => patch({ reason: e.target.value })}
          placeholder="Chief complaint / injury description..."
          rows={2}
          disabled={disabled}
        />
        <div className="flex flex-wrap gap-1.5">
          {HEALTH_VISIT_REASON_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="text-xs px-2 py-1 rounded-full border bg-muted/50 hover:bg-muted transition-colors"
              disabled={disabled}
              onClick={() => patch({ reason: s })}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <SuggestInput
        id="visit-treatment"
        label="Treatment"
        value={value.treatment ?? ""}
        options={HEALTH_VISIT_TREATMENTS}
        onChange={(treatment) => patch({ treatment })}
        placeholder="Ice, bandaged, going home..."
        disabled={disabled}
      />

      <SuggestInput
        id="visit-location"
        label="Location of incident"
        value={value.incident_location ?? ""}
        options={HEALTH_VISIT_LOCATIONS}
        onChange={(incident_location) => patch({ incident_location })}
        placeholder="Pool, Gaga, Bunk..."
        disabled={disabled}
      />

      <SuggestInput
        id="visit-group"
        label="Group name"
        value={value.group_name ?? ""}
        options={groupOptions}
        onChange={(group_name) => patch({ group_name })}
        placeholder="Camper group / bunk"
        disabled={disabled}
      />

      <SuggestInput
        id="visit-counselor"
        label="Counselor name"
        value={value.counselor_name ?? ""}
        options={["Self", ...counselorOptions]}
        onChange={(counselor_name) => patch({ counselor_name })}
        placeholder="Counselor on duty"
        disabled={disabled}
      />

      <div className="space-y-2">
        <Label>Nurse name</Label>
        <Select
          value={value.nurse_name || undefined}
          onValueChange={(nurse_name) => patch({ nurse_name })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select nurse..." />
          </SelectTrigger>
          <SelectContent>
            {[...new Set([...HEALTH_VISIT_NURSE_NAMES, ...nurseOptions])].map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Sent home</Label>
        <Select
          value={value.sent_home || undefined}
          onValueChange={(sent_home) => patch({ sent_home })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {HEALTH_VISIT_YES_NO.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Called home</Label>
        <Select
          value={value.called_home || undefined}
          onValueChange={(called_home) => patch({ called_home })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {HEALTH_VISIT_CALLED_HOME_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-2 space-y-2">
        <Label htmlFor="visit-notes">Additional notes (optional)</Label>
        <Textarea
          id="visit-notes"
          value={value.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Extra details..."
          rows={2}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
