import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { TaskOwnerType } from "./SequenceTaskList";

interface TaskOwnerSelectorProps {
  value: TaskOwnerType;
  onChange: (value: TaskOwnerType) => void;
}

export const TaskOwnerSelector = ({ value, onChange }: TaskOwnerSelectorProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Owner de la tâche</label>
      <RadioGroup value={value} onValueChange={(value) => onChange(value as TaskOwnerType)}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="no_owner" id="no_owner" />
          <Label htmlFor="no_owner">Aucun owner</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="contact_owner" id="contact_owner" />
          <Label htmlFor="contact_owner">Owner du contact</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="previous_task_owner" id="previous_task_owner" />
          <Label htmlFor="previous_task_owner">Owner de la tâche précédente</Label>
        </div>
      </RadioGroup>
    </div>
  );
};