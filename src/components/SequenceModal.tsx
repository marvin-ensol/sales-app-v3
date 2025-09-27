import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCategoryManagement } from "@/hooks/useTaskCategoriesManagement";

interface SequenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: TaskCategoryManagement[];
  onCreateSequence: (categoryId: number) => Promise<void>;
  isSubmitting: boolean;
}

export const SequenceModal = ({ 
  open, 
  onOpenChange, 
  categories, 
  onCreateSequence,
  isSubmitting 
}: SequenceModalProps) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // Show all categories except the fallback category (preserving original UI)
  const availableCategories = useMemo(() => {
    return categories.filter(category => 
      category.hs_queue_id !== null
    );
  }, [categories]);

  const selectedCategory = availableCategories.find(cat => cat.id === selectedCategoryId);

  const handleCreateSequence = async () => {
    if (!selectedCategoryId) return;
    
    try {
      await onCreateSequence(selectedCategoryId);
      setSelectedCategoryId(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating sequence:', error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedCategoryId(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer une automatisation</DialogTitle>
          <DialogDescription>
            Sélectionnez la catégorie de tâches concernée par l'automatisation
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Catégorie de tâches</label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between"
                >
                  {selectedCategory ? (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: selectedCategory.color || "#9ca3af" }}
                      />
                      {selectedCategory.label}
                    </div>
                  ) : (
                    "Sélectionner une catégorie..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Rechercher une catégorie..." />
                  <CommandList>
                    <CommandEmpty>Aucune catégorie trouvée.</CommandEmpty>
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
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: category.color || "#9ca3af" }}
                            />
                            <span>{category.label}</span>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                selectedCategoryId === category.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {availableCategories.length === 0 && (
            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
              Toutes les catégories disponibles ont déjà une séquence associée.
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleCreateSequence}
            disabled={!selectedCategoryId || isSubmitting}
          >
            Créer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};