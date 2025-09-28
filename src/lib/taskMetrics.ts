import { Task } from '@/types/task';

/**
 * Normalize a name for consistent matching by trimming whitespace,
 * converting to lowercase, and normalizing Unicode characters
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name.normalize('NFKC').trim().toLowerCase();
}

/**
 * Check if a task is overdue based on its hsTimestamp
 * Uses current UTC time for consistent comparison
 */
export function isTaskOverdueUtc(task: Task, nowMs = Date.now()): boolean {
  // Only consider non-completed tasks
  if (task.status === 'completed') return false;
  
  // Must have a valid hsTimestamp
  if (!task.hsTimestamp) return false;
  
  // Compare UTC timestamps
  return task.hsTimestamp.getTime() < nowMs;
}

/**
 * Check if a task was completed today in Paris timezone
 * Uses calendar date comparison for consistent results
 */
export function isTaskCompletedTodayParis(task: Task, now = new Date()): boolean {
  // Must be completed with a completion date
  if (task.status !== 'completed' || !task.completionDate) return false;
  
  // Get today's date in Paris timezone as a string (YYYY-MM-DD)
  const todayParis = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  
  // Get completion date in Paris timezone as a string (YYYY-MM-DD)
  const completionParis = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(task.completionDate);
  
  return completionParis === todayParis;
}

/**
 * Compute overdue and completed today counts for an owner
 */
export function computeOwnerStats(
  tasks: Task[], 
  ownerHubspotId: string,
  ownerFullName: string,
  now = new Date()
): { overdueCount: number; completedTodayCount: number } {
  const normalizedOwnerName = normalizeName(ownerFullName);
  const nowMs = now.getTime();
  
  // Filter tasks for this owner using both ID and name matching for robustness
  const ownerTasks = tasks.filter(task => {
    // Primary match by HubSpot owner ID (most reliable)
    if (task.hubspotOwnerId && ownerHubspotId) {
      return task.hubspotOwnerId === ownerHubspotId;
    }
    // Fallback to normalized name matching
    return normalizeName(task.owner) === normalizedOwnerName;
  });
  
  // Calculate overdue tasks
  const overdueCount = ownerTasks.filter(task => 
    isTaskOverdueUtc(task, nowMs)
  ).length;
  
  // Calculate tasks completed today
  const completedTodayCount = ownerTasks.filter(task => 
    isTaskCompletedTodayParis(task, now)
  ).length;
  
  return {
    overdueCount,
    completedTodayCount
  };
}