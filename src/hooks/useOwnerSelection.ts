
import { useState, useEffect } from 'react';
import { HubSpotOwner } from '@/hooks/useHubSpotOwners';

const STORAGE_KEY = "kanban_selected_owner";

export const useOwnerSelection = (owners: HubSpotOwner[]) => {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [ownerSelectionInitialized, setOwnerSelectionInitialized] = useState(false);

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
  };

  const getSelectedOwnerName = () => {
    if (!selectedOwnerId) return "Select owner";
    const owner = owners.find(o => o.id === selectedOwnerId);
    return owner?.fullName || "Select owner";
  };

  return {
    selectedOwnerId,
    ownerSelectionInitialized,
    handleOwnerChange,
    getSelectedOwnerName
  };
};
