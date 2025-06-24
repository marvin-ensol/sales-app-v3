
import { useState, useEffect } from "react";
import { Search, RefreshCw, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import VerticalKanbanColumn from "./VerticalKanbanColumn";
import TaskCard from "./TaskCard";
import { Task, TaskQueue } from "@/types/task";
import { useHubSpotTasks } from "@/hooks/useHubSpotTasks";
import { useHubSpotOwners } from "@/hooks/useHubSpotOwners";

// Define columns based on task queues
const columns = [
  { id: "new", title: "New", color: "border-l-4 border-l-blue-400" },
  { id: "attempted", title: "Attempted", color: "border-l-4 border-l-orange-400" },
  { id: "other", title: "Other", color: "border-l-4 border-l-gray-400" }
];

const STORAGE_KEY = "kanban_selected_owner";

interface KanbanBoardProps {
  onFrameUrlChange: (url: string) => void;
}

const KanbanBoard = ({ onFrameUrlChange }: KanbanBoardProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [expandedColumn, setExpandedColumn] = useState<string>("new");
  const [ownerComboboxOpen, setOwnerComboboxOpen] = useState(false);
  const [ownerSelectionInitialized, setOwnerSelectionInitialized] = useState(false);
  
  const { owners, loading: ownersLoading, refetch: refetchOwners } = useHubSpotOwners();
  const { tasks, loading: tasksLoading, error, refetch } = useHubSpotTasks(selectedOwnerId || undefined);

  // Consolidated owner selection logic - runs only once when owners are loaded
  useEffect(() => {
    if (owners.length > 0 && !ownerSelectionInitialized) {
      console.log('Initializing owner selection with', owners.length, 'owners');
      
      const savedOwnerId = localStorage.getItem(STORAGE_KEY);
      console.log('Saved owner ID from localStorage:', savedOwnerId);
      
      // Check if saved owner exists in current owners list
      const savedOwnerExists = savedOwnerId && owners.some(owner => owner.id === savedOwnerId);
      console.log('Saved owner exists in current list:', savedOwnerExists);
      
      if (savedOwnerExists) {
        console.log('Using saved owner:', savedOwnerId);
        setSelectedOwnerId(savedOwnerId);
      } else {
        // Fallback to first owner if no valid saved selection
        const firstOwner = owners[0];
        console.log('Using first owner as fallback:', firstOwner.id, firstOwner.fullName);
        setSelectedOwnerId(firstOwner.id);
        localStorage.setItem(STORAGE_KEY, firstOwner.id);
      }
      
      setOwnerSelectionInitialized(true);
    }
  }, [owners, ownerSelectionInitialized]);

  // Handle manual owner selection changes
  const handleOwnerChange = (ownerId: string) => {
    console.log('Manual owner change to:', ownerId);
    setSelectedOwnerId(ownerId);
    localStorage.setItem(STORAGE_KEY, ownerId);
    setOwnerComboboxOpen(false);
  };

  // Sort owners alphabetically by full name
  const sortedOwners = [...owners].sort((a, b) => a.fullName.localeCompare(b.fullName));

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTasksByQueue = (queue: TaskQueue) => {
    return filteredTasks.filter(task => task.queue === queue);
  };

  // Auto-expand columns with search matches
  useEffect(() => {
    if (searchTerm) {
      // Find columns that have matching tasks
      const columnsWithMatches = columns.filter(column => 
        getTasksByQueue(column.id as TaskQueue).length > 0
      );
      
      // If there are matches, expand the first column with matches
      if (columnsWithMatches.length > 0) {
        setExpandedColumn(columnsWithMatches[0].id);
      }
    }
  }, [searchTerm, filteredTasks]);

  const handleTaskMove = (taskId: string, newQueue: TaskQueue) => {
    console.log(`Moving task ${taskId} to ${newQueue} queue`);
  };

  const handleRefresh = () => {
    refetch();
    refetchOwners();
  };

  const getSelectedOwnerName = () => {
    if (!selectedOwnerId) return "Select owner";
    const owner = owners.find(o => o.id === selectedOwnerId);
    return owner?.fullName || "Select owner";
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
      {/* Header Controls */}
      <div className="p-3 border-b border-gray-200 space-y-3 bg-white">
        {/* Owner Selection and Refresh Button */}
        <div className="flex items-center gap-2">
          <Popover open={ownerComboboxOpen} onOpenChange={setOwnerComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={ownerComboboxOpen}
                className="flex-1 justify-between max-w-sm"
                disabled={!ownerSelectionInitialized}
              >
                {ownerSelectionInitialized ? getSelectedOwnerName() : "Loading owners..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full max-w-sm p-0" align="start">
              <Command>
                <CommandInput placeholder="Search owners..." />
                <CommandList>
                  <CommandEmpty>No owner found.</CommandEmpty>
                  <CommandGroup>
                    {sortedOwners.map((owner) => (
                      <CommandItem
                        key={owner.id}
                        value={owner.fullName}
                        onSelect={() => handleOwnerChange(owner.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedOwnerId === owner.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {owner.fullName}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh} 
            disabled={tasksLoading || ownersLoading}
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${(tasksLoading || ownersLoading) ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search tasks or contacts..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Vertical Columns */}
      <div className="flex-1 overflow-y-auto px-2">
        {columns.map((column) => (
          <VerticalKanbanColumn
            key={column.id}
            title={column.title}
            color={column.color}
            count={getTasksByQueue(column.id as TaskQueue).length}
            isExpanded={expandedColumn === column.id}
            onToggle={() => handleColumnToggle(column.id)}
          >
            {getTasksByQueue(column.id as TaskQueue).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onMove={(taskId, newStatus) => handleTaskMove(taskId, newStatus as TaskQueue)}
                onFrameUrlChange={onFrameUrlChange}
                showOwner={false}
              />
            ))}
            {getTasksByQueue(column.id as TaskQueue).length === 0 && !tasksLoading && ownerSelectionInitialized && (
              <div className="text-center text-gray-500 py-8">
                No tasks
              </div>
            )}
          </VerticalKanbanColumn>
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;
