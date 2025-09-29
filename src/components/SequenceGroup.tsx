import { Task } from '@/types/task';
import TaskCard from './TaskCard';

interface SequenceGroupProps {
  sequenceNumber: number | null;
  tasks: Task[];
  categoryColor: string;
  onMove: (taskId: string, newQueue: string) => void;
  onFrameUrlChange: (url: string) => void;
  onTaskAssigned?: () => void;
  onTaskSkipped?: () => void;
}

const SequenceGroup = ({
  sequenceNumber,
  tasks,
  categoryColor,
  onMove,
  onFrameUrlChange,
  onTaskAssigned,
  onTaskSkipped
}: SequenceGroupProps) => {
  if (tasks.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 px-2 py-1 bg-muted/30 rounded-md border-l-2 border-muted">
        <span className="text-sm font-medium text-muted-foreground">
          {sequenceNumber !== null ? `Séquence : tâche ${sequenceNumber}` : 'Hors séquence'}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.map(task => (
          <TaskCard
            key={`${task.id}-${task.queue}`}
            task={task}
            onMove={(taskId, newStatus) => onMove(taskId, newStatus)}
            onFrameUrlChange={onFrameUrlChange}
            onTaskAssigned={onTaskAssigned}
            onTaskSkipped={onTaskSkipped}
            categoryColor={categoryColor}
          />
        ))}
      </div>
    </div>
  );
};

export default SequenceGroup;