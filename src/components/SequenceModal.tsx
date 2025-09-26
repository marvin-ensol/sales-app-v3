import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCategoryManagement } from "@/hooks/useTaskCategoriesManagement";
import { SequenceTaskList } from "./SequenceTaskList";

interface SequenceTask {
  id: string;
  taskName: string;
  delay: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

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
  const [createInitialTask, setCreateInitialTask] = useState(true);
  const [initialTaskName, setInitialTaskName] = useState("");
  const [sequenceTasks, setSequenceTasks] = useState<SequenceTask[]>([
    {
      id: "task-1",
      taskName: "",
      delay: { amount: 1, unit: 'hours' }
    }
  ]);

  // Filter out categories that already have sequences and the fallback category
  const availableCategories = useMemo(() => {
    return categories.filter(category => 
      category.hs_queue_id !== null && 
      !category.display_sequence_card
    );
  }, [categories]);

  const selectedCategory = availableCategories.find(cat => cat.id === selectedCategoryId);

  const handleCreateSequence = async () => {
    if (!selectedCategoryId) return;
    
    try {
      // TODO: Update this to handle the sequence configuration
      await onCreateSequence(selectedCategoryId);
      setSelectedCategoryId(null);
      setCreateInitialTask(true);
      setInitialTaskName("");
      setSequenceTasks([{
        id: "task-1",
        taskName: "",
        delay: { amount: 1, unit: 'hours' }
      }]);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating sequence:', error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedCategoryId(null);
      setCreateInitialTask(true);
      setInitialTaskName("");
      setSequenceTasks([{
        id: "task-1",
        taskName: "",
        delay: { amount: 1, unit: 'hours' }
      }]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une séquence</DialogTitle>
          <DialogDescription>
            Configurez une séquence automatisée de tâches pour cette catégorie.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
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

          {selectedCategoryId && (
            <div className="space-y-6">
              {/* Task 1 Configuration */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                <h4 className="font-medium">Tâche 1</h4>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="create-initial-task"
                    checked={createInitialTask}
                    onCheckedChange={(checked) => setCreateInitialTask(checked as boolean)}
                  />
                  <label
                    htmlFor="create-initial-task"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Créer une tâche quand le contact entre dans une liste
                  </label>
                </div>

                {createInitialTask && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nom de la tâche</label>
                    <Input
                      value={initialTaskName}
                      onChange={(e) => setInitialTaskName(e.target.value)}
                      placeholder="Nom de la première tâche"
                    />
                  </div>
                )}

                {!createInitialTask && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      La séquence ne sera activée que si une première tâche est ajoutée dans cette catégorie pour un contact donné
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Subsequent Tasks */}
              <div className="space-y-4">
                <h4 className="font-medium">Tâches suivantes</h4>
                <SequenceTaskList
                  tasks={sequenceTasks}
                  onTasksChange={setSequenceTasks}
                />
              </div>
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
            Créer la séquence
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};