import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { AlertTriangle, Plus, X, CalendarIcon } from "lucide-react";
import { SequenceTaskList, TaskOwnerType } from "./SequenceTaskList";
import { TaskOwnerSelector } from "./TaskOwnerSelector";
import { ContactListCard } from "./ContactListCard";
import { useToast } from '@/hooks/use-toast';
import { TaskCategoryManagement } from "@/hooks/useTaskCategoriesManagement";

interface SequenceTask {
  id: string;
  taskName: string;
  owner: TaskOwnerType;
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
  initialCategory?: TaskCategoryManagement;
}

interface SequenceConfig {
  categoryId: number;
  createInitialTask: boolean;
  initialTaskName: string;
  initialTaskOwner: TaskOwnerType;
  sequenceTasks: SequenceTask[];
  canInterruptSequence: boolean;
  useWorkingHours: boolean;
  workingHours: WorkingHoursConfig;
  nonWorkingDates: Date[];
  // New database format
  first_task_creation?: boolean;
  sequence_enabled?: boolean;
  sequence_exit_enabled?: boolean;
  schedule_enabled?: boolean;
  tasks_configuration?: any;
  schedule_configuration?: any;
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
  onListChange,
  initialCategory
}: SequenceConfigProps) => {
  const [createInitialTask, setCreateInitialTask] = useState(true);
  const [initialTaskName, setInitialTaskName] = useState("");
  const [initialTaskOwner, setInitialTaskOwner] = useState<TaskOwnerType>('contact_owner');
  const [canInterruptSequence, setCanInterruptSequence] = useState(false);
  const [useWorkingHours, setUseWorkingHours] = useState(false);
  const [sequenceMode, setSequenceMode] = useState(false);
  const [sequenceTasks, setSequenceTasks] = useState<SequenceTask[]>([]);

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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Initialize component state from existing category data
  useEffect(() => {
    if (initialCategory) {
      // Set boolean flags
      setCreateInitialTask(initialCategory.first_task_creation ?? true);
      setSequenceMode(initialCategory.sequence_enabled ?? false);
      setCanInterruptSequence(initialCategory.sequence_exit_enabled ?? false);
      setUseWorkingHours(initialCategory.schedule_enabled ?? false);

      // Parse tasks_configuration JSONB
      if (initialCategory.tasks_configuration) {
        const tasksConfig = initialCategory.tasks_configuration;
        
        // Initialize initial task data
        if (tasksConfig.initial_task) {
          setInitialTaskName(tasksConfig.initial_task.name || "");
          setInitialTaskOwner(tasksConfig.initial_task.owner || 'contact_owner');
        }

        // Initialize sequence tasks
        if (tasksConfig.sequence_tasks && Array.isArray(tasksConfig.sequence_tasks)) {
          const sequenceTasks = tasksConfig.sequence_tasks.map((task: any) => ({
            id: `task-${task.id || Date.now() + Math.random()}`,
            taskName: task.name || "",
            owner: task.owner || 'contact_owner' as TaskOwnerType,
            delay: {
              amount: task.delay?.amount || 1,
              unit: task.delay?.unit || 'days' as 'minutes' | 'hours' | 'days'
            }
          }));
          setSequenceTasks(sequenceTasks);
        }
      }

      // Parse schedule_configuration JSONB
      if (initialCategory.schedule_configuration) {
        const scheduleConfig = initialCategory.schedule_configuration;
        
        // Initialize working hours (convert from English to French day names)
        if (scheduleConfig.working_hours) {
          const dayMapping = {
            'mon': 'lundi',
            'tue': 'mardi', 
            'wed': 'mercredi',
            'thu': 'jeudi',
            'fri': 'vendredi',
            'sat': 'samedi',
            'sun': 'dimanche'
          };

          const newWorkingHours = { ...workingHours };
          Object.entries(scheduleConfig.working_hours).forEach(([englishDay, schedule]: [string, any]) => {
            const frenchDay = dayMapping[englishDay as keyof typeof dayMapping];
            if (frenchDay) {
              newWorkingHours[frenchDay as keyof WorkingHoursConfig] = {
                enabled: schedule.enabled ?? true,
                startTime: schedule.start_time || schedule.startTime || "09:00", // Support both old and new format
                endTime: schedule.end_time || schedule.endTime || "18:00"
              };
            }
          });
          setWorkingHours(newWorkingHours);
        }

        // Initialize non-working dates
        if (scheduleConfig.non_working_dates && Array.isArray(scheduleConfig.non_working_dates)) {
          const dates = scheduleConfig.non_working_dates
            .map((dateStr: string) => {
              try {
                return new Date(dateStr);
              } catch {
                return null;
              }
            })
            .filter((date: Date | null) => date !== null);
          setNonWorkingDates(dates);
        }
      }
    }
  }, [initialCategory]);

  const validateConfig = () => {
    const errors: Record<string, string> = {};

    // Contact list validation - when either feature requires a list
    if ((createInitialTask || canInterruptSequence) && (!selectedListId || selectedListId === '')) {
      errors.contactList = 'Veuillez sélectionner une liste de contact';
    }

    // Task name validation - Initial task
    if (createInitialTask && initialTaskName.trim().length < 2) {
      errors.initialTaskName = 'Le nom de la tâche doit contenir au moins 2 caractères';
    }

    // Sequence tasks validation
    sequenceTasks.forEach((task, index) => {
      if (task.taskName.trim().length < 2) {
        errors[`sequenceTask_${index}_name`] = 'Le nom de la tâche doit contenir au moins 2 caractères';
      }

      // Delay validation
      const { amount, unit } = task.delay;
      if (unit === 'hours' && (amount < 1 || amount > 24)) {
        errors[`sequenceTask_${index}_delay`] = 'Les heures doivent être entre 1 et 24';
      } else if (unit === 'minutes' && (amount < 5 || amount > 60)) {
        errors[`sequenceTask_${index}_delay`] = 'Les minutes doivent être entre 5 et 60';
      } else if (unit === 'days' && (amount < 1 || amount > 365)) {
        errors[`sequenceTask_${index}_delay`] = 'Les jours doivent être entre 1 et 365';
      }
    });

    // Working hours special validation
    if (useWorkingHours) {
      const hasAtLeastOneDay = Object.values(workingHours).some(day => day.enabled);
      if (!hasAtLeastOneDay) {
        setUseWorkingHours(false);
        errors.workingHours = 'Au moins une journée de disponibilité est nécessaire pour activer cette fonctionnalité';
      }
    }

    return errors;
  };

  // Helper function to build tasks configuration JSONB
  const buildTasksConfiguration = () => {
    const config: any = {};

    // Initial task configuration
    if (createInitialTask) {
      config.initial_task = {
        name: initialTaskName,
        owner: initialTaskOwner,
        list_id: selectedListId || ""
      };
    }

    // Sequence tasks configuration with sequential IDs
    if (sequenceTasks.length > 0) {
      config.sequence_tasks = sequenceTasks.map((task, index) => ({
        id: index + 1,
        name: task.taskName,
        owner: task.owner,
        delay: {
          amount: task.delay.amount,
          unit: task.delay.unit
        }
      }));
    }

    // Exit sequence configuration
    if (canInterruptSequence) {
      config.exit_sequence = {
        list_id: selectedListId || ""
      };
    }

    return config;
  };

  // Helper function to build boolean flags
  const buildBooleanFlags = () => {
    return {
      first_task_creation: createInitialTask,
      sequence_enabled: sequenceTasks.length >= 1,
      sequence_exit_enabled: canInterruptSequence,
      schedule_enabled: useWorkingHours && Object.values(workingHours).some(day => day.enabled)
    };
  };

  // Helper function to deterministically order schedule JSON for display
  const orderScheduleForDisplay = (scheduleConfig: any) => {
    if (!scheduleConfig || !scheduleConfig.working_hours) return scheduleConfig;

    const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const orderedWorkingHours: Record<string, any> = {};

    // Process days in logical order
    dayOrder.forEach(day => {
      if (scheduleConfig.working_hours[day]) {
        const dayConfig = scheduleConfig.working_hours[day];
        if (dayConfig.enabled) {
          orderedWorkingHours[day] = {
            enabled: true,
            start_time: dayConfig.start_time,
            end_time: dayConfig.end_time
          };
        } else {
          orderedWorkingHours[day] = {
            enabled: false
          };
        }
      }
    });

    return {
      working_hours: orderedWorkingHours,
      non_working_dates: scheduleConfig.non_working_dates || []
    };
  };

  // Helper function to build schedule configuration JSONB
  const buildScheduleConfiguration = () => {
    if (!useWorkingHours) return null;

    // Map French day names to English abbreviated in logical order
    const dayMappingOrder = [
      { french: 'lundi', english: 'mon' },
      { french: 'mardi', english: 'tue' }, 
      { french: 'mercredi', english: 'wed' },
      { french: 'jeudi', english: 'thu' },
      { french: 'vendredi', english: 'fri' },
      { french: 'samedi', english: 'sat' },
      { french: 'dimanche', english: 'sun' }
    ];

    // Build working hours object in correct order using Map to preserve insertion order
    const workingHoursEntries: [string, any][] = [];
    
    dayMappingOrder.forEach(({ french, english }) => {
      const schedule = workingHours[french as keyof WorkingHoursConfig];
      if (schedule.enabled) {
        workingHoursEntries.push([english, {
          enabled: true,
          start_time: schedule.startTime,
          end_time: schedule.endTime
        }]);
      } else {
        workingHoursEntries.push([english, {
          enabled: false
        }]);
      }
    });

    // Convert to object maintaining order
    const mappedWorkingHours = Object.fromEntries(workingHoursEntries);

    return {
      working_hours: mappedWorkingHours,
      non_working_dates: nonWorkingDates.map(date => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      })
    };
  };

  const handleSave = async () => {
    const errors = validateConfig();
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast({
        title: "Erreur de validation",
        description: "Veuillez corriger les erreurs avant d'enregistrer l'automatisation",
        variant: "destructive",
      });
      return;
    }

    try {
      const booleanFlags = buildBooleanFlags();
      const tasksConfiguration = buildTasksConfiguration();
      const scheduleConfiguration = buildScheduleConfiguration();

      // Log the properly ordered schedule for debugging
      if (scheduleConfiguration) {
        const orderedSchedule = orderScheduleForDisplay(scheduleConfiguration);
        console.log('Schedule Configuration (ordered):', JSON.stringify(orderedSchedule, null, 2));
      }

      await onSave({
        categoryId,
        createInitialTask,
        initialTaskName,
        initialTaskOwner,
        sequenceTasks,
        canInterruptSequence,
        useWorkingHours,
        workingHours,
        nonWorkingDates,
        // New database format
        ...booleanFlags,
        tasks_configuration: tasksConfiguration,
        schedule_configuration: scheduleConfiguration
      });
    } catch (error) {
      console.error('Error saving sequence config:', error);
    }
  };


  const updateDaySchedule = (day: keyof WorkingHoursConfig, field: keyof DaySchedule, value: boolean | string) => {
    const newWorkingHours = {
      ...workingHours,
      [day]: {
        ...workingHours[day],
        [field]: value
      }
    };
    setWorkingHours(newWorkingHours);
    
    // Real-time validation for working hours
    if (useWorkingHours && field === 'enabled') {
      const hasEnabledDays = Object.values(newWorkingHours).some(day => day.enabled);
      if (!hasEnabledDays) {
        setUseWorkingHours(false);
        setValidationErrors(prev => ({
          ...prev,
          workingHours: 'Au moins une journée de disponibilité est nécessaire pour activer cette fonctionnalité'
        }));
      } else {
        setValidationErrors(prev => {
          const { workingHours, ...rest } = prev;
          return rest;
        });
      }
    }
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

  // Field-level validation functions
  const validateTaskName = (name: string, fieldKey: string) => {
    if (name.trim().length < 2) {
      setValidationErrors(prev => ({
        ...prev,
        [fieldKey]: 'Le nom de la tâche doit contenir au moins 2 caractères'
      }));
    } else {
      setValidationErrors(prev => {
        const { [fieldKey]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const validateDelay = (amount: number, unit: string, fieldKey: string) => {
    let error = '';
    if (unit === 'hours' && (amount < 1 || amount > 24)) {
      error = 'Les heures doivent être entre 1 et 24';
    } else if (unit === 'minutes' && (amount < 5 || amount > 60)) {
      error = 'Les minutes doivent être entre 5 et 60';  
    } else if (unit === 'days' && (amount < 1 || amount > 365)) {
      error = 'Les jours doivent être entre 1 et 365';
    }
    
    if (error) {
      setValidationErrors(prev => ({ ...prev, [fieldKey]: error }));
    } else {
      setValidationErrors(prev => {
        const { [fieldKey]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Contact List Card - shown when either checkbox is checked */}
      {(createInitialTask || canInterruptSequence) && (
        <ContactListCard
          hubspotLists={hubspotLists}
          listsLoading={listsLoading}
          refreshingLists={refreshingLists}
          onRefreshLists={onRefreshLists}
          selectedListId={selectedListId}
          onListChange={onListChange}
          validationError={validationErrors.contactList}
        />
      )}

      {/* Task 1 Configuration */}
      <div className="p-4 border rounded-lg bg-slate-50/80 border-slate-200">
        {/* Header with task number and inline name input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <h4 className="font-medium whitespace-nowrap">Tâche 1</h4>
              {createInitialTask && (
                <Input
                  value={initialTaskName}
                  onChange={(e) => setInitialTaskName(e.target.value)}
                  onBlur={() => validateTaskName(initialTaskName, 'initialTaskName')}
                  placeholder="Nom de la première tâche"
                  className="flex-1"
                />
              )}
            </div>
          </div>
          
          {validationErrors.initialTaskName && (
            <p className="text-sm text-destructive">{validationErrors.initialTaskName}</p>
          )}
        </div>

        {/* Divider - always present */}
        <div className="border-t border-slate-200/80 my-4"></div>

        {/* Checkbox below divider */}
        <div className="flex items-center space-x-2 mb-4">
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
            Créer une tâche quand le contact entre dans la liste définie ci-dessus
          </label>
        </div>

        {!createInitialTask && (
          /* Red alert when checkbox is unchecked */
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
            onClick={() => {
              setSequenceMode(true);
              // Automatically create the first sequence task (Task 2)
              if (sequenceTasks.length === 0) {
                setSequenceTasks([{
                  id: `task-${Date.now()}`,
                  taskName: '',
                  owner: 'previous_task_owner',
                  delay: { amount: 1, unit: 'hours' }
                }]);
              }
            }}
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
            validationErrors={validationErrors}
            onValidateTaskName={validateTaskName}
            onValidateDelay={validateDelay}
            onSequenceDelete={() => {
              setSequenceMode(false);
              setCreateInitialTask(true);
              setSequenceTasks([]);
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
                La séquence pourra être interrompue avant les tâches restantes si le contact quitte la liste définie ci-dessus
              </label>
            </div>

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
                
                {validationErrors.workingHours && (
                  <p className="text-sm text-destructive mt-3">{validationErrors.workingHours}</p>
                )}

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