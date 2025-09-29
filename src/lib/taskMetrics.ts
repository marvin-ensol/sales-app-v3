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
 * Enhanced version that can match by either hubspot_owner_id or normalized fullName
 */
export function computeOwnerStats(
  tasks: Task[], 
  owner: { id?: string; fullName?: string },
  now = new Date()
): { overdueCount: number; completedTodayCount: number } {
  const nowMs = now.getTime();
  
  // Filter tasks for this owner using ID (preferred) or normalized name matching
  const ownerTasks = tasks.filter(task => {
    // Primary: Match by hubspot_owner_id if available
    if (owner.id && task.hubspotOwnerId) {
      return task.hubspotOwnerId === owner.id;
    }
    
    // Fallback: Match by normalized name
    const normalizedOwnerName = normalizeName(owner.fullName);
    const normalizedTaskOwner = normalizeName(task.owner);
    return normalizedTaskOwner === normalizedOwnerName;
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