import { Task } from '@/types/task';

/**
 * Sorts tasks based on the category's display order setting and hs_timestamp
 * @param tasks - Array of tasks to sort
 * @param displayOrder - The display order setting ('oldest_tasks_first' or 'newest_tasks_first')
 * @returns Sorted array of tasks
 */
export const sortTasksByDisplayOrder = (tasks: Task[], displayOrder: string = 'oldest_tasks_first'): Task[] => {
  return [...tasks].sort((a, b) => {
    // Handle cases where hs_timestamp might be null/undefined
    const aTimestamp = a.hsTimestamp;
    const bTimestamp = b.hsTimestamp;
    
    // If both timestamps are missing, maintain original order
    if (!aTimestamp && !bTimestamp) {
      return 0;
    }
    
    // Tasks with timestamps come before tasks without timestamps
    if (aTimestamp && !bTimestamp) {
      return -1;
    }
    if (!aTimestamp && bTimestamp) {
      return 1;
    }
    
    // Both have timestamps, sort based on display order
    if (aTimestamp && bTimestamp) {
      const aTime = aTimestamp.getTime();
      const bTime = bTimestamp.getTime();
      
      if (displayOrder === 'newest_tasks_first') {
        return bTime - aTime; // Descending (newest first)
      } else {
        return aTime - bTime; // Ascending (oldest first)
      }
    }
    
    return 0;
  });
};