import { useState, useMemo } from "react";
import { TaskQueue } from "@/types/task";
import KanbanHeader from "./KanbanHeader";
import KanbanContent from "./KanbanContent";
import { TeamLeaderboard } from "./TeamLeaderboard";
import { useUsers } from "@/hooks/useUsers";
import { useLocalTasks } from "@/hooks/useLocalTasks";
import { useAllTasks } from "@/hooks/useAllTasks";
import { useOwnerSelection } from "@/hooks/useOwnerSelection";
import { useTaskFiltering } from "@/hooks/useTaskFiltering";
import { useTaskAssignment } from "@/hooks/useTaskAssignment";
import { useColumnState } from "@/hooks/useColumnState";
import { useTaskCategories } from "@/hooks/useTaskCategories";
import { calculateDateRange } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useTeamSummary } from "@/hooks/useTeamSummary";

interface KanbanBoardProps {
  onFrameUrlChange: (url: string) => void;
}

const KanbanBoard = ({ onFrameUrlChange }: KanbanBoardProps) => {
  console.log('=== KANBAN BOARD RENDERING ===');
  
  const [searchTerm, setSearchTerm] = useState("");
  const [lockedColumns, setLockedColumns] = useState<string[]>([]);
  const [lowerBound, setLowerBound] = useState("tout");
  const [upperBound, setUpperBound] = useState("aujourd_hui");
  const [isLeaderboardHidden, setIsLeaderboardHidden] = useState(false);

  console.log('Initializing hooks...');
  
  // Auth context
  const { userEmail, justSignedIn } = useAuth();
  
  // Owner management
  const { owners, loading: ownersLoading, error: ownersError, refetch: refetchOwners } = useUsers();
  console.log('Owners hook result:', { owners: owners?.length, ownersLoading, ownersError });
  
  const skipLocalStorage = !!justSignedIn && !userEmail;
  const { selectedOwnerId, ownerSelectionInitialized, handleOwnerChange, getSelectedOwnerName } = useOwnerSelection(owners, userEmail, { skipLocalStorage });
  console.log('Owner selection hook result:', { selectedOwnerId, ownerSelectionInitialized });
  
  // Task management
  const { tasks, loading: tasksLoading, error: tasksError, refetch } = useLocalTasks(selectedOwnerId);
  console.log('Tasks hook result:', { tasks: tasks?.length, tasksLoading, tasksError });
  
  // All tasks for team leaderboard
  const { tasks: allTasks } = useAllTasks();
  console.log('All tasks result:', { allTasks: allTasks?.length });
  
  // Get team summary data for accurate header counts
  const selectedOwner = owners.find(owner => owner.id === selectedOwnerId);
  const teamId = selectedOwner?.teamId;
  const { data: teamSummary } = useTeamSummary({ 
    teamId: teamId || '', 
    ownerId: selectedOwnerId !== 'all' ? selectedOwnerId : undefined 
  });
  console.log('Team summary result:', teamSummary?.owner_header_summary);
  
  // Get selected user's team ID for category filtering
  const selectedUser = owners.find(owner => owner.id === selectedOwnerId);
  const selectedUserTeamId = selectedUser?.teamId || null;
  console.log('Selected user team ID:', selectedUserTeamId);

  // Get categories for the selected user's team
  const { categories, loading: categoriesLoading } = useTaskCategories(selectedUserTeamId);
  console.log('Categories result:', { categories: categories?.length, categoriesLoading });

  // Calculate date range
  const dateRange = useMemo(() => {
    return calculateDateRange(lowerBound, upperBound);
  }, [lowerBound, upperBound]);

  // Task filtering
  const { notStartedTasks, hasNewTasks, filteredTasks } = useTaskFiltering({
    tasks,
    searchTerm,
    lockedColumns,
    getSelectedOwnerName,
    dateRange
  });
  console.log('Task filtering result:', { notStartedTasks: notStartedTasks?.length, hasNewTasks, filteredTasks: filteredTasks?.length });
  
  // Column state management
  const { expandedColumn, handleColumnToggle, lockedExpandableColumns } = useColumnState({
    notStartedTasks,
    hasNewTasks,
    lockedColumns,
    categories
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

  const handleDateRangeClear = () => {
    console.log('Clearing date range filter');
    setLowerBound("tout");
    setUpperBound("tout");
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

  // Get team members for the leaderboard
  const teamMembers = useMemo(() => {
    if (!selectedUser?.teamId) return [];
    return owners.filter(owner => owner.teamId === selectedUser.teamId);
  }, [owners, selectedUser?.teamId]);

  const handleMemberClick = (ownerId: string) => {
    console.log('Switching to team member:', ownerId);
    handleOwnerChange(ownerId);
  };

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
        isLoading={tasksLoading || ownersLoading || categoriesLoading}
        tasks={tasks}
        lowerBound={lowerBound}
        upperBound={upperBound}
        onLowerBoundChange={setLowerBound}
        onUpperBoundChange={setUpperBound}
        onDateRangeClear={handleDateRangeClear}
        overdueCount={teamSummary?.owner_header_summary?.overdue_count}
        futureCount={teamSummary?.owner_header_summary?.future_tasks_count}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <KanbanContent
          filteredTasks={filteredTasks}
          allTasks={allTasks}
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
          selectedUserTeamId={selectedUserTeamId}
          tasks={tasks}
          teamSummary={teamSummary}
          onLeaderboardVisibilityChange={setIsLeaderboardHidden}
        />
        
        {/* Team Leaderboard - only show when a team member is selected */}
        {teamMembers.length > 1 && (
          <TeamLeaderboard
            teamMembers={teamMembers}
            teamId={teamMembers[0]?.teamId}
            onMemberClick={handleMemberClick}
            selectedOwnerId={selectedOwnerId}
            isHidden={isLeaderboardHidden}
          />
        )}
      </div>
    </div>
  );
};

export default KanbanBoard;
