import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { SortDirection } from "@/hooks/use-sortable";
import { cn } from "@/lib/utils";

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: { key: string; direction: SortDirection };
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({ label, sortKey, currentSort, onSort, className }: SortableHeaderProps) {
  const isActive = currentSort.key === sortKey;
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors", className)}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && currentSort.direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : isActive && currentSort.direction === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}

/** For native <th> tables (Alumni, Screening, MultiCamp, DataMigration) */
interface SortableThProps {
  label: string;
  sortKey: string;
  currentSort: { key: string; direction: SortDirection };
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTh({ label, sortKey, currentSort, onSort, className }: SortableThProps) {
  const isActive = currentSort.key === sortKey;
  return (
    <th
      className={cn("text-left p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors", className)}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && currentSort.direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : isActive && currentSort.direction === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}
