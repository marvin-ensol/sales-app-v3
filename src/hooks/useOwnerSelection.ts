
import { useState, useEffect } from 'react';
import { HubSpotOwner } from '@/hooks/useUsers';

const STORAGE_KEY = "kanban_selected_owner";

export const useOwnerSelection = (owners: HubSpotOwner[], userEmail?: string | null) => {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [ownerSelectionInitialized, setOwnerSelectionInitialized] = useState(false);

  // Consolidated owner selection logic - runs only once when owners are loaded
  useEffect(() => {
    if (owners.length > 0 && !ownerSelectionInitialized) {
      console.log('Initializing owner selection with', owners.length, 'owners');
      console.log('Authenticated user email:', userEmail);
      
      let selectedOwner: HubSpotOwner | null = null;
      
      // Priority 1: Try to match authenticated user's email
      if (userEmail) {
        selectedOwner = owners.find(owner => owner.email?.toLowerCase() === userEmail.toLowerCase()) || null;
        if (selectedOwner) {
          console.log('Found owner matching authenticated email:', selectedOwner.fullName, selectedOwner.email);
        }
      }
      
      // Priority 2: Use saved owner if no email match
      if (!selectedOwner) {
        const savedOwnerId = localStorage.getItem(STORAGE_KEY);
        console.log('Saved owner ID from localStorage:', savedOwnerId);
        
        if (savedOwnerId) {
          selectedOwner = owners.find(owner => owner.id === savedOwnerId) || null;
          if (selectedOwner) {
            console.log('Using saved owner:', selectedOwner.fullName);
          }
        }
      }
      
      // Priority 3: Fallback to first owner
      if (!selectedOwner) {
        selectedOwner = owners[0];
        console.log('Using first owner as fallback:', selectedOwner.fullName);
      }
      
      setSelectedOwnerId(selectedOwner.id);
      localStorage.setItem(STORAGE_KEY, selectedOwner.id);
      setOwnerSelectionInitialized(true);
    }
  }, [owners, ownerSelectionInitialized, userEmail]);

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
