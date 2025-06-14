
import { useState } from "react";
import { Clock, ChevronDown, ChevronUp, Edit, User } from "lucide-react";
import { Task, TaskStatus } from "@/types/task";
import { useOverdueCounter } from "@/hooks/useOverdueCounter";

interface TaskCardProps {
  task: Task;
  onMove: (taskId: string, newStatus: TaskStatus) => void;
  onFrameUrlChange: (url: string) => void;
  showOwner?: boolean;
}

const TaskCard = ({ task, onMove, onFrameUrlChange, showOwner }: TaskCardProps) => {
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

  const getFrenchWeekday = (dateString: string) => {
    if (!dateString) return "";
    const [datePart] = dateString.split(' à ');
    if (!datePart) return "";
    const [day, month] = datePart.split('/');
    const currentYear = new Date().getFullYear();
    const date = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    const weekdays = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
    return weekdays[date.getDay()];
  };

  const handleCardClick = () => {
    console.log('TaskCard clicked, task:', task.title);
    console.log('Task contactId:', task.contactId);
    console.log('onFrameUrlChange function:', typeof onFrameUrlChange);
    
    if (task.contactId) {
      const hubspotUrl = `https://app-eu1.hubspot.com/contacts/142467012/record/0-1/${task.contactId}`;
      console.log('Calling frame URL change with:', hubspotUrl);
      console.log('About to call onFrameUrlChange...');
      onFrameUrlChange(hubspotUrl);
      console.log('onFrameUrlChange called successfully');
    } else {
      console.log('No contactId found for task');
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Edit button clicked');
    if (task.contactId && task.hubspotId) {
      const taskDetailsUrl = `https://app-eu1.hubspot.com/contacts/142467012/contact/${task.contactId}/?engagement=${task.hubspotId}`;
      console.log('Calling edit URL change with:', taskDetailsUrl);
      onFrameUrlChange(taskDetailsUrl);
    }
  };

  const handleDescriptionToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDescription(!showDescription);
  };

  const cardBackgroundClass = isOverdue ? "bg-red-50" : "bg-white";
  const weekday = getFrenchWeekday(task.dueDate);

  return (
    <div
      className={`${cardBackgroundClass} rounded-lg shadow-sm border border-gray-200 border-l-4 ${getPriorityColor(
        task.priority
      )} p-4 hover:shadow-md transition-shadow cursor-pointer relative`}
      onClick={handleCardClick}
    >
      {/* Edit icon in top right corner */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={handleEditClick}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Edit task"
        >
          <Edit className="h-4 w-4 text-gray-600 hover:text-gray-800" />
        </button>
      </div>

      <div className="space-y-3 pr-8">
        {/* OWNER ROW (with icon), only if showOwner is true */}
        {showOwner && (
          <div className="flex items-center text-sm font-medium text-gray-700 mb-1">
            <User className="h-4 w-4 mr-2 text-gray-400" />
            <span>{task.owner}</span>
          </div>
        )}
        {/* Contact name in bold */}
        <div className="font-bold text-gray-900 text-base">
          {task.contact}
        </div>

        {/* Task name */}
        <h4 className="font-medium text-gray-700 text-sm leading-relaxed">
          {task.title}
        </h4>

        {/* Due date with weekday */}
        {task.dueDate && (
          <div className="flex items-center text-sm">
            <Clock className="h-3 w-3 mr-2 flex-shrink-0 text-gray-600" />
            <div>
              <div className={`font-medium ${isOverdue ? "text-red-700" : "text-gray-900"}`}>
                {weekday && `${weekday} `}{task.dueDate}
              </div>
              {isOverdue && counter && (
                <div className="text-red-600 font-semibold text-xs mt-1">
                  Overdue: {counter}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Description toggle */}
        {task.description && (
          <div className="space-y-1">
            <div
              className="flex items-center text-sm text-gray-600 cursor-pointer hover:text-gray-800"
              onClick={handleDescriptionToggle}
            >
              <span className="font-medium">Description</span>
              {showDescription ? (
                <ChevronUp className="h-3 w-3 ml-2 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-2 flex-shrink-0" />
              )}
            </div>
            {/* Balanced full-width description box */}
            {showDescription && (
              <div className="text-sm text-gray-700 mt-2 bg-gray-50 rounded px-5 py-3">
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
