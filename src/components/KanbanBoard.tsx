
import { useState } from "react";
import { Plus, Filter, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import KanbanColumn from "./KanbanColumn";
import TaskCard from "./TaskCard";
import { Task, TaskStatus } from "@/types/task";
import { useHubSpotTasks } from "@/hooks/useHubSpotTasks";

// Define columns based on HubSpot task statuses
const columns = [
  { id: "not_started", title: "Not Started", color: "border-gray-400 bg-gray-50" },
  { id: "in_progress", title: "In Progress", color: "border-blue-400 bg-blue-50" },
  { id: "waiting", title: "Waiting", color: "border-orange-400 bg-orange-50" },
  { id: "completed", title: "Completed", color: "border-green-400 bg-green-50" },
  { id: "deferred", title: "Deferred", color: "border-purple-400 bg-purple-50" }
];

const KanbanBoard = () => {
  const { tasks, loading, error, refetch } = useHubSpotTasks();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTasksByStatus = (status: TaskStatus) => {
    return filteredTasks.filter(task => task.status === status);
  };

  const handleTaskMove = (taskId: string, newStatus: TaskStatus) => {
    // Note: In a real implementation, you'd want to update the task in HubSpot
    // For now, this is just visual until we implement the update functionality
    console.log(`Moving task ${taskId} to ${newStatus}`);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading tasks: {error}</p>
          <Button onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search tasks or contacts..."
              className="pl-10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-sm text-gray-500">Syncing with HubSpot...</span>}
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-6 overflow-x-auto pb-6">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            title={column.title}
            color={column.color}
            count={getTasksByStatus(column.id as TaskStatus).length}
          >
            <div className="space-y-3">
              {getTasksByStatus(column.id as TaskStatus).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onMove={handleTaskMove}
                />
              ))}
              {getTasksByStatus(column.id as TaskStatus).length === 0 && !loading && (
                <div className="text-center text-gray-500 py-8">
                  No tasks
                </div>
              )}
            </div>
          </KanbanColumn>
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;
