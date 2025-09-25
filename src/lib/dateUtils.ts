
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
 * Format date for display (DD/MM à HH:MM) - converts UTC to Paris time
 */
export function formatTaskDate(timestamp: string | number): string {
  if (!timestamp) return '';
  
  let date: Date;
  
  if (typeof timestamp === 'string') {
    // HubSpot returns ISO strings like "2025-06-25T06:00:00.000Z"
    const utcDate = new Date(timestamp);
    // Convert UTC to Paris time
    date = new Date(utcDate.toLocaleString("en-US", { timeZone: TIME_CONFIG.TIMEZONE }));
  } else {
    // Handle numeric timestamps
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
  const date = new Date(currentYear, parseInt(month) - 1, parseInt(day));
  
  const weekdays = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  return weekdays[date.getDay()];
}

/**
 * Get French day of week abbreviation (lowercase)
 */
export function getFrenchDayOfWeek(dateString: string): string {
  if (!dateString) return "";
  
  const [datePart] = dateString.split(' à ');
  if (!datePart) return "";
  
  const [day, month] = datePart.split('/');
  const currentYear = new Date().getFullYear();
  const date = new Date(currentYear, parseInt(month) - 1, parseInt(day));
  
  const weekdays = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  return weekdays[date.getDay()];
}

/**
 * Get French month abbreviation (3 letters)
 */
export function getFrenchMonthAbbreviation(dateString: string): string {
  if (!dateString) return "";
  
  const [datePart] = dateString.split(' à ');
  if (!datePart) return "";
  
  const [, month] = datePart.split('/');
  if (!month) return "";
  
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const monthIndex = parseInt(month) - 1;
  return monthNames[monthIndex] || "";
}

/**
 * Extract day number from date string
 */
export function extractDay(dateString: string): string {
  if (!dateString) return "";
  
  const [datePart] = dateString.split(' à ');
  if (!datePart) return "";
  
  const [day] = datePart.split('/');
  return day || "";
}

/**
 * Extract time (HH:mm) from date string
 */
export function extractTime(dateString: string): string {
  if (!dateString) return "";
  
  const [, timePart] = dateString.split(' à ');
  return timePart || "";
}

/**
 * Get date key for grouping (DD/MM format)
 */
export function getDateKey(dateString: string): string {
  if (!dateString) return "";
  
  const [datePart] = dateString.split(' à ');
  return datePart || "";
}

/**
 * Parse date string to Date object (handles "DD/MM à HH:MM" format) - creates date in Paris time
 */
export function parseTaskDate(dateString: string): Date {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error('Invalid date string provided');
  }
  
  const [datePart, timePart] = dateString.split(' à ');
  if (!datePart || !timePart) {
    throw new Error('Invalid date format - expected "DD/MM à HH:MM"');
  }
  
  const [day, month] = datePart.split('/');
  const [hours, minutes] = timePart.split(':');
  
  if (!day || !month || !hours || !minutes) {
    throw new Error('Invalid date components');
  }
  
  const currentYear = new Date().getFullYear();
  
  // Create date directly in Paris time (no timezone conversion needed)
  return new Date(
    currentYear, 
    parseInt(month) - 1, 
    parseInt(day), 
    parseInt(hours), 
    parseInt(minutes)
  );
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

/**
 * Get Monday of the given week (weeks start on Monday)
 */
export function getWeekStart(date: Date): Date {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(date.getFullYear(), date.getMonth(), diff);
}

/**
 * Get Sunday of the given week
 */
export function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  return new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
}

/**
 * Get first day of current month
 */
export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get last day of current month
 */
export function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Calculate date range based on lower and upper bound selections
 */
export function calculateDateRange(lowerBound: string, upperBound: string): { startDate: Date | null, endDate: Date | null } {
  const now = getCurrentParisTime();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  // Calculate start date based on lower bound
  switch (lowerBound) {
    case 'tout':
      startDate = null;
      break;
    case 'debut_mois':
      startDate = getMonthStart(now);
      break;
    case 'semaine_precedente':
      const lastWeekStart = getWeekStart(now);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      startDate = lastWeekStart;
      break;
    case 'debut_semaine':
      startDate = getWeekStart(now);
      break;
    case 'aujourd_hui':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
  }

  // Calculate end date based on upper bound
  switch (upperBound) {
    case 'tout':
      endDate = null;
      break;
    case 'aujourd_hui':
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    case 'fin_semaine':
      const weekEnd = getWeekEnd(now);
      endDate = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59, 999);
      break;
    case 'semaine_prochaine':
      const nextWeekEnd = getWeekEnd(now);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
      endDate = new Date(nextWeekEnd.getFullYear(), nextWeekEnd.getMonth(), nextWeekEnd.getDate(), 23, 59, 59, 999);
      break;
    case 'fin_mois':
      const monthEnd = getMonthEnd(now);
      endDate = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate(), 23, 59, 59, 999);
      break;
  }

  return { startDate, endDate };
}
