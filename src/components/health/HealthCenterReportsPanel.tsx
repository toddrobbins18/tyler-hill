import ReportingCenter from "@/components/admin/ReportingCenter";

const HEALTH_CENTER_REPORT_TYPES = [
  "as_needed_medications",
  "medications",
  "allergies",
] as const;

export default function HealthCenterReportsPanel() {
  return (
    <ReportingCenter
      embedded
      defaultReportType="as_needed_medications"
      allowedReportTypes={[...HEALTH_CENTER_REPORT_TYPES]}
    />
  );
}
