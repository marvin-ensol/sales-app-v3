
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
  const [previousHasNewTasks, setPreviousHasNewTasks] = useState(false);

  // Auto-expand logic - handle initial load and new task changes
  useEffect(() => {
    if (!autoExpandInitialized && notStartedTasks.length > 0) {
      const rappelsQueueTasks = notStartedTasks.filter(task => task.queue === 'rappels');
      const hasRappelsTasks = rappelsQueueTasks.length > 0;
      
      if (hasNewTasks) {
        // If there are new tasks, always expand "new" initially
        setExpandedColumn("new");
      } else if (hasRappelsTasks) {
        setExpandedColumn("rappels");
      } else if (lockedColumns.length > 0) {
        setExpandedColumn("new");
      }
      
      setPreviousHasNewTasks(hasNewTasks);
      setAutoExpandInitialized(true);
    }
  }, [notStartedTasks, hasNewTasks, lockedColumns.length, autoExpandInitialized]);

  // Handle dynamic changes to new tasks
  useEffect(() => {
    if (autoExpandInitialized) {
      // If we went from no new tasks to having new tasks
      if (!previousHasNewTasks && hasNewTasks) {
        console.log('New tasks detected, auto-expanding "new" column');
        setExpandedColumn("new");
      }
      // If we went from having new tasks to no new tasks
      else if (previousHasNewTasks && !hasNewTasks) {
        console.log('No more new tasks, collapsing all columns');
        setExpandedColumn("");
      }
      
      setPreviousHasNewTasks(hasNewTasks);
    }
  }, [hasNewTasks, previousHasNewTasks, autoExpandInitialized]);

  // Get columns that should be locked (non-expandable)
  const getLockedExpandableColumns = () => {
    if (hasNewTasks) {
      // When there are new tasks, lock all columns except "new" and "rappels"
      return ["attempted", "autres", "simulations", "communications"];
    }
    return [];
  };

  const handleColumnToggle = (columnId: string) => {
    console.log(`=== COLUMN TOGGLE DEBUG ===`);
    console.log(`Toggling column: ${columnId}`);
    console.log(`Current expandedColumn: ${expandedColumn}`);
    console.log(`Has new tasks: ${hasNewTasks}`);
    
    const lockedExpandableColumns = getLockedExpandableColumns();
    
    // Don't allow toggling if this column is locked for expansion
    if (lockedExpandableColumns.includes(columnId)) {
      console.log(`Column ${columnId} is locked and cannot be expanded`);
      return;
    }
    
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
    handleColumnToggle,
    lockedExpandableColumns: getLockedExpandableColumns()
  };
};
