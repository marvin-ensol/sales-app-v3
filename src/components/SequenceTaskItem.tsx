import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DelaySelector } from "./DelaySelector";
import { TaskOwnerSelector } from "./TaskOwnerSelector";
import { Trash2 } from "lucide-react";
import { TaskOwnerType } from "./SequenceTaskList";

interface SequenceTask {
  id: string;
  taskName: string;
  owner: TaskOwnerType;
  delay: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

interface SequenceTaskItemProps {
  task: SequenceTask;
  taskNumber: number;
  onUpdate: (task: SequenceTask) => void;
  onRemove: () => void;
  canRemove: boolean;
  validationErrors?: Record<string, string>;
  taskIndex?: number;
  onValidateTaskName?: (name: string, fieldKey: string) => void;
  onValidateDelay?: (amount: number, unit: string, fieldKey: string) => void;
}

export const SequenceTaskItem = ({ 
  task, 
  taskNumber, 
  onUpdate, 
  onRemove, 
  canRemove,
  validationErrors = {},
  taskIndex = 0,
  onValidateTaskName,
  onValidateDelay
}: SequenceTaskItemProps) => {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...task, taskName: e.target.value });
  };

  const handleDelayChange = (delay: { amount: number; unit: 'minutes' | 'hours' | 'days' }) => {
    onUpdate({ ...task, delay });
  };

  const handleOwnerChange = (owner: TaskOwnerType) => {
    onUpdate({ ...task, owner });
  };

  return (
    <div className="p-4 border rounded-lg bg-slate-50/80 border-slate-200">
      {/* Header with task number and inline name input */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <h4 className="font-medium whitespace-nowrap">Tâche {taskNumber}</h4>
            <Input
              value={task.taskName}
              onChange={handleNameChange}
              onBlur={() => onValidateTaskName?.(task.taskName, `sequenceTask_${taskIndex}_name`)}
              placeholder="Nom de cette tâche"
              className="flex-1"
            />
          </div>
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {validationErrors[`sequenceTask_${taskIndex}_name`] && (
          <p className="text-sm text-destructive">{validationErrors[`sequenceTask_${taskIndex}_name`]}</p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200/80 my-4"></div>
      
      {/* Rest of the content */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Délai après la validation de la tâche précédente
          </label>
          <DelaySelector
            value={task.delay}
            onChange={handleDelayChange}
            error={validationErrors[`sequenceTask_${taskIndex}_delay`]}
            onValidate={onValidateDelay ? (amount, unit) => onValidateDelay(amount, unit, `sequenceTask_${taskIndex}_delay`) : undefined}
          />
        </div>

        <TaskOwnerSelector
          value={task.owner}
          onChange={handleOwnerChange}
        />
      </div>
    </div>
  );
};