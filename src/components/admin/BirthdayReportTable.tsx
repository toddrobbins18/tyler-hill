import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BirthdayRow {
  id: string;
  name: string;
  type: 'Camper' | 'Staff';
  division: string;
  date_of_birth: string | null;
  birthday_month: string;
  birthday_cake_type: string;
  birthday_cake_message: string;
  birthday_frosting_colors: string;
  birthday_toppings: string;
  birthday_cake_allergies: string;
  birthday_party_type: string;
  birthday_party_comments: string;
  birthday_cake_meal: string;
  birthday_group: string;
}

interface BirthdayReportTableProps {
  data: BirthdayRow[];
  onDataUpdate: () => void;
}

const EDITABLE_FIELDS: (keyof BirthdayRow)[] = [
  'birthday_cake_type',
  'birthday_cake_message',
  'birthday_frosting_colors',
  'birthday_toppings',
  'birthday_cake_allergies',
  'birthday_party_type',
  'birthday_party_comments',
  'birthday_cake_meal',
  'birthday_group',
];

const COLUMN_HEADERS: Record<string, string> = {
  name: 'Name',
  type: 'Type',
  division: 'Division',
  date_of_birth: 'Date of Birth',
  birthday_month: 'Birthday Month',
  birthday_cake_type: 'Cake Type',
  birthday_cake_message: 'Cake Message',
  birthday_frosting_colors: 'Frosting Colors',
  birthday_toppings: 'Toppings',
  birthday_cake_allergies: 'Cake Allergies',
  birthday_party_type: 'Party Type',
  birthday_party_comments: 'Party Comments',
  birthday_cake_meal: 'Cake Meal',
  birthday_group: 'Birthday Group',
};

const CAKE_TYPE_OPTIONS = ['Chocolate', 'Vanilla', 'Funfetti', 'Ice Cream Cake', 'Red Velvet', 'Marble', 'Carrot', 'Other'];
const PARTY_TYPE_OPTIONS = ['Standard', 'Pool Party', 'Theme Party', 'No Party', 'Other'];

const DISPLAY_COLUMNS: (keyof BirthdayRow)[] = [
  'name', 'type', 'division', 'date_of_birth', 'birthday_month',
  'birthday_cake_type', 'birthday_cake_message', 'birthday_frosting_colors',
  'birthday_toppings', 'birthday_cake_allergies', 'birthday_party_type',
  'birthday_party_comments', 'birthday_cake_meal', 'birthday_group',
];

export default function BirthdayReportTable({ data, onDataUpdate }: BirthdayReportTableProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof BirthdayRow } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else { setSortColumn(null); setSortDirection('asc'); }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = (() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn as keyof BirthdayRow] ?? '';
      const bVal = b[sortColumn as keyof BirthdayRow] ?? '';
      const cmp = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  })();

  const startEdit = (row: BirthdayRow, field: keyof BirthdayRow) => {
    if (row.type !== 'Camper') return;
    if (!EDITABLE_FIELDS.includes(field)) return;
    setEditingCell({ rowId: row.id, field });
    setEditValue(row[field]?.toString() || '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async (row: BirthdayRow) => {
    if (!editingCell) return;
    const { field } = editingCell;

    // No change
    if (editValue === (row[field]?.toString() || '')) {
      cancelEdit();
      return;
    }

    setSaving(true);
    try {
      // Map field names to DB column names (they match)
      const dbField = field as string;
      
      // Handle array fields
      const arrayFields = ['birthday_frosting_colors', 'birthday_toppings', 'birthday_cake_allergies'];
      let dbValue: any = editValue || null;
      
      if (arrayFields.includes(dbField) && editValue) {
        dbValue = editValue.split(',').map(s => s.trim()).filter(Boolean);
      }

      const { error } = await supabase
        .from('children')
        .update({ [dbField]: dbValue })
        .eq('id', row.id);

      if (error) {
        toast.error('Failed to save: ' + error.message);
      } else {
        toast.success(`Updated ${COLUMN_HEADERS[field]} for ${row.name}`);
        onDataUpdate();
      }
    } catch (err) {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
      cancelEdit();
    }
  };

  const renderCell = (row: BirthdayRow, field: keyof BirthdayRow) => {
    const isEditing = editingCell?.rowId === row.id && editingCell?.field === field;
    const isEditable = row.type === 'Camper' && EDITABLE_FIELDS.includes(field);
    const value = row[field]?.toString() || '';

    if (isEditing) {
      // Use select for cake type and party type
      if (field === 'birthday_cake_type') {
        return (
          <Select value={editValue || 'none'} onValueChange={(val) => {
            setEditValue(val === 'none' ? '' : val);
            // Auto-save on select
            setTimeout(async () => {
              const dbValue = val === 'none' ? null : val;
              setSaving(true);
              const { error } = await supabase
                .from('children')
                .update({ birthday_cake_type: dbValue })
                .eq('id', row.id);
              if (error) toast.error('Failed to save');
              else { toast.success(`Updated Cake Type for ${row.name}`); onDataUpdate(); }
              setSaving(false);
              cancelEdit();
            }, 0);
          }}>
            <SelectTrigger className="h-8 text-xs min-w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not Set</SelectItem>
              {CAKE_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      }

      if (field === 'birthday_party_type') {
        return (
          <Select value={editValue || 'none'} onValueChange={(val) => {
            setEditValue(val === 'none' ? '' : val);
            setTimeout(async () => {
              const dbValue = val === 'none' ? null : val;
              setSaving(true);
              const { error } = await supabase
                .from('children')
                .update({ birthday_party_type: dbValue })
                .eq('id', row.id);
              if (error) toast.error('Failed to save');
              else { toast.success(`Updated Party Type for ${row.name}`); onDataUpdate(); }
              setSaving(false);
              cancelEdit();
            }, 0);
          }}>
            <SelectTrigger className="h-8 text-xs min-w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not Set</SelectItem>
              {PARTY_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      }

      return (
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(row);
              if (e.key === 'Escape') cancelEdit();
            }}
            onBlur={() => saveEdit(row)}
            className="h-8 text-xs min-w-[100px]"
            disabled={saving}
          />
        </div>
      );
    }

    return (
      <div
        className={cn(
          "flex items-center gap-1 min-h-[32px]",
          isEditable && "cursor-pointer group/cell rounded px-1 -mx-1 hover:bg-primary/5 transition-colors"
        )}
        onClick={() => isEditable && startEdit(row, field)}
        title={isEditable ? 'Click to edit' : undefined}
      >
        <span className={cn(!value && isEditable && "text-muted-foreground/50 italic")}>
          {value || (isEditable ? 'Click to set' : '-')}
        </span>
        {isEditable && (
          <Pencil className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0" />
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {DISPLAY_COLUMNS.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/80 transition-colors select-none whitespace-nowrap"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-2">
                    <span>{COLUMN_HEADERS[col]}</span>
                    {EDITABLE_FIELDS.includes(col) && (
                      <Pencil className="h-3 w-3 text-muted-foreground/40" />
                    )}
                    {sortColumn === col ? (
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
            {sortedData.map((row) => (
              <tr key={row.id} className="hover:bg-muted/50">
                {DISPLAY_COLUMNS.map((col) => (
                  <td key={col} className="px-4 py-2 text-sm">
                    {renderCell(row, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
