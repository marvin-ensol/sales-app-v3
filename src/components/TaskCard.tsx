
import { useState } from "react";
import { Clock, ChevronDown, ChevronUp, User, Phone, Plus, Trash2, AlertCircle, Check, Pen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Task, TaskStatus } from "@/types/task";
import { useOverdueCounter } from "@/hooks/useOverdueCounter";
import { useTaskAssignment } from "@/hooks/useTaskAssignment";
import { useTaskSkipping } from "@/hooks/useTaskSkipping";
import { useTaskCompletion } from "@/hooks/useTaskCompletion";
import { getFrenchWeekday } from "@/lib/dateUtils";

interface TaskCardProps {
  task: Task;
  onMove: (taskId: string, newStatus: TaskStatus) => void;
  onFrameUrlChange: (url: string) => void;
  showOwner?: boolean;
  onTaskAssigned?: () => void;
  selectedOwnerId?: string;
  onTaskSkipped?: () => void;
  onTaskCompleted?: () => void;
  categoryColor?: string; // New prop for category color
}

const TaskCard = ({ task, onMove, onFrameUrlChange, showOwner, onTaskAssigned, selectedOwnerId, onTaskSkipped, onTaskCompleted, categoryColor }: TaskCardProps) => {
  const { counter, isOverdue } = useOverdueCounter(task.hsTimestamp);
  const [showDescription, setShowDescription] = useState(false);
  const [isConfirmingComplete, setIsConfirmingComplete] = useState(false);
  const [isConfirmingSkip, setIsConfirmingSkip] = useState(false);
  const { isAssigning, assignTask } = useTaskAssignment();
  const { isSkipping, skipTask } = useTaskSkipping();
  const { completeTask, isCompleting, isTaskOptimisticallyCompleted } = useTaskCompletion();

  const getLeftBorderColor = () => {
    if (categoryColor) {
      return categoryColor;
    }
    // Fallback to priority-based colors
    switch (task.priority) {
      case "high":
        return "#ef4444";
      case "medium":
        return "#f97316";
      case "low":
        return "#22c55e";
      default:
        return "#d1d5db";
    }
  };

  const weekday = getFrenchWeekday(task.dueDate);

  const handleCardClick = () => {
    if (task.isUnassigned) {
      return;
    }

    console.log('TaskCard clicked, task:', task.title);
    console.log('Task contactId:', task.contactId);
    console.log('onFrameUrlChange function:', typeof onFrameUrlChange);
    
    if (task.contactId) {
      const hubspotUrl = `https://app-eu1.hubspot.com/contacts/142467012/record/0-1/${task.contactId}`;
      console.log('Opening HubSpot URL:', hubspotUrl);
      onFrameUrlChange(hubspotUrl);
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

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.contactPhone) {
      window.location.href = `tel:${task.contactPhone}`;
    }
  };

  const handleUnassignedContactClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!selectedOwnerId) {
      return;
    }
    
    await assignTask(
      task.id,
      task.hubspotId,
      task.contactId,
      selectedOwnerId,
      onTaskAssigned
    );
  };

  const handleSkipTask = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isConfirmingSkip) {
      // First click - show confirmation
      setIsConfirmingSkip(true);
    } else {
      // Second click - confirm skip
      try {
        await skipTask(task.hubspotId, task.id, task.title, onTaskSkipped);
        setIsConfirmingSkip(false);
      } catch (error) {
        console.error('Failed to skip task:', error);
        setIsConfirmingSkip(false);
      }
    }
  };

  const handleCompleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isConfirmingComplete) {
      // First click - show confirmation
      setIsConfirmingComplete(true);
    } else {
      // Second click - confirm completion
      try {
        await completeTask(task.hubspotId, task.id, onTaskCompleted);
        setIsConfirmingComplete(false);
      } catch (error) {
        console.error('Failed to complete task:', error);
        setIsConfirmingComplete(false);
      }
    }
  };

  const cardBackgroundClass = isOverdue ? "bg-red-50" : "bg-white";
  const cursorStyle = task.isUnassigned ? "cursor-default" : "cursor-pointer";
  
  // Hide card if optimistically completed
  if (isTaskOptimisticallyCompleted(task.id)) {
    return null;
  }

  return (
    <div
      className={`${cardBackgroundClass} rounded-lg shadow-sm border border-gray-200 border-l-4 p-3 m-2 hover:shadow-md transition-shadow ${cursorStyle} relative max-w-full group`}
      style={{
        borderLeftColor: getLeftBorderColor()
      }}
      onClick={handleCardClick}
    >
      {/* Action bar - appears on card hover */}
      {!task.isUnassigned && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div 
            className={`flex items-center gap-2 bg-white rounded-md shadow-sm border p-2 ${
              isConfirmingComplete || isConfirmingSkip ? 'cursor-pointer' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (isConfirmingComplete) {
                handleCompleteClick(e);
              } else if (isConfirmingSkip) {
                handleSkipTask(e);
              }
            }}
          >
            {!isConfirmingComplete && !isConfirmingSkip && (
              <button
                type="button"
                onClick={handleCompleteClick}
                disabled={isCompleting}
                className="p-1.5 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                title="Marquer comme terminé"
              >
                <Check className={`h-5 w-5 transition-colors ${isCompleting ? 'text-muted-foreground' : 'text-green-600 hover:text-green-700'}`} />
              </button>
            )}
            {isConfirmingComplete && (
              <>
                <button
                  type="button"
                  onClick={handleCompleteClick}
                  disabled={isCompleting}
                  className="p-1.5 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                  title="Marquer comme terminé"
                >
                  <Check className={`h-5 w-5 transition-colors ${isCompleting ? 'text-muted-foreground' : 'text-green-600 hover:text-green-700'}`} />
                </button>
                <span className="text-xs text-gray-600 font-medium">
                  Confirmer ?
                </span>
              </>
            )}
            {isConfirmingSkip && (
              <>
                <button
                  type="button"
                  onClick={handleSkipTask}
                  disabled={isSkipping}
                  className="p-1.5 hover:bg-orange-50 rounded transition-colors disabled:opacity-50"
                  title="Sauter la tâche"
                >
                  <Trash2 className={`h-5 w-5 transition-colors ${isSkipping ? 'text-muted-foreground' : 'text-orange-600 hover:text-orange-700'}`} />
                </button>
                <span className="text-xs text-gray-600 font-medium">
                  Confirmer ?
                </span>
              </>
            )}
            {!isConfirmingComplete && !isConfirmingSkip && (
              <>
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Modifier la tâche"
                >
                  <Pen className="h-5 w-5 text-gray-600 hover:text-gray-800" />
                </button>
                <button
                  type="button"
                  onClick={handleSkipTask}
                  disabled={isSkipping}
                  className="p-1.5 hover:bg-orange-50 rounded transition-colors disabled:opacity-50"
                  title="Sauter la tâche"
                >
                  <Trash2 className={`h-5 w-5 transition-colors ${isSkipping ? 'text-muted-foreground' : 'text-orange-600 hover:text-orange-700'}`} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2 pr-6">
        {/* OWNER ROW (with icon), only if showOwner is true */}
        {showOwner && (
          <div className="flex items-center text-xs font-medium text-gray-700 mb-1">
            <User className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
            <span className="truncate">{task.owner}</span>
            {task.isUnassigned && (
              <span className="ml-1 text-orange-600 font-semibold text-xs">(Unassigned)</span>
            )}
          </div>
        )}
        
        {/* Contact name in bold with hover effects */}
        <div className="relative">
          {task.isUnassigned && task.queue === 'new' ? (
            <div 
              className={`font-bold text-gray-900 text-sm leading-tight break-words transition-all duration-200 ${
                isAssigning ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={handleUnassignedContactClick}
            >
              <span className="inline-flex items-center gap-1">
                <span className="inline-block hover:bg-green-100 hover:text-green-800 hover:rounded px-1 py-0.5 hover:cursor-pointer">
                  {task.contact}
                </span>
                <Plus className="h-3 w-3 opacity-0 hover:opacity-100 transition-opacity duration-200" />
              </span>
            </div>
          ) : (
            <div 
              className={`font-bold text-gray-900 text-sm leading-tight break-words transition-all duration-200`}
              onClick={task.contactPhone && !task.isUnassigned ? handlePhoneClick : undefined}
            >
              <span className="inline-flex items-center gap-1">
                <span className={`inline-block px-1 py-0.5 ${
                  task.contactPhone && !task.isUnassigned
                    ? 'hover:bg-blue-100 hover:text-blue-800 hover:rounded hover:cursor-pointer' 
                    : ''
                }`}>
                  {task.contact}
                </span>
                {task.contactPhone && !task.isUnassigned && (
                  <Phone className="h-3 w-3 opacity-0 hover:opacity-100 transition-opacity duration-200" />
                )}
              </span>
            </div>
          )}
        </div>

        {/* Task name - hidden for unassigned tasks */}
        {!task.isUnassigned && (
          <h4 className="font-medium text-gray-700 text-xs leading-relaxed break-words">
            {task.title}
          </h4>
        )}

        {/* Due date with weekday */}
        {task.dueDate && (
          <div className="flex items-start text-xs">
            <Clock className="h-3 w-3 mr-1 flex-shrink-0 text-gray-600 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium break-words text-gray-900">
                  {weekday && `${weekday} `}{task.dueDate}
                </div>
                {isOverdue && counter && (
                  <Badge variant="destructive" className="text-xs px-2 py-0 h-5 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {counter}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Description toggle */}
        {task.description && (
          <div className="space-y-1">
            <div
              className="flex items-center text-xs text-gray-600 cursor-pointer hover:text-gray-800"
              onClick={handleDescriptionToggle}
            >
              <span className="font-medium">Description</span>
              {showDescription ? (
                <ChevronUp className="h-3 w-3 ml-1 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0" />
              )}
            </div>
            {showDescription && (
              <div className="text-xs text-gray-700 mt-2 bg-gray-50 rounded px-3 py-2 break-words">
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
