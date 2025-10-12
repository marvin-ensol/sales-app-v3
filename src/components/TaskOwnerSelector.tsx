import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskOwnerType } from "./SequenceTaskList";

interface TaskOwnerSelectorProps {
  value: TaskOwnerType;
  onChange: (value: TaskOwnerType) => void;
  excludeOptions?: TaskOwnerType[];
}

export const TaskOwnerSelector = ({ value, onChange, excludeOptions = [] }: TaskOwnerSelectorProps) => {
  const allOwnerOptions = [
    { value: 'no_owner', label: 'Aucun propriétaire' },
    { value: 'contact_owner', label: 'Propriétaire du contact' },
    { value: 'previous_task_owner', label: 'Propriétaire de la tâche précédente' }
  ];

  const ownerOptions = allOwnerOptions.filter(option => 
    !excludeOptions.includes(option.value as TaskOwnerType)
  );

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Propriétaire de la tâche</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-background">
          <SelectValue placeholder="Sélectionner un propriétaire..." />
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