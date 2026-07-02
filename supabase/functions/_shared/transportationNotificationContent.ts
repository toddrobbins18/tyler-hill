type TripLikeRecord = {
  name?: string | null;
  type?: string | null;
  date?: string | null;
  end_date?: string | null;
  departure_time?: string | null;
  return_time?: string | null;
  destination?: string | null;
  status?: string | null;
  transportation_type?: string | null;
  driver?: string | null;
  chaperone?: string | null;
};

type CalendarRecord = {
  title?: string | null;
  event_date?: string | null;
  end_date?: string | null;
  depart_time?: string | null;
  depart_from_camp?: string | null;
  location?: string | null;
  home_away?: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  name: "Trip name",
  title: "Event name",
  date: "Date",
  event_date: "Date",
  end_date: "End date",
  departure_time: "Departure time",
  depart_time: "Departure time",
  depart_from_camp: "Departure time",
  return_time: "Return time",
  destination: "Location",
  location: "Location",
  status: "Status",
  transportation_type: "Transportation",
  driver: "Driver",
  chaperone: "Chaperone",
};

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return String(value);
}

function collectChanges(
  oldRecord: Record<string, unknown> | null | undefined,
  newRecord: Record<string, unknown>,
  fields: string[],
): string[] {
  if (!oldRecord) return [];

  const changes: string[] = [];
  for (const field of fields) {
    const oldValue = oldRecord[field];
    const newValue = newRecord[field];
    if (oldValue !== newValue && (oldValue != null || newValue != null)) {
      const label = FIELD_LABELS[field] ?? field;
      changes.push(`- **${label}:** ${formatValue(oldValue)} → ${formatValue(newValue)}`);
    }
  }
  return changes;
}

export function buildTransportationNotification(input: {
  type: "INSERT" | "UPDATE";
  source: "trips" | "sports_calendar" | "activities_field_trips";
  record: TripLikeRecord & CalendarRecord;
  old_record?: (TripLikeRecord & CalendarRecord) | null;
}): { subject: string; content: string } {
  const { type, source, record, old_record } = input;
  const eventName = record.name ?? record.title ?? "Scheduled event";

  const sourceLabel =
    source === "sports_calendar"
      ? "Sports Calendar"
      : source === "activities_field_trips"
        ? "Field Trip / Activity"
        : "Transportation";

  if (type === "INSERT") {
    return {
      subject: `New transportation event: ${eventName}`,
      content: [
        `A new ${sourceLabel.toLowerCase()} item was scheduled:`,
        "",
        `**Event:** ${eventName}`,
        `**Date:** ${formatValue(record.date ?? record.event_date)}`,
        `**Departure:** ${formatValue(record.departure_time ?? record.depart_time ?? record.depart_from_camp)}`,
        `**Location:** ${formatValue(record.destination ?? record.location)}`,
        "",
        "Please review the Transportation section.",
      ].join("\n"),
    };
  }

  const watchedFields =
    source === "trips"
      ? ["name", "date", "end_date", "departure_time", "return_time", "destination", "status", "transportation_type", "driver", "chaperone"]
      : ["title", "event_date", "end_date", "depart_time", "depart_from_camp", "location"];

  const changes = collectChanges(
    old_record as Record<string, unknown> | null | undefined,
    record as Record<string, unknown>,
    watchedFields,
  );

  const changeBlock =
    changes.length > 0
      ? ["**What changed:**", ...changes, ""].join("\n")
      : "";

  return {
    subject: `${sourceLabel} updated: ${eventName}`,
    content: [
      `A ${sourceLabel.toLowerCase()} item was updated:`,
      "",
      `**Event:** ${eventName}`,
      `**Date:** ${formatValue(record.date ?? record.event_date)}`,
      `**Departure:** ${formatValue(record.departure_time ?? record.depart_time ?? record.depart_from_camp)}`,
      `**Location:** ${formatValue(record.destination ?? record.location)}`,
      "",
      changeBlock,
      "Please review the updated details in the Transportation section.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
