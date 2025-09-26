import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DelaySelector } from "./DelaySelector";
import { Trash2 } from "lucide-react";

interface SequenceTask {
  id: string;
  taskName: string;
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
}

export const SequenceTaskItem = ({ 
  task, 
  taskNumber, 
  onUpdate, 
  onRemove, 
  canRemove 
}: SequenceTaskItemProps) => {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...task, taskName: e.target.value });
  };

  const handleDelayChange = (delay: { amount: number; unit: 'minutes' | 'hours' | 'days' }) => {
    onUpdate({ ...task, delay });
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
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Nom de cette tâche</label>
        <Input
          value={task.taskName}
          onChange={handleNameChange}
          placeholder="Nom de la tâche"
        />
      </div>
    </div>
  );
};