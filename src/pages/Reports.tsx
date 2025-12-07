import ReportingCenter from "@/components/admin/ReportingCenter";

export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Reports</h1>
        <p className="text-muted-foreground">View and export comprehensive reports across all modules</p>
      </div>
      
      <ReportingCenter />
    </div>
  );
}
