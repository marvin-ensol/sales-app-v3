
import { useState } from "react";
import VerticalKanbanColumn from "./VerticalKanbanColumn";
import TaskCard from "./TaskCard";
import { Task, TaskQueue } from "@/types/task";
import { useTaskCategories } from "@/hooks/useTaskCategories";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface KanbanContentProps {
  filteredTasks: Task[];
  allTasks: Task[];
  expandedColumn: string;
  onColumnToggle: (columnId: string) => void;
  onTaskMove: (taskId: string, newQueue: TaskQueue) => void;
  onFrameUrlChange: (url: string) => void;
  searchTerm: string;
  setExpandedColumn: (columnId: string) => void; // Keep for backward compatibility but not used
  tasksLoading: boolean;
  ownerSelectionInitialized: boolean;
  onTaskAssigned?: () => void;
  onTaskDeleted?: () => void;
  selectedOwnerId: string;
  lockedColumns: string[];
  lockedExpandableColumns?: string[]; // New prop for expansion locking
}

const KanbanContent = ({
  filteredTasks,
  allTasks,
  expandedColumn,
  onColumnToggle,
  onTaskMove,
  onFrameUrlChange,
  tasksLoading,
  ownerSelectionInitialized,
  onTaskAssigned,
  onTaskDeleted,
  selectedOwnerId,
  lockedColumns,
  lockedExpandableColumns = []
}: KanbanContentProps) => {
  const [showEmptyCategories, setShowEmptyCategories] = useState(false);
  const { categories: kanbanColumns, loading: categoriesLoading, error: categoriesError } = useTaskCategories();
  
  console.log('KanbanContent render - Categories:', kanbanColumns.length, 'Loading:', categoriesLoading, 'Error:', categoriesError);

  const getTasksByQueue = (queue: TaskQueue) => {
    const tasks = filteredTasks.filter(task => task.queue === queue && task.status === 'not_started');
    const uniqueTasks = tasks.filter((task, index, arr) => 
      arr.findIndex(t => t.id === task.id) === index
    );
    console.log(`Queue ${queue}: ${tasks.length} tasks (${uniqueTasks.length} unique)`);
    return uniqueTasks;
  };

  const getCompletedTasksByQueue = (queue: TaskQueue) => {
    return allTasks.filter(task => task.queue === queue && task.status === 'completed').length;
  };

  // Check if a column is completely empty (no to-do tasks and no completed tasks)
  const isColumnCompletelyEmpty = (columnId: string) => {
    const todoCount = getTasksByQueue(columnId as TaskQueue).length;
    const completedCount = getCompletedTasksByQueue(columnId as TaskQueue);
    return todoCount === 0 && completedCount === 0;
  };

  // Check if we should show the toggle button (at least one completely empty category exists)
  const hasEmptyCategories = kanbanColumns.some(column => isColumnCompletelyEmpty(column.id));

  // Filter columns based on the toggle state
  // Filter and sort columns
  const visibleColumns = kanbanColumns.filter(column => {
    if (showEmptyCategories) return true;
    return !isColumnCompletelyEmpty(column.id as TaskQueue);
  });
  
  console.log('All columns:', kanbanColumns.map(c => ({ id: c.id, title: c.title })));
  console.log('Visible columns:', visibleColumns.map(c => ({ id: c.id, title: c.title })));

  // Sort columns: first those with tasks, then those without, maintaining database order within each group
  const sortedColumns = [...visibleColumns].sort((a, b) => {
    const aTaskCount = getTasksByQueue(a.id as TaskQueue).length;
    const bTaskCount = getTasksByQueue(b.id as TaskQueue).length;
    
    // If both have tasks or both are empty, maintain database order
    if ((aTaskCount > 0 && bTaskCount > 0) || (aTaskCount === 0 && bTaskCount === 0)) {
      return a.order - b.order;
    }
    
    // Columns with tasks come first
    if (aTaskCount > 0 && bTaskCount === 0) return -1;
    if (aTaskCount === 0 && bTaskCount > 0) return 1;
    
    return 0;
  });

  console.log('Sorted columns:', sortedColumns.map(c => ({ id: c.id, title: c.title, tasks: getTasksByQueue(c.id as TaskQueue).length })));

  if (categoriesLoading) {
    return <div className="flex-1 flex items-center justify-center">Loading categories...</div>;
  }

  if (categoriesError && kanbanColumns.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-red-500">Error loading categories: {categoriesError}</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto px-1">
      {sortedColumns.map((column) => {
        const columnTasks = getTasksByQueue(column.id as TaskQueue);
        const isLocked = lockedColumns.includes(column.id);
        const isLockedFromExpansion = lockedExpandableColumns.includes(column.id);
        const hasContent = columnTasks.length > 0;
        
        return (
          <VerticalKanbanColumn
            key={column.id}
            title={column.title}
            color={column.color}
            count={columnTasks.length}
            completedCount={getCompletedTasksByQueue(column.id as TaskQueue)}
            isExpanded={expandedColumn === column.id}
            onToggle={() => onColumnToggle(column.id)}
            isLocked={isLocked}
            isLockedFromExpansion={isLockedFromExpansion}
            hasContent={hasContent}
          >
            {columnTasks.map((task) => (
              <TaskCard
                key={`${task.id}-${task.queue}`}
                task={task}
                onMove={(taskId, newStatus) => onTaskMove(taskId, newStatus as TaskQueue)}
                onFrameUrlChange={onFrameUrlChange}
                showOwner={false}
                onTaskAssigned={onTaskAssigned}
                onTaskDeleted={onTaskDeleted}
                selectedOwnerId={selectedOwnerId}
              />
            ))}
            {columnTasks.length === 0 && !tasksLoading && ownerSelectionInitialized && (
              <div className="text-center text-gray-500 py-8">
                No tasks
              </div>
            )}
          </VerticalKanbanColumn>
        );
      })}
      
      {hasEmptyCategories && (
        <div className="flex justify-center py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEmptyCategories(!showEmptyCategories)}
            className="text-gray-500 hover:text-gray-700 bg-transparent hover:bg-gray-50"
          >
            {showEmptyCategories ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Masquer les catégories sans activité
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Montrer les catégories sans activité
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default KanbanContent;
