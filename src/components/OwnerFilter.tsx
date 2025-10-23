import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { HubSpotOwner } from "@/hooks/useUsers";
import { groupOwnersByTeam } from "@/utils/ownerGrouping";

interface OwnerFilterProps {
  owners: HubSpotOwner[];
  selectedOwnerId: string | undefined;
  onOwnerChange: (ownerId: string | undefined) => void;
  loading: boolean;
}

export const OwnerFilter = ({
  owners,
  selectedOwnerId,
  onOwnerChange,
  loading
}: OwnerFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const groupedOwners = groupOwnersByTeam(owners);

  const getSelectedOwnerName = () => {
    if (!selectedOwnerId) return "All Owners";
    const owner = owners.find(o => o.id === selectedOwnerId);
    return owner?.fullName || "All Owners";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between"
          disabled={loading}
        >
          {loading ? "Loading owners..." : getSelectedOwnerName()}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search owners..." />
          <CommandList>
            <CommandEmpty>No owner found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-owners"
                onSelect={() => {
                  onOwnerChange(undefined);
                  setIsOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !selectedOwnerId ? "opacity-100" : "opacity-0"
                  )}
                />
                All Owners
              </CommandItem>
            </CommandGroup>
            {groupedOwners.map((group) => (
              <CommandGroup key={group.teamName} heading={group.teamName}>
                {group.owners.map((owner) => (
                  <CommandItem
                    key={owner.id}
                    value={`${owner.fullName} ${group.teamName}`}
                    onSelect={() => {
                      onOwnerChange(owner.id);
                      setIsOpen(false);
                    }}
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
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
