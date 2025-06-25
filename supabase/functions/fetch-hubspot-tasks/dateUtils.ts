
import { TIME_CONFIG } from './constants.ts';

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
