import { useState, useEffect, useRef } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface CalendarZoomWrapperProps {
  children: (height: number) => React.ReactNode;
  minHeight?: number;
  maxHeight?: number;
}

export function CalendarZoomWrapper({ children, minHeight = 400, maxHeight = 1400 }: CalendarZoomWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoHeight, setAutoHeight] = useState(600);
  const [zoomOffset, setZoomOffset] = useState(0);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Fill remaining viewport minus some padding for controls
        const available = window.innerHeight - rect.top - 40;
        setAutoHeight(Math.max(minHeight, Math.min(maxHeight, available)));
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [minHeight, maxHeight]);

  const effectiveHeight = Math.max(minHeight, Math.min(maxHeight, autoHeight + zoomOffset));

  const handleZoomIn = () => setZoomOffset(prev => Math.min(prev + 100, maxHeight - autoHeight));
  const handleZoomOut = () => setZoomOffset(prev => Math.max(prev - 100, minHeight - autoHeight));
  const handleReset = () => setZoomOffset(0);

  return (
    <div ref={containerRef}>
      <div className="flex flex-wrap items-center gap-2 mb-2 justify-center sm:justify-end">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} title="Zoom out (fewer days visible)">
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Slider
          value={[effectiveHeight]}
          min={minHeight}
          max={maxHeight}
          step={50}
          onValueChange={([v]) => setZoomOffset(v - autoHeight)}
          className="w-28 sm:w-24"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} title="Zoom in (more days visible)">
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Auto-fit to screen">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {children(effectiveHeight)}
    </div>
  );
}
