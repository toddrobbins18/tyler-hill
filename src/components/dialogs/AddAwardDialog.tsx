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
  "Color War Captain",
  "Other"
];

const OTHER_SUB_OPTIONS = ["Starfish", "Spirit", "Achievement"];

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
  const [awardType, setAwardType] = useState("");
  const [otherSelections, setOtherSelections] = useState<string[]>([]);
  const [starfishValues, setStarfishValues] = useState<string[]>([]);
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

  const showStarfishValues = awardType === "Starfish" || otherSelections.includes("Starfish");

  const toggleOtherSelection = (value: string) => {
    setOtherSelections(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const toggleStarfishValue = (value: string) => {
    setStarfishValues(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!awardType) {
      toast.error("Please select a Year End Award type");
      return;
    }

    if (awardType === "Other" && otherSelections.length === 0) {
      toast.error("Please select at least one option for Other");
      return;
    }

    setLoading(true);

    // Build title based on selections
    let title = awardType;
    if (awardType === "Other") {
      title = otherSelections.join(", ");
    }

    // Store starfish values in category field as JSON
    const category = showStarfishValues && starfishValues.length > 0 
      ? JSON.stringify({ starfish_values: starfishValues })
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
    setAwardType("");
    setOtherSelections([]);
    setStarfishValues([]);
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

          <div>
            <Label htmlFor="awardType">Year End Award</Label>
            <Select value={awardType} onValueChange={setAwardType}>
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

          {awardType === "Other" && (
            <div className="space-y-2">
              <Label>Select Options (multi-select)</Label>
              <div className="flex flex-wrap gap-4 p-3 border rounded-md bg-muted/30">
                {OTHER_SUB_OPTIONS.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`other-${option}`}
                      checked={otherSelections.includes(option)}
                      onCheckedChange={() => toggleOtherSelection(option)}
                    />
                    <label
                      htmlFor={`other-${option}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {option}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showStarfishValues && (
            <div className="space-y-2">
              <Label>Starfish Values (multi-select)</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                {STARFISH_VALUES.map((value) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`starfish-${value}`}
                      checked={starfishValues.includes(value)}
                      onCheckedChange={() => toggleStarfishValue(value)}
                    />
                    <label
                      htmlFor={`starfish-${value}`}
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
