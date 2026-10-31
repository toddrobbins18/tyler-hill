import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  presets: readonly string[];
  onSelect: (text: string) => void;
  className?: string;
  /** When true, append with "; " if field already has text. */
  append?: boolean;
  currentValue?: string;
};

export function NotePresetButtons({ presets, onSelect, className, append, currentValue = "" }: Props) {
  if (presets.length === 0) return null;

  const apply = (text: string) => {
    if (append && currentValue.trim()) {
      onSelect(`${currentValue.trim()}; ${text}`);
    } else {
      onSelect(text);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {presets.map((preset) => (
        <Button
          key={preset}
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px] font-normal"
          onClick={() => apply(preset)}
        >
          {preset}
        </Button>
      ))}
    </div>
  );
}
