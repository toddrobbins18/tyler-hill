import { Card } from "@/components/ui/card";
import { StaffMember, DepartmentStats } from "@/types/staff";
import { Users, UserCheck, UserPlus } from "lucide-react";

interface HiringStatsProps {
  staff: StaffMember[];
}

export function HiringStats({ staff }: HiringStatsProps) {
  const totalPositions = staff.length;
  const hiredCount = staff.filter((s) => s.status === "hired").length;
  const toHireCount = staff.filter((s) => s.status === "to-hire").length;
  const interviewingCount = staff.filter((s) => s.status === "interviewing").length;

  const totalBudget = staff.reduce((sum, s) => sum + s.netBudget, 0);
  const usedBudget = staff
    .filter((s) => s.status === "hired")
    .reduce((sum, s) => sum + s.netBudget, 0);

  const departments = Array.from(new Set(staff.map((s) => s.department)));
  const departmentStats: DepartmentStats[] = departments.map((dept) => {
    const deptStaff = staff.filter((s) => s.department === dept);
    return {
      name: dept,
      totalPositions: deptStaff.length,
      filled: deptStaff.filter((s) => s.status === "hired").length,
      toHire: deptStaff.filter((s) => s.status === "to-hire").length,
      budgetTotal: deptStaff.reduce((sum, s) => sum + s.netBudget, 0),
      budgetUsed: deptStaff
        .filter((s) => s.status === "hired")
        .reduce((sum, s) => sum + s.netBudget, 0),
    };
  });

  const stats = [
    { title: "Total Positions", value: totalPositions, icon: Users, color: "text-foreground" },
    { title: "Hired", value: hiredCount, icon: UserCheck, color: "text-success" },
    { title: "To Hire", value: toHireCount, icon: UserPlus, color: "text-primary" },
    { title: "In Progress", value: interviewingCount, icon: Users, color: "text-warning" },
  ];

  const budgetPct = totalBudget > 0 ? (usedBudget / totalBudget) * 100 : 0;

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

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Budget Overview</h3>
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total Budget</span>
            <span className="font-semibold">${totalBudget.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Committed</span>
            <span className="font-semibold text-success">${usedBudget.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Available</span>
            <span className="font-semibold text-primary">
              ${(totalBudget - usedBudget).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-success to-secondary transition-all duration-500"
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          {budgetPct.toFixed(1)}% of budget committed
        </p>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Department Breakdown</h3>
        <div className="space-y-3">
          {departmentStats.map((dept) => (
            <div key={dept.name} className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-medium text-xs text-foreground">{dept.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {dept.filled}/{dept.totalPositions} filled
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-success transition-all duration-500"
                    style={{
                      width: `${
                        dept.totalPositions > 0
                          ? (dept.filled / dept.totalPositions) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-[11px] font-medium min-w-12 text-right text-foreground">
                  ${(dept.budgetUsed / 1000).toFixed(0)}k
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
