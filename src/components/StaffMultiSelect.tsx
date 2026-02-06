import { useState, useEffect, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Search, X, UserPlus } from "lucide-react";

interface StaffMember {
  id: string;
  name: string;
  role: string | null;
}

interface StaffMultiSelectProps {
  /** Comma-separated staff names (for backward compat with chaperone text field) */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export function StaffMultiSelect({
  value,
  onChange,
  label = "Staff (optional)",
  placeholder = "Search staff to assign...",
}: StaffMultiSelectProps) {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();

  // Parse selected names from comma-separated string
  const selectedNames = useMemo(() => {
    if (!value) return [] as string[];
    return value.split(",").map(s => s.trim()).filter(Boolean);
  }, [value]);

  useEffect(() => {
    fetchStaff();
  }, [currentCompany?.id, currentSeason]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchStaff = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .neq("name", "Unknown")
      .not("name", "is", null)
      .order("name");
    setStaffList(data || []);
    setLoading(false);
  };

  const filteredStaff = useMemo(() => {
    if (!searchTerm) return staffList;
    const term = searchTerm.toLowerCase();
    return staffList.filter(
      s => s.name.toLowerCase().includes(term) || (s.role?.toLowerCase() || "").includes(term)
    );
  }, [staffList, searchTerm]);

  const toggleStaff = (name: string) => {
    let updated: string[];
    if (selectedNames.includes(name)) {
      updated = selectedNames.filter(n => n !== name);
    } else {
      updated = [...selectedNames, name];
    }
    onChange(updated.join(", "));
  };

  const removeStaff = (name: string) => {
    const updated = selectedNames.filter(n => n !== name);
    onChange(updated.join(", "));
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label>{label}</Label>

      {/* Selected staff badges */}
      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedNames.map(name => (
            <Badge key={name} variant="secondary" className="flex items-center gap-1 pr-1">
              {name}
              <button
                type="button"
                onClick={() => removeStaff(name)}
                className="ml-1 rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchTerm}
          onChange={e => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10"
        />
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <div className="border rounded-md bg-popover shadow-md z-50 relative">
          <ScrollArea className="max-h-48">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground text-center">Loading staff...</div>
            ) : filteredStaff.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                {searchTerm ? "No staff found" : "No staff available"}
              </div>
            ) : (
              <div className="py-1">
                {filteredStaff.map(staff => {
                  const isSelected = selectedNames.includes(staff.name);
                  return (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => toggleStaff(staff.name)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary border-primary" : "border-input"
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{staff.name}</p>
                        {staff.role && (
                          <p className="text-xs text-muted-foreground truncate">{staff.role}</p>
                        )}
                      </div>
                      {!isSelected && (
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
