import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Play, Pause, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSyncControl } from '@/hooks/useSyncControl';
import { cn } from '@/lib/utils';

export const SyncControlPanel = () => {
  const { syncControl, loading, togglePause, setCustomTimestamp, clearCustomTimestamp } = useSyncControl();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('12:00');
  const [notes, setNotes] = useState('');

  const handlePauseToggle = async (checked: boolean) => {
    await togglePause(checked, notes || undefined);
    setNotes('');
  };

  const handleSetCustomTimestamp = async () => {
    if (!selectedDate) return;
    
    const [hours, minutes] = selectedTime.split(':');
    const customDateTime = new Date(selectedDate);
    customDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    // Convert to UTC for storage
    const utcTimestamp = customDateTime.toISOString();
    
    await setCustomTimestamp(utcTimestamp, notes || undefined);
    setSelectedDate(undefined);
    setSelectedTime('12:00');
    setNotes('');
  };

  const handleClearCustomTimestamp = async () => {
    await clearCustomTimestamp();
  };

  const formatCustomTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'PPp'); // Local time display
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Sync Control Panel
        </CardTitle>
        <CardDescription>
          Manage sync operations and set custom timestamps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pause/Resume Toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="pause-sync"
                checked={syncControl?.is_paused || false}
                onCheckedChange={handlePauseToggle}
                disabled={loading}
              />
              <Label htmlFor="pause-sync" className="flex items-center gap-2">
                {syncControl?.is_paused ? (
                  <>
                    <Pause className="h-4 w-4 text-orange-500" />
                    Sync Paused
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 text-green-500" />
                    Sync Active
                  </>
                )}
              </Label>
            </div>
            
            <Badge variant={syncControl?.is_paused ? "destructive" : "default"}>
              {syncControl?.is_paused ? "Paused" : "Running"}
            </Badge>
          </div>

          {syncControl?.is_paused && syncControl.paused_at && (
            <div className="text-sm text-muted-foreground">
              Paused {format(new Date(syncControl.paused_at), 'PPp')}
              {syncControl.paused_by && ` by ${syncControl.paused_by}`}
            </div>
          )}
        </div>

        {/* Custom Timestamp Section */}
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Custom Sync Timestamp</Label>
            <p className="text-xs text-muted-foreground">
              Set a custom timestamp to sync from. This will be used for the next sync only.
            </p>
          </div>

          {syncControl?.custom_sync_timestamp && (
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Custom timestamp set
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Next sync will start from: {formatCustomTimestamp(syncControl.custom_sync_timestamp)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearCustomTimestamp}
                disabled={loading}
              >
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add a note about this change..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSetCustomTimestamp}
              disabled={!selectedDate || loading}
              size="sm"
              className="flex-1"
            >
              Set Custom Timestamp
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};