import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function useSortable<T>(data: T[], defaultSort?: SortConfig) {
  const [sort, setSort] = useState<SortConfig>(defaultSort || { key: "", direction: null });

  const handleSort = (key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: "", direction: null };
    });
  };

  const sorted = useMemo(() => {
    if (!sort.key || !sort.direction) return data;
    return [...data].sort((a, b) => {
      // Handle nested keys like "goldfish.0"
      const getNestedValue = (obj: any, path: string) => {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
      };

      const aVal = getNestedValue(a, sort.key);
      const bVal = getNestedValue(b, sort.key);

      // Handle nullish
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Numeric comparison (handles "$1,200" style strings)
      const aNum = typeof aVal === "number" ? aVal : parseFloat(String(aVal).replace(/[^0-9.-]/g, ""));
      const bNum = typeof bVal === "number" ? bVal : parseFloat(String(bVal).replace(/[^0-9.-]/g, ""));
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sort.direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [data, sort]);

  return { sorted, sort, handleSort };
}
