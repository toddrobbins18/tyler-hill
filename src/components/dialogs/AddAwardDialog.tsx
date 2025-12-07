import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import SearchableChildSelect from "@/components/SearchableChildSelect";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface AddAwardDialogProps {
  onSuccess: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const YEAR_END_AWARDS = [
  "Camper of the Year",
  "Starfish",
  "Spirit",
  "Achievement",
  "Color War Captain"
];

const STARFISH_VALUES = [
  "Sportsmanship",
  "Tolerance",
  "Appreciation",
  "Respect",
  "Friendship",
  "Integrity",
  "Sensitivity",
  "Helpfulness"
];

export default function AddAwardDialog({ onSuccess, open, onOpenChange }: AddAwardDialogProps) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [weeklyStarfishValues, setWeeklyStarfishValues] = useState<string[]>([]);
  const [yearEndAward, setYearEndAward] = useState("");
  const [yearEndStarfishValues, setYearEndStarfishValues] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    description: "",
    date: new Date().toISOString().split('T')[0],
    child_id: "",
  });

  useEffect(() => {
    if (open) {
      fetchChildren();
    }
  }, [open, currentSeason]);

  const fetchChildren = async () => {
    if (!currentCompany?.id) return;
    const { data } = await supabase
      .from("children")
      .select("id, name")
      .eq("status", "active")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .order("name");
    
    if (data) setChildren(data);
  };

  const toggleWeeklyStarfishValue = (value: string) => {
    setWeeklyStarfishValues(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const toggleYearEndStarfishValue = (value: string) => {
    setYearEndStarfishValues(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasWeeklyStarfish = weeklyStarfishValues.length > 0;
    const hasYearEnd = yearEndAward !== "";

    if (!hasWeeklyStarfish && !hasYearEnd) {
      toast.error("Please select at least one award type");
      return;
    }

    setLoading(true);

    // Build title based on selections
    let title = "";
    if (hasWeeklyStarfish && hasYearEnd) {
      title = `Weekly Starfish, ${yearEndAward}`;
    } else if (hasWeeklyStarfish) {
      title = "Weekly Starfish";
    } else {
      title = yearEndAward;
    }

    // Store values in category field as JSON
    const categoryData: any = {};
    if (hasWeeklyStarfish) {
      categoryData.weekly_starfish_values = weeklyStarfishValues;
    }
    if (yearEndAward === "Starfish" && yearEndStarfishValues.length > 0) {
      categoryData.year_end_starfish_values = yearEndStarfishValues;
    }

    const category = Object.keys(categoryData).length > 0 
      ? JSON.stringify(categoryData)
      : null;

    const { error } = await supabase
      .from("awards")
      .insert([{ 
        title,
        category,
        description: formData.description,
        date: formData.date,
        child_id: formData.child_id,
        company_id: currentCompany?.id, 
        season: currentSeason 
      }]);

    if (error) {
      toast.error("Failed to add award");
      console.error(error);
    } else {
      toast.success("Award added successfully");
      onSuccess();
      onOpenChange(false);
      resetForm();
    }
    setLoading(false);
  };

  const resetForm = () => {
    setWeeklyStarfishValues([]);
    setYearEndAward("");
    setYearEndStarfishValues([]);
    setFormData({
      description: "",
      date: new Date().toISOString().split('T')[0],
      child_id: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Award</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="child">Child</Label>
            <SearchableChildSelect
              children={children}
              value={formData.child_id}
              onValueChange={(value) => setFormData({ ...formData, child_id: value })}
              placeholder="Type to search for a child..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Weekly Starfish (multi-select)</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
              {STARFISH_VALUES.map((value) => (
                <div key={value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`weekly-${value}`}
                    checked={weeklyStarfishValues.includes(value)}
                    onCheckedChange={() => toggleWeeklyStarfishValue(value)}
                  />
                  <label
                    htmlFor={`weekly-${value}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {value}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="yearEndAward">Year End Award</Label>
            <Select value={yearEndAward} onValueChange={setYearEndAward}>
              <SelectTrigger>
                <SelectValue placeholder="Select award type..." />
              </SelectTrigger>
              <SelectContent>
                {YEAR_END_AWARDS.map((award) => (
                  <SelectItem key={award} value={award}>
                    {award}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {yearEndAward === "Starfish" && (
            <div className="space-y-2">
              <Label>Starfish Values (multi-select)</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                {STARFISH_VALUES.map((value) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`yearend-starfish-${value}`}
                      checked={yearEndStarfishValues.includes(value)}
                      onCheckedChange={() => toggleYearEndStarfishValue(value)}
                    />
                    <label
                      htmlFor={`yearend-starfish-${value}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {value}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Notes (optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Award"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
