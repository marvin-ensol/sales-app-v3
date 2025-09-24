
import { useState } from "react";
import { Search, RefreshCw, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { HubSpotOwner } from "@/hooks/useUsers";
import OwnerSelector from "./OwnerSelector";
import { PerformanceIndicator } from "./PerformanceIndicator";

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
  taskCount?: number;
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
  taskCount = 0
}: KanbanHeaderProps) => {
  const navigate = useNavigate();
  const [ownerComboboxOpen, setOwnerComboboxOpen] = useState(false);

  const handleClearSearch = () => {
    onSearchChange("");
  };

  return (
    <div className="p-3 border-b border-gray-200 space-y-3 bg-white">
      {/* Owner Selection and Status */}
      <div className="flex items-center gap-2">
        <OwnerSelector
          owners={owners}
          selectedOwnerId={selectedOwnerId}
          onOwnerChange={onOwnerChange}
          isOpen={ownerComboboxOpen}
          onOpenChange={setOwnerComboboxOpen}
          ownerSelectionInitialized={ownerSelectionInitialized}
          getSelectedOwnerName={getSelectedOwnerName}
        />

        <PerformanceIndicator 
          loading={isLoading}
          taskCount={taskCount}
          mode="database"
        />

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

      {/* Search */}
      <div className="relative max-w-md">
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
    </div>
  );
};

export default KanbanHeader;
