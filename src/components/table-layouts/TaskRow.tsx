import { useState } from "react";
import { Phone, Edit, Trash2, Plus, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Task, TaskStatus } from "@/types/task";
import { useOverdueCounter } from "@/hooks/useOverdueCounter";
import { useTaskAssignment } from "@/hooks/useTaskAssignment";
import { useTaskSkipping } from "@/hooks/useTaskSkipping";
import { getFrenchMonthAbbreviation, extractDay, extractTime, getFrenchDayOfWeek } from "@/lib/dateUtils";
import { generateCategoryColors } from "@/lib/colorUtils";

interface TaskRowProps {
  task: Task;
  onMove: (taskId: string, newStatus: TaskStatus) => void;
  onFrameUrlChange: (url: string) => void;
  onTaskAssigned?: () => void;
  selectedOwnerId?: string;
  onTaskSkipped?: () => void;
  categoryColor?: string;
  showDateColumns?: boolean; // If false, don't show month/day columns (for grouped display)
}

const TaskRow = ({ 
  task, 
  onMove, 
  onFrameUrlChange, 
  onTaskAssigned, 
  selectedOwnerId, 
  onTaskSkipped, 
  categoryColor,
  showDateColumns = true 
}: TaskRowProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { counter, isOverdue } = useOverdueCounter(task.hsTimestamp);
  const { isAssigning, assignTask } = useTaskAssignment();
  const { isSkipping, skipTask } = useTaskSkipping();

  const monthAbbr = getFrenchMonthAbbreviation(task.dueDate);
  const day = extractDay(task.dueDate);
  const dayOfWeek = getFrenchDayOfWeek(task.dueDate);
  const time = extractTime(task.dueDate);

  const handleRowClick = () => {
    if (task.isUnassigned) return;

    console.log('TaskRow clicked, task:', task.title);
    console.log('Task contactId:', task.contactId);
    
    if (task.contactId) {
      const hubspotUrl = `https://app-eu1.hubspot.com/contacts/142467012/record/0-1/${task.contactId}`;
      console.log('Opening HubSpot URL:', hubspotUrl);
      onFrameUrlChange(hubspotUrl);
    }
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.contactPhone) {
      window.location.href = `tel:${task.contactPhone}`;
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

  const handleSkipTask = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await skipTask(task.hubspotId, task.id, task.title, onTaskSkipped);
  };

  const handleUnassignedContactClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!selectedOwnerId) return;
    
    await assignTask(
      task.id,
      task.hubspotId,
      task.contactId,
      selectedOwnerId,
      onTaskAssigned
    );
  };

  // Generate category-based hover colors
  const categoryColors = categoryColor ? generateCategoryColors(categoryColor) : null;
  
  const getRowBgClass = () => {
    if (isHovered && categoryColors) {
      return "transition-colors";
    }
    return "transition-colors";
  };

  const getRowBgStyle = () => {
    if (isHovered && categoryColors) {
      return { backgroundColor: categoryColors.hoverBg };
    }
    return {};
  };

  const cursorStyle = task.isUnassigned ? "cursor-default" : "cursor-pointer";

  return (
    <div
      className={`${getRowBgClass()} ${cursorStyle} group`}
      style={getRowBgStyle()}
      onClick={handleRowClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="grid grid-cols-[40px_32px_32px_48px_200px_1fr_auto] items-center py-2 px-3 gap-3 relative">
        {/* Month Column */}
        <div className="text-xs font-medium text-gray-600">
          {showDateColumns ? monthAbbr : ''}
        </div>
        
        {/* Day Column */}
        <div className="text-xs font-medium text-gray-900">
          {showDateColumns ? day : ''}
        </div>
        
        {/* Day of Week Column */}
        <div className="text-xs text-gray-500">
          {showDateColumns ? dayOfWeek : ''}
        </div>
        
        {/* Time Column */}
        <div className="text-xs text-gray-600">
          <div className="flex items-center gap-2">
            {time}
            {isOverdue && counter && (
              <Badge variant="destructive" className="text-xs px-1 py-0 h-4 flex items-center gap-1">
                <AlertCircle className="h-2 w-2" />
                {counter}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Contact Column */}
        <div className="min-w-0 max-w-[200px]">
          {task.isUnassigned && task.queue === 'new' ? (
            <div 
              className={`font-medium text-sm text-gray-900 truncate transition-all duration-200 hover:text-green-700 ${
                isAssigning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              onClick={handleUnassignedContactClick}
              title={task.contact}
            >
              <span className="inline-flex items-center gap-1">
                {task.contact.length > 20 ? `${task.contact.substring(0, 17)}...` : task.contact}
                <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </span>
            </div>
          ) : (
            <div 
              className={`font-medium text-sm text-gray-900 truncate transition-all duration-200 ${
                task.contactPhone && !task.isUnassigned
                  ? 'hover:text-blue-700 cursor-pointer' 
                  : ''
              }`}
              onClick={task.contactPhone && !task.isUnassigned ? handlePhoneClick : undefined}
              title={task.contact}
            >
              {task.contact.length > 20 ? `${task.contact.substring(0, 17)}...` : task.contact}
            </div>
          )}
        </div>
        
        {/* Task Title Column */}
        <div className="min-w-0 text-left">
          {!task.isUnassigned && (
            <div className={`text-sm truncate ${
              isOverdue 
                ? 'font-bold text-red-600' 
                : 'text-gray-700'
            }`}>
              {task.title}
            </div>
          )}
        </div>
        
        {/* Action Icons - Only show on hover for non-unassigned tasks */}
        {!task.isUnassigned && (
          <div className={`flex items-center gap-1 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            {task.contactPhone && (
              <button
                onClick={handlePhoneClick}
                className="p-1 hover:bg-blue-100 rounded transition-colors"
                title="Appeler"
              >
                <Phone className="h-3 w-3 text-blue-600 hover:text-blue-800" />
              </button>
            )}
            <button
              onClick={handleEditClick}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Modifier la tâche"
            >
              <Edit className="h-3 w-3 text-gray-600 hover:text-gray-800" />
            </button>
            <button
              onClick={handleSkipTask}
              disabled={isSkipping}
              className="p-1 hover:bg-orange-100 rounded transition-colors disabled:opacity-50"
              title="Sauter la tâche"
            >
              <Trash2 className={`h-3 w-3 transition-colors ${isSkipping ? 'text-gray-400' : 'text-orange-600 hover:text-orange-800'}`} />
            </button>
          </div>
        )}
        
        {/* Unassigned task action */}
        {task.isUnassigned && task.queue === 'new' && (
          <div className={`flex items-center transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={handleUnassignedContactClick}
              disabled={isAssigning}
              className="p-1 hover:bg-green-100 rounded transition-colors disabled:opacity-50"
              title="Assigner la tâche"
            >
              <Plus className={`h-3 w-3 transition-colors ${isAssigning ? 'text-gray-400' : 'text-green-600 hover:text-green-800'}`} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskRow;