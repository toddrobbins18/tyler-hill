import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Child {
  id: string;
  name: string;
  age?: number;
  gender?: string;
}

interface SearchableChildSelectProps {
  children: Child[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  /** When set, keeps typed search text (e.g. draft restore after tab switch). */
  searchText?: string;
  onSearchTextChange?: (text: string) => void;
}

export default function SearchableChildSelect({
  children,
  value,
  onValueChange,
  placeholder = "Type to search...",
  required = false,
  searchText,
  onSearchTextChange,
}: SearchableChildSelectProps) {
  const isControlledSearch = onSearchTextChange != null;
  const [internalSearch, setInternalSearch] = useState(searchText ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const search = isControlledSearch ? (searchText ?? "") : internalSearch;

  const setSearch = (next: string) => {
    if (isControlledSearch) {
      onSearchTextChange(next);
    } else {
      setInternalSearch(next);
    }
  };

  // Get the selected child's name for display
  const selectedChild = children.find((c) => c.id === value);

  useEffect(() => {
    if (selectedChild && !isOpen) {
      setSearch(selectedChild.name);
    }
  }, [selectedChild, isOpen]);

  const filteredChildren = useMemo(() => {
    if (!search.trim()) return children.slice(0, 50); // Show first 50 when no search
    const searchLower = search.toLowerCase();
    return children.filter((child) =>
      child.name.toLowerCase().includes(searchLower)
    ).slice(0, 50);
  }, [children, search]);

  const handleSelect = (child: Child) => {
    onValueChange(child.id);
    setSearch(child.name);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setIsOpen(true);
    // Clear selection if user types something different
    if (selectedChild && e.target.value !== selectedChild.name) {
      onValueChange("");
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleBlur = () => {
    // Delay closing to allow click on option
    setTimeout(() => {
      setIsOpen(false);
      if (isControlledSearch) return;
      // Reset to selected value if nothing new was selected
      if (selectedChild) {
        setSearch(selectedChild.name);
      } else {
        setSearch("");
      }
    }, 200);
  };

  return (
    <div className="relative">
      <Input
        value={search}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required && !value}
        autoComplete="off"
      />
      {isOpen && filteredChildren.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg">
          <ScrollArea className="max-h-60">
            <div className="p-1">
              {filteredChildren.map((child) => (
                <div
                  key={child.id}
                  className={cn(
                    "px-3 py-2 cursor-pointer rounded-sm hover:bg-accent hover:text-accent-foreground text-sm",
                    value === child.id && "bg-accent"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(child);
                  }}
                >
                  {child.name} {child.age ? `(${child.age})` : ""}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      {isOpen && filteredChildren.length === 0 && search.trim() && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
          No results found
        </div>
      )}
    </div>
  );
}
