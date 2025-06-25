
import { useState, useEffect } from 'react';
import { Task } from '@/types/task';

interface UseColumnStateProps {
  notStartedTasks: Task[];
  hasNewTasks: boolean;
  lockedColumns: string[];
}

export const useColumnState = ({
  notStartedTasks,
  hasNewTasks,
  lockedColumns
}: UseColumnStateProps) => {
  const [expandedColumn, setExpandedColumn] = useState<string>("rappels");
  const [autoExpandInitialized, setAutoExpandInitialized] = useState(false);

  // Auto-expand logic - only run once when tasks are first loaded
  useEffect(() => {
    if (!autoExpandInitialized && notStartedTasks.length > 0) {
      const rappelsQueueTasks = notStartedTasks.filter(task => task.queue === 'rappels');
      const hasRappelsTasks = rappelsQueueTasks.length > 0;
      
      if (hasRappelsTasks) {
        setExpandedColumn("rappels");
      } else if (hasNewTasks && lockedColumns.length > 0) {
        setExpandedColumn("new");
      }
      
      setAutoExpandInitialized(true);
    }
  }, [notStartedTasks, hasNewTasks, lockedColumns.length, autoExpandInitialized]);

  const handleColumnToggle = (columnId: string) => {
    console.log(`=== COLUMN TOGGLE DEBUG ===`);
    console.log(`Toggling column: ${columnId}`);
    console.log(`Current expandedColumn: ${expandedColumn}`);
    console.log(`Locked columns: ${lockedColumns.join(', ')}`);
    
    const newExpandedColumn = expandedColumn === columnId ? "" : columnId;
    console.log(`Setting expandedColumn to: ${newExpandedColumn}`);
    
    setExpandedColumn(newExpandedColumn);
    
    // Add a small delay to see if the state actually changes
    setTimeout(() => {
      console.log(`After setState - expandedColumn should be: ${newExpandedColumn}`);
    }, 100);
  };

  return {
    expandedColumn,
    setExpandedColumn,
    handleColumnToggle
  };
};
