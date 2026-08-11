import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaffMember } from "@/types/staff";
import { GripVertical, DollarSign, Tag } from "lucide-react";

interface StaffCardProps {
  staff: StaffMember;
}

const departmentColors: Record<string, string> = {
  PROGRAMMING: "bg-primary/10 text-primary border-primary/30",
  ADMINISTRATION: "bg-secondary/15 text-secondary border-secondary/30",
  "FOOD SERVICE": "bg-success/10 text-success border-success/30",
  MAINTENANCE: "bg-accent/10 text-accent border-accent/30",
  TRANSPORTATION: "bg-info/10 text-info border-info/30",
  "CREATIVE ARTS": "bg-warning/10 text-warning border-warning/30",
};

export function StaffCard({ staff }: StaffCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: staff.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const deptColor =
    departmentColors[staff.department] || "bg-muted text-muted-foreground border-border";

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="p-3 hover:shadow-md transition-all cursor-move bg-card">
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-0.5 truncate text-foreground">{staff.name}</h4>
            <p className="text-xs text-muted-foreground mb-2 truncate">{staff.position}</p>

            <div className="flex flex-wrap gap-1.5 mb-2">
              <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${deptColor}`}>
                <Tag className="h-2.5 w-2.5 mr-1" />
                {staff.department}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  {staff.netBudget.toLocaleString()}
                </span>
              </div>
              {staff.kidCredit > 0 && (
                <span className="text-muted-foreground text-[11px]">
                  Kid Credit: ${staff.kidCredit.toLocaleString()}
                </span>
              )}
            </div>

            {staff.notes && (
              <p className="text-[11px] text-muted-foreground mt-1.5 italic">{staff.notes}</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
