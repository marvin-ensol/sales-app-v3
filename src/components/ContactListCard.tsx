import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronsUpDown, Check, ExternalLink, Repeat, AlertTriangle } from "lucide-react";

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
}

export const ContactListCard = ({
  hubspotLists,
  listsLoading,
  refreshingLists,
  onRefreshLists,
  selectedListId,
  onListChange,
  validationError
}: ContactListCardProps) => {
  const [listPopoverOpen, setListPopoverOpen] = useState(false);

  const openHubSpotList = (listId: string) => {
    const url = `https://app-eu1.hubspot.com/contacts/142467012/objectLists/${listId}/filters`;
    window.open(url, '_blank');
  };

  const selectedList = hubspotLists.find(list => list.listId === selectedListId);

  return (
    <Card className="space-y-4">
      <CardHeader>
        <CardTitle>Liste de contact</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
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
                    {hubspotLists.map((list) => (
                      <CommandItem
                        key={list.listId}
                        value={list.name}
                        onSelect={() => {
                          onListChange(list.listId);
                          setListPopoverOpen(false);
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate">{list.name}</span>
                          <Badge variant="secondary" className="ml-2 flex-shrink-0">
                            {list.additionalProperties?.hs_list_size || '0'}
                          </Badge>
                        </div>
                        <Check
                          className={`ml-auto h-4 w-4 ${
                            selectedListId === list.listId ? "opacity-100" : "opacity-0"
                          }`}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {validationError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
        </div>

        {selectedList && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openHubSpotList(selectedList.listId)}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Ouvrir dans HubSpot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshLists}
              disabled={refreshingLists}
              className="flex items-center gap-2"
            >
              <Repeat className={`h-4 w-4 ${refreshingLists ? 'animate-spin' : ''}`} />
              Actualiser les listes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};