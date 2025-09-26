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
    <div className="space-y-3 p-4 border rounded-lg bg-slate-50/80 border-slate-200">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Tâche {taskNumber}</h4>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
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

      <div className="space-y-2">
        <label className="text-sm font-medium">Nom de cette tâche</label>
        <Input
          value={task.taskName}
          onChange={handleNameChange}
          onBlur={() => onValidateTaskName?.(task.taskName, `sequenceTask_${taskIndex}_name`)}
          placeholder="Nom de la tâche"
        />
        {validationErrors[`sequenceTask_${taskIndex}_name`] && (
          <p className="text-sm text-destructive mt-1">{validationErrors[`sequenceTask_${taskIndex}_name`]}</p>
        )}
      </div>

      <TaskOwnerSelector
        value={task.owner}
        onChange={handleOwnerChange}
      />
    </div>
  );
};