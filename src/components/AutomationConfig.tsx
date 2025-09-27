import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Trash2, Settings, Play, Pause, Save } from 'lucide-react';
import { TaskAutomation } from '@/hooks/useTaskAutomationsManagement';

interface AutomationConfigProps {
  automation: TaskAutomation;
  hubspotLists: Array<{ listId: string; name: string; size: number }>;
  onUpdate: (id: string, data: Partial<TaskAutomation>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleEnabled: (id: string, enabled: boolean) => Promise<void>;
  onHide?: (id: string) => Promise<void>;
}

interface TaskConfig {
  delay: number;
  title: string;
  description: string;
}

export const AutomationConfig: React.FC<AutomationConfigProps> = ({
  automation,
  hubspotLists,
  onUpdate,
  onDelete,
  onToggleEnabled,
  onHide
}) => {
  // Debug logging
  console.log('AutomationConfig received automation:', automation);
  console.log('tasks_configuration:', automation.tasks_configuration);
  console.log('schedule_configuration:', automation.schedule_configuration);

  // Normalize configuration data with proper defaults
  const normalizeTasksConfig = (config: any) => {
    if (!config || typeof config !== 'object') {
      console.log('Invalid tasks_configuration, using default:', config);
      return { tasks: [] as TaskConfig[] };
    }
    if (!Array.isArray(config.tasks)) {
      console.log('tasks_configuration.tasks is not an array, using default:', config.tasks);
      return { tasks: [] as TaskConfig[] };
    }
    return config;
  };

  const normalizeScheduleConfig = (config: any) => {
    if (!config || typeof config !== 'object') {
      console.log('Invalid schedule_configuration, using default:', config);
      return { delay: 1, unit: 'hours' };
    }
    return config;
  };

  const [isEditing, setIsEditing] = useState(false);
  const [localConfig, setLocalConfig] = useState({
    name: automation.name,
    hs_list_id: automation.hs_list_id || '',
    sequence_enabled: automation.sequence_enabled || false,
    sequence_exit_enabled: automation.sequence_exit_enabled || false,
    first_task_creation: automation.first_task_creation || false,
    auto_complete_on_exit_enabled: automation.auto_complete_on_exit_enabled || false,
    schedule_enabled: automation.schedule_enabled || false,
    schedule_configuration: normalizeScheduleConfig(automation.schedule_configuration),
    tasks_configuration: normalizeTasksConfig(automation.tasks_configuration)
  });

  useEffect(() => {
    console.log('AutomationConfig useEffect triggered with automation:', automation);
    setLocalConfig({
      name: automation.name,
      hs_list_id: automation.hs_list_id || '',
      sequence_enabled: automation.sequence_enabled || false,
      sequence_exit_enabled: automation.sequence_exit_enabled || false,
      first_task_creation: automation.first_task_creation || false,
      auto_complete_on_exit_enabled: automation.auto_complete_on_exit_enabled || false,
      schedule_enabled: automation.schedule_enabled || false,
      schedule_configuration: normalizeScheduleConfig(automation.schedule_configuration),
      tasks_configuration: normalizeTasksConfig(automation.tasks_configuration)
    });
  }, [automation]);

  const handleSave = async () => {
    try {
      await onUpdate(automation.id, localConfig);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save automation:', error);
    }
  };

  const handleCancel = () => {
    setLocalConfig({
      name: automation.name,
      hs_list_id: automation.hs_list_id || '',
      sequence_enabled: automation.sequence_enabled || false,
      sequence_exit_enabled: automation.sequence_exit_enabled || false,
      first_task_creation: automation.first_task_creation || false,
      auto_complete_on_exit_enabled: automation.auto_complete_on_exit_enabled || false,
      schedule_enabled: automation.schedule_enabled || false,
      schedule_configuration: normalizeScheduleConfig(automation.schedule_configuration),
      tasks_configuration: normalizeTasksConfig(automation.tasks_configuration)
    });
    setIsEditing(false);
  };

  const addTask = () => {
    setLocalConfig(prev => ({
      ...prev,
      tasks_configuration: {
        ...prev.tasks_configuration,
        tasks: [
          ...(prev.tasks_configuration?.tasks || []),
          { delay: 1, title: '', description: '' }
        ]
      }
    }));
  };

  const updateTask = (index: number, field: keyof TaskConfig, value: string | number) => {
    setLocalConfig(prev => ({
      ...prev,
      tasks_configuration: {
        ...prev.tasks_configuration,
        tasks: (prev.tasks_configuration?.tasks || []).map((task, i) => 
          i === index ? { ...task, [field]: value } : task
        )
      }
    }));
  };

  const removeTask = (index: number) => {
    setLocalConfig(prev => ({
      ...prev,
      tasks_configuration: {
        ...prev.tasks_configuration,
        tasks: (prev.tasks_configuration?.tasks || []).filter((_, i) => i !== index)
      }
    }));
  };

  const selectedList = hubspotLists.find(list => list.listId === automation.hs_list_id);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">
            {isEditing ? (
              <Input
                value={localConfig.name}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, name: e.target.value }))}
                className="text-base font-semibold"
              />
            ) : (
              automation.name
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={automation.automation_enabled ? "default" : "secondary"}>
              {automation.automation_enabled ? "Active" : "Inactive"}
            </Badge>
            {automation.task_categories && (
              <Badge 
                variant="outline" 
                style={{ 
                  borderColor: automation.task_categories.color,
                  color: automation.task_categories.color 
                }}
              >
                {automation.task_categories.label}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleEnabled(automation.id, !automation.automation_enabled)}
          >
            {automation.automation_enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(automation.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* HubSpot List Selection */}
        <div className="space-y-2">
          <Label>HubSpot List</Label>
          {isEditing ? (
            <Select
              value={localConfig.hs_list_id}
              onValueChange={(value) => setLocalConfig(prev => ({ ...prev, hs_list_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a HubSpot list" />
              </SelectTrigger>
              <SelectContent>
                {hubspotLists.map((list) => (
                  <SelectItem key={list.listId} value={list.listId}>
                    {list.name} ({list.size} contacts)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              {selectedList ? `${selectedList.name} (${selectedList.size} contacts)` : 'No list selected'}
            </p>
          )}
        </div>

        {/* Sequence Configuration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="sequence-enabled">Enable Sequence</Label>
            <Switch
              id="sequence-enabled"
              checked={localConfig.sequence_enabled}
              onCheckedChange={(checked) => 
                setLocalConfig(prev => ({ ...prev, sequence_enabled: checked }))
              }
              disabled={!isEditing}
            />
          </div>

          {localConfig.sequence_enabled && (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="sequence-exit">Enable Sequence Exit</Label>
                <Switch
                  id="sequence-exit"
                  checked={localConfig.sequence_exit_enabled}
                  onCheckedChange={(checked) => 
                    setLocalConfig(prev => ({ ...prev, sequence_exit_enabled: checked }))
                  }
                  disabled={!isEditing}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="first-task">Create First Task</Label>
                <Switch
                  id="first-task"
                  checked={localConfig.first_task_creation}
                  onCheckedChange={(checked) => 
                    setLocalConfig(prev => ({ ...prev, first_task_creation: checked }))
                  }
                  disabled={!isEditing}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-complete">Auto-complete on Exit</Label>
                <Switch
                  id="auto-complete"
                  checked={localConfig.auto_complete_on_exit_enabled}
                  onCheckedChange={(checked) => 
                    setLocalConfig(prev => ({ ...prev, auto_complete_on_exit_enabled: checked }))
                  }
                  disabled={!isEditing}
                />
              </div>

              {/* Tasks Configuration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Task Sequence</Label>
                  {isEditing && (
                    <Button variant="outline" size="sm" onClick={addTask}>
                      Add Task
                    </Button>
                  )}
                </div>

                {(localConfig.tasks_configuration?.tasks || []).map((task, index) => (
                  <Card key={index} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Task {index + 1}</Label>
                        {isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTask(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Delay (days)</Label>
                          <Input
                            type="number"
                            value={task.delay}
                            onChange={(e) => updateTask(index, 'delay', parseInt(e.target.value) || 0)}
                            disabled={!isEditing}
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Title</Label>
                        <Input
                          value={task.title}
                          onChange={(e) => updateTask(index, 'title', e.target.value)}
                          disabled={!isEditing}
                          className="text-sm"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={task.description}
                          onChange={(e) => updateTask(index, 'description', e.target.value)}
                          disabled={!isEditing}
                          className="text-sm"
                          rows={2}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

        {isEditing && (
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};