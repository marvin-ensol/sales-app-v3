import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { SequenceTaskList } from "./SequenceTaskList";

interface SequenceTask {
  id: string;
  taskName: string;
  delay: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

interface SequenceConfigProps {
  categoryId: number;
  onSave: (config: SequenceConfig) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

interface SequenceConfig {
  categoryId: number;
  createInitialTask: boolean;
  initialTaskName: string;
  sequenceTasks: SequenceTask[];
}

export const SequenceConfig = ({ 
  categoryId, 
  onSave, 
  onCancel, 
  isSubmitting 
}: SequenceConfigProps) => {
  const [createInitialTask, setCreateInitialTask] = useState(true);
  const [initialTaskName, setInitialTaskName] = useState("");
  const [sequenceTasks, setSequenceTasks] = useState<SequenceTask[]>([
    {
      id: "task-1",
      taskName: "",
      delay: { amount: 1, unit: 'hours' }
    }
  ]);

  const handleSave = async () => {
    try {
      await onSave({
        categoryId,
        createInitialTask,
        initialTaskName,
        sequenceTasks
      });
    } catch (error) {
      console.error('Error saving sequence config:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Task 1 Configuration */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
        <h4 className="font-medium">Tâche 1</h4>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="create-initial-task"
            checked={createInitialTask}
            onCheckedChange={(checked) => setCreateInitialTask(checked as boolean)}
          />
          <label
            htmlFor="create-initial-task"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Créer une tâche quand le contact entre dans une liste
          </label>
        </div>

        {createInitialTask && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Nom de la tâche</Label>
            <Input
              value={initialTaskName}
              onChange={(e) => setInitialTaskName(e.target.value)}
              placeholder="Nom de la première tâche"
            />
          </div>
        )}

        {!createInitialTask && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              La séquence ne sera activée que si une première tâche est ajoutée dans cette catégorie pour un contact donné
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Subsequent Tasks */}
      <div className="space-y-4">
        <h4 className="font-medium">Tâches suivantes</h4>
        <SequenceTaskList
          tasks={sequenceTasks}
          onTasksChange={setSequenceTasks}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSubmitting}
          className="bg-black hover:bg-gray-800 text-white"
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
};