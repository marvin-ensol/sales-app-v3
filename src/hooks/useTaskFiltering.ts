
import { useMemo } from 'react';
import { Task } from '@/types/task';
import { parseTaskDate } from '@/lib/dateUtils';

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
    notStartedTasks.filter(task => task.queue === 'new'), 
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
      if (dateRange && (dateRange.startDate || dateRange.endDate)) {
        try {
          const taskDate = parseTaskDate(task.dueDate);
          
          if (dateRange.startDate && taskDate < dateRange.startDate) {
            return false;
          }
          
          if (dateRange.endDate && taskDate > dateRange.endDate) {
            return false;
          }
        } catch (error) {
          console.error('Error parsing task date for filtering:', error);
          return false;
        }
      }
      
      // For unassigned "New" tasks, apply special filtering logic
      if (task.isUnassigned && task.queue === 'new') {
        // Check if the user has any assigned "New" tasks
        const userHasAssignedNewTasks = notStartedTasks.some(t => 
          !t.isUnassigned && 
          t.queue === 'new' && 
          t.owner === getSelectedOwnerName()
        );
        
        // If user has assigned "New" tasks, hide unassigned ones
        if (userHasAssignedNewTasks) {
          return false;
        }
        
        // Only show the oldest unassigned "New" task
        const unassignedNewTasks = notStartedTasks.filter(t => 
          t.isUnassigned && 
          t.queue === 'new' &&
          (t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           t.contact.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        if (unassignedNewTasks.length > 1) {
          // Sort by creation date (oldest first) and only return the first one
          unassignedNewTasks.sort((a, b) => {
            // Parse the dates - assuming format is "DD/MM à HH:MM"
            const parseDate = (dateStr: string) => {
              const [datePart, timePart] = dateStr.split(' à ');
              const [day, month] = datePart.split('/');
              const [hours, minutes] = timePart.split(':');
              const currentYear = new Date().getFullYear();
              return new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
            };
            
            const dateA = parseDate(a.dueDate);
            const dateB = parseDate(b.dueDate);
            return dateA.getTime() - dateB.getTime();
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
