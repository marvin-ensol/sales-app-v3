
import { Clock, User } from "lucide-react";
import { Task, TaskStatus } from "@/types/task";

interface TaskCardProps {
  task: Task;
  onMove: (taskId: string, newStatus: TaskStatus) => void;
}

const TaskCard = ({ task }: TaskCardProps) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-red-500";
      case "medium":
        return "border-l-orange-500";
      case "low":
        return "border-l-green-500";
      default:
        return "border-l-gray-300";
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 ${getPriorityColor(task.priority)} p-4 hover:shadow-md transition-shadow cursor-pointer`}>
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900 text-sm leading-relaxed">
          {task.title}
        </h4>
        
        <div className="space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <User className="h-3 w-3 mr-2 flex-shrink-0" />
            <span className="font-medium">Contact</span>
          </div>
          <div className="text-sm text-gray-900 font-medium ml-5">
            {task.contact}
          </div>
        </div>

        {task.dueDate && (
          <div className="space-y-1">
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-3 w-3 mr-2 flex-shrink-0" />
              <span>Infos</span>
            </div>
            <div className="text-sm text-gray-900 ml-5">
              {task.dueDate}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
