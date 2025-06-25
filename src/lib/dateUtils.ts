
import { TIME_CONFIG } from './constants';

/**
 * Get Paris time from UTC timestamp
 */
export function getParisTimeFromUTC(utcTimestamp: number): Date {
  // Create date from UTC timestamp
  const utcDate = new Date(utcTimestamp);
  
  // Convert to Paris timezone using proper timezone handling
  const parisTimeString = utcDate.toLocaleString("sv-SE", { 
    timeZone: TIME_CONFIG.TIMEZONE
  });
  
  // Parse the ISO-like string to create a proper Date object
  const parisDate = new Date(parisTimeString);
  
  console.log(`UTC timestamp: ${utcTimestamp}, UTC date: ${utcDate.toISOString()}, Paris date: ${parisDate.toLocaleString("fr-FR")}`);
  
  return parisDate;
}

/**
 * Get current time in Paris timezone
 */
export function getCurrentParisTime(): Date {
  const now = new Date();
  
  // Get current time in Paris timezone
  const parisTimeString = now.toLocaleString("sv-SE", { 
    timeZone: TIME_CONFIG.TIMEZONE
  });
  
  return new Date(parisTimeString);
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
    // Convert UTC timestamp to Paris time
    date = getParisTimeFromUTC(timestamp);
  }

  // Format in Paris timezone
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
  const parisDate = new Date();
  parisDate.setFullYear(currentYear, parseInt(month) - 1, parseInt(day));
  
  const weekdays = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  return weekdays[parisDate.getDay()];
}

/**
 * Parse date string to Date object (handles "DD/MM à HH:MM" format) - in Paris timezone
 * This is the CORRECTED version that properly handles Paris time
 */
export function parseTaskDate(dateString: string): Date {
  console.log(`Parsing date string: ${dateString}`);
  
  const [datePart, timePart] = dateString.split(' à ');
  const [day, month] = datePart.split('/');
  const [hours, minutes] = timePart.split(':');
  const currentYear = new Date().getFullYear();
  
  // Create a date object that represents the EXACT Paris time
  // We create it as a local date, then adjust to make sure it represents Paris time
  const parisDate = new Date(
    currentYear, 
    parseInt(month) - 1, 
    parseInt(day), 
    parseInt(hours), 
    parseInt(minutes)
  );
  
  console.log(`Created Paris date: ${parisDate.toLocaleString("fr-FR")}`);
  console.log(`Paris date ISO: ${parisDate.toISOString()}`);
  
  return parisDate;
}

/**
 * Get start and end of day in Paris timezone
 */
export function getParisTimeRange(): { startTimestamp: number; endTimestamp: number } {
  const nowParis = getCurrentParisTime();
  const startOfDayParis = new Date(nowParis.getFullYear(), nowParis.getMonth(), nowParis.getDate());
  const endOfDayParis = new Date(nowParis.getFullYear(), nowParis.getMonth(), nowParis.getDate() + 1);
  
  return { 
    startTimestamp: startOfDayParis.getTime(),
    endTimestamp: endOfDayParis.getTime()
  };
}

/**
 * Get timestamp for "X minutes from now" in Paris timezone
 */
export function getParisTimeAdvanced(minutes: number): number {
  const nowParis = getCurrentParisTime();
  const advancedTime = new Date(nowParis.getTime() + (minutes * 60 * 1000));
  
  return advancedTime.getTime();
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
