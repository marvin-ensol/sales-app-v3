
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { HubSpotOwner } from "@/hooks/useHubSpotOwners";

interface OwnerSelectorProps {
  owners: HubSpotOwner[];
  selectedOwnerId: string;
  onOwnerChange: (ownerId: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ownerSelectionInitialized: boolean;
  getSelectedOwnerName: () => string;
}

const OwnerSelector = ({
  owners,
  selectedOwnerId,
  onOwnerChange,
  isOpen,
  onOpenChange,
  ownerSelectionInitialized,
  getSelectedOwnerName
}: OwnerSelectorProps) => {
  // Sort owners alphabetically by full name
  const sortedOwners = [...owners].sort((a, b) => a.fullName.localeCompare(b.fullName));

  const handleOwnerSelect = (ownerId: string) => {
    onOwnerChange(ownerId);
    onOpenChange(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="flex-1 justify-between max-w-sm"
          disabled={!ownerSelectionInitialized}
        >
          {ownerSelectionInitialized ? getSelectedOwnerName() : "Loading owners..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full max-w-sm p-0" align="start">
        <Command>
          <CommandInput placeholder="Search owners..." />
          <CommandList>
            <CommandEmpty>No owner found.</CommandEmpty>
            <CommandGroup>
              {sortedOwners.map((owner) => (
                <CommandItem
                  key={owner.id}
                  value={owner.fullName}
                  onSelect={() => handleOwnerSelect(owner.id)}
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
  );
};

export default OwnerSelector;
