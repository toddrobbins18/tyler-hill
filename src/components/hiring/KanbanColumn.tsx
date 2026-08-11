import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaffMember, HiringStatus } from "@/types/staff";
import { StaffCard } from "./StaffCard";

interface KanbanColumnProps {
  status: HiringStatus;
  title: string;
  staff: StaffMember[];
}

const statusHeader: Record<HiringStatus, string> = {
  "to-hire": "bg-primary text-primary-foreground",
  interviewing: "bg-warning text-warning-foreground",
  offered: "bg-secondary text-secondary-foreground",
  hired: "bg-success text-success-foreground",
};

export function KanbanColumn({ status, title, staff }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const totalBudget = staff.reduce((sum, s) => sum + s.netBudget, 0);

  return (
    <div className="flex flex-col h-full">
      <div className={`${statusHeader[status]} rounded-t-lg p-4 shadow-sm`}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-base">{title}</h3>
          <Badge variant="secondary" className="bg-white/20 text-white border-0 hover:bg-white/30">
            {staff.length}
          </Badge>
        </div>
        <p className="text-xs opacity-90">Budget: ${totalBudget.toLocaleString()}</p>
      </div>

      <Card
        ref={setNodeRef}
        className={`flex-1 p-3 rounded-t-none border-t-0 transition-colors min-h-[500px] ${
          isOver ? "bg-accent/10 border-accent" : "bg-card/50"
        }`}
      >
        <SortableContext items={staff.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {staff.map((member) => (
              <StaffCard key={member.id} staff={member} />
            ))}
            {staff.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Drop staff here
              </div>
            )}
          </div>
        </SortableContext>
      </Card>
    </div>
  );
}
