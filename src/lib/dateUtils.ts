import { TIME_CONFIG } from './constants';

/**
 * Get Paris time from UTC timestamp
 */
export function getParisTimeFromUTC(utcTimestamp: number): Date {
  // Create date from UTC timestamp and convert to Paris timezone
  const utcDate = new Date(utcTimestamp);
  
  // Use Intl.DateTimeFormat to properly convert to Paris timezone
  const parisTimeString = utcDate.toLocaleString("en-CA", { 
    timeZone: TIME_CONFIG.TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parse the properly formatted Paris time string
  return new Date(parisTimeString.replace(',', ''));
}

/**
 * Get current time in Paris timezone
 */
export function getCurrentParisTime(): Date {
  const now = new Date();
  
  // Use Intl.DateTimeFormat to get proper Paris time
  const parisTimeString = now.toLocaleString("en-CA", { 
    timeZone: TIME_CONFIG.TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  return new Date(parisTimeString.replace(',', ''));
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
  const parisTimeString = date.toLocaleString("en-CA", { 
    timeZone: TIME_CONFIG.TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parisDate = new Date(parisTimeString.replace(',', ''));

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
  
  // Create date object in local time (which should be properly handled)
  const date = new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  
  return date;
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
