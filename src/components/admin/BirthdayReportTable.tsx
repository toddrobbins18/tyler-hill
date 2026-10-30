import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface BirthdayRow {
  id: string;
  name: string;
  type: "Camper" | "Staff";
  division: string;
  date_of_birth: string | null;
  birthday_month: string;
}

interface BirthdayReportTableProps {
  data: BirthdayRow[];
  onDataUpdate: () => void;
}

const COLUMN_HEADERS: Record<string, string> = {
  name: "Name",
  type: "Type",
  division: "Division",
  date_of_birth: "Date of Birth",
  birthday_month: "Birthday Month",
};

const DISPLAY_COLUMNS: (keyof BirthdayRow)[] = [
  "name",
  "type",
  "division",
  "date_of_birth",
  "birthday_month",
];

export default function BirthdayReportTable({ data }: BirthdayReportTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") setSortDirection("desc");
      else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedData = (() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn as keyof BirthdayRow] ?? "";
      const bVal = b[sortColumn as keyof BirthdayRow] ?? "";
      const cmp = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
      return sortDirection === "asc" ? cmp : -cmp;
    });
  })();

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No birthday records found.</p>;
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {DISPLAY_COLUMNS.map((col) => (
              <th key={col} className="text-left p-3 font-medium">
                <button
                  type="button"
                  className="flex items-center hover:text-foreground"
                  onClick={() => handleSort(col)}
                >
                  {COLUMN_HEADERS[col]}
                  <SortIcon column={col} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => (
            <tr key={`${row.type}-${row.id}`} className={cn("border-b", "hover:bg-muted/30")}>
              {DISPLAY_COLUMNS.map((col) => (
                <td key={col} className="p-3">
                  {row[col]?.toString() || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
