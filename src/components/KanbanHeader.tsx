
import { useState } from "react";
import { Search, RefreshCw, X, Settings, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { HubSpotOwner } from "@/hooks/useUsers";
import { Task } from "@/types/task";
import { isTaskOverdue } from "@/lib/dateUtils";
import { useIsCompactView } from "@/hooks/useIsCompactView";
import OwnerSelector from "./OwnerSelector";
import { PerformanceIndicator } from "./PerformanceIndicator";
import DateRangeFilter from "./DateRangeFilter";

interface KanbanHeaderProps {
  owners: HubSpotOwner[];
  selectedOwnerId: string;
  onOwnerChange: (ownerId: string) => void;
  ownerSelectionInitialized: boolean;
  getSelectedOwnerName: () => string;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  tasks: Task[];
  lowerBound: string;
  upperBound: string;
  onLowerBoundChange: (value: string) => void;
  onUpperBoundChange: (value: string) => void;
  onDateRangeClear: () => void;
}

const KanbanHeader = ({
  owners,
  selectedOwnerId,
  onOwnerChange,
  ownerSelectionInitialized,
  getSelectedOwnerName,
  searchTerm,
  onSearchChange,
  onRefresh,
  isLoading,
  tasks,
  lowerBound,
  upperBound,
  onLowerBoundChange,
  onUpperBoundChange,
  onDateRangeClear
}: KanbanHeaderProps) => {
  const navigate = useNavigate();
  const { isCompact, containerRef } = useIsCompactView(600);
  const [ownerComboboxOpen, setOwnerComboboxOpen] = useState(false);
  const [activeCompactComponent, setActiveCompactComponent] = useState<'search' | 'filter'>('filter');

  // Calculate overdue and future tasks
  const tasksOverdue = tasks.filter(task => task.dueDate && isTaskOverdue(task.dueDate)).length;
  const tasksFuture = tasks.filter(task => task.dueDate && !isTaskOverdue(task.dueDate)).length;

  const handleClearSearch = () => {
    onSearchChange("");
  };

  const handleCompactComponentToggle = () => {
    setActiveCompactComponent(prev => prev === 'search' ? 'filter' : 'search');
  };

  return (
    <div ref={containerRef} className="p-3 border-b border-gray-200 space-y-3 bg-white">
      {/* First Row: Owner Selection, Task Count (desktop only), and Action Buttons */}
      <div className="relative flex items-center justify-between">
        <OwnerSelector
          owners={owners}
          selectedOwnerId={selectedOwnerId}
          onOwnerChange={onOwnerChange}
          isOpen={ownerComboboxOpen}
          onOpenChange={setOwnerComboboxOpen}
          ownerSelectionInitialized={ownerSelectionInitialized}
          getSelectedOwnerName={getSelectedOwnerName}
        />

        {/* Task count - desktop only */}
        {!isCompact && (
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <span className="text-sm text-muted-foreground">
              {tasksOverdue} tâche{tasksOverdue !== 1 ? 's' : ''} à faire | {tasksFuture} tâche{tasksFuture !== 1 ? 's' : ''} à venir
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => navigate('/settings')}
            title="Paramètres"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button 
            variant="outline" 
            size="icon"
            onClick={onRefresh} 
            disabled={isLoading}
            title="Actualiser"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Second Row: Compact toggle layout or Desktop search/filter */}
      {isCompact ? (
        <div className="flex items-center justify-between gap-2">
          {activeCompactComponent === 'filter' ? (
            <DateRangeFilter
              lowerBound={lowerBound}
              upperBound={upperBound}
              onLowerBoundChange={onLowerBoundChange}
              onUpperBoundChange={onUpperBoundChange}
              onClear={onDateRangeClear}
              isCompact={true}
            />
          ) : (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Trouver une tâche ou un contact..."
                className="pl-10 pr-10"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                  onClick={handleClearSearch}
                  title="Clear search"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </Button>
              )}
            </div>
          )}
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleCompactComponentToggle}
            title={activeCompactComponent === 'filter' ? 'Recherche' : 'Filtrer par date'}
          >
            {activeCompactComponent === 'filter' ? (
              <Search className="h-4 w-4" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
          </Button>
        </div>
      ) : (
        /* Desktop layout - unchanged */
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Trouver une tâche ou un contact..."
              className="pl-10 pr-10"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                onClick={handleClearSearch}
                title="Clear search"
              >
                <X className="h-4 w-4 text-gray-400" />
              </Button>
            )}
          </div>

          <DateRangeFilter
            lowerBound={lowerBound}
            upperBound={upperBound}
            onLowerBoundChange={onLowerBoundChange}
            onUpperBoundChange={onUpperBoundChange}
            onClear={onDateRangeClear}
          />
        </div>
      )}
    </div>
  );
};

export default KanbanHeader;
