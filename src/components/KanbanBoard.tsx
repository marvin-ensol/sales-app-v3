
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

const KanbanBoard = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [expandedColumn, setExpandedColumn] = useState<string>("new");
  const [ownerComboboxOpen, setOwnerComboboxOpen] = useState(false);
  
  const { owners, loading: ownersLoading, refetch: refetchOwners } = useHubSpotOwners();
  const { tasks, loading, error, refetch } = useHubSpotTasks(selectedOwnerId || undefined);

  // Load saved owner selection on component mount, or default to first owner
  useEffect(() => {
    const savedOwnerId = localStorage.getItem(STORAGE_KEY);
    if (savedOwnerId) {
      setSelectedOwnerId(savedOwnerId);
    } else if (owners.length > 0 && !selectedOwnerId) {
      // Auto-select first owner if none saved and owners are available
      const firstOwner = owners[0];
      setSelectedOwnerId(firstOwner.id);
      localStorage.setItem(STORAGE_KEY, firstOwner.id);
    }
  }, [owners, selectedOwnerId]);

  // Save owner selection to localStorage when it changes
  useEffect(() => {
    if (selectedOwnerId) {
      localStorage.setItem(STORAGE_KEY, selectedOwnerId);
    }
  }, [selectedOwnerId]);

  // Sort owners alphabetically by full name
  const sortedOwners = [...owners].sort((a, b) => a.fullName.localeCompare(b.fullName));

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTasksByQueue = (queue: TaskQueue) => {
    return filteredTasks.filter(task => task.queue === queue);
  };

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
    return owner?.fullName || selectedOwnerId;
  };

  const handleColumnToggle = (columnId: string) => {
    setExpandedColumn(expandedColumn === columnId ? "" : columnId);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <div className="text-center">
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
    <div className="h-full flex flex-col">
      {/* Header Controls */}
      <div className="p-4 border-b border-gray-200 space-y-4">
        {/* Owner Selection */}
        <Popover open={ownerComboboxOpen} onOpenChange={setOwnerComboboxOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={ownerComboboxOpen}
              className="w-full justify-between"
            >
              {getSelectedOwnerName()}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search owners..." />
              <CommandList>
                <CommandEmpty>No owner found.</CommandEmpty>
                <CommandGroup>
                  {sortedOwners.map((owner) => (
                    <CommandItem
                      key={owner.id}
                      value={owner.fullName}
                      onSelect={() => {
                        setSelectedOwnerId(owner.id);
                        setOwnerComboboxOpen(false);
                      }}
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search tasks or contacts..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Refresh Button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={loading || ownersLoading}
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${(loading || ownersLoading) ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        {/* Status indicator */}
        {(loading || ownersLoading) && (
          <div className="text-sm text-gray-500 text-center">Syncing with HubSpot...</div>
        )}
      </div>

      {/* Vertical Columns */}
      <div className="flex-1 overflow-y-auto">
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
                showOwner={false}
              />
            ))}
            {getTasksByQueue(column.id as TaskQueue).length === 0 && !loading && (
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
