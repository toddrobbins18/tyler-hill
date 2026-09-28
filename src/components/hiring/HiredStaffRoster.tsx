import { useMemo } from "react";
import { StaffMember } from "@/types/staff";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag, DollarSign } from "lucide-react";

const departmentColors: Record<string, string> = {
  PROGRAMMING: "bg-primary/10 text-primary border-primary/30",
  ADMINISTRATION: "bg-secondary/15 text-secondary border-secondary/30",
  "FOOD SERVICE": "bg-success/10 text-success border-success/30",
  MAINTENANCE: "bg-accent/10 text-accent border-accent/30",
  TRANSPORTATION: "bg-info/10 text-info border-info/30",
  "CREATIVE ARTS": "bg-warning/10 text-warning border-warning/30",
};

function HiredStaffCard({ staff }: { staff: StaffMember }) {
  const deptColor =
    departmentColors[staff.department] || "bg-muted text-muted-foreground border-border";

  return (
    <Card className="p-3 bg-card">
      <h4 className="font-semibold text-sm mb-0.5 truncate text-foreground">{staff.name}</h4>
      <p className="text-xs text-muted-foreground mb-2 truncate">{staff.position}</p>
      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${deptColor}`}>
        <Tag className="h-2.5 w-2.5 mr-1" />
        {staff.department}
      </Badge>
      {staff.netBudget > 0 && (
        <div className="flex items-center gap-1 mt-2 text-xs">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium text-foreground">{staff.netBudget.toLocaleString()}</span>
        </div>
      )}
    </Card>
  );
}

type Props = {
  staff: StaffMember[];
};

export function HiredStaffRoster({ staff }: Props) {
  const byDepartment = useMemo(() => {
    const groups = new Map<string, StaffMember[]>();
    for (const member of staff) {
      const dept = member.department || "GENERAL";
      if (!groups.has(dept)) groups.set(dept, []);
      groups.get(dept)!.push(member);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [staff]);

  return (
    <div className="space-y-6">
      {byDepartment.map(([department, members]) => (
        <div key={department}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{department}</h3>
            <span className="text-xs text-muted-foreground">{members.length} hired</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map((member) => (
              <HiredStaffCard key={member.id} staff={member} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
