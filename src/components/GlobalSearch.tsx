import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Users, UserCog, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useNavigate } from "react-router-dom";
import { useSeasonContext } from "@/contexts/SeasonContext";

interface SearchResult {
  id: string;
  type: "camper" | "staff";
  name: string;
  matchedField: string;
  matchedValue: string;
  extra?: string;
}

export function GlobalSearch() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const navigate = useNavigate();
  
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const performSearch = useCallback(async (q: string) => {
    if (q.length < 2 || !currentCompany?.id) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    const lower = q.toLowerCase();
    const matched: SearchResult[] = [];

    try {
      const [{ data: campers, error: campersError }, { data: staff, error: staffError }] = await Promise.all([
        supabase
          .from("children")
          .select("id, name, grade, group_name, status, guardian_email, guardian_phone")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .limit(200),
        supabase
          .from("staff")
          .select("id, name, email, phone, role, department, status")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .limit(200),
      ]);

      if (campersError || staffError) {
        throw campersError || staffError;
      }

      if (campers?.length) {
        for (const c of campers) {
          const fields: [string, string | null | undefined][] = [
            ["Name", c.name],
            ["Grade", c.grade],
            ["Group", c.group_name],
            ["Status", c.status],
            ["Parent Email", c.guardian_email],
            ["Parent Phone", c.guardian_phone],
          ];

          for (const [label, val] of fields) {
            if (val && val.toLowerCase().includes(lower)) {
              matched.push({
                id: c.id,
                type: "camper",
                name: c.name || "Unknown Camper",
                matchedField: label,
                matchedValue: val,
                extra: c.group_name ? `Group: ${c.group_name}` : undefined,
              });
              break;
            }
          }
        }
      }

      if (staff?.length) {
        for (const s of staff) {
          const fields: [string, string | null | undefined][] = [
            ["Name", s.name],
            ["Email", s.email],
            ["Phone", s.phone],
            ["Role", s.role],
            ["Department", s.department],
            ["Status", s.status],
          ];

          for (const [label, val] of fields) {
            if (val && val.toLowerCase().includes(lower)) {
              matched.push({
                id: s.id,
                type: "staff",
                name: s.name || "Unknown Staff",
                matchedField: label,
                matchedValue: val,
                extra: s.role || undefined,
              });
              break;
            }
          }
        }
      }
    } catch (err) {
      console.error("Search error:", err);
    }

    setResults(matched.slice(0, 20));
    setOpen(matched.length > 0 || q.length >= 2);
    setLoading(false);
  }, [currentCompany?.id, currentSeason]);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(val), 300);
  };

  const highlightMatch = (text: string, q: string) => {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="bg-primary/20 text-primary font-semibold rounded px-0.5">{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    if (result.type === "camper") {
      navigate(`/child/${result.id}`);
    } else {
      navigate(`/staff/${result.id}`);
    }
  };

  return (
    <div ref={containerRef} className="relative hidden md:block z-50">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="Search by name, phone, email..."
        className="w-80 pl-9 h-9 bg-muted/50 border-0 pr-8"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
      />
      {query && (
        <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[420px] bg-popover border border-border rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No results found for "{query}"</div>
          ) : (
            <div className="py-1">
              <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </div>
              {results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-start gap-3"
                  onClick={() => handleSelect(r)}
                >
                  <div className={`mt-0.5 rounded-full p-1.5 ${r.type === "camper" ? "bg-primary/10" : "bg-accent/30"}`}>
                    {r.type === "camper" ? <Users className="h-3.5 w-3.5 text-primary" /> : <UserCog className="h-3.5 w-3.5 text-accent-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.name}</span>
                      <Badge variant="secondary" className="text-[9px] px-1.5">{r.type === "camper" ? "Camper" : "Staff"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="text-muted-foreground/70">{r.matchedField}:</span>{" "}
                      {highlightMatch(r.matchedValue, query)}
                    </p>
                    {r.extra && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{r.extra}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
