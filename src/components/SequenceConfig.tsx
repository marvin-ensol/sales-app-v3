import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AlertTriangle, ChevronsUpDown, Check, Repeat } from "lucide-react";
import { SequenceTaskList } from "./SequenceTaskList";

interface SequenceTask {
  id: string;
  taskName: string;
  delay: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

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

interface SequenceConfigProps {
  categoryId: number;
  onSave: (config: SequenceConfig) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  hubspotLists: HubSpotList[];
  listsLoading: boolean;
  refreshingLists: boolean;
  onRefreshLists: () => void;
  selectedListId?: string;
  onListChange: (listId: string) => void;
}

interface SequenceConfig {
  categoryId: number;
  createInitialTask: boolean;
  initialTaskName: string;
  sequenceTasks: SequenceTask[];
  canInterruptSequence: boolean;
}

export const SequenceConfig = ({ 
  categoryId, 
  onSave, 
  onCancel, 
  isSubmitting,
  hubspotLists,
  listsLoading,
  refreshingLists,
  onRefreshLists,
  selectedListId,
  onListChange
}: SequenceConfigProps) => {
  const [createInitialTask, setCreateInitialTask] = useState(true);
  const [initialTaskName, setInitialTaskName] = useState("");
  const [listPopoverOpen, setListPopoverOpen] = useState(false);
  const [canInterruptSequence, setCanInterruptSequence] = useState(false);
  const [exitListPopoverOpen, setExitListPopoverOpen] = useState(false);
  const [sequenceTasks, setSequenceTasks] = useState<SequenceTask[]>([
    {
      id: "task-1",
      taskName: "",
      delay: { amount: 1, unit: 'hours' }
    }
  ]);

  const handleSave = async () => {
    try {
      await onSave({
        categoryId,
        createInitialTask,
        initialTaskName,
        sequenceTasks,
        canInterruptSequence
      });
    } catch (error) {
      console.error('Error saving sequence config:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Task 1 Configuration */}
      <div className="space-y-4 p-4 border rounded-lg bg-slate-50/80 border-slate-200">
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
          <div className="space-y-4">
            <div className="space-y-2">
              <Popover open={listPopoverOpen} onOpenChange={setListPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={listPopoverOpen}
                    className="w-full justify-between"
                    disabled={listsLoading}
                  >
                    {selectedListId
                      ? hubspotLists.find(list => list.listId === selectedListId)?.name || "Liste non trouvée"
                      : "Sélectionner une liste..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 bg-background border z-50">
                  <Command>
                    <CommandInput placeholder="Rechercher une liste..." />
                    <CommandEmpty>Aucune liste trouvée.</CommandEmpty>
                    <CommandList>
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
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedListId === list.listId ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <div>
                              <div className="font-medium">{list.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {list.additionalProperties?.hs_list_size} contacts • {list.processingType}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="mt-2 flex justify-end">
                <Button
                  variant="link"
                  size="sm"
                  onClick={onRefreshLists}
                  disabled={refreshingLists}
                  className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800"
                >
                  <Repeat className={`h-3 w-3 mr-1 ${refreshingLists ? 'animate-spin' : ''}`} />
                  {refreshingLists ? 'Actualisation...' : 'Actualiser les listes'}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nom de la tâche</Label>
              <Input
                value={initialTaskName}
                onChange={(e) => setInitialTaskName(e.target.value)}
                placeholder="Nom de la première tâche"
              />
            </div>
          </div>
        )}

        {!createInitialTask && (
          <Alert className="bg-red-50 border-red-200 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              La séquence ne sera activée que si une première tâche est ajoutée dans cette catégorie pour un contact donné
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Subsequent Tasks */}
      <SequenceTaskList
        tasks={sequenceTasks}
        onTasksChange={setSequenceTasks}
      />

      {/* Sequence Exit Configuration */}
      <div className="space-y-4 p-4 border rounded-lg bg-slate-50/80 border-slate-200">
        <h4 className="font-medium">Sortie de séquence</h4>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="can-interrupt-sequence"
            checked={canInterruptSequence}
            onCheckedChange={(checked) => setCanInterruptSequence(checked as boolean)}
          />
          <label
            htmlFor="can-interrupt-sequence"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            La séquence pourra être interrompue avant les tâches restantes si le contact quitte la liste contact
          </label>
        </div>

        {canInterruptSequence && (
          <div className="space-y-2">
            {createInitialTask && selectedListId ? (
              // Read-only display when Task 1 is enabled
              <div className="w-full p-2 border border-input bg-muted rounded-md">
                <div className="font-medium">
                  {hubspotLists.find(list => list.listId === selectedListId)?.name || "Liste non trouvée"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Liste sélectionnée depuis la Tâche 1
                </div>
              </div>
            ) : (
              // Interactive dropdown when Task 1 is not enabled
              <Popover open={exitListPopoverOpen} onOpenChange={setExitListPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={exitListPopoverOpen}
                    className="w-full justify-between"
                    disabled={listsLoading}
                  >
                    {selectedListId
                      ? hubspotLists.find(list => list.listId === selectedListId)?.name || "Liste non trouvée"
                      : "Sélectionner une liste..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 bg-background border z-50">
                  <Command>
                    <CommandInput placeholder="Rechercher une liste..." />
                    <CommandEmpty>Aucune liste trouvée.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {hubspotLists.map((list) => (
                          <CommandItem
                            key={list.listId}
                            value={list.name}
                            onSelect={() => {
                              onListChange(list.listId);
                              setExitListPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedListId === list.listId ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <div>
                              <div className="font-medium">{list.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {list.additionalProperties?.hs_list_size} contacts • {list.processingType}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            {!createInitialTask && (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="link"
                  size="sm"
                  onClick={onRefreshLists}
                  disabled={refreshingLists}
                  className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800"
                >
                  <Repeat className={`h-3 w-3 mr-1 ${refreshingLists ? 'animate-spin' : ''}`} />
                  {refreshingLists ? 'Actualisation...' : 'Actualiser les listes'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSubmitting}
          className="bg-black hover:bg-gray-800 text-white"
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
};