
import { useState, useEffect } from "react";
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
  const [expandedColumn, setExpandedColumn] = useState<string>("rappels");
  
  const { owners, loading: ownersLoading, refetch: refetchOwners } = useHubSpotOwners();
  const { 
    selectedOwnerId, 
    ownerSelectionInitialized, 
    handleOwnerChange, 
    getSelectedOwnerName 
  } = useOwnerSelection(owners);
  
  const { tasks, loading: tasksLoading, error, refetch } = useHubSpotTasks(selectedOwnerId);

  // Separate not started and completed tasks
  const notStartedTasks = tasks.filter(task => task.status === 'not_started');
  const completedTasks = tasks.filter(task => task.status === 'completed');

  // Check if there are any not started tasks in the "new" queue to determine locking
  const newQueueTasks = notStartedTasks.filter(task => task.queue === 'new');
  const hasNewTasks = newQueueTasks.length > 0;
  
  // Define which columns are locked - Rappels & RDV is never locked
  const getLockedColumns = () => {
    if (hasNewTasks) {
      return ['attempted', 'other']; // Only lock these columns, not rappels
    }
    return []; // No locked columns when new queue is empty
  };
  
  const lockedColumns = getLockedColumns();

  // Auto-expand logic - prioritize rappels if it has tasks, otherwise new
  useEffect(() => {
    const rappelsQueueTasks = notStartedTasks.filter(task => task.queue === 'rappels');
    const hasRappelsTasks = rappelsQueueTasks.length > 0;
    
    if (hasRappelsTasks) {
      setExpandedColumn("rappels");
    } else if (hasNewTasks && lockedColumns.length > 0) {
      setExpandedColumn("new");
    }
  }, [notStartedTasks, hasNewTasks, lockedColumns.length]);

  // Filter not started tasks based on the existing requirements and locking logic
  const filteredTasks = notStartedTasks.filter(task => {
    // First check if the task is in a locked column and we have a search term
    if (searchTerm && lockedColumns.includes(task.queue)) {
      return false; // Don't show tasks from locked columns in search results
    }
    
    // Apply search filter
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.contact.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // For unassigned "New" tasks, apply special filtering logic
    if (task.isUnassigned && task.queue === 'new') {
      // Check if the user has any assigned "New" tasks
      const userHasAssignedNewTasks = notStartedTasks.some(t => 
        !t.isUnassigned && 
        t.queue === 'new' && 
        t.owner === getSelectedOwnerName()
      );
      
      // If user has assigned "New" tasks, hide unassigned ones
      if (userHasAssignedNewTasks) {
        return false;
      }
      
      // Only show the oldest unassigned "New" task
      const unassignedNewTasks = notStartedTasks.filter(t => 
        t.isUnassigned && 
        t.queue === 'new' &&
        (t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
         t.contact.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      if (unassignedNewTasks.length > 1) {
        // Sort by creation date (oldest first) and only return the first one
        unassignedNewTasks.sort((a, b) => {
          // Parse the dates - assuming format is "DD/MM à HH:MM"
          const parseDate = (dateStr: string) => {
            const [datePart, timePart] = dateStr.split(' à ');
            const [day, month] = datePart.split('/');
            const [hours, minutes] = timePart.split(':');
            const currentYear = new Date().getFullYear();
            return new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
          };
          
          const dateA = parseDate(a.dueDate);
          const dateB = parseDate(b.dueDate);
          return dateA.getTime() - dateB.getTime();
        });
        
        // Only show this task if it's the oldest one
        return task.id === unassignedNewTasks[0].id;
      }
    }
    
    return true;
  });

  const handleTaskMove = (taskId: string, newQueue: TaskQueue) => {
    console.log(`Moving task ${taskId} to ${newQueue} queue`);
  };

  const handleRefresh = () => {
    refetch();
    refetchOwners();
  };

  const handleColumnToggle = (columnId: string) => {
    console.log(`Toggling column ${columnId}, currently expanded: ${expandedColumn}, locked columns: ${lockedColumns.join(', ')}`);
    
    // Allow toggling any column that has content, even if it's locked
    // The VerticalKanbanColumn component will handle the display logic
    setExpandedColumn(expandedColumn === columnId ? "" : columnId);
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
        setExpandedColumn={setExpandedColumn}
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
