
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskQueue } from "@/types/task";
import { useHubSpotTasks } from "@/hooks/useHubSpotTasks";
import { useHubSpotOwners } from "@/hooks/useHubSpotOwners";
import { useOwnerSelection } from "@/hooks/useOwnerSelection";
import { useTaskFiltering } from "@/hooks/useTaskFiltering";
import { useColumnState } from "@/hooks/useColumnState";
import KanbanHeader from "./KanbanHeader";
import KanbanContent from "./KanbanContent";

interface KanbanBoardProps {
  onFrameUrlChange: (url: string) => void;
}

const KanbanBoard = ({ onFrameUrlChange }: KanbanBoardProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { owners, loading: ownersLoading, refetch: refetchOwners } = useHubSpotOwners();
  const { 
    selectedOwnerId, 
    ownerSelectionInitialized, 
    handleOwnerChange, 
    getSelectedOwnerName 
  } = useOwnerSelection(owners);
  
  const { tasks, loading: tasksLoading, error, refetch } = useHubSpotTasks(selectedOwnerId);

  const { notStartedTasks, hasNewTasks, filteredTasks } = useTaskFiltering({
    tasks,
    searchTerm,
    lockedColumns: getLockedColumns(),
    getSelectedOwnerName
  });

  // Define which columns are locked - Rappels & RDV is never locked
  function getLockedColumns() {
    if (hasNewTasks) {
      return ['attempted', 'other']; // Only lock these columns, not rappels
    }
    return []; // No locked columns when new queue is empty
  }
  
  const lockedColumns = getLockedColumns();

  const { expandedColumn, handleColumnToggle } = useColumnState({
    notStartedTasks,
    hasNewTasks,
    lockedColumns
  });

  const handleTaskMove = (taskId: string, newQueue: TaskQueue) => {
    console.log(`Moving task ${taskId} to ${newQueue} queue`);
  };

  const handleRefresh = () => {
    refetch();
    refetchOwners();
  };

  const handleTaskAssigned = () => {
    console.log('Task assigned, refreshing...');
    refetch();
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

  console.log(`=== KANBAN BOARD RENDER ===`);
  console.log(`Current expandedColumn: ${expandedColumn}`);
  console.log(`Locked columns: ${lockedColumns.join(', ')}`);

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
      />

      <KanbanContent
        filteredTasks={filteredTasks}
        allTasks={tasks}
        expandedColumn={expandedColumn}
        onColumnToggle={handleColumnToggle}
        onTaskMove={handleTaskMove}
        onFrameUrlChange={onFrameUrlChange}
        searchTerm={searchTerm}
        setExpandedColumn={() => {}} // This is no longer needed as we use handleColumnToggle
        tasksLoading={tasksLoading}
        ownerSelectionInitialized={ownerSelectionInitialized}
        onTaskAssigned={handleTaskAssigned}
        selectedOwnerId={selectedOwnerId}
        lockedColumns={lockedColumns}
      />
    </div>
  );
};

export default KanbanBoard;
