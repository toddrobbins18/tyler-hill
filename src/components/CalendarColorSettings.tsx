import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ColorOverride {
  [key: string]: string;
}

interface CalendarColorSettingsProps {
  calendarId: string; // unique key per calendar page
  defaultColors: Record<string, string>; // eventType -> default hex
  onColorsChange: (colors: Record<string, string>) => void;
}

const STORAGE_KEY_PREFIX = "calendar-colors-";

export function CalendarColorSettings({ calendarId, defaultColors, onColorsChange }: CalendarColorSettingsProps) {
  const [colors, setColors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + calendarId);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setColors({ ...defaultColors, ...parsed });
        onColorsChange({ ...defaultColors, ...parsed });
      } catch {
        setColors(defaultColors);
        onColorsChange(defaultColors);
      }
    } else {
      setColors(defaultColors);
      onColorsChange(defaultColors);
    }
  }, [calendarId]);

  const handleColorChange = (key: string, value: string) => {
    const updated = { ...colors, [key]: value };
    setColors(updated);
    
    // Only store overrides (diff from defaults)
    const overrides: ColorOverride = {};
    Object.entries(updated).forEach(([k, v]) => {
      if (v !== defaultColors[k]) {
        overrides[k] = v;
      }
    });
    localStorage.setItem(STORAGE_KEY_PREFIX + calendarId, JSON.stringify(overrides));
    onColorsChange(updated);
    // Dispatch custom event for same-tab listeners
    window.dispatchEvent(new Event(calendarId + "-colors-updated"));
  };

  const handleReset = () => {
    setColors(defaultColors);
    localStorage.removeItem(STORAGE_KEY_PREFIX + calendarId);
    onColorsChange(defaultColors);
    window.dispatchEvent(new Event(calendarId + "-colors-updated"));
  };

  const entries = Object.entries(colors);

  if (entries.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" title="Calendar color settings">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-sm">Event Colors</h4>
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs h-7">
              Reset
            </Button>
          </div>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2 pr-2">
              {entries.map(([key, color]) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-border p-0.5"
                  />
                  <Label className="text-xs flex-1 truncate">{key}</Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
