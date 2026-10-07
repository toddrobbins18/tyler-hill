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
      "src/lib/__tests__/transport*.test.ts",
      "src/lib/__tests__/swimProgress*.test.ts",
      "src/lib/__tests__/operationsDashboard.test.ts",
    ],
  },
});
