import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TaskCategory {
  id: number;
  label: string;
  color: string;
  hs_queue_id: string;
}

interface AutomationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: TaskCategory[];
  onCreateAutomation: (categoryId: number, name: string) => Promise<void>;
  isSubmitting: boolean;
}

export const AutomationModal: React.FC<AutomationModalProps> = ({
  open,
  onOpenChange,
  categories,
  onCreateAutomation,
  isSubmitting
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [automationName, setAutomationName] = useState('');
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const availableCategories = useMemo(() => {
    return categories.filter(category => category.hs_queue_id !== null);
  }, [categories]);

  const selectedCategory = availableCategories.find(cat => cat.id === selectedCategoryId);

  const handleCreateAutomation = async () => {
    if (!selectedCategoryId || !automationName.trim()) return;
    
    await onCreateAutomation(selectedCategoryId, automationName.trim());
    handleOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedCategoryId(null);
      setAutomationName('');
      setComboboxOpen(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Automation</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="automation-name">Automation Name</Label>
            <Input
              id="automation-name"
              placeholder="Enter automation name..."
              value={automationName}
              onChange={(e) => setAutomationName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Task Category</Label>
            {availableCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No categories available for automation creation. Please create a task category first.
              </p>
            ) : (
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="justify-between"
                  >
                    {selectedCategory ? (
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-sm" 
                          style={{ backgroundColor: selectedCategory.color }}
                        />
                        {selectedCategory.label}
                      </div>
                    ) : (
                      "Select category..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search categories..." />
                    <CommandList>
                      <CommandEmpty>No categories found.</CommandEmpty>
                      <CommandGroup>
                        {availableCategories.map((category) => (
                          <CommandItem
                            key={category.id}
                            value={category.label}
                            onSelect={() => {
                              setSelectedCategoryId(category.id);
                              setComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCategoryId === category.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-sm" 
                                style={{ backgroundColor: category.color }}
                              />
                              {category.label}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateAutomation}
            disabled={!selectedCategoryId || !automationName.trim() || isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Automation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};