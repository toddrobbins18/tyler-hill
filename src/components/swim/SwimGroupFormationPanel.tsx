import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSwimPeriodGroups,
  fetchSwimFormationCampers,
  type SwimFormationCamper,
  type SwimFormationGroup,
} from "@/lib/swimGroupFormation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Loader2, Users, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { buildSwimFormationReportPdf } from "@/lib/swimGroupFormationPdf";
import { triggerBlobDownload } from "@/lib/transportBubbleSheetPdf";

type Props = {
  companyId: string;
  season: string;
};

export function SwimGroupFormationPanel({ companyId, season }: Props) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [campers, setCampers] = useState<SwimFormationCamper[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [instructorCount, setInstructorCount] = useState(3);
  const [groups, setGroups] = useState<SwimFormationGroup[]>([]);

  const loadRoster = useCallback(async () => {
    if (!companyId || !season) return;
    setLoading(true);
    try {
      const next = await fetchSwimFormationCampers(supabase, companyId, season);
      setCampers(next);
      setSelectedGroups((prev) => prev.filter((name) => next.some((c) => c.group === name)));
    } catch (err) {
      console.error(err);
      toast({
        title: "Could not load campers",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, season, toast]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const campGroupNames = useMemo(() => {
    const names = new Set<string>();
    for (const camper of campers) {
      const group = camper.group.trim();
      if (group && group !== "—") names.add(group);
    }
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [campers]);

  const toggleGroup = (name: string, checked: boolean) => {
    setSelectedGroups((prev) => {
      if (checked) return prev.includes(name) ? prev : [...prev, name];
      return prev.filter((group) => group !== name);
    });
  };

  const handleBuild = async () => {
    if (!companyId || !season) return;
    if (selectedGroups.length === 0) {
      toast({ title: "Pick at least one camp group", variant: "destructive" });
      return;
    }
    setBuilding(true);
    try {
      const next = await fetchSwimFormationCampers(supabase, companyId, season);
      setCampers(next);
      const built = buildSwimPeriodGroups(next, selectedGroups, instructorCount);
      const assigned = built.reduce((sum, group) => sum + group.campers.length, 0);
      setGroups(built);
      toast({
        title: "Swim groups built",
        description: `${built.length} group${built.length === 1 ? "" : "s"} from ${assigned} campers`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Could not build groups",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBuilding(false);
    }
  };

  const totalAssigned = useMemo(
    () => groups.reduce((sum, g) => sum + g.campers.length, 0),
    [groups],
  );

  const criteriaSummary = useMemo(() => {
    const names = [...selectedGroups].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return [
      names.length ? `Camp groups: ${names.join(", ")}` : "No camp groups selected",
      `${instructorCount} instructor${instructorCount === 1 ? "" : "s"}`,
      "By completed swim level",
    ].join(" · ");
  }, [selectedGroups, instructorCount]);

  const handleDownloadPdf = () => {
    const built = buildSwimFormationReportPdf({
      companyName: currentCompany?.name ?? "Camp",
      season,
      groups,
      criteriaSummary,
    });
    if (!built) {
      toast({ title: "Build groups first", variant: "destructive" });
      return;
    }
    triggerBlobDownload(built.blob, built.filename);
    toast({ title: "Formation PDF downloaded" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading campers…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Swim group formation
          </CardTitle>
          <CardDescription>
            Pick the camp groups in this swim period, set how many instructors you have, and build groups from
            each camper’s last completed swim level. Kids stay with their camp group when the numbers allow. A
            group can mix camps, for example 6 Cheetahs and 4 Panthers. {campers.length} active campers in
            season {season}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Camp groups in this period</Label>
              {campGroupNames.length === 0 ? (
                <p className="text-sm text-muted-foreground">No camp groups on this season’s roster.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {campGroupNames.map((name) => {
                    const count = campers.filter((c) => c.group === name).length;
                    return (
                      <label
                        key={name}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={selectedGroups.includes(name)}
                          onCheckedChange={(v) => toggleGroup(name, v === true)}
                        />
                        <span className="text-sm font-medium">
                          {name}
                          <span className="ml-1 font-normal text-muted-foreground">({count})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instructor-count">Number of instructors</Label>
                <Input
                  id="instructor-count"
                  type="number"
                  min={1}
                  max={20}
                  value={instructorCount}
                  onChange={(e) => setInstructorCount(Number(e.target.value) || 1)}
                  className="max-w-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Campers are ordered by completed swim level, then camp group, and split across this many
                  instructors.
                </p>
              </div>
              <Button
                onClick={handleBuild}
                disabled={building || campers.length === 0 || selectedGroups.length === 0}
                className="gap-2"
              >
                {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Build swim groups
              </Button>
              {selectedGroups.length === 0 ? (
                <Alert>
                  <AlertDescription>Select the camp groups for this swim period first.</AlertDescription>
                </Alert>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {groups.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{groups.length} groups</Badge>
            <Badge variant="outline">{totalAssigned} campers assigned</Badge>
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{group.label}</CardTitle>
                <CardDescription>{group.campers.length} camper{group.campers.length === 1 ? "" : "s"}</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Level complete</TableHead>
                      <TableHead>Division leader</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.campers.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.division}</TableCell>
                        <TableCell>{c.group}</TableCell>
                        <TableCell>{c.highestCompletedLevel}</TableCell>
                        <TableCell>{c.divisionLeader}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
