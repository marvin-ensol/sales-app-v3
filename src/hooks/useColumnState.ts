
import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { TaskCategory } from '@/hooks/useTaskCategories';

interface UseColumnStateProps {
  notStartedTasks: Task[];
  hasNewTasks: boolean;
  lockedColumns: string[];
  categories: TaskCategory[];
}

export const useColumnState = ({
  notStartedTasks,
  hasNewTasks,
  lockedColumns,
  categories
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

  // Update locked columns when categories or tasks change
  useEffect(() => {
    console.log('Categories for locking calculation:', categories);
    console.log('Not started tasks for locking:', notStartedTasks.length);
  }, [categories, notStartedTasks]);

  // Get columns that should be locked (non-expandable) based on category locking settings
  const getLockedExpandableColumns = () => {
    const lockedColumns: string[] = [];
    
    // Sort categories by order to check locking in sequence
    const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
    
    for (const category of sortedCategories) {
      // Skip if this category doesn't have locking enabled
      if (!category.locks_lower_categories) continue;
      
      // Check if this category has tasks
      const categoryTasks = notStartedTasks.filter(task => task.queue === category.id);
      
      if (categoryTasks.length > 0) {
        // Lock all categories with higher order (displayed lower)
        const higherOrderCategories = sortedCategories.filter(cat => cat.order > category.order);
        higherOrderCategories.forEach(cat => {
          if (!lockedColumns.includes(cat.id)) {
            lockedColumns.push(cat.id);
          }
        });
      }
    }
    
    return lockedColumns;
  };

  const handleColumnToggle = (columnId: string) => {
    console.log(`=== COLUMN TOGGLE DEBUG ===`);
    console.log(`Toggling column: ${columnId}`);
    console.log(`Current expandedColumn: ${expandedColumn}`);
    console.log(`Has new tasks: ${hasNewTasks}`);
    console.log(`Categories with locking:`, categories.filter(c => c.locks_lower_categories));
    
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
