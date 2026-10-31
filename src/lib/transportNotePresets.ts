/** Quick-fill text for transport exception forms and PT notes (Phase 2.3). */

export const TRANSPORT_PICKUP_NOTE_PRESETS = [
  "Parent picking up at camp",
  "Early pickup — office notified",
  "Alternate guardian pickup",
  "Grandparent pickup today",
  "Late stay — not on PM bus",
  "Swim lesson — no PM bus",
] as const;

export const TRANSPORT_ABSENCE_REASON_PRESETS = [
  "Sick — not attending today",
  "Doctor appointment",
  "Family travel",
  "Not coming AM",
  "Leaving early — PM absence",
] as const;

export const TRANSPORT_NURSE_REASON_PRESETS = [
  "Sent home — not feeling well",
  "Fever — parent notified",
  "Injury — parent picking up",
  "Nurse sent home — no PM bus",
] as const;

export const PARENT_TRANSPORT_NOTE_PRESETS = [
  "Parent transport all season",
  "Grandparent pickup Wed only",
  "No AM bus — drop off at camp",
  "No PM bus — parent pickup",
  "Alternate pickup contact on file",
] as const;

/** Most-used swim test notes — full list remains in SWIM_TEST_NOTE_OPTIONS. */
export const SWIM_TEST_NOTE_QUICK_PRESETS = [
  "PASSED",
  "Refused",
  "Needed Assist",
  "No Backfloat",
  "Backfloat form needs work",
  "Tread needs endurance",
] as const;
