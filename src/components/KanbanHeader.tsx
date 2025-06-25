
import { RefreshCw, Search, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import OwnerSelector from "./OwnerSelector";
import { HubSpotOwner } from "@/types/task";

interface KanbanHeaderProps {
  owners: HubSpotOwner[];
  selectedOwnerId: string;
  onOwnerChange: (ownerId: string) => void;
  ownerSelectionInitialized: boolean;
  getSelectedOwnerName: () => string;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  onDebugTotalCounts?: () => void; // Add debug function prop
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
  onDebugTotalCounts
}: KanbanHeaderProps) => {
  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <OwnerSelector
            owners={owners}
            selectedOwnerId={selectedOwnerId}
            onOwnerChange={onOwnerChange}
            ownerSelectionInitialized={ownerSelectionInitialized}
            getSelectedOwnerName={getSelectedOwnerName}
          />
          
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onDebugTotalCounts && (
            <Button
              onClick={onDebugTotalCounts}
              variant="outline"
              size="sm"
              className="text-orange-600 border-orange-600 hover:bg-orange-50"
            >
              <Bug className="h-4 w-4 mr-2" />
              Debug Counts
            </Button>
          )}
          
          <Button 
            onClick={onRefresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
};

export default KanbanHeader;
