import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  areaLabel,
  formatMinutes12,
  parseClockToMinutes,
  rotationWeekFromLocation,
  scheduleGroupName,
  scheduleRotationWeek,
  slotsAtTime,
  type GroupScheduleSlot,
} from "@/lib/groupSchedule";
import { readScheduleFile, scanGroupScheduleSheets } from "@/lib/groupScheduleScan";

function slot(partial: Omit<GroupScheduleSlot, "id" | "uploadId"> & { id?: string }): GroupScheduleSlot {
  return {
    id: partial.id ?? "1",
    uploadId: "upload",
    ...partial,
  };
}

describe("group schedule clock parsing", () => {
  it("reads camp morning and afternoon times", () => {
    expect(parseClockToMinutes("9:00 AM")).toBe(9 * 60);
    expect(parseClockToMinutes("1:15")).toBe(13 * 60 + 15);
    expect(parseClockToMinutes("13:00")).toBe(13 * 60);
    expect(parseClockToMinutes("12:00")).toBe(12 * 60);
    expect(parseClockToMinutes("10")).toBe(10 * 60);
    expect(formatMinutes12(13 * 60 + 15)).toBe("1:15 PM");
  });
});

describe("group schedule scan", () => {
  it("reads a period list", () => {
    const { slots, warnings } = scanGroupScheduleSheets([
      {
        name: "Weekly",
        rows: [
          ["Group", "Day", "Start", "End", "Activity", "Location"],
          ["Dolphins", "Monday", "9:00 AM", "9:45 AM", "Swim", "Pool"],
          ["Sharks", "Monday", "9:00 AM", "9:45 AM", "Gaga", "Field"],
          ["Dolphins", "Tuesday", "9:00 AM", "9:45 AM", "Arts", "Lodge"],
        ],
      },
    ]);
    expect(warnings).toEqual([]);
    expect(slots).toEqual([
      {
        groupName: "Dolphins",
        dayOfWeek: 1,
        appliesOn: null,
        startMinutes: 9 * 60,
        endMinutes: 9 * 60 + 45,
        activity: "Swim",
        location: "Pool",
      },
      {
        groupName: "Sharks",
        dayOfWeek: 1,
        appliesOn: null,
        startMinutes: 9 * 60,
        endMinutes: 9 * 60 + 45,
        activity: "Gaga",
        location: "Field",
      },
      {
        groupName: "Dolphins",
        dayOfWeek: 2,
        appliesOn: null,
        startMinutes: 9 * 60,
        endMinutes: 9 * 60 + 45,
        activity: "Arts",
        location: "Lodge",
      },
    ]);
  });

  it("reads a North Shore group sheet with a merged title and week sections", () => {
    const span = (label: string) => [label, label, label, label, label, label];
    const { slots, warnings } = scanGroupScheduleSheets([
      {
        name: "Bunnies - SS3",
        rows: [
          span("Bunnies - SS3"),
          span("Week 1"),
          ["Periods", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          ["09:30 AM\n10:00 AM", "Change", "Change", "Change", "Change", "Change"],
          ["09:30 AM\n10:00 AM", "SWIM", "SWIM", "SWIM", "SWIM", "SWIM"],
          span("Week 2"),
          ["Periods", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          ["10:30 AM\n11:00 AM", "TGIM", "Cooking", "Dance", "Music", "Soccer"],
        ],
      },
    ]);
    expect(warnings).toEqual([]);
    expect(slots.find((row) => row.dayOfWeek === 1 && row.activity === "SWIM")).toMatchObject({
      groupName: "Bunnies",
      rotationWeek: 1,
      startMinutes: 9 * 60 + 30,
      endMinutes: 10 * 60,
      location: "",
    });
    expect(slots.find((row) => row.activity === "Cooking")).toMatchObject({
      groupName: "Bunnies",
      rotationWeek: 2,
      dayOfWeek: 2,
      startMinutes: 10 * 60 + 30,
      endMinutes: 11 * 60,
      location: "",
    });
  });

  it("reads one sheet per group with days across the top", () => {
    const { slots } = scanGroupScheduleSheets([
      {
        name: "Dolphins",
        rows: [
          ["", "Monday", "Tuesday"],
          ["9:00-9:45", "Swim", "Arts"],
          ["9:45-10:30", "Gaga", "Swim at Pool"],
        ],
      },
    ]);
    expect(slots.map((row) => [row.dayOfWeek, row.activity, row.location])).toEqual([
      [1, "Swim", ""],
      [2, "Arts", ""],
      [1, "Gaga", ""],
      [2, "Swim", "Pool"],
    ]);
    expect(areaLabel(slots[3])).toBe("Pool");
  });

  it("reads groups across the top for a single day", () => {
    const { slots, warnings } = scanGroupScheduleSheets([
      {
        name: "Monday",
        rows: [
          ["Monday"],
          ["Time", "Dolphins", "Sharks"],
          ["9:00-9:45", "Swim", "Gaga"],
          ["9:45", "Arts", "Swim"],
          ["10:30", "", ""],
        ],
      },
    ]);
    expect(warnings).toEqual([]);
    const dolphins = slots.filter((row) => row.groupName === "Dolphins");
    expect(dolphins.map((row) => [row.startMinutes, row.endMinutes, row.activity])).toEqual([
      [9 * 60, 9 * 60 + 45, "Swim"],
      [9 * 60 + 45, 10 * 60 + 30, "Arts"],
    ]);
    expect(slots.every((row) => row.dayOfWeek === 1)).toBe(true);
  });

  it("reads times across the top and repeats a dayless grid on weekdays", () => {
    const { slots, warnings } = scanGroupScheduleSheets([
      {
        name: "Master",
        rows: [
          ["Group", "9:00-9:45", "9:45-10:30"],
          ["Dolphins", "Swim", "Arts"],
          ["Sharks", "Gaga", "Swim @ Field"],
        ],
      },
    ]);
    expect(warnings).toEqual(["“Master” has no day, so those periods were applied Monday–Friday."]);
    expect(slots.filter((row) => row.groupName === "Sharks" && row.dayOfWeek === 3)).toEqual([
      {
        groupName: "Sharks",
        dayOfWeek: 3,
        appliesOn: null,
        startMinutes: 9 * 60,
        endMinutes: 9 * 60 + 45,
        activity: "Gaga",
        location: "",
      },
      {
        groupName: "Sharks",
        dayOfWeek: 3,
        appliesOn: null,
        startMinutes: 9 * 60 + 45,
        endMinutes: 10 * 60 + 30,
        activity: "Swim",
        location: "Field",
      },
    ]);
  });
});

describe("readScheduleFile", () => {
  it("scans an Excel workbook with one sheet per group", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["", "Monday", "Tuesday"],
      ["9:00-9:45", "Swim", "Arts"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Dolphins");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = new File([buffer], "groups.xlsx");
    const sheets = await readScheduleFile(file);
    const { slots } = scanGroupScheduleSheets(sheets);
    expect(slots.map((row) => [row.groupName, row.dayOfWeek, row.activity])).toEqual([
      ["Dolphins", 1, "Swim"],
      ["Dolphins", 2, "Arts"],
    ]);
  });

  const toddWorkbook = path.resolve(__dirname, "../../../../2026 Group Schedules.xlsx");
  it.skipIf(!fs.existsSync(toddWorkbook))("reads the 2026 group workbook", async () => {
    const bytes = fs.readFileSync(toddWorkbook);
    const file = new File([bytes], "2026 Group Schedules.xlsx");
    const sheets = await readScheduleFile(file);
    const { slots, warnings } = scanGroupScheduleSheets(sheets);
    expect(warnings.filter((warning) => warning.includes("no day"))).toEqual([]);
    const bunniesMonday = slots.filter(
      (row) => row.groupName === "Bunnies" && row.dayOfWeek === 1 && row.activity === "SWIM",
    );
    expect(bunniesMonday.length).toBeGreaterThan(0);
    expect(bunniesMonday.every((row) => row.startMinutes < row.endMinutes)).toBe(true);
    expect(bunniesMonday.some((row) => row.rotationWeek === 1)).toBe(true);
    expect(slots.every((row) => !/\s-\s/.test(row.groupName) && !/\bcrew\b/i.test(row.groupName))).toBe(true);
    expect(slots.length).toBeGreaterThan(1000);
  }, 30000);

  it.skipIf(!fs.existsSync(toddWorkbook))("finds groups on a camp Tuesday at 10:30", async () => {
    const bytes = fs.readFileSync(toddWorkbook);
    const file = new File([bytes], "2026 Group Schedules.xlsx");
    const sheets = await readScheduleFile(file);
    const { slots } = scanGroupScheduleSheets(sheets);
    const ymd = "2026-07-07";
    const minutes = 10 * 60 + 30;
    const at = slotsAtTime(
      slots.map((row, index) => ({ ...row, id: String(index), uploadId: "u" })),
      ymd,
      minutes,
      1,
    );
    expect(at.length).toBeGreaterThan(0);
  }, 30000);

  it.skipIf(!fs.existsSync(toddWorkbook))("still finds Tuesday slots when only the first 1000 periods are loaded", async () => {
    const bytes = fs.readFileSync(toddWorkbook);
    const file = new File([bytes], "2026 Group Schedules.xlsx");
    const { slots } = scanGroupScheduleSheets(await readScheduleFile(file));
    const capped = slots.slice(0, 1000);
    const at = slotsAtTime(
      capped.map((row, index) => ({ ...row, id: String(index), uploadId: "u" })),
      "2026-07-07",
      10 * 60 + 30,
      1,
    );
    expect(at.length).toBeGreaterThan(0);
  }, 30000);

  it.skipIf(!fs.existsSync(toddWorkbook))("loads Todd-style DB rows with Week 1/2 in location", async () => {
    const bytes = fs.readFileSync(toddWorkbook);
    const { slots } = scanGroupScheduleSheets(await readScheduleFile(new File([bytes], "x.xlsx")));
    const { groupScheduleSlotFromRow, activeScheduleRotationWeek } = await import("@/lib/groupSchedule");
    const loaded = slots.slice(0, 1000).map((row, index) => {
      const loc =
        row.rotationWeek === 1 || row.rotationWeek === 2 ? `Week ${row.rotationWeek}` : row.location;
      return groupScheduleSlotFromRow({
        id: String(index),
        upload_id: "u",
        group_name: `${row.groupName} - SS3`,
        day_of_week: row.dayOfWeek,
        applies_on: row.appliesOn,
        start_time: `${String(Math.floor(row.startMinutes / 60)).padStart(2, "0")}:${String(row.startMinutes % 60).padStart(2, "0")}:00`,
        end_time: `${String(Math.floor(row.endMinutes / 60)).padStart(2, "0")}:${String(row.endMinutes % 60).padStart(2, "0")}:00`,
        activity: row.activity,
        location: loc,
      });
    });
    const rotation = activeScheduleRotationWeek(loaded, 3);
    const at = slotsAtTime(loaded, "2026-07-07", 10 * 60 + 30, rotation);
    expect(at.length).toBeGreaterThan(0);
  }, 30000);
});

describe("slotsAtTime", () => {
  const weekly: GroupScheduleSlot[] = [
    slot({
      id: "weekly",
      groupName: "Dolphins",
      dayOfWeek: 1,
      appliesOn: null,
      startMinutes: 9 * 60,
      endMinutes: 9 * 60 + 45,
      activity: "Swim",
      location: "Pool",
    }),
    slot({
      id: "next",
      groupName: "Dolphins",
      dayOfWeek: 1,
      appliesOn: null,
      startMinutes: 9 * 60 + 45,
      endMinutes: 10 * 60 + 30,
      activity: "Arts",
      location: "Lodge",
    }),
    slot({
      id: "sharks",
      groupName: "Sharks",
      dayOfWeek: 1,
      appliesOn: null,
      startMinutes: 9 * 60,
      endMinutes: 9 * 60 + 45,
      activity: "Gaga",
      location: "Field",
    }),
  ];

  it("finds the group and the area at a clock time", () => {
    const at = slotsAtTime(weekly, "2026-07-06", 9 * 60 + 15);
    expect(at.map((row) => row.groupName)).toEqual(["Dolphins", "Sharks"]);
    expect(at.find((row) => row.groupName === "Dolphins")?.location).toBe("Pool");
  });

  it("treats the end time as the next period", () => {
    const at = slotsAtTime(weekly, "2026-07-06", 9 * 60 + 45);
    expect(at.map((row) => row.activity)).toEqual(["Arts"]);
  });

  it("lets a one-day upload replace the weekly period for that group", () => {
    const at = slotsAtTime(
      [
        ...weekly,
        slot({
          id: "rain",
          groupName: "Dolphins",
          dayOfWeek: 1,
          appliesOn: "2026-07-06",
          startMinutes: 9 * 60,
          endMinutes: 9 * 60 + 45,
          activity: "Gym",
          location: "Gym",
        }),
      ],
      "2026-07-06",
      9 * 60 + 10,
    );
    expect(at.find((row) => row.groupName === "Dolphins")?.activity).toBe("Gym");
    expect(at.find((row) => row.groupName === "Sharks")?.activity).toBe("Gaga");
  });

  it("uses schedule week 1 on odd camp weeks and week 2 on even weeks", () => {
    const rows = [
      slot({
        groupName: "Bunnies - SS3",
        dayOfWeek: 1,
        appliesOn: null,
        startMinutes: 10 * 60 + 30,
        endMinutes: 11 * 60,
        activity: "TGIM",
        location: "Week 1",
      }),
      slot({
        id: "cook",
        groupName: "Bunnies",
        dayOfWeek: 1,
        appliesOn: null,
        startMinutes: 10 * 60 + 30,
        endMinutes: 11 * 60,
        activity: "Cooking",
        location: "Week 2",
      }),
    ];
    expect(scheduleRotationWeek(1)).toBe(1);
    expect(scheduleRotationWeek(2)).toBe(2);
    expect(scheduleRotationWeek(3)).toBe(1);
    expect(scheduleRotationWeek(8)).toBe(2);
    expect(slotsAtTime(rows, "2026-07-06", 10 * 60 + 45, 1).map((row) => row.activity)).toEqual(["TGIM"]);
    expect(slotsAtTime(rows, "2026-07-06", 10 * 60 + 45, 2).map((row) => row.activity)).toEqual(["Cooking"]);
    expect(areaLabel(rows[0])).toBe("TGIM");
  });
});

describe("scheduleGroupName", () => {
  it("drops the sheet suffix so the roster name matches", () => {
    expect(scheduleGroupName("Bunnies - SS3")).toBe("Bunnies");
    expect(scheduleGroupName("Dublin- G1")).toBe("Dublin");
    expect(scheduleGroupName("Honolulu CREW GIRLS")).toBe("Honolulu");
    expect(scheduleGroupName("Everest - CREW Boys")).toBe("Everest");
  });
});
