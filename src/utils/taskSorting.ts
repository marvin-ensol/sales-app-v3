import { Task } from '@/types/task';

export interface TaskGroup {
  sequenceNumber: number | null;
  tasks: Task[];
}

/**
 * Sorts tasks based on the category's display order setting and hs_timestamp
 * @param tasks - Array of tasks to sort
 * @param displayOrder - The display order setting ('oldest_tasks_first' or 'newest_tasks_first')
 * @returns Sorted array of tasks
 */
export const sortTasksByDisplayOrder = (tasks: Task[], displayOrder: string = 'oldest_tasks_first'): Task[] => {
  console.log(`🔄 Sorting ${tasks.length} tasks with displayOrder: ${displayOrder}`);
  
  // Debug: Log timestamps before sorting
  tasks.forEach((task, index) => {
    console.log(`Task ${index + 1}: ${task.title} - hsTimestamp: ${task.hsTimestamp ? task.hsTimestamp.toISOString() : 'null'}`);
  });
  
  const sortedTasks = [...tasks].sort((a, b) => {
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
      
      console.log(`Comparing: ${a.title} (${aTime}) vs ${b.title} (${bTime})`);
      
      if (displayOrder === 'newest_tasks_first') {
        const result = bTime - aTime; // Descending (newest first)
        console.log(`newest_tasks_first: ${result > 0 ? b.title : a.title} comes first`);
        return result;
      } else {
        const result = aTime - bTime; // Ascending (oldest first)
        console.log(`oldest_tasks_first: ${result < 0 ? a.title : b.title} comes first`);
        return result;
      }
    }
    
    return 0;
  });
  
  // Debug: Log order after sorting
  console.log('📋 Tasks after sorting:');
  sortedTasks.forEach((task, index) => {
    console.log(`${index + 1}. ${task.title} - ${task.hsTimestamp ? task.hsTimestamp.toISOString() : 'null'}`);
  });
  
  return sortedTasks;
};

/**
 * Groups tasks by sequence position and sorts them for sequence-based ordering
 * @param tasks - Array of tasks to group and sort
 * @param displayOrder - The display order setting ('oldest_tasks_first' or 'newest_tasks_first')
 * @returns Array of TaskGroup objects with sequence-based grouping
 */
export const sortTasksWithSequenceGrouping = (tasks: Task[], displayOrder: string = 'oldest_tasks_first'): TaskGroup[] => {
  console.log(`🔄 Grouping ${tasks.length} tasks by sequence with displayOrder: ${displayOrder}`);
  
  // Group tasks by their sequence number
  const groupMap = new Map<number | null, Task[]>();
  
  tasks.forEach(task => {
    const sequenceNumber = task.numberInSequence;
    if (!groupMap.has(sequenceNumber)) {
      groupMap.set(sequenceNumber, []);
    }
    groupMap.get(sequenceNumber)!.push(task);
  });
  
  // Convert to TaskGroup array and sort
  const groups: TaskGroup[] = Array.from(groupMap.entries()).map(([sequenceNumber, groupTasks]) => ({
    sequenceNumber,
    tasks: sortTasksByDisplayOrder(groupTasks, displayOrder)
  }));
  
  // Sort groups by sequence number (nulls last)
  groups.sort((a, b) => {
    if (a.sequenceNumber === null && b.sequenceNumber === null) return 0;
    if (a.sequenceNumber === null) return 1;
    if (b.sequenceNumber === null) return -1;
    return a.sequenceNumber - b.sequenceNumber;
  });
  
  console.log(`📋 Created ${groups.length} sequence groups:`, groups.map(g => `Seq ${g.sequenceNumber}: ${g.tasks.length} tasks`));
  
  return groups;
};