import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { usePermissions } from "@/hooks/usePermissions";
import { expandDivisionIdsForRosterFilter } from "@/lib/divisionFilterUtils";

type ProfileQuickSearchProps = {
  type: "child" | "staff";
  currentId?: string;
};

type SearchResult = {
  id: string;
  name: string;
  subtitle?: string;
};

export default function ProfileQuickSearch({ type, currentId }: ProfileQuickSearchProps) {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const { getDivisionFilter } = usePermissions();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentCompany?.id) return;

    let cancelled = false;

    const loadResults = async () => {
      setLoading(true);
      try {
        if (type === "child") {
          const divisionFilter = getDivisionFilter();
          let query = supabase
            .from("children")
            .select("id, name, grade, divisions(name)")
            .eq("company_id", currentCompany.id)
            .eq("season", currentSeason)
            .neq("status", "inactive")
            .order("name");

          if (divisionFilter !== null && divisionFilter.length > 0) {
            const { data: divisions } = await supabase
              .from("divisions")
              .select("id, name")
              .eq("company_id", currentCompany.id)
              .eq("is_active", true);

            const expanded = expandDivisionIdsForRosterFilter(
              divisionFilter,
              divisions || [],
            );
            query = query.in("division_id", expanded);
          }

          const { data } = await query;
          if (cancelled) return;

          setResults(
            (data || []).map((child: any) => ({
              id: child.id,
              name: child.name,
              subtitle: [child.grade, child.divisions?.name].filter(Boolean).join(" • "),
            })),
          );
        } else {
          const { data } = await supabase
            .from("staff")
            .select("id, name, role, department")
            .eq("company_id", currentCompany.id)
            .eq("season", currentSeason)
            .neq("status", "inactive")
            .order("name");

          if (cancelled) return;

          setResults(
            (data || []).map((member: any) => ({
              id: member.id,
              name: member.name,
              subtitle: [member.role, member.department].filter(Boolean).join(" • "),
            })),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadResults();

    return () => {
      cancelled = true;
    };
  }, [currentCompany?.id, currentSeason, getDivisionFilter, type]);

  const filteredResults = useMemo(() => {
    if (!search.trim()) return results.slice(0, 8);
    const searchLower = search.toLowerCase();
    return results
      .filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          (item.subtitle || "").toLowerCase().includes(searchLower),
      )
      .slice(0, 8);
  }, [results, search]);

  const handleSelect = (item: SearchResult) => {
    setSearch("");
    setIsOpen(false);
    if (item.id === currentId) return;
    navigate(type === "child" ? `/child/${item.id}` : `/staff/${item.id}`);
  };

  const placeholder =
    type === "child"
      ? "Search campers by name, grade, or division..."
      : "Search staff by name, role, or department...";

  return (
    <div className="relative flex-1 max-w-xl">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setTimeout(() => setIsOpen(false), 200);
        }}
        placeholder={placeholder}
        className="pl-10"
        autoComplete="off"
      />
      {isOpen && (loading || filteredResults.length > 0 || search.trim()) && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading...</div>
          ) : filteredResults.length > 0 ? (
            <ScrollArea className="max-h-60">
              <div className="p-1">
                {filteredResults.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "px-3 py-2 cursor-pointer rounded-sm hover:bg-accent hover:text-accent-foreground text-sm",
                      item.id === currentId && "bg-accent",
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(item);
                    }}
                  >
                    <div className="font-medium">{item.name}</div>
                    {item.subtitle ? (
                      <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="p-3 text-sm text-muted-foreground">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
