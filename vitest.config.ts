import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: [
      "src/lib/__tests__/enrollmentWeekCalendar.test.ts",
      "src/lib/__tests__/transportCamperBusRun.test.ts",
      "src/lib/__tests__/transportBusCheckins.test.ts",
      "src/lib/__tests__/transportWeekView.test.ts",
      "src/lib/__tests__/transport*.test.ts",
      "src/lib/__tests__/swimProgress*.test.ts",
      "src/lib/__tests__/swimProgram.test.ts",
      "src/lib/__tests__/swimGroupFormation.test.ts",
      "src/lib/__tests__/swimLessonCalendar.test.ts",
      "src/lib/__tests__/swimLessonInstructors.test.ts",
      "src/lib/__tests__/swimBraceletReportPdf.test.ts",
      "src/lib/__tests__/divisionFilterUtils.test.ts",
      "src/lib/__tests__/groupSchedule.test.ts",
      "src/lib/__tests__/audienceMessaging.test.ts",
      "src/lib/__tests__/messageInboxFilters.test.ts",
      "src/lib/__tests__/operationsDashboard.test.ts",
      "src/lib/__tests__/parentReminderLayout.test.ts",
    ],
  },
});
