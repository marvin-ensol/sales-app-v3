
import { useState } from "react";
import { Clock, User, ChevronDown, ChevronUp } from "lucide-react";
import { Task, TaskStatus } from "@/types/task";
import { useOverdueCounter } from "@/hooks/useOverdueCounter";

interface TaskCardProps {
  task: Task;
  onMove: (taskId: string, newStatus: TaskStatus) => void;
}

const TaskCard = ({ task }: TaskCardProps) => {
  const { counter, isOverdue } = useOverdueCounter(task.dueDate);
  const [showDescription, setShowDescription] = useState(false);

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

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation when clicking on description toggle
    if ((e.target as HTMLElement).closest('[data-description-toggle]')) {
      return;
    }
    
    if (task.contactId) {
      // Open HubSpot contact page in new tab
      const hubspotUrl = `https://app-eu1.hubspot.com/contacts/142467012/record/0-1/${task.contactId}`;
      window.open(hubspotUrl, '_blank');
    }
  };

  const handleDescriptionToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDescription(!showDescription);
  };

  const cardBackgroundClass = isOverdue ? "bg-red-50" : "bg-white";

  return (
    <div 
      className={`${cardBackgroundClass} rounded-lg shadow-sm border border-gray-200 border-l-4 ${getPriorityColor(task.priority)} p-4 hover:shadow-md transition-shadow cursor-pointer`}
      onClick={handleCardClick}
    >
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
              <span>Due Date</span>
            </div>
            <div className="text-sm ml-5">
              <div className={`font-medium ${isOverdue ? 'text-red-700' : 'text-gray-900'}`}>
                {task.dueDate}
              </div>
              {isOverdue && counter && (
                <div className="text-red-600 font-semibold text-xs mt-1">
                  Overdue: {counter}
                </div>
              )}
            </div>
          </div>
        )}

        {task.description && (
          <div className="space-y-1">
            <div 
              className="flex items-center text-sm text-gray-600 cursor-pointer hover:text-gray-800"
              onClick={handleDescriptionToggle}
              data-description-toggle
            >
              <span className="font-medium">Description</span>
              {showDescription ? (
                <ChevronUp className="h-3 w-3 ml-2 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-2 flex-shrink-0" />
              )}
            </div>
            {showDescription && (
              <div className="text-sm text-gray-700 ml-0 mt-2 p-2 bg-gray-50 rounded">
                {task.description}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
