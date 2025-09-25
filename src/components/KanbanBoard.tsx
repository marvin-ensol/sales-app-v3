import { useState } from "react";
import { TaskQueue } from "@/types/task";
import KanbanHeader from "./KanbanHeader";
import KanbanContent from "./KanbanContent";
import { useUsers } from "@/hooks/useUsers";
import { useLocalTasks } from "@/hooks/useLocalTasks";
import { useOwnerSelection } from "@/hooks/useOwnerSelection";
import { useTaskFiltering } from "@/hooks/useTaskFiltering";
import { useTaskAssignment } from "@/hooks/useTaskAssignment";
import { useColumnState } from "@/hooks/useColumnState";

interface KanbanBoardProps {
  onFrameUrlChange: (url: string) => void;
}

const KanbanBoard = ({ onFrameUrlChange }: KanbanBoardProps) => {
  console.log('=== KANBAN BOARD RENDERING ===');
  
  const [searchTerm, setSearchTerm] = useState("");
  const [lockedColumns, setLockedColumns] = useState<string[]>([]);

  console.log('Initializing hooks...');
  
  // Owner management
  const { owners, loading: ownersLoading, error: ownersError, refetch: refetchOwners } = useUsers();
  console.log('Owners hook result:', { owners: owners?.length, ownersLoading, ownersError });
  
  const { selectedOwnerId, ownerSelectionInitialized, handleOwnerChange, getSelectedOwnerName } = useOwnerSelection(owners);
  console.log('Owner selection hook result:', { selectedOwnerId, ownerSelectionInitialized });
  
  // Task management
  const { tasks, loading: tasksLoading, error: tasksError, refetch } = useLocalTasks(selectedOwnerId);
  console.log('Tasks hook result:', { tasks: tasks?.length, tasksLoading, tasksError });
  
  // Task filtering
  const { notStartedTasks, hasNewTasks, filteredTasks } = useTaskFiltering({
    tasks,
    searchTerm,
    lockedColumns,
    getSelectedOwnerName
  });
  console.log('Task filtering result:', { notStartedTasks: notStartedTasks?.length, hasNewTasks, filteredTasks: filteredTasks?.length });
  
  // Column state management
  const { expandedColumn, handleColumnToggle, lockedExpandableColumns } = useColumnState({
    notStartedTasks,
    hasNewTasks,
    lockedColumns
  });
  console.log('Column state result:', { expandedColumn, lockedExpandableColumns });
  
  // Task assignment
  const { assignTask } = useTaskAssignment();
  console.log('Task assignment hook initialized');

  const handleTaskMove = async (taskId: string, newQueue: TaskQueue) => {
    console.log(`Moving task ${taskId} to queue ${newQueue}`);
    // Implementation would go here
  };

  const handleTaskAssigned = () => {
    console.log('Task assigned, refetching...');
    refetch();
  };

  const handleTaskDeleted = () => {
    console.log('Task deleted, refetching...');
    refetch();
  };

  const handleSearchChange = (term: string) => {
    console.log('Search term changed:', term);
    setSearchTerm(term);
  };

  const handleRefresh = () => {
    console.log('Refreshing data...');
    refetch();
    refetchOwners();
  };

  const handleLockColumn = (columnId: string) => {
    console.log('Locking column:', columnId);
    setLockedColumns(prev => [...prev, columnId]);
  };

  const handleUnlockColumn = (columnId: string) => {
    console.log('Unlocking column:', columnId);
    setLockedColumns(prev => prev.filter(id => id !== columnId));
  };

  console.log('Rendering KanbanBoard JSX...');

  if (ownersError) {
    console.error('Owners error:', ownersError);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error loading owners: {ownersError}</div>
      </div>
    );
  }

  if (tasksError) {
    console.error('Tasks error:', tasksError);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error loading tasks: {tasksError}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <KanbanHeader
        owners={owners}
        selectedOwnerId={selectedOwnerId}
        onOwnerChange={handleOwnerChange}
        ownerSelectionInitialized={ownerSelectionInitialized}
        getSelectedOwnerName={getSelectedOwnerName}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onRefresh={handleRefresh}
        isLoading={tasksLoading || ownersLoading}
        taskCount={tasks.length}
      />
      
      <KanbanContent
        filteredTasks={filteredTasks}
        allTasks={tasks}
        expandedColumn={expandedColumn}
        onColumnToggle={handleColumnToggle}
        onTaskMove={handleTaskMove}
        onFrameUrlChange={onFrameUrlChange}
        searchTerm={searchTerm}
        setExpandedColumn={() => {}} // Not used anymore, kept for backward compatibility
        tasksLoading={tasksLoading}
        ownerSelectionInitialized={ownerSelectionInitialized}
        onTaskAssigned={handleTaskAssigned}
        onTaskDeleted={handleTaskDeleted}
        selectedOwnerId={selectedOwnerId}
        lockedColumns={lockedColumns}
        lockedExpandableColumns={lockedExpandableColumns}
        userTeamId={owners.find(owner => owner.id === selectedOwnerId)?.teamId || null}
      />
    </div>
  );
};

export default KanbanBoard;
