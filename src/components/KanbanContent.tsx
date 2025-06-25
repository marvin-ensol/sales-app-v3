
import { useEffect } from "react";
import VerticalKanbanColumn from "./VerticalKanbanColumn";
import TaskCard from "./TaskCard";
import { Task, TaskQueue } from "@/types/task";

// Define columns based on task queues - Rappels & RDV comes first
const columns = [
  { id: "rappels", title: "Rappels & RDV", color: "border-l-4 border-l-purple-400" },
  { id: "new", title: "New", color: "border-l-4 border-l-blue-400" },
  { id: "attempted", title: "Attempted", color: "border-l-4 border-l-orange-400" },
  { id: "other", title: "Autres", color: "border-l-4 border-l-gray-400" }
];

interface KanbanContentProps {
  filteredTasks: Task[];
  allTasks: Task[];
  expandedColumn: string;
  onColumnToggle: (columnId: string) => void;
  onTaskMove: (taskId: string, newQueue: TaskQueue) => void;
  onFrameUrlChange: (url: string) => void;
  searchTerm: string;
  setExpandedColumn: (columnId: string) => void;
  tasksLoading: boolean;
  ownerSelectionInitialized: boolean;
  onTaskAssigned?: () => void;
  selectedOwnerId: string;
  lockedColumns: string[];
}

const KanbanContent = ({
  filteredTasks,
  allTasks,
  expandedColumn,
  onColumnToggle,
  onTaskMove,
  onFrameUrlChange,
  searchTerm,
  setExpandedColumn,
  tasksLoading,
  ownerSelectionInitialized,
  onTaskAssigned,
  selectedOwnerId,
  lockedColumns
}: KanbanContentProps) => {
  const getTasksByQueue = (queue: TaskQueue) => {
    const tasks = filteredTasks.filter(task => task.queue === queue && task.status === 'not_started');
    // Ensure unique tasks by ID to prevent duplicate key errors
    const uniqueTasks = tasks.filter((task, index, arr) => 
      arr.findIndex(t => t.id === task.id) === index
    );
    console.log(`Queue ${queue}: ${tasks.length} tasks (${uniqueTasks.length} unique)`);
    return uniqueTasks;
  };

  const getCompletedTasksByQueue = (queue: TaskQueue) => {
    return allTasks.filter(task => task.queue === queue && task.status === 'completed').length;
  };

  // Auto-expand columns with search matches, but only if they're not locked
  useEffect(() => {
    if (searchTerm) {
      // Find columns that have matching tasks and are not locked
      const columnsWithMatches = columns.filter(column => 
        getTasksByQueue(column.id as TaskQueue).length > 0 && 
        !lockedColumns.includes(column.id)
      );
      
      // If there are matches, expand the first column with matches
      if (columnsWithMatches.length > 0) {
        setExpandedColumn(columnsWithMatches[0].id);
      }
    }
  }, [searchTerm, filteredTasks, setExpandedColumn, lockedColumns]);

  return (
    <div className="flex-1 overflow-y-auto px-1">
      {columns.map((column) => {
        const columnTasks = getTasksByQueue(column.id as TaskQueue);
        const isLocked = lockedColumns.includes(column.id);
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
    </div>
  );
};

export default KanbanContent;
