
import { useState, useEffect } from 'react';
import { HubSpotOwner } from '@/hooks/useUsers';

const STORAGE_KEY = "kanban_selected_owner";

export const useOwnerSelection = (owners: HubSpotOwner[], userEmail?: string | null) => {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [ownerSelectionInitialized, setOwnerSelectionInitialized] = useState(false);

  // Owner selection logic - prioritizes email matching over localStorage
  useEffect(() => {
    if (owners.length > 0) {
      console.log('=== OWNER SELECTION LOGIC ===');
      console.log('Owners loaded:', owners.length);
      console.log('User email:', userEmail);
      console.log('Already initialized:', ownerSelectionInitialized);
      
      let selectedOwner: HubSpotOwner | null = null;
      let selectionReason = '';
      
      // Priority 1: Try to match authenticated user's email (always check this first)
      if (userEmail) {
        selectedOwner = owners.find(owner => 
          owner.email?.toLowerCase() === userEmail.toLowerCase()
        ) || null;
        if (selectedOwner) {
          selectionReason = 'email match';
          console.log('✅ Found owner matching authenticated email:', selectedOwner.fullName, selectedOwner.email);
        } else {
          console.log('❌ No owner found matching email:', userEmail);
        }
      }
      
      // Priority 2: Use saved owner if no email match AND not already initialized
      if (!selectedOwner && !ownerSelectionInitialized) {
        const savedOwnerId = localStorage.getItem(STORAGE_KEY);
        console.log('Checking localStorage saved owner:', savedOwnerId);
        
        if (savedOwnerId) {
          selectedOwner = owners.find(owner => owner.id === savedOwnerId) || null;
          if (selectedOwner) {
            selectionReason = 'localStorage';
            console.log('✅ Using saved owner from localStorage:', selectedOwner.fullName);
          }
        }
      }
      
      // Priority 3: Fallback to first owner if not initialized
      if (!selectedOwner && !ownerSelectionInitialized) {
        selectedOwner = owners[0];
        selectionReason = 'first owner fallback';
        console.log('✅ Using first owner as fallback:', selectedOwner.fullName);
      }
      
      // Update selection if we found an owner
      if (selectedOwner) {
        console.log(`🎯 Setting owner: ${selectedOwner.fullName} (reason: ${selectionReason})`);
        setSelectedOwnerId(selectedOwner.id);
        localStorage.setItem(STORAGE_KEY, selectedOwner.id);
        setOwnerSelectionInitialized(true);
      }
      
      console.log('=== END OWNER SELECTION ===');
    }
  }, [owners, userEmail, ownerSelectionInitialized]);

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
