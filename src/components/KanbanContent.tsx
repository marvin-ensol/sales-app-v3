
import { useEffect } from "react";
import VerticalKanbanColumn from "./VerticalKanbanColumn";
import TaskCard from "./TaskCard";
import { Task, TaskQueue } from "@/types/task";

// Define columns based on task queues
const columns = [
  { id: "new", title: "New", color: "border-l-4 border-l-blue-400" },
  { id: "attempted", title: "Attempted", color: "border-l-4 border-l-orange-400" },
  { id: "other", title: "Other", color: "border-l-4 border-l-gray-400" }
];

interface KanbanContentProps {
  filteredTasks: Task[];
  expandedColumn: string;
  onColumnToggle: (columnId: string) => void;
  onTaskMove: (taskId: string, newQueue: TaskQueue) => void;
  onFrameUrlChange: (url: string) => void;
  searchTerm: string;
  setExpandedColumn: (columnId: string) => void;
  tasksLoading: boolean;
  ownerSelectionInitialized: boolean;
}

const KanbanContent = ({
  filteredTasks,
  expandedColumn,
  onColumnToggle,
  onTaskMove,
  onFrameUrlChange,
  searchTerm,
  setExpandedColumn,
  tasksLoading,
  ownerSelectionInitialized
}: KanbanContentProps) => {
  const getTasksByQueue = (queue: TaskQueue) => {
    const queueTasks = filteredTasks.filter(task => task.queue === queue);
    
    // For "new" queue, sort unassigned tasks first
    if (queue === "new") {
      return queueTasks.sort((a, b) => {
        if (a.isUnassigned && !b.isUnassigned) return -1;
        if (!a.isUnassigned && b.isUnassigned) return 1;
        return 0;
      });
    }
    
    return queueTasks;
  };

  // Auto-expand columns with search matches
  useEffect(() => {
    if (searchTerm) {
      // Find columns that have matching tasks
      const columnsWithMatches = columns.filter(column => 
        getTasksByQueue(column.id as TaskQueue).length > 0
      );
      
      // If there are matches, expand the first column with matches
      if (columnsWithMatches.length > 0) {
        setExpandedColumn(columnsWithMatches[0].id);
      }
    }
  }, [searchTerm, filteredTasks, setExpandedColumn]);

  return (
    <div className="flex-1 overflow-y-auto px-2">
      {columns.map((column) => (
        <VerticalKanbanColumn
          key={column.id}
          title={column.title}
          color={column.color}
          count={getTasksByQueue(column.id as TaskQueue).length}
          isExpanded={expandedColumn === column.id}
          onToggle={() => onColumnToggle(column.id)}
        >
          {getTasksByQueue(column.id as TaskQueue).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onMove={(taskId, newStatus) => onTaskMove(taskId, newStatus as TaskQueue)}
              onFrameUrlChange={onFrameUrlChange}
              showOwner={false}
            />
          ))}
          {getTasksByQueue(column.id as TaskQueue).length === 0 && !tasksLoading && ownerSelectionInitialized && (
            <div className="text-center text-gray-500 py-8">
              No tasks
            </div>
          )}
        </VerticalKanbanColumn>
      ))}
    </div>
  );
};

export default KanbanContent;
