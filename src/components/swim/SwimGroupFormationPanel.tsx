import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  SWIM_FORMATION_CRITERIA,
  buildSwimFormationGroups,
  fetchSwimFormationCampers,
  type SwimFormationCriterion,
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
import { Loader2, Users, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  companyId: string;
  season: string;
};

export function SwimGroupFormationPanel({ companyId, season }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [criteria, setCriteria] = useState<SwimFormationCriterion[]>(["division", "swimLevel"]);
  const [maxPerGroup, setMaxPerGroup] = useState(8);
  const [groups, setGroups] = useState<SwimFormationGroup[]>([]);
  const [rosterCount, setRosterCount] = useState(0);

  const loadRoster = useCallback(async () => {
    if (!companyId || !season) return;
    setLoading(true);
    try {
      const campers = await fetchSwimFormationCampers(supabase, companyId, season);
      setRosterCount(campers.length);
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

  const toggleCriterion = (id: SwimFormationCriterion, checked: boolean) => {
    setCriteria((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((c) => c !== id);
    });
  };

  const handleBuild = async () => {
    if (!companyId || !season) return;
    setBuilding(true);
    try {
      const campers = await fetchSwimFormationCampers(supabase, companyId, season);
      setRosterCount(campers.length);
      const built = buildSwimFormationGroups(campers, {
        criteria,
        maxCampersPerGroup: maxPerGroup,
      });
      setGroups(built);
      toast({
        title: "Swim groups built",
        description: `${built.length} group${built.length === 1 ? "" : "s"} from ${campers.length} campers`,
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
            Pick how groups should be formed, set a max size, then build groups for season {season}.{" "}
            {rosterCount} active campers on roster.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Group by (select all that apply)</Label>
              {SWIM_FORMATION_CRITERIA.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={criteria.includes(item.id)}
                    onCheckedChange={(v) => toggleCriterion(item.id, v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max-campers">Max campers per group</Label>
                <Input
                  id="max-campers"
                  type="number"
                  min={1}
                  max={99}
                  value={maxPerGroup}
                  onChange={(e) => setMaxPerGroup(Number(e.target.value) || 8)}
                  className="max-w-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  When a bucket has more campers than this, it splits into Group 1, Group 2, etc.
                </p>
              </div>
              <Button onClick={handleBuild} disabled={building || rosterCount === 0} className="gap-2">
                {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Build swim groups
              </Button>
              {criteria.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No criteria selected — all campers will be mixed and split only by max group size.
                  </AlertDescription>
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
