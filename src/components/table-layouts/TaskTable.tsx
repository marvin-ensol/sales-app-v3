import { useMemo } from "react";
import TaskRow from "./TaskRow";
import { Task, TaskStatus } from "@/types/task";
import { getDateKey } from "@/lib/dateUtils";

interface TaskTableProps {
  tasks: Task[];
  onMove: (taskId: string, newStatus: TaskStatus) => void;
  onFrameUrlChange: (url: string) => void;
  onTaskAssigned?: () => void;
  selectedOwnerId?: string;
  onTaskDeleted?: () => void;
  categoryColor?: string;
}

interface GroupedTask extends Task {
  isFirstOfDate: boolean;
}

const TaskTable = ({ 
  tasks, 
  onMove, 
  onFrameUrlChange, 
  onTaskAssigned, 
  selectedOwnerId, 
  onTaskDeleted, 
  categoryColor 
}: TaskTableProps) => {
  
  // Group tasks by date
  const groupedTasksByDate = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];

    const tasksByDate = new Map<string, Task[]>();
    
    // Group tasks by date
    tasks.forEach(task => {
      const dateKey = getDateKey(task.dueDate);
      if (!tasksByDate.has(dateKey)) {
        tasksByDate.set(dateKey, []);
      }
      tasksByDate.get(dateKey)!.push(task);
    });

    // Return array of date groups
    return Array.from(tasksByDate.entries()).map(([dateKey, dateTasks]) => ({
      dateKey,
      tasks: dateTasks.map((task, index) => ({
        ...task,
        isFirstOfDate: index === 0
      }))
    }));
  }, [tasks]);

  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <div className="mx-4 pt-3 space-y-3">
      {groupedTasksByDate.map((dateGroup, groupIndex) => (
        <div key={dateGroup.dateKey} className="bg-gray-50 rounded-lg">
          {dateGroup.tasks.map((task, taskIndex) => {
            const shouldShowDivider = taskIndex > 0;

            return (
              <div key={`${task.id}-${task.queue}`}>
                {shouldShowDivider && (
                  <div className="border-t border-gray-200 my-2 ml-28"></div>
                )}
                <TaskRow
                  task={task}
                  onMove={onMove}
                  onFrameUrlChange={onFrameUrlChange}
                  onTaskAssigned={onTaskAssigned}
                  selectedOwnerId={selectedOwnerId}
                  onTaskDeleted={onTaskDeleted}
                  categoryColor={categoryColor}
                  showDateColumns={task.isFirstOfDate}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default TaskTable;