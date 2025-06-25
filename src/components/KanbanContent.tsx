
import VerticalKanbanColumn from "./VerticalKanbanColumn";
import TaskCard from "./TaskCard";
import { Task, TaskQueue } from "@/types/task";
import { KANBAN_COLUMNS } from "@/lib/constants";

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
  tasksLoading,
  ownerSelectionInitialized,
  onTaskAssigned,
  selectedOwnerId,
  lockedColumns
}: KanbanContentProps) => {
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

  // Sort columns: first those with tasks, then those without, maintaining original order within each group
  const sortedColumns = [...KANBAN_COLUMNS].sort((a, b) => {
    const aTaskCount = getTasksByQueue(a.id as TaskQueue).length;
    const bTaskCount = getTasksByQueue(b.id as TaskQueue).length;
    
    // If both have tasks or both are empty, maintain original order
    if ((aTaskCount > 0 && bTaskCount > 0) || (aTaskCount === 0 && bTaskCount === 0)) {
      return KANBAN_COLUMNS.findIndex(col => col.id === a.id) - KANBAN_COLUMNS.findIndex(col => col.id === b.id);
    }
    
    // Columns with tasks come first
    if (aTaskCount > 0 && bTaskCount === 0) return -1;
    if (aTaskCount === 0 && bTaskCount > 0) return 1;
    
    return 0;
  });

  return (
    <div className="flex-1 overflow-y-auto px-1">
      {sortedColumns.map((column) => {
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
