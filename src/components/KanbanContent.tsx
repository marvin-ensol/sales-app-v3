import { useState } from "react";
import VerticalKanbanColumn from "./VerticalKanbanColumn";
import TaskCard from "./TaskCard";
import { Task, TaskQueue } from "@/types/task";
import { useTaskCategories } from "@/hooks/useTaskCategories";
import { sortTasksByDisplayOrder, sortTasksWithSequenceGrouping } from "@/utils/taskSorting";
import SequenceGroup from "./SequenceGroup";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { isTaskOverdue } from "@/lib/dateUtils";
import { TaskSummaryData } from "@/hooks/useTeamSummary";

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
  selectedUserTeamId?: string | null; // New prop for team-based category filtering
  tasks?: Task[]; // For mobile task count display
  teamSummary?: TaskSummaryData | null;
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
  lockedExpandableColumns = [],
  selectedUserTeamId,
  tasks = [],
  teamSummary
}: KanbanContentProps) => {
  const [showEmptyCategories, setShowEmptyCategories] = useState(false);
  const isMobile = useIsMobile();
  const { categories: kanbanColumns, loading: categoriesLoading, error: categoriesError } = useTaskCategories(selectedUserTeamId);

  // Calculate task counts for mobile display
  const tasksOverdue = tasks.filter(task => task.dueDate && isTaskOverdue(task.dueDate)).length;
  const tasksFuture = tasks.filter(task => task.dueDate && !isTaskOverdue(task.dueDate)).length;
  
  console.log('KanbanContent render - Categories:', kanbanColumns.length, 'Loading:', categoriesLoading, 'Error:', categoriesError);

  const getTasksByQueue = (queue: TaskQueue) => {
    const tasks = filteredTasks.filter(task => task.queue === queue && (task.status === 'not_started' || task.status === 'waiting'));
    const uniqueTasks = tasks.filter((task, index, arr) => 
      arr.findIndex(t => t.id === task.id) === index
    );
    
    // Find the category for this queue to get its display order setting
    const category = kanbanColumns.find(col => col.id === queue);
    const displayOrder = category?.task_display_order || 'oldest_tasks_first';
    const useSequenceOrdering = category?.order_by_position_in_sequence || false;
    
    console.log(`\n🏷️ Queue "${queue}": Found category:`, category ? `"${category.title}" with display order: "${displayOrder}", sequence ordering: ${useSequenceOrdering}` : 'NOT FOUND, using defaults');
    console.log(`📦 Processing ${uniqueTasks.length} unique tasks for queue "${queue}"`);
    
    // Debug: Check if tasks have hsTimestamp and sequence numbers
    const tasksWithTimestamp = uniqueTasks.filter(t => t.hsTimestamp);
    const tasksWithoutTimestamp = uniqueTasks.filter(t => !t.hsTimestamp);
    const tasksWithSequence = uniqueTasks.filter(t => t.numberInSequence);
    console.log(`⏰ Tasks with hsTimestamp: ${tasksWithTimestamp.length}, without: ${tasksWithoutTimestamp.length}`);
    console.log(`🔢 Tasks with sequence number: ${tasksWithSequence.length}`);
    
    if (useSequenceOrdering) {
      // Return grouped tasks for sequence-based ordering
      const groupedTasks = sortTasksWithSequenceGrouping(uniqueTasks, displayOrder);
      console.log(`✅ Sequence grouping complete for queue "${queue}"\n`);
      return groupedTasks;
    } else {
      // Sort tasks using the standard utility function
      const sortedTasks = sortTasksByDisplayOrder(uniqueTasks, displayOrder);
      console.log(`✅ Standard sorting complete for queue "${queue}"\n`);
      return sortedTasks;
    }
  };

  const getCompletedTasksByQueue = (queue: TaskQueue) => {
    // Use centralized data when available for selected owner
    if (teamSummary?.category_counts && selectedOwnerId !== 'all') {
      return teamSummary.category_counts.completed_by_category[queue] || 0;
    }
    
    // Fallback to local calculation for 'all' owners or when data unavailable
    return allTasks.filter(task => {
      // Map NULL queue to fallback category if needed
      const taskQueue = task.queue || (kanbanColumns.find(col => col.queueId === null)?.id?.toString() || 'other');
      
      return taskQueue === queue && 
        task.status === 'completed' &&
        // When a specific owner is selected, only count their tasks
        (selectedOwnerId === 'all' || task.hubspotOwnerId === selectedOwnerId);
    }).length;
  };

  const getOverdueTasksByQueue = (queue: TaskQueue) => {
    // Use centralized data when available for selected owner
    if (teamSummary?.category_counts && selectedOwnerId !== 'all') {
      return teamSummary.category_counts.overdue_by_category[queue] || 0;
    }
    
    // Fallback to local calculation for 'all' owners or when data unavailable
    const nowMs = Date.now();
    return allTasks.filter(task => {
      // Map NULL queue to fallback category if needed
      const taskQueue = task.queue || (kanbanColumns.find(col => col.queueId === null)?.id?.toString() || 'other');
      
      return taskQueue === queue && 
        task.status !== 'completed' && 
        task.status !== 'deleted' &&
        task.hsTimestamp && 
        task.hsTimestamp.getTime() < nowMs &&
        // When a specific owner is selected, only count their tasks
        (selectedOwnerId === 'all' || task.hubspotOwnerId === selectedOwnerId);
    }).length;
  };

  // Check if a column is completely empty (no to-do tasks and no completed tasks)
  const isColumnCompletelyEmpty = (columnId: string) => {
    const tasks = getTasksByQueue(columnId as TaskQueue);
    // Handle both regular arrays and grouped arrays
    const todoCount = Array.isArray(tasks) && tasks.length > 0 && 'sequenceNumber' in tasks[0]
      ? (tasks as any[]).reduce((sum, group) => sum + group.tasks.length, 0)
      : (tasks as any[]).length;
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
    const aTasks = getTasksByQueue(a.id as TaskQueue);
    const bTasks = getTasksByQueue(b.id as TaskQueue);
    
    // Handle both regular arrays and grouped arrays for task counting
    const aTaskCount = Array.isArray(aTasks) && aTasks.length > 0 && 'sequenceNumber' in aTasks[0]
      ? (aTasks as any[]).reduce((sum, group) => sum + group.tasks.length, 0)
      : (aTasks as any[]).length;
    const bTaskCount = Array.isArray(bTasks) && bTasks.length > 0 && 'sequenceNumber' in bTasks[0]
      ? (bTasks as any[]).reduce((sum, group) => sum + group.tasks.length, 0)
      : (bTasks as any[]).length;
    
    // If both have tasks or both are empty, maintain database order
    if ((aTaskCount > 0 && bTaskCount > 0) || (aTaskCount === 0 && bTaskCount === 0)) {
      return a.order - b.order;
    }
    
    // Columns with tasks come first
    if (aTaskCount > 0 && bTaskCount === 0) return -1;
    if (aTaskCount === 0 && bTaskCount > 0) return 1;
    
    return 0;
  });

  console.log('Sorted columns:', sortedColumns.map(c => {
    const tasks = getTasksByQueue(c.id as TaskQueue);
    const taskCount = Array.isArray(tasks) && tasks.length > 0 && 'sequenceNumber' in tasks[0]
      ? (tasks as any[]).reduce((sum, group) => sum + group.tasks.length, 0)
      : (tasks as any[]).length;
    return { id: c.id, title: c.title, tasks: taskCount };
  }));

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
        const useSequenceOrdering = column.order_by_position_in_sequence || false;
        
        // Handle both regular arrays and grouped arrays for hasContent check
        const hasContent = Array.isArray(columnTasks) && columnTasks.length > 0 && 'sequenceNumber' in columnTasks[0]
          ? (columnTasks as any[]).some(group => group.tasks.length > 0)
          : (columnTasks as any[]).length > 0;
        
        return (
          <VerticalKanbanColumn
            key={column.id}
            title={column.title}
            color={column.color}
            count={getOverdueTasksByQueue(column.id as TaskQueue)}
            completedCount={getCompletedTasksByQueue(column.id as TaskQueue)}
            isExpanded={expandedColumn === column.id}
            onToggle={() => onColumnToggle(column.id)}
            isLocked={isLocked}
            isLockedFromExpansion={isLockedFromExpansion}
            hasContent={hasContent}
          >
            {useSequenceOrdering ? (
              // Render grouped tasks with sequence headers
              <div className="space-y-1">
                {(columnTasks as any[]).map((group, groupIndex) => (
                  <SequenceGroup
                    key={`${column.id}-group-${group.sequenceNumber || 'no-sequence'}-${groupIndex}`}
                    sequenceNumber={group.sequenceNumber}
                    tasks={group.tasks}
                    categoryColor={column.color}
                    onMove={(taskId, newStatus) => onTaskMove(taskId, newStatus as TaskQueue)}
                    onFrameUrlChange={onFrameUrlChange}
                    onTaskAssigned={onTaskAssigned}
                    onTaskDeleted={onTaskDeleted}
                  />
                ))}
              </div>
            ) : (
              // Render regular task list
              <div className="space-y-2">
                {(columnTasks as any[]).map(task => (
                  <TaskCard
                    key={`${task.id}-${task.queue}`}
                    task={task}
                    onMove={(taskId, newStatus) => onTaskMove(taskId, newStatus as TaskQueue)}
                    onFrameUrlChange={onFrameUrlChange}
                    onTaskAssigned={onTaskAssigned}
                    onTaskDeleted={onTaskDeleted}
                    categoryColor={column.color}
                  />
                ))}
              </div>
            )}
            {!hasContent && !tasksLoading && ownerSelectionInitialized && (
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

      {/* Mobile task count display */}
      {isMobile && tasks.length > 0 && (
        <div className="flex justify-center py-2">
          <span className="text-sm text-gray-400">
            {tasksOverdue} tâche{tasksOverdue !== 1 ? 's' : ''} à faire | {tasksFuture} tâche{tasksFuture !== 1 ? 's' : ''} à venir
          </span>
        </div>
      )}
    </div>
  );
};

export default KanbanContent;