
import { TIME_CONFIG } from './constants';

/**
 * Get Paris time from UTC timestamp
 */
export function getParisTimeFromUTC(utcTimestamp: number): Date {
  return new Date(utcTimestamp);
}

/**
 * Get current time in Paris timezone
 */
export function getCurrentParisTime(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: TIME_CONFIG.TIMEZONE }));
}

/**
 * Format date for display (DD/MM à HH:MM) - ensuring Paris timezone
 */
export function formatTaskDate(timestamp: string | number): string {
  if (!timestamp) return '';
  
  let date: Date;
  if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    date = new Date(timestamp);
  }

  // Convert to Paris timezone for display
  const parisDate = new Date(date.toLocaleString("en-US", { timeZone: TIME_CONFIG.TIMEZONE }));

  const day = parisDate.getDate().toString().padStart(2, '0');
  const month = (parisDate.getMonth() + 1).toString().padStart(2, '0');
  const hours = parisDate.getHours().toString().padStart(2, '0');
  const minutes = parisDate.getMinutes().toString().padStart(2, '0');
  
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
  
  // Create date and convert to Paris timezone
  const date = new Date(currentYear, parseInt(month) - 1, parseInt(day));
  const parisDate = new Date(date.toLocaleString("en-US", { timeZone: TIME_CONFIG.TIMEZONE }));
  
  const weekdays = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  return weekdays[parisDate.getDay()];
}

/**
 * Parse date string to Date object (handles "DD/MM à HH:MM" format) - in Paris timezone
 */
export function parseTaskDate(dateString: string): Date {
  const [datePart, timePart] = dateString.split(' à ');
  const [day, month] = datePart.split('/');
  const [hours, minutes] = timePart.split(':');
  const currentYear = new Date().getFullYear();
  
  // Create date object
  const date = new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  
  // Convert from Paris timezone to UTC, then back to get proper Paris time
  const parisOffset = date.getTimezoneOffset() + 60; // Paris is UTC+1 (or UTC+2 during DST)
  const utc = date.getTime() + (parisOffset * 60000);
  const parisTime = new Date(utc);
  
  return parisTime;
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
