import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SequenceTaskItem } from "./SequenceTaskItem";
import { Plus } from "lucide-react";

export type TaskOwnerType = 'no_owner' | 'contact_owner' | 'previous_task_owner';

interface SequenceTask {
  id: string;
  taskName: string;
  owner: TaskOwnerType;
  delay: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

interface SequenceTaskListProps {
  tasks: SequenceTask[];
  onTasksChange: (tasks: SequenceTask[]) => void;
  onSequenceDelete?: () => void;
  validationErrors?: Record<string, string>;
}

export const SequenceTaskList = ({ tasks, onTasksChange, onSequenceDelete, validationErrors = {} }: SequenceTaskListProps) => {
  const addTask = () => {
    const newTask: SequenceTask = {
      id: `task-${Date.now()}`,
      taskName: '',
      owner: 'previous_task_owner',
      delay: { amount: 1, unit: 'hours' }
    };
    onTasksChange([...tasks, newTask]);
  };

  const updateTask = (index: number, updatedTask: SequenceTask) => {
    const newTasks = [...tasks];
    newTasks[index] = updatedTask;
    onTasksChange(newTasks);
  };

  const removeTask = (index: number) => {
    if (index === 0 && onSequenceDelete) {
      // If removing the first task (Task 2), delete the entire sequence
      onSequenceDelete();
    } else {
      const newTasks = tasks.filter((_, i) => i !== index);
      onTasksChange(newTasks);
    }
  };

  return (
    <div className="space-y-4">
      {tasks.map((task, index) => (
        <SequenceTaskItem
          key={task.id}
          task={task}
          taskNumber={index + 2} // Start from 2 since Task 1 is handled separately
          onUpdate={(updatedTask) => updateTask(index, updatedTask)}
          onRemove={() => removeTask(index)}
          canRemove={true}
          validationErrors={validationErrors}
          taskIndex={index}
        />
      ))}
      
      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          onClick={addTask}
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une tâche
        </Button>
      </div>
    </div>
  );
};