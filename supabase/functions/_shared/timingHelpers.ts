/**
 * Calculate send time for scheduled notifications based on timing type
 */
export function calculateSendTime(
  eventDate: string,
  eventTime: string | null,
  timing: string
): string {
  const date = new Date(eventDate + 'T00:00:00Z');

  switch (timing) {
    case 'day_before':
      date.setUTCDate(date.getUTCDate() - 1);
      date.setUTCHours(18, 0, 0, 0); // 6 PM UTC day before
      break;

    case 'morning_of':
      date.setUTCHours(12, 0, 0, 0); // 8 AM EST = 12 PM UTC
      break;

    case '2_hours_before':
      if (eventTime) {
        const [hours, minutes] = eventTime.split(':').map(Number);
        date.setUTCHours(hours + 4, minutes, 0, 0); // Convert EST to UTC
        date.setUTCHours(date.getUTCHours() - 2); // 2 hours before
      } else {
        date.setUTCHours(14, 0, 0, 0); // Default to 10 AM EST if no time
      }
      break;

    case '4_hours_before':
      if (eventTime) {
        const [hours, minutes] = eventTime.split(':').map(Number);
        date.setUTCHours(hours + 4, minutes, 0, 0); // Convert EST to UTC
        date.setUTCHours(date.getUTCHours() - 4); // 4 hours before
      } else {
        date.setUTCHours(12, 0, 0, 0); // Default to 8 AM EST if no time
      }
      break;

    case '1_week_before':
      date.setUTCDate(date.getUTCDate() - 7);
      date.setUTCHours(18, 0, 0, 0); // 6 PM UTC week before
      break;

    default:
      date.setUTCHours(12, 0, 0, 0); // Default to noon UTC
  }

  return date.toISOString();
}

/**
 * Build subject line based on timing type
 */
export function buildTimingSubject(
  baseTitle: string,
  timing: string,
  action?: string
): string {
  switch (timing) {
    case 'day_before':
      return `📅 Reminder: Tomorrow's ${baseTitle}`;
    case 'morning_of':
      return `🌅 Today's Event: ${baseTitle}`;
    case '2_hours_before':
      return `⏰ Starting Soon: ${baseTitle}`;
    case '4_hours_before':
      return `⏰ Upcoming: ${baseTitle}`;
    case '1_week_before':
      return `📆 Next Week: ${baseTitle}`;
    case 'on_create':
      return action === 'created' ? `New: ${baseTitle}` : `Created: ${baseTitle}`;
    case 'on_update':
      return `Updated: ${baseTitle}`;
    default:
      return baseTitle;
  }
}

/**
 * Add timing-specific context to email content
 */
export function addTimingContext(content: string, timing: string): string {
  let prefix = '';

  switch (timing) {
    case 'day_before':
      prefix = '📅 **REMINDER: This event is tomorrow.**\n\n';
      break;
    case 'morning_of':
      prefix = '🌅 **TODAY\'S EVENT**\n\n';
      break;
    case '2_hours_before':
      prefix = '⏰ **STARTING IN 2 HOURS**\n\n';
      break;
    case '4_hours_before':
      prefix = '⏰ **STARTING IN 4 HOURS**\n\n';
      break;
    case '1_week_before':
      prefix = '📆 **UPCOMING NEXT WEEK**\n\n';
      break;
  }

  return prefix + content;
}
