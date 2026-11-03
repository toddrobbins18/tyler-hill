import * as XLSX from "xlsx";
import { parseCsvDocument } from "@/lib/csvLine";
import {
  type GroupScheduleDraft,
  dayOfWeekFromYmd,
  parseClockToMinutes,
  parseTimeRange,
  scheduleGroupName,
} from "@/lib/groupSchedule";

export type ScheduleSheet = {
  name: string;
  rows: string[][];
};

export type GroupScheduleScan = {
  slots: GroupScheduleDraft[];
  warnings: string[];
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  weds: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const HEADER_ALIASES: Record<string, string[]> = {
  group: ["group", "group name", "bunk", "bunk name"],
  day: ["day", "weekday", "day of week"],
  date: ["date", "schedule date"],
  start: ["start", "start time", "from", "begins"],
  end: ["end", "end time", "to", "ends"],
  time: ["time", "time block", "period time", "block"],
  activity: ["activity", "program", "class", "sport", "what"],
  location: ["location", "area", "place", "where", "activity area"],
};

const GENERIC_SHEET = /^(sheet\s*\d+|schedule|weekly|weekly schedule|week\s*\d+)$/i;

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\./g, "");
}

function weekdayFromLabel(value: string): number | null {
  const key = norm(value);
  return key in WEEKDAYS ? WEEKDAYS[key] : null;
}

function aliasKind(value: string): string | null {
  const key = norm(value);
  for (const [kind, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(key)) return kind;
  }
  return null;
}

function parseDateCell(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!slash) return null;
  return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
}

function isLikelyGroupHeader(value: string): boolean {
  const text = value.trim();
  if (text.length < 2) return false;
  if (weekdayFromLabel(text) != null) return false;
  if (aliasKind(text)) return false;
  if (parseTimeRange(text) || parseClockToMinutes(text) != null) return false;
  if (parseDateCell(text)) return false;
  if (/^(week|schedule|period|notes|staff|counselor|activity|location|area)\b/i.test(text)) return false;
  if (/^\d+$/.test(text)) return false;
  return true;
}

function isGenericSheetName(name: string): boolean {
  return GENERIC_SHEET.test(name.trim());
}

type ClockCell = { start: number; end: number | null };

function readClockCell(value: string): ClockCell | null {
  const text = value.replace(/\r\n/g, "\n").trim();
  const range = parseTimeRange(text);
  if (range) return { start: range.start, end: range.end };
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    const start = parseClockToMinutes(lines[0] ?? "");
    const end = parseClockToMinutes(lines[1] ?? "");
    if (start != null && end != null && end > start) return { start, end };
  }
  const start = parseClockToMinutes(text);
  if (start == null) return null;
  return { start, end: null };
}

function fillOpenEnds(blocks: ClockCell[]): { start: number; end: number }[] {
  return blocks.map((block, index) => {
    if (block.end != null) return { start: block.start, end: block.end };
    const next = blocks[index + 1];
    if (next && next.start > block.start) return { start: block.start, end: next.start };
    return { start: block.start, end: block.start + 45 };
  });
}

function splitActivity(cell: string): { activity: string; location: string } | null {
  const text = cell.trim();
  if (!text || text === "-" || text === "—" || text === "–" || /^n\/?a$/i.test(text)) return null;
  const parts = text.split(/\s+@\s+|\s+at\s+/i);
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    return { activity: parts[0].trim(), location: parts[1].trim() };
  }
  return { activity: text, location: "" };
}

function groupFromContext(sheetName: string, rowsAbove: string[][]): string | null {
  for (const row of rowsAbove) {
    for (let index = 0; index < row.length - 1; index++) {
      const key = norm(row[index] ?? "");
      if (key === "group" || key === "group name" || key === "bunk") {
        const value = row[index + 1]?.trim();
        if (value) return value;
      }
    }
  }

  const candidates = rowsAbove
    .flat()
    .map((cell) => cell.trim())
    .filter((cell) => isLikelyGroupHeader(cell) && !/^weekly schedule$/i.test(cell));
  if (candidates.length === 1) return candidates[0];
  if (!isGenericSheetName(sheetName) && sheetName.trim()) return sheetName.trim();
  return null;
}

function dayContext(rowsAbove: string[][]): { dayOfWeek: number | null; appliesOn: string | null } {
  for (const row of rowsAbove) {
    for (const cell of row) {
      const date = parseDateCell(cell);
      if (date) return { dayOfWeek: dayOfWeekFromYmd(date), appliesOn: date };
      const day = weekdayFromLabel(cell);
      if (day != null) return { dayOfWeek: day, appliesOn: null };
    }
  }
  return { dayOfWeek: null, appliesOn: null };
}

function isListHeader(row: string[]): boolean {
  const kinds = new Set(row.map(aliasKind).filter((kind): kind is string => kind != null));
  const hasGroup = kinds.has("group");
  const hasActivity = kinds.has("activity") || kinds.has("location");
  const hasWhen = kinds.has("time") || kinds.has("start");
  return hasGroup && hasActivity && hasWhen;
}

function headerKind(row: string[]): "list" | "days" | "times" | "groups" | null {
  const filled = row.map((cell) => cell.trim()).filter(Boolean);
  if (filled.length < 2) return null;
  if (isListHeader(row)) return "list";
  if (row.filter((cell) => weekdayFromLabel(cell) != null).length >= 2) return "days";
  // A merged title such as "Bunnies - SS3" is copied into every column. That is not a group grid.
  if (new Set(filled.map((cell) => norm(cell))).size === 1) return null;
  if (row.filter((cell) => readClockCell(cell) != null).length >= 2) return "times";
  if (row.filter((cell) => isLikelyGroupHeader(cell)).length >= 2) return "groups";
  return null;
}

function weekLabelAbove(rows: string[][], headerIndex: number): string | null {
  for (let index = headerIndex - 1; index >= 0; index--) {
    const label = (rows[index] ?? []).map((cell) => cell.trim()).find((cell) => /^week\s+\d+\b/i.test(cell));
    if (label) return label.replace(/\s+/g, " ");
    if ((rows[index] ?? []).some((cell) => weekdayFromLabel(cell) != null)) break;
  }
  return null;
}

function pushSlot(
  slots: GroupScheduleDraft[],
  slot: GroupScheduleDraft,
) {
  const normalized = { ...slot, groupName: scheduleGroupName(slot.groupName) };
  if (slots.some((existing) => slotKey(existing) === slotKey(normalized))) return;
  slots.push(normalized);
}

function slotKey(slot: GroupScheduleDraft): string {
  return [
    scheduleGroupName(slot.groupName).toLowerCase(),
    slot.dayOfWeek ?? "",
    slot.appliesOn ?? "",
    slot.rotationWeek ?? "",
    slot.startMinutes,
    slot.endMinutes,
    slot.activity.trim().toLowerCase(),
    slot.location.trim().toLowerCase(),
  ].join("|");
}

function parseList(rows: string[][], headerIndex: number, warnings: string[], sheetName: string) {
  const header = rows[headerIndex];
  const columns = new Map<string, number>();
  header.forEach((cell, index) => {
    const kind = aliasKind(cell);
    if (kind && !columns.has(kind)) columns.set(kind, index);
  });

  const cell = (row: string[], kind: string) => {
    const index = columns.get(kind);
    return index == null ? "" : (row[index] ?? "").trim();
  };

  const slots: GroupScheduleDraft[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (row.every((value) => !value.trim())) continue;
    const groupName = cell(row, "group");
    const activityCell = cell(row, "activity");
    const locationCell = cell(row, "location");
    const parsedActivity = splitActivity(activityCell);
    const activity = parsedActivity?.activity || "";
    const location = locationCell || parsedActivity?.location || "";
    if (!groupName || (!activity && !location)) continue;

    const date = parseDateCell(cell(row, "date"));
    const dayLabel = cell(row, "day");
    const dayFromLabel = dayLabel ? weekdayFromLabel(dayLabel) : null;
    const appliesOn = date;
    const dayOfWeek = date ? dayOfWeekFromYmd(date) : dayFromLabel;

    const range = readClockCell(cell(row, "time"));
    const start = parseClockToMinutes(cell(row, "start"));
    const end = parseClockToMinutes(cell(row, "end"));
    let startMinutes = range?.start ?? start;
    let endMinutes = range?.end ?? (end != null ? end : null);
    if (startMinutes == null) {
      warnings.push(`${sheetName} row ${rowIndex + 1}: skipped ${groupName} because the time could not be read.`);
      continue;
    }
    if (endMinutes == null) endMinutes = startMinutes + 45;
    if (endMinutes <= startMinutes) {
      warnings.push(`${sheetName} row ${rowIndex + 1}: skipped ${groupName} because the end time is not after the start.`);
      continue;
    }
    if (dayOfWeek == null && !appliesOn) {
      warnings.push(`${sheetName} row ${rowIndex + 1}: skipped ${groupName} because the day could not be read.`);
      continue;
    }

    pushSlot(slots, {
      groupName,
      dayOfWeek,
      appliesOn,
      startMinutes,
      endMinutes,
      activity: activity || location,
      location,
    });
  }
  return slots;
}

function parseDayGrid(
  sheetName: string,
  rows: string[][],
  headerIndex: number,
  warnings: string[],
  untilRow = rows.length,
  weekLabel: string | null = null,
) {
  const header = rows[headerIndex];
  const dayCols = header
    .map((cell, col) => ({ col, day: weekdayFromLabel(cell) }))
    .filter((entry): entry is { col: number; day: number } => entry.day != null);
  const groupName = groupFromContext(sheetName, rows.slice(0, headerIndex));
  if (!groupName) {
    warnings.push(
      `“${sheetName}” has days across the top but no group name. Rename the sheet to the group, or put the group name above the grid.`,
    );
    return [];
  }

  const dayColSet = new Set(dayCols.map((entry) => entry.col));
  const timedRows: { rowIndex: number; clock: ClockCell }[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < untilRow; rowIndex++) {
    const row = rows[rowIndex];
    const timeCell = row.find((value, col) => !dayColSet.has(col) && readClockCell(value));
    const clock = timeCell ? readClockCell(timeCell) : null;
    if (clock) timedRows.push({ rowIndex, clock });
  }
  const ranges = fillOpenEnds(timedRows.map((entry) => entry.clock));
  const slots: GroupScheduleDraft[] = [];
  timedRows.forEach((entry, index) => {
    const range = ranges[index];
    for (const dayCol of dayCols) {
      const activity = splitActivity(rows[entry.rowIndex]?.[dayCol.col] ?? "");
      if (!activity) continue;
      const weekNumber = /^week\s*2\b/i.test(weekLabel ?? "") ? 2 : weekLabel ? 1 : null;
      pushSlot(slots, {
        groupName,
        dayOfWeek: dayCol.day,
        appliesOn: null,
        rotationWeek: weekNumber,
        startMinutes: range.start,
        endMinutes: range.end,
        activity: activity.activity,
        location: activity.location,
      });
    }
  });
  if (slots.length === 0) {
    warnings.push(`“${sheetName}” looked like a weekly grid but no activity cells were found.`);
  }
  return slots;
}

function parseTimeColumns(sheetName: string, rows: string[][], headerIndex: number, warnings: string[]) {
  const header = rows[headerIndex];
  const timeCols = header
    .map((cell, col) => ({ col, clock: readClockCell(cell) }))
    .filter((entry): entry is { col: number; clock: ClockCell } => entry.clock != null && entry.col > 0);
  const ranges = fillOpenEnds(timeCols.map((entry) => entry.clock));
  const context = dayContext(rows.slice(0, headerIndex));
  const days = context.dayOfWeek == null ? [1, 2, 3, 4, 5] : [context.dayOfWeek];
  if (context.dayOfWeek == null) {
    warnings.push(`“${sheetName}” has no day, so those periods were applied Monday–Friday.`);
  }

  const slots: GroupScheduleDraft[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const groupName = (row[0] ?? "").trim();
    if (!isLikelyGroupHeader(groupName)) continue;
    timeCols.forEach((entry, index) => {
      const activity = splitActivity(row[entry.col] ?? "");
      if (!activity) return;
      const range = ranges[index];
      for (const dayOfWeek of days) {
        pushSlot(slots, {
          groupName,
          dayOfWeek: context.appliesOn ? dayOfWeekFromYmd(context.appliesOn) : dayOfWeek,
          appliesOn: context.appliesOn,
          startMinutes: range.start,
          endMinutes: range.end,
          activity: activity.activity,
          location: activity.location,
        });
      }
    });
  }
  return slots;
}

function parseGroupColumns(sheetName: string, rows: string[][], headerIndex: number, warnings: string[]) {
  const header = rows[headerIndex];
  const groupCols = header
    .map((cell, col) => ({ col, name: cell.trim() }))
    .filter((entry) => entry.col > 0 && isLikelyGroupHeader(entry.name));
  const context = dayContext(rows.slice(0, headerIndex));
  const days = context.dayOfWeek == null ? [1, 2, 3, 4, 5] : [context.dayOfWeek];
  if (context.dayOfWeek == null) {
    warnings.push(`“${sheetName}” has no day, so those periods were applied Monday–Friday.`);
  }

  const timedRows: { rowIndex: number; clock: ClockCell }[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
    const clock = readClockCell(rows[rowIndex]?.[0] ?? "");
    if (clock) timedRows.push({ rowIndex, clock });
  }
  const ranges = fillOpenEnds(timedRows.map((entry) => entry.clock));
  const slots: GroupScheduleDraft[] = [];
  timedRows.forEach((entry, index) => {
    const range = ranges[index];
    for (const groupCol of groupCols) {
      const activity = splitActivity(rows[entry.rowIndex]?.[groupCol.col] ?? "");
      if (!activity) continue;
      for (const dayOfWeek of days) {
        pushSlot(slots, {
          groupName: groupCol.name,
          dayOfWeek: context.appliesOn ? dayOfWeekFromYmd(context.appliesOn) : dayOfWeek,
          appliesOn: context.appliesOn,
          startMinutes: range.start,
          endMinutes: range.end,
          activity: activity.activity,
          location: activity.location,
        });
      }
    }
  });
  return slots;
}

export function scanGroupScheduleSheets(sheets: ScheduleSheet[]): GroupScheduleScan {
  const slots: GroupScheduleDraft[] = [];
  const warnings: string[] = [];

  for (const sheet of sheets) {
    const rows = sheet.rows.map((row) => row.map((cell) => (cell ?? "").trim()));
    const dayHeaders: number[] = [];
    for (let index = 0; index < rows.length; index++) {
      if (headerKind(rows[index] ?? []) === "days") dayHeaders.push(index);
    }
    if (dayHeaders.length > 0) {
      dayHeaders.forEach((headerIndex, section) => {
        const untilRow = dayHeaders[section + 1] ?? rows.length;
        const weekLabel = dayHeaders.length > 1 ? weekLabelAbove(rows, headerIndex) : null;
        for (const slot of parseDayGrid(sheet.name, rows, headerIndex, warnings, untilRow, weekLabel)) {
          pushSlot(slots, slot);
        }
      });
      continue;
    }

    let headerIndex = -1;
    let kind: ReturnType<typeof headerKind> = null;
    const searchLimit = Math.min(rows.length, 15);
    for (let index = 0; index < searchLimit; index++) {
      const found = headerKind(rows[index] ?? []);
      if (found) {
        headerIndex = index;
        kind = found;
        break;
      }
    }
    if (headerIndex < 0 || !kind) {
      if (rows.some((row) => row.some(Boolean))) {
        warnings.push(`“${sheet.name}” was skipped. No schedule table was found.`);
      }
      continue;
    }

    const parsed =
      kind === "list"
        ? parseList(rows, headerIndex, warnings, sheet.name)
        : kind === "days"
          ? parseDayGrid(sheet.name, rows, headerIndex, warnings)
          : kind === "times"
            ? parseTimeColumns(sheet.name, rows, headerIndex, warnings)
            : parseGroupColumns(sheet.name, rows, headerIndex, warnings);
    for (const slot of parsed) pushSlot(slots, slot);
  }

  if (slots.length === 0 && warnings.length === 0) {
    warnings.push("No periods were found. Use the template, a day grid, or a group grid.");
  }

  return { slots, warnings };
}

function matrixFromSheet(sheet: XLSX.WorkSheet): string[][] {
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });
  const rows = matrix.map((row) => (row ?? []).map((cell) => (cell == null ? "" : String(cell).trim())));
  for (const merge of sheet["!merges"] ?? []) {
    const origin = rows[merge.s.r]?.[merge.s.c] ?? "";
    if (!origin) continue;
    for (let rowIndex = merge.s.r; rowIndex <= merge.e.r; rowIndex++) {
      if (!rows[rowIndex]) rows[rowIndex] = [];
      for (let colIndex = merge.s.c; colIndex <= merge.e.c; colIndex++) {
        if (!rows[rowIndex][colIndex]) rows[rowIndex][colIndex] = origin;
      }
    }
  }
  return rows;
}

export async function readScheduleFile(file: File): Promise<ScheduleSheet[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = await file.text();
    return [{ name: file.name.replace(/\.(csv|txt)$/i, ""), rows: parseCsvDocument(text) }];
  }
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    throw new Error("Upload an Excel or CSV schedule (.xlsx, .xls, or .csv).");
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, raw: false });
  return workbook.SheetNames.map((name) => ({
    name,
    rows: matrixFromSheet(workbook.Sheets[name]),
  }));
}
