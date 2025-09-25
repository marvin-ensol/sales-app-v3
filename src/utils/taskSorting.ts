import { Task } from '@/types/task';

export const sortTasksByDisplayOrder = (tasks: Task[], displayOrder: string = 'oldest_tasks_first'): Task[] => {
  const sortedTasks = [...tasks];
  
  sortedTasks.sort((a, b) => {
    // Handle missing hsTimestamp values by placing them at the end
    if (!a.hsTimestamp && !b.hsTimestamp) return 0;
    if (!a.hsTimestamp) return 1;
    if (!b.hsTimestamp) return -1;
    
    const aTime = new Date(a.hsTimestamp).getTime();
    const bTime = new Date(b.hsTimestamp).getTime();
    
    if (displayOrder === 'newest_tasks_first') {
      return bTime - aTime; // Newest first (DESC)
    } else {
      return aTime - bTime; // Oldest first (ASC)
    }
  });
  
  return sortedTasks;
};