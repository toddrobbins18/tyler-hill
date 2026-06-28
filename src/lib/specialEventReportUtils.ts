import { formatTime12Hour } from "@/lib/utils";

export function formatSpecialEventTypeLabel(eventType: string): string {
  if (!eventType) return "N/A";

  const labels: Record<string, string> = {
    "special-event": "Special Event",
    "evening-activity": "Evening Activity",
    "rookie-day": "Rookie Day",
    tour: "Tour",
    "divisional-night": "Divisional Night",
    "campus-night": "Campus Night",
    "full-camp": "Full Camp",
    campfire: "Campfire",
    "movie-night": "Movie Night",
    "talent-show": "Talent Show",
    "game-night": "Game Night",
    other: "Other",
  };

  return (
    labels[eventType] ||
    eventType
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

export function formatSpecialEventReportTime(event: {
  start_time?: string | null;
  end_time?: string | null;
  time_slot?: string | null;
}): string {
  if (event.start_time && event.end_time) {
    return `${formatTime12Hour(event.start_time)} – ${formatTime12Hour(event.end_time)}`;
  }
  if (event.start_time) return formatTime12Hour(event.start_time);
  if (event.time_slot?.trim()) return event.time_slot.trim();
  return "TBD";
}
