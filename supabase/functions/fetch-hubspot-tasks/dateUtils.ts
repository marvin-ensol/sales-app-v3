
import { TIME_CONFIG } from './constants.ts';

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
  
  console.log(`UTC timestamp: ${utcTimestamp}, UTC date: ${utcDate.toISOString()}, Paris date: ${parisDate.toLocaleString("fr-FR", { timeZone: TIME_CONFIG.TIMEZONE })}`);
  
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
 * Format date for display (DD/MM à HH:MM)
 */
export function formatTaskDate(timestamp: string | number): string {
  if (!timestamp) return '';
  
  let date: Date;
  if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    date = getParisTimeFromUTC(timestamp);
  }

  // Format in Paris timezone - use the date object directly since it's already in Paris time
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
  const startTimestamp = startOfDayParis.getTime();
  const endTimestamp = endOfDayParis.getTime();
  
  return { startTimestamp, endTimestamp };
}

/**
 * Get timestamp for "X minutes from now" in Paris timezone
 */
export function getParisTimeAdvanced(minutes: number): number {
  const nowParis = getCurrentParisTime();
  const advancedTime = new Date(nowParis.getTime() + (minutes * 60 * 1000));
  
  return advancedTime.getTime();
}
