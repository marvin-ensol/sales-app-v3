
import { useMemo } from 'react';
import { Task } from '@/types/task';

interface UseTaskFilteringProps {
  tasks: Task[];
  searchTerm: string;
  lockedColumns: string[];
  getSelectedOwnerName: () => string;
  dateRange?: { startDate: Date | null; endDate: Date | null };
}

export const useTaskFiltering = ({
  tasks,
  searchTerm,
  lockedColumns,
  getSelectedOwnerName,
  dateRange
}: UseTaskFilteringProps) => {
  const notStartedTasks = useMemo(() => 
    tasks.filter(task => task.status === 'not_started' || task.status === 'waiting'), 
    [tasks]
  );
  
  const completedTasks = useMemo(() => 
    tasks.filter(task => task.status === 'completed'), 
    [tasks]
  );

  const newQueueTasks = useMemo(() => 
    notStartedTasks.filter(task => task.queue === '1'), // Use database ID for "New" category
    [notStartedTasks]
  );

  const hasNewTasks = newQueueTasks.length > 0;

  const filteredTasks = useMemo(() => {
    return notStartedTasks.filter(task => {
      // Exclude deleted tasks completely
      if (task.status === 'deleted') {
        return false;
      }
      // First check if the task is in a locked column and we have a search term
      if (searchTerm && lockedColumns.includes(task.queue)) {
        return false; // Don't show tasks from locked columns in search results
      }
      
      // Apply search filter
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.contact.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Apply date range filter
      if (dateRange && (dateRange.startDate || dateRange.endDate) && task.hsTimestamp) {
        if (dateRange.startDate && task.hsTimestamp < dateRange.startDate) {
          return false;
        }
        
        if (dateRange.endDate && task.hsTimestamp > dateRange.endDate) {
          return false;
        }
      }
      
      // For unassigned "New" tasks, apply special filtering logic
      if (task.isUnassigned && task.queue === '1') { // Use database ID for "New" category
        // Check if the user has any assigned "New" tasks
        const userHasAssignedNewTasks = notStartedTasks.some(t => 
          !t.isUnassigned && 
          t.queue === '1' && // Use database ID for "New" category
          t.owner === getSelectedOwnerName()
        );
        
        // If user has assigned "New" tasks, hide unassigned ones
        if (userHasAssignedNewTasks) {
          return false;
        }
        
        // Only show the oldest unassigned "New" task
        const unassignedNewTasks = notStartedTasks.filter(t => 
          t.isUnassigned && 
          t.queue === '1' && // Use database ID for "New" category
          (t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           t.contact.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        if (unassignedNewTasks.length > 1) {
          // Sort by timestamp (oldest first) and only return the first one
          unassignedNewTasks.sort((a, b) => {
            if (!a.hsTimestamp && !b.hsTimestamp) return 0;
            if (!a.hsTimestamp) return 1;
            if (!b.hsTimestamp) return -1;
            return a.hsTimestamp.getTime() - b.hsTimestamp.getTime();
          });
          
          // Only show this task if it's the oldest one
          return task.id === unassignedNewTasks[0].id;
        }
      }
      
      return true;
    });
  }, [notStartedTasks, searchTerm, lockedColumns, getSelectedOwnerName, dateRange]);

  return {
    notStartedTasks,
    completedTasks,
    newQueueTasks,
    hasNewTasks,
    filteredTasks
  };
};
