
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Task, TaskQueue } from "@/types/task";
import { useHubSpotTasks } from "@/hooks/useHubSpotTasks";
import { useHubSpotOwners } from "@/hooks/useHubSpotOwners";
import { useOwnerSelection } from "@/hooks/useOwnerSelection";
import KanbanHeader from "./KanbanHeader";
import KanbanContent from "./KanbanContent";

interface KanbanBoardProps {
  onFrameUrlChange: (url: string) => void;
}

const KanbanBoard = ({ onFrameUrlChange }: KanbanBoardProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedColumn, setExpandedColumn] = useState<string>("new");
  const [debugTaskId, setDebugTaskId] = useState<string>("");
  
  const { owners, loading: ownersLoading, refetch: refetchOwners } = useHubSpotOwners();
  const { 
    selectedOwnerId, 
    ownerSelectionInitialized, 
    handleOwnerChange, 
    getSelectedOwnerName 
  } = useOwnerSelection(owners);
  
  const { tasks, loading: tasksLoading, error, refetch } = useHubSpotTasks(
    selectedOwnerId || undefined,
    { debugTaskId: debugTaskId || undefined }
  );

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTaskMove = (taskId: string, newQueue: TaskQueue) => {
    console.log(`Moving task ${taskId} to ${newQueue} queue`);
  };

  const handleRefresh = () => {
    refetch();
    refetchOwners();
  };

  const handleColumnToggle = (columnId: string) => {
    setExpandedColumn(expandedColumn === columnId ? "" : columnId);
  };

  // Show loading state while owners are being fetched
  if (ownersLoading && !ownerSelectionInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading owners...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">Error loading tasks: {error}</p>
          <Button onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col w-full">
      <KanbanHeader
        owners={owners}
        selectedOwnerId={selectedOwnerId}
        onOwnerChange={handleOwnerChange}
        ownerSelectionInitialized={ownerSelectionInitialized}
        getSelectedOwnerName={getSelectedOwnerName}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onRefresh={handleRefresh}
        isLoading={tasksLoading || ownersLoading}
        debugTaskId={debugTaskId}
        onDebugTaskIdChange={setDebugTaskId}
      />

      <KanbanContent
        filteredTasks={filteredTasks}
        expandedColumn={expandedColumn}
        onColumnToggle={handleColumnToggle}
        onTaskMove={handleTaskMove}
        onFrameUrlChange={onFrameUrlChange}
        searchTerm={searchTerm}
        setExpandedColumn={setExpandedColumn}
        tasksLoading={tasksLoading}
        ownerSelectionInitialized={ownerSelectionInitialized}
      />
    </div>
  );
};

export default KanbanBoard;
