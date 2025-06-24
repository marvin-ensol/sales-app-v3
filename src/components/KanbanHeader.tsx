
import { useState } from "react";
import { Search, RefreshCw, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HubSpotOwner } from "@/hooks/useHubSpotOwners";
import OwnerSelector from "./OwnerSelector";

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
  debugTaskId: string;
  onDebugTaskIdChange: (taskId: string) => void;
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
  debugTaskId,
  onDebugTaskIdChange
}: KanbanHeaderProps) => {
  const [ownerComboboxOpen, setOwnerComboboxOpen] = useState(false);
  const [showDebugMode, setShowDebugMode] = useState(false);

  return (
    <div className="p-3 border-b border-gray-200 space-y-3 bg-white">
      {/* Owner Selection and Refresh Button */}
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

        <Button 
          variant="outline" 
          size="icon"
          onClick={onRefresh} 
          disabled={isLoading}
          title="Refresh data"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>

        <Button 
          variant="outline" 
          size="icon"
          onClick={() => setShowDebugMode(!showDebugMode)}
          title="Toggle debug mode"
          className={showDebugMode ? 'bg-orange-100 border-orange-300' : ''}
        >
          <Bug className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search tasks or contacts..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Debug Mode */}
      {showDebugMode && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Bug className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">Debug Mode</span>
          </div>
          <div className="space-y-2">
            <Input
              placeholder="Enter task ID to debug (e.g., 227212806382)"
              value={debugTaskId}
              onChange={(e) => onDebugTaskIdChange(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-orange-700">
              Enter a specific task ID to see detailed logging about why it might not appear in the results.
              Check the browser console and edge function logs for detailed debugging information.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanHeader;
