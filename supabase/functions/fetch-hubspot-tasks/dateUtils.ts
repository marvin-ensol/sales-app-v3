
import { TIME_CONFIG } from './constants.ts';

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
  const parisDate = new Date(parisTimeString.replace(',', ''));
  
  console.log(`UTC timestamp: ${utcTimestamp}, UTC date: ${utcDate.toISOString()}, Paris date: ${parisDate.toLocaleString("fr-FR", { timeZone: TIME_CONFIG.TIMEZONE })}`);
  
  return parisDate;
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

  // Format in Paris timezone
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
