import { Task, TaskStatus } from "@/types/task";
import TaskTable from "./TaskTable";

interface TableTaskDisplayProps {
  tasks: Task[];
  onMove: (taskId: string, newStatus: TaskStatus) => void;
  onFrameUrlChange: (url: string) => void;
  onTaskAssigned?: () => void;
  selectedOwnerId?: string;
  onTaskSkipped?: () => void;
  categoryColor?: string;
}

/**
 * Complete table display component with all refined styling and features.
 * This preserves the table layout design with:
 * - Date grouping with gray containers
 * - Horizontal dividers starting from time column
 * - White column backgrounds
 * - Task row hover effects
 * - Date range filtering integration
 */
const TableTaskDisplay = (props: TableTaskDisplayProps) => {
  return <TaskTable {...props} />;
};

export default TableTaskDisplay;