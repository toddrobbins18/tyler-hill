import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Clock, MapPin, Waves } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import {
  fetchSwimHistoryByChild,
  fetchSwimHistoryByPerson,
  skillStatusLabel,
  type SwimSeasonHistory,
} from "@/lib/swimProgram";
import { fetchSwimLessonsForCamper, type CamperSwimLessonRow } from "@/lib/camperProfileSwim";
import { SWIM_LESSON_STATUS_LABELS, type SwimLessonStatus } from "@/lib/swimLessonApproval";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  childId: string;
  childName: string;
  season: string;
  personId?: string | null;
  initialLessons?: CamperSwimLessonRow[];
};

export default function CamperSwimHistoryTab({
  childId,
  childName,
  season,
  personId,
  initialLessons,
}: Props) {
  const { currentCompany } = useCompany();
  const [history, setHistory] = useState<SwimSeasonHistory[]>([]);
  const [lessons, setLessons] = useState<CamperSwimLessonRow[]>(initialLessons ?? []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentCompany?.id || !childId) {
      setHistory([]);
      setLessons([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const loadHistory = personId
      ? fetchSwimHistoryByPerson(supabase, currentCompany.id, personId)
      : fetchSwimHistoryByChild(supabase, currentCompany.id, childId, childName, season);

    const loadLessons =
      initialLessons != null
        ? Promise.resolve(initialLessons)
        : fetchSwimLessonsForCamper(supabase, currentCompany.id, childId, personId);

    Promise.all([loadHistory, loadLessons])
      .then(([hist, lessonRows]) => {
        setHistory(hist);
        setLessons(lessonRows);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentCompany?.id, childId, childName, season, personId, initialLessons]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading swim…</p>;
  }

  const lessonStatusLabel = (status: string) =>
    SWIM_LESSON_STATUS_LABELS[status as SwimLessonStatus] ?? status;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Waves className="h-4 w-4" /> Private swim lessons
          </CardTitle>
          <CardDescription>
            Scheduled from Swim Lessons — linked by camper roster id
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No swim lessons on file for this camper.</p>
          ) : (
            lessons.map((lesson) => {
              const when = new Date(lesson.scheduled_at);
              return (
                <div
                  key={lesson.id}
                  className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {format(when, "EEE, MMM d, yyyy")}
                    </p>
                    <Badge variant="outline">{lessonStatusLabel(lesson.status)}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {format(when, "h:mm a")} · {lesson.duration_minutes} min
                    </span>
                    {lesson.instructor ? <span>Instructor: {lesson.instructor}</span> : null}
                    {lesson.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {lesson.location}
                      </span>
                    ) : null}
                    {lesson.parent_confirmed ? <span>Parent confirmed</span> : null}
                    {lesson.transport_status ? (
                      <span>Transport: {lesson.transport_status.replace(/_/g, " ")}</span>
                    ) : null}
                  </div>
                  {lesson.notes ? <p className="text-muted-foreground">{lesson.notes}</p> : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {history.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Swim program (levels &amp; bracelets)</CardTitle>
            <CardDescription>No Red Cross / bracelet checklist saved yet for this camper.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        history.map((entry) => {
          const hasData =
            Boolean(entry.bracelet?.currentBracelet) ||
            (entry.levels?.goldfish.some((s) => s !== "—") ?? false) ||
            (entry.levels?.minnow.some((s) => s !== "—") ?? false) ||
            (entry.levels?.tadpole.some((s) => s !== "—") ?? false);
          return (
            <Card key={`${entry.season}-${entry.childId}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Season {entry.season} — program</span>
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
        })
      )}
    </div>
  );
}
