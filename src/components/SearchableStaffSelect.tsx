import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  name: string;
  role?: string | null;
  department?: string | null;
}

interface SearchableStaffSelectProps {
  staff: StaffMember[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export default function SearchableStaffSelect({
  staff,
  value,
  onValueChange,
  placeholder = "Type to search...",
  required = false,
}: SearchableStaffSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedStaff = staff.find((member) => member.id === value);

  useEffect(() => {
    if (selectedStaff && !isOpen) {
      setSearch(selectedStaff.name);
    }
  }, [selectedStaff, isOpen]);

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staff.slice(0, 50);
    const searchLower = search.toLowerCase();
    return staff
      .filter(
        (member) =>
          member.name.toLowerCase().includes(searchLower) ||
          (member.role || "").toLowerCase().includes(searchLower) ||
          (member.department || "").toLowerCase().includes(searchLower),
      )
      .slice(0, 50);
  }, [staff, search]);

  const handleSelect = (member: StaffMember) => {
    onValueChange(member.id);
    setSearch(member.name);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setIsOpen(true);
    if (selectedStaff && e.target.value !== selectedStaff.name) {
      onValueChange("");
    }
  };

  return (
    <div className="relative">
      <Input
        value={search}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setTimeout(() => {
            setIsOpen(false);
            if (selectedStaff) {
              setSearch(selectedStaff.name);
            } else {
              setSearch("");
            }
          }, 200);
        }}
        placeholder={placeholder}
        required={required && !value}
        autoComplete="off"
      />
      {isOpen && filteredStaff.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg">
          <ScrollArea className="max-h-60">
            <div className="p-1">
              {filteredStaff.map((member) => (
                <div
                  key={member.id}
                  className={cn(
                    "px-3 py-2 cursor-pointer rounded-sm hover:bg-accent hover:text-accent-foreground text-sm",
                    value === member.id && "bg-accent",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(member);
                  }}
                >
                  {member.name}
                  {member.role ? ` • ${member.role}` : ""}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      {isOpen && filteredStaff.length === 0 && search.trim() && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
          No results found
        </div>
      )}
    </div>
  );
}
