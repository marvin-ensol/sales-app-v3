import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskOwnerType } from "./SequenceTaskList";

interface TaskOwnerSelectorProps {
  value: TaskOwnerType;
  onChange: (value: TaskOwnerType) => void;
}

export const TaskOwnerSelector = ({ value, onChange }: TaskOwnerSelectorProps) => {
  const ownerOptions = [
    { value: 'no_owner', label: 'Aucun owner' },
    { value: 'contact_owner', label: 'Owner du contact' },
    { value: 'previous_task_owner', label: 'Owner de la tâche précédente' }
  ];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Owner de la tâche</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-background">
          <SelectValue placeholder="Sélectionner un owner..." />
        </SelectTrigger>
        <SelectContent className="bg-background border z-50">
          {ownerOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};