import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { AlertTriangle, ChevronsUpDown, Check, Repeat, Plus, X, CalendarIcon } from "lucide-react";
import { SequenceTaskList } from "./SequenceTaskList";

interface SequenceTask {
  id: string;
  taskName: string;
  delay: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days';
  };
}

interface DaySchedule {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

interface WorkingHoursConfig {
  lundi: DaySchedule;
  mardi: DaySchedule;
  mercredi: DaySchedule;
  jeudi: DaySchedule;
  vendredi: DaySchedule;
  samedi: DaySchedule;
  dimanche: DaySchedule;
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
  useWorkingHours: boolean;
  workingHours: WorkingHoursConfig;
  nonWorkingDates: Date[];
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
  const [useWorkingHours, setUseWorkingHours] = useState(false);
  const [sequenceMode, setSequenceMode] = useState(false);
  const [sequenceTasks, setSequenceTasks] = useState<SequenceTask[]>([
    {
      id: "task-1",
      taskName: "",
      delay: { amount: 1, unit: 'hours' }
    }
  ]);

  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig>({
    lundi: { enabled: true, startTime: "09:00", endTime: "18:00" },
    mardi: { enabled: true, startTime: "09:00", endTime: "18:00" },
    mercredi: { enabled: true, startTime: "09:00", endTime: "18:00" },
    jeudi: { enabled: true, startTime: "09:00", endTime: "18:00" },
    vendredi: { enabled: true, startTime: "09:00", endTime: "18:00" },
    samedi: { enabled: false, startTime: "09:00", endTime: "18:00" },
    dimanche: { enabled: false, startTime: "09:00", endTime: "18:00" }
  });

  const [nonWorkingDates, setNonWorkingDates] = useState<Date[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSave = async () => {
    try {
      await onSave({
        categoryId,
        createInitialTask,
        initialTaskName,
        sequenceTasks,
        canInterruptSequence,
        useWorkingHours,
        workingHours,
        nonWorkingDates
      });
    } catch (error) {
      console.error('Error saving sequence config:', error);
    }
  };

  const updateDaySchedule = (day: keyof WorkingHoursConfig, field: keyof DaySchedule, value: boolean | string) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const dayNames: Array<{ key: keyof WorkingHoursConfig; label: string }> = [
    { key: 'lundi', label: 'Lundi' },
    { key: 'mardi', label: 'Mardi' },
    { key: 'mercredi', label: 'Mercredi' },
    { key: 'jeudi', label: 'Jeudi' },
    { key: 'vendredi', label: 'Vendredi' },
    { key: 'samedi', label: 'Samedi' },
    { key: 'dimanche', label: 'Dimanche' }
  ];

  const formatFrenchDate = (date: Date): string => {
    const frenchDays = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const frenchMonths = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                          'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    
    const dayName = frenchDays[date.getDay()];
    const day = date.getDate();
    const month = frenchMonths[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName} ${day} ${month} ${year}`;
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date && !nonWorkingDates.some(d => d.toDateString() === date.toDateString())) {
      setNonWorkingDates([...nonWorkingDates, date]);
    }
    setShowDatePicker(false);
  };

  const removeDate = (dateToRemove: Date) => {
    setNonWorkingDates(nonWorkingDates.filter(d => d.toDateString() !== dateToRemove.toDateString()));
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
            disabled={!sequenceMode}
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

      {/* Create Sequence Button or Subsequent Tasks */}
      {!sequenceMode ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSequenceMode(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Créer une séquence
          </Button>
        </div>
      ) : (
        <>
          {/* Subsequent Tasks */}
          <SequenceTaskList
            tasks={sequenceTasks}
            onTasksChange={setSequenceTasks}
            onSequenceDelete={() => {
              setSequenceMode(false);
              setCreateInitialTask(true);
            }}
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

          {/* Working Hours Configuration */}
          <div className="space-y-4 p-4 border rounded-lg bg-slate-50/80 border-slate-200">
            <h4 className="font-medium">Horaires de travail</h4>
            
            <div className="flex items-start space-x-2">
              <Checkbox
                id="use-working-hours"
                checked={useWorkingHours}
                onCheckedChange={(checked) => setUseWorkingHours(checked as boolean)}
              />
              <label
                htmlFor="use-working-hours"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                S'assurer que les échéances des tâches créées automatiquement tiennent compte des horaires de travail
              </label>
            </div>

            {useWorkingHours && (
              <div className="mt-4 space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Jour</TableHead>
                      <TableHead className="w-24">Début</TableHead>
                      <TableHead className="w-24">Fin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dayNames.map(({ key, label }) => (
                      <TableRow key={key}>
                        <TableCell className="h-14">
                          <div className="flex items-center space-x-2 h-full">
                            <Checkbox
                              id={`day-${key}`}
                              checked={workingHours[key].enabled}
                              onCheckedChange={(checked) => updateDaySchedule(key, 'enabled', checked as boolean)}
                            />
                            <label htmlFor={`day-${key}`} className="text-sm font-medium">
                              {label}
                            </label>
                          </div>
                        </TableCell>
                        {workingHours[key].enabled ? (
                          <>
                            <TableCell className="h-14">
                              <div className="flex items-center h-full">
                                <Input
                                  type="time"
                                  value={workingHours[key].startTime}
                                  onChange={(e) => updateDaySchedule(key, 'startTime', e.target.value)}
                                  className="w-full h-9"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="h-14">
                              <div className="flex items-center h-full">
                                <Input
                                  type="time"
                                  value={workingHours[key].endTime}
                                  onChange={(e) => updateDaySchedule(key, 'endTime', e.target.value)}
                                  className="w-full h-9"
                                />
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="h-14">
                              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                -
                              </div>
                            </TableCell>
                            <TableCell className="h-14">
                              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                -
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Separator />

                <div className="space-y-3">
                  <h5 className="font-medium text-sm">Dates d'exception (aucune tâche ne sera créée à ces dates)</h5>
                  
                  {nonWorkingDates.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Aucunes dates ajoutées</p>
                  ) : (
                    <div className="space-y-2">
                      {nonWorkingDates.map((date, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center justify-between w-fit px-3 py-1">
                          <span className="text-sm">{formatFrenchDate(date)}</span>
                          <button
                            onClick={() => removeDate(date)}
                            className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5"
                            type="button"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Ajouter une date
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={undefined}
                        onSelect={handleDateSelect}
                        weekStartsOn={1}
                        disabled={(date) => 
                          date < new Date() || 
                          nonWorkingDates.some(d => d.toDateString() === date.toDateString())
                        }
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Save/Cancel Actions */}
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