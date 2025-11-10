import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ConflictIndicatorProps {
  count: number;
  onClick?: () => void;
}

export default function ConflictIndicator({ count, onClick }: ConflictIndicatorProps) {
  if (count === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="destructive" 
            className="cursor-pointer hover:bg-destructive/90 gap-1"
            onClick={onClick}
          >
            <AlertTriangle className="h-3 w-3" />
            {count} Conflict{count > 1 ? 's' : ''}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to view schedule conflicts</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
