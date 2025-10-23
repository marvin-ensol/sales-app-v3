import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface EventTypeFilterProps {
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
}

const EVENT_TYPES = [
  { value: "call_created", label: "Call Created" },
  { value: "list_entry", label: "List Entry" },
  { value: "list_exit", label: "List Exit" },
];

export const EventTypeFilter = ({
  selectedTypes,
  onTypesChange,
}: EventTypeFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (value: string) => {
    const newSelection = selectedTypes.includes(value)
      ? selectedTypes.filter((t) => t !== value)
      : [...selectedTypes, value];
    onTypesChange(newSelection);
  };

  const handleClearAll = () => {
    onTypesChange([]);
  };

  const getButtonText = () => {
    if (selectedTypes.length === 0) return "All Events";
    if (selectedTypes.length === 1) {
      const type = EVENT_TYPES.find((t) => t.value === selectedTypes[0]);
      return type?.label || "All Events";
    }
    return `${selectedTypes.length} events selected`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between"
        >
          {getButtonText()}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search event types..." />
          <CommandList>
            <CommandEmpty>No event type found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={handleClearAll}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Check
                    className={cn(
                      "h-4 w-4",
                      selectedTypes.length === 0 ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>All Events</span>
                </div>
              </CommandItem>
              {EVENT_TYPES.map((type) => (
                <CommandItem
                  key={type.value}
                  onSelect={() => handleToggle(type.value)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedTypes.includes(type.value)}
                      onCheckedChange={() => handleToggle(type.value)}
                    />
                    <span>{type.label}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
