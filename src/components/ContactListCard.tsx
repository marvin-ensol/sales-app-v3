import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronsUpDown, Check, ExternalLink, Repeat, AlertTriangle, Users } from "lucide-react";

interface HubSpotList {
  listId: string;
  name: string;
  updatedAt: string;
  objectTypeId: string;
  processingType: string;
  additionalProperties?: {
    hs_list_size?: string;
    hs_list_reference_count?: string;
  };
}

interface ContactListCardProps {
  hubspotLists: HubSpotList[];
  listsLoading: boolean;
  refreshingLists: boolean;
  onRefreshLists: () => void;
  selectedListId?: string;
  onListChange: (listId: string) => void;
  validationError?: string;
  usedListIds?: string[];
}

export const ContactListCard = ({
  hubspotLists,
  listsLoading,
  refreshingLists,
  onRefreshLists,
  selectedListId,
  onListChange,
  validationError,
  usedListIds = []
}: ContactListCardProps) => {
  const [listPopoverOpen, setListPopoverOpen] = useState(false);

  const openHubSpotList = (listId: string) => {
    const url = `https://app-eu1.hubspot.com/contacts/142467012/objectLists/${listId}/filters`;
    window.open(url, '_blank');
  };

  const selectedList = hubspotLists.find(list => list.listId === selectedListId);

  return (
    <div className="p-4 border rounded-lg bg-slate-50/80 border-slate-200">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h4 className="text-base font-medium">Liste de contact</h4>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          {/* Dropdown and HubSpot button container */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Popover open={listPopoverOpen} onOpenChange={setListPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={listPopoverOpen}
                    className="w-full justify-between text-left font-normal"
                    disabled={listsLoading}
                  >
                    {selectedList ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="truncate">{selectedList.name}</span>
                        <Badge variant="secondary" className="ml-2 flex-shrink-0">
                          {selectedList.additionalProperties?.hs_list_size || '0'} contacts
                        </Badge>
                      </div>
                    ) : (
                      "Sélectionner une liste..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher une liste..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>Aucune liste trouvée.</CommandEmpty>
                      <CommandGroup>
                        {hubspotLists.map((list) => {
                          const isUsed = usedListIds.includes(list.listId);
                          const isSelected = selectedListId === list.listId;
                          
                          return (
                            <CommandItem
                              key={list.listId}
                              value={list.name}
                              disabled={isUsed}
                              onSelect={() => {
                                if (!isUsed) {
                                  onListChange(list.listId);
                                  setListPopoverOpen(false);
                                }
                              }}
                              className={isUsed ? "opacity-50 cursor-not-allowed" : ""}
                            >
                              <div className="flex flex-col gap-1 w-full">
                                <div className="flex items-center justify-between w-full">
                                  <span className="truncate">{list.name}</span>
                                  <Badge variant="secondary" className="ml-2 flex-shrink-0">
                                    {list.additionalProperties?.hs_list_size || '0'}
                                  </Badge>
                                </div>
                                {isUsed && (
                                  <span className="text-xs text-muted-foreground italic">
                                    Liste déjà utilisée ailleurs
                                  </span>
                                )}
                              </div>
                              <Check
                                className={`ml-auto h-4 w-4 ${
                                  isSelected ? "opacity-100" : "opacity-0"
                                }`}
                              />
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            {/* HubSpot icon button */}
            {selectedList && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => openHubSpotList(selectedList.listId)}
                className="h-10 w-10 flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>

          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
        </div>

        {/* Refresh link - always visible and right-aligned */}
        <div className="flex justify-end">
          <button
            onClick={onRefreshLists}
            disabled={refreshingLists}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center gap-1"
          >
            <Repeat className={`h-3 w-3 ${refreshingLists ? 'animate-spin' : ''}`} />
            Actualiser les listes
          </button>
        </div>
      </div>
    </div>
  );
};