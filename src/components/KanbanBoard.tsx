
import { useState } from "react";
import { Filter, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import KanbanColumn from "./KanbanColumn";
import TaskCard from "./TaskCard";
import { Task, TaskQueue } from "@/types/task";
import { useHubSpotTasks } from "@/hooks/useHubSpotTasks";
import { useHubSpotOwners } from "@/hooks/useHubSpotOwners";

// Define columns based on task queues
const columns = [
  { id: "new", title: "New", color: "border-blue-400 bg-blue-50" },
  { id: "attempted", title: "Attempted", color: "border-orange-400 bg-orange-50" },
  { id: "other", title: "Other", color: "border-gray-400 bg-gray-50" }
];

const KanbanBoard = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("all");
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  
  const { owners, loading: ownersLoading } = useHubSpotOwners();
  const { tasks, loading, error, refetch } = useHubSpotTasks(selectedOwnerId === "all" ? undefined : selectedOwnerId);

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTasksByQueue = (queue: TaskQueue) => {
    return filteredTasks.filter(task => task.queue === queue);
  };

  const handleTaskMove = (taskId: string, newQueue: TaskQueue) => {
    // Note: In a real implementation, you'd want to update the task queue in HubSpot
    // For now, this is just visual until we implement the update functionality
    console.log(`Moving task ${taskId} to ${newQueue} queue`);
  };

  const toggleColumnCollapse = (columnId: string) => {
    const newCollapsed = new Set(collapsedColumns);
    if (newCollapsed.has(columnId)) {
      newCollapsed.delete(columnId);
    } else {
      newCollapsed.add(columnId);
    }
    setCollapsedColumns(newCollapsed);
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
          <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {owners.map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {(loading || ownersLoading) && <span className="text-sm text-gray-500">Syncing with HubSpot...</span>}
          <span className="text-sm text-gray-600">
            Status: Not Started | Due: Today or Earlier
            {selectedOwnerId !== "all" && ` | Owner: ${owners.find(o => o.id === selectedOwnerId)?.fullName || selectedOwnerId}`}
          </span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-6 overflow-x-auto pb-6">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            title={column.title}
            color={column.color}
            count={getTasksByQueue(column.id as TaskQueue).length}
            isCollapsed={collapsedColumns.has(column.id)}
            onToggleCollapse={() => toggleColumnCollapse(column.id)}
          >
            <div className="space-y-3">
              {getTasksByQueue(column.id as TaskQueue).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onMove={(taskId, newStatus) => handleTaskMove(taskId, newStatus as TaskQueue)}
                />
              ))}
              {getTasksByQueue(column.id as TaskQueue).length === 0 && !loading && (
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
