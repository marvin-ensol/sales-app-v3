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
  
  // Group tasks by date and mark first occurrence
  const groupedTasks = useMemo(() => {
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

    // Create flat array with isFirstOfDate flag
    const result: GroupedTask[] = [];
    tasksByDate.forEach((dateTasks) => {
      dateTasks.forEach((task, index) => {
        result.push({
          ...task,
          isFirstOfDate: index === 0
        });
      });
    });

    return result;
  }, [tasks]);

  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0 mx-4 pt-3">
      {groupedTasks.map((task, index) => {
        const isFirstTask = index === 0;
        const prevTask = index > 0 ? groupedTasks[index - 1] : null;
        const currentDateKey = getDateKey(task.dueDate);
        const prevDateKey = prevTask ? getDateKey(prevTask.dueDate) : null;
        const shouldShowTaskSeparator = !isFirstTask && currentDateKey === prevDateKey;

        return (
          <div key={`${task.id}-${task.queue}`}>
            {shouldShowTaskSeparator && (
              <div className="grid grid-cols-[40px_32px_32px_48px_200px_1fr_auto] mx-3">
                <div></div>
                <div></div>
                <div></div>
                <div className="col-span-4 border-t border-gray-200 my-2"></div>
              </div>
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
  );
};

export default TaskTable;