import { TIME_CONFIG } from './constants';

/**
 * Get Paris time from UTC timestamp
 */
export function getParisTimeFromUTC(utcTimestamp: number): Date {
  const utcDate = new Date(utcTimestamp);
  return new Date(utcDate.toLocaleString("en-US", { timeZone: TIME_CONFIG.TIMEZONE }));
}

/**
 * Get current time in Paris timezone
 */
export function getCurrentParisTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TIME_CONFIG.TIMEZONE }));
}

/**
 * Format date for display (DD/MM à HH:MM) - ensuring Paris timezone
 */
export function formatTaskDate(timestamp: string | number): string {
  if (!timestamp) return '';
  
  let date: Date;
  if (typeof timestamp === 'string') {
    // Parse string timestamp and convert to Paris time
    const utcDate = new Date(timestamp);
    date = new Date(utcDate.toLocaleString("en-US", { timeZone: TIME_CONFIG.TIMEZONE }));
  } else {
    // Convert UTC timestamp to Paris time
    date = getParisTimeFromUTC(timestamp);
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month} à ${hours}:${minutes}`;
}

/**
 * Get French weekday abbreviation
 */
export function getFrenchWeekday(dateString: string): string {
  if (!dateString) return "";
  
  const [datePart] = dateString.split(' à ');
  if (!datePart) return "";
  
  const [day, month] = datePart.split('/');
  const currentYear = new Date().getFullYear();
  
  // Create date in Paris timezone
  const date = new Date(currentYear, parseInt(month) - 1, parseInt(day));
  
  const weekdays = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  return weekdays[date.getDay()];
}

/**
 * Parse date string to Date object (handles "DD/MM à HH:MM" format) - in Paris timezone
 */
export function parseTaskDate(dateString: string): Date {
  const [datePart, timePart] = dateString.split(' à ');
  const [day, month] = datePart.split('/');
  const [hours, minutes] = timePart.split(':');
  const currentYear = new Date().getFullYear();
  
  // Create date in Paris timezone
  const parisDate = new Date();
  parisDate.setFullYear(currentYear, parseInt(month) - 1, parseInt(day));
  parisDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  return parisDate;
}

/**
 * Get start and end of day in Paris timezone
 */
export function getParisTimeRange(): { startTimestamp: number; endTimestamp: number } {
  const nowParis = getCurrentParisTime();
  const startOfDayParis = new Date(nowParis.getFullYear(), nowParis.getMonth(), nowParis.getDate());
  const endOfDayParis = new Date(nowParis.getFullYear(), nowParis.getMonth(), nowParis.getDate() + 1);
  
  // Convert Paris times to UTC timestamps for HubSpot API
  const startTimestamp = new Date(startOfDayParis.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const endTimestamp = new Date(endOfDayParis.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  
  return { startTimestamp, endTimestamp };
}

/**
 * Get timestamp for "X minutes from now" in Paris timezone
 */
export function getParisTimeAdvanced(minutes: number): number {
  const nowParis = getCurrentParisTime();
  const advancedTime = new Date(nowParis.getTime() + (minutes * 60 * 1000));
  const advancedTimeUTC = new Date(advancedTime.toLocaleString("en-US", { timeZone: "UTC" }));
  
  return advancedTimeUTC.getTime();
}

/**
 * Check if a task is overdue (for Paris timezone)
 */
export function isTaskOverdue(dueDate: string): boolean {
  if (!dueDate) return false;
  
  try {
    const taskDate = parseTaskDate(dueDate);
    const currentParisTime = getCurrentParisTime();
    return taskDate < currentParisTime;
  } catch (error) {
    console.error('Error checking if task is overdue:', error);
    return false;
  }
}
