import { Card } from "@/components/ui/card";
import { StaffMember, DepartmentStats } from "@/types/staff";
import { Users, Building2 } from "lucide-react";

interface HiringStatsProps {
  staff: StaffMember[];
}

export function HiringStats({ staff }: HiringStatsProps) {
  const hiredCount = staff.length;
  const totalBudget = staff.reduce((sum, s) => sum + s.netBudget, 0);

  const departments = Array.from(new Set(staff.map((s) => s.department)));
  const departmentStats: DepartmentStats[] = departments.map((dept) => {
    const deptStaff = staff.filter((s) => s.department === dept);
    return {
      name: dept,
      totalPositions: deptStaff.length,
      filled: deptStaff.length,
      toHire: 0,
      budgetTotal: deptStaff.reduce((sum, s) => sum + s.netBudget, 0),
      budgetUsed: deptStaff.reduce((sum, s) => sum + s.netBudget, 0),
    };
  });

  const stats = [
    { title: "Hired Staff", value: hiredCount, icon: Users, color: "text-success" },
    { title: "Departments", value: departments.length, icon: Building2, color: "text-primary" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {totalBudget > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Budget Overview</h3>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total on roster</span>
            <span className="font-semibold">${totalBudget.toLocaleString()}</span>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">By Department</h3>
        <div className="space-y-3">
          {departmentStats.map((dept) => (
            <div key={dept.name} className="flex justify-between items-center text-xs">
              <span className="font-medium text-foreground">{dept.name}</span>
              <span className="text-muted-foreground">{dept.filled} hired</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
