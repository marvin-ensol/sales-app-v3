import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SequenceTaskItem } from "./SequenceTaskItem";
import { Plus } from "lucide-react";

interface SequenceTask {
  id: string;
  taskName: string;
  delay: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

interface SequenceTaskListProps {
  tasks: SequenceTask[];
  onTasksChange: (tasks: SequenceTask[]) => void;
}

export const SequenceTaskList = ({ tasks, onTasksChange }: SequenceTaskListProps) => {
  const addTask = () => {
    const newTask: SequenceTask = {
      id: `task-${Date.now()}`,
      taskName: '',
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
    const newTasks = tasks.filter((_, i) => i !== index);
    onTasksChange(newTasks);
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
          canRemove={tasks.length > 1 && index > 0}
        />
      ))}
      
      <Button
        type="button"
        variant="outline"
        onClick={addTask}
      >
        <Plus className="h-4 w-4 mr-2" />
        Ajouter une tâche
      </Button>
    </div>
  );
};