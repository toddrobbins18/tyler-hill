import { useEffect, useState } from "react";
import { Waves } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import {
  fetchSwimHistoryByPerson,
  skillStatusLabel,
  type SwimSeasonHistory,
} from "@/lib/swimProgram";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CamperSwimHistoryTab({ personId }: { personId: string }) {
  const { currentCompany } = useCompany();
  const [history, setHistory] = useState<SwimSeasonHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentCompany?.id || !personId) {
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchSwimHistoryByPerson(supabase, currentCompany.id, personId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentCompany?.id, personId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading swim history…</p>;
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Waves className="h-4 w-4" /> Swim History
          </CardTitle>
          <CardDescription>No swim seasons found for this camper yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry) => {
        const hasData =
          Boolean(entry.bracelet?.currentBracelet) ||
          (entry.levels?.goldfish.some((s) => s !== "—") ?? false) ||
          (entry.levels?.minnow.some((s) => s !== "—") ?? false) ||
          (entry.levels?.tadpole.some((s) => s !== "—") ?? false);
        return (
        <Card key={`${entry.season}-${entry.childId}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Season {entry.season}</span>
              {entry.bracelet?.currentBracelet ? (
                <Badge variant="outline">{entry.bracelet.currentBracelet} bracelet</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!hasData ? (
              <p className="text-muted-foreground">No swim bracelet or level data saved for this season.</p>
            ) : entry.levels ? (
              <div className="grid gap-2 md:grid-cols-3">
                {[
                  { label: "Goldfish", skills: entry.levels.goldfish, level: entry.levels.goldfishLevel },
                  { label: "Minnow", skills: entry.levels.minnow, level: entry.levels.minnowLevel },
                  { label: "Tadpole", skills: entry.levels.tadpole, level: entry.levels.tadpoleLevel },
                ].map((block) => (
                  <div key={block.label} className="rounded-md border p-2">
                    <p className="font-medium mb-1">
                      {block.label}{" "}
                      <span className="text-muted-foreground font-normal">({block.level})</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {block.skills.map((s, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={
                            s === "A"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : s === "W"
                                ? "bg-sky-500/15 text-sky-300"
                                : ""
                          }
                        >
                          {s === "—" ? "—" : `${s} (${skillStatusLabel(s)})`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : entry.bracelet?.currentBracelet ? (
              <p className="text-muted-foreground">Bracelet only — no level checklist saved.</p>
            ) : null}
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}
