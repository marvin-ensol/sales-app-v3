import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { toZonedTime, fromZonedTime, format } from "https://esm.sh/date-fns-tz@3.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkingHours {
  enabled: boolean;
  start_time?: string;
  end_time?: string;
}

interface ScheduleConfiguration {
  working_hours: {
    mon: WorkingHours;
    tue: WorkingHours;
    wed: WorkingHours;
    thu: WorkingHours;
    fri: WorkingHours;
    sat: WorkingHours;
    sun: WorkingHours;
  };
  non_working_dates: string[];
}

interface AutomationTriggerRequest {
  trigger_type: 'list_entry' | 'task_completion';
  // For list_entry triggers
  membership_id?: string;
  hs_list_id?: string;
  // For task_completion triggers
  task_id?: string;
  current_position?: number;
  associated_contact_id?: string;
  completion_date?: string;
  hubspot_owner_id?: string;
  // Common fields
  automation_id: string;
  hs_object_id: string;
  hs_queue_id?: string;
  schedule_enabled: boolean;
  schedule_configuration: ScheduleConfiguration | null;
  timezone: string | null;
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Parse time string (HH:MM) and return hours and minutes
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Check if a given date is in the non-working dates list
 */
function isNonWorkingDate(date: Date, nonWorkingDates: string[]): boolean {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return nonWorkingDates.includes(dateStr);
}

/**
 * Check if current time is within working hours for a given day
 */
function isWithinWorkingHours(
  date: Date,
  dayConfig: WorkingHours
): boolean {
  if (!dayConfig.enabled) return false;
  if (!dayConfig.start_time || !dayConfig.end_time) return false;

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const start = parseTime(dayConfig.start_time);
  const end = parseTime(dayConfig.end_time);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Find the next available working datetime based on schedule configuration
 */
function findNextWorkingDateTime(
  currentDate: Date,
  scheduleConfig: ScheduleConfiguration,
  timezone: string
): Date {
  const maxDaysToCheck = 14; // Look ahead up to 2 weeks
  let checkDate = new Date(currentDate);

  for (let i = 0; i < maxDaysToCheck; i++) {
    const dayName = DAY_NAMES[checkDate.getDay()];
    const dayConfig = scheduleConfig.working_hours[dayName];

    // Check if this is a working day and not in non-working dates
    if (
      dayConfig.enabled &&
      dayConfig.start_time &&
      !isNonWorkingDate(checkDate, scheduleConfig.non_working_dates)
    ) {
      // If it's today and we're still within working hours, return now
      if (i === 0 && isWithinWorkingHours(checkDate, dayConfig)) {
        return checkDate;
      }

      // Otherwise, set to start of working hours for this day
      const start = parseTime(dayConfig.start_time);
      const resultDate = new Date(checkDate);
      resultDate.setHours(start.hours, start.minutes, 0, 0);

      // If it's today but after working hours, move to next day
      if (i === 0 && resultDate <= currentDate) {
        checkDate.setDate(checkDate.getDate() + 1);
        continue;
      }

      return resultDate;
    }

    // Move to next day
    checkDate.setDate(checkDate.getDate() + 1);
  }

  // Fallback: if no working time found in 2 weeks, return current time
  console.warn('No working time found in next 2 weeks, using current time');
  return currentDate;
}

/**
 * Calculate delay in milliseconds from delay configuration
 */
function calculateDelayMs(delayConfig: any): number {
  if (!delayConfig || typeof delayConfig.amount !== 'number' || !delayConfig.unit) {
    console.warn('Invalid delay configuration, applying no delay');
    return 0;
  }

  const amount = delayConfig.amount;
  
  switch (delayConfig.unit) {
    case 'minutes':
      return amount * 60 * 1000;
    case 'hours':
      return amount * 60 * 60 * 1000;
    case 'days':
      return amount * 24 * 60 * 60 * 1000;
    default:
      console.warn(`Unknown delay unit: ${delayConfig.unit}, applying no delay`);
      return 0;
  }
}

/**
 * Calculate planned execution timestamp for sequence tasks based on completion date and delay
 */
function calculateSequenceExecutionTimestamp(
  completionDate: string | null | undefined,
  delayConfig: any,
  scheduleEnabled: boolean,
  scheduleConfig: ScheduleConfiguration | null,
  timezone: string | null
): Date | null {
  // Risk 1: Missing completion date - use current timestamp
  const baseDate = completionDate ? new Date(completionDate) : new Date();
  console.log(`Base completion date: ${baseDate.toISOString()}`);
  
  // Risk 2: Invalid delay configuration - apply no delay
  const delayMs = calculateDelayMs(delayConfig);
  console.log(`Delay: ${delayMs}ms (${delayConfig?.amount} ${delayConfig?.unit})`);
  
  // Calculate base execution time (completion + delay)
  const calculatedTime = new Date(baseDate.getTime() + delayMs);
  console.log(`Calculated time (completion + delay): ${calculatedTime.toISOString()}`);
  
  // Risk 5: Past completion dates - stop/do nothing
  const now = new Date();
  if (calculatedTime < now) {
    console.warn('Calculated execution time is in the past, stopping automation');
    return null;
  }
  
  // If schedule not enabled, use the calculated time directly
  if (!scheduleEnabled || !scheduleConfig || !timezone) {
    console.log('Schedule not enabled, using calculated time directly');
    return calculatedTime;
  }
  
  // Risk 3: Timezone consistency - rely on task_automations.timezone
  try {
    // Convert calculated time to the specified timezone
    const zonedCalculatedTime = toZonedTime(calculatedTime, timezone);
    console.log(`Calculated time in ${timezone}: ${format(zonedCalculatedTime, 'yyyy-MM-dd HH:mm:ss', { timeZone: timezone })}`);
    
    const dayName = DAY_NAMES[zonedCalculatedTime.getDay()];
    const dayConfig = scheduleConfig.working_hours[dayName];
    
    // Check if calculated time is within working hours
    if (
      dayConfig.enabled &&
      !isNonWorkingDate(zonedCalculatedTime, scheduleConfig.non_working_dates) &&
      isWithinWorkingHours(zonedCalculatedTime, dayConfig)
    ) {
      console.log('Calculated time is within working hours, using it directly');
      return calculatedTime;
    }
    
    // Find next available working time after the calculated time
    console.log('Calculated time is outside working hours, finding next available slot');
    const nextWorkingTime = findNextWorkingDateTime(
      zonedCalculatedTime,
      scheduleConfig,
      timezone
    );
    
    // Convert back to UTC
    const nextWorkingTimeUTC = fromZonedTime(nextWorkingTime, timezone);
    console.log(`Next working time in ${timezone}: ${format(nextWorkingTime, 'yyyy-MM-dd HH:mm:ss', { timeZone: timezone })}`);
    console.log(`Next working time in UTC: ${nextWorkingTimeUTC.toISOString()}`);
    
    return nextWorkingTimeUTC;
  } catch (error) {
    console.error('Error calculating sequence execution timestamp:', error);
    // Fallback to calculated time
    return calculatedTime;
  }
}

/**
 * Calculate planned execution timestamp based on schedule configuration (for list_entry triggers)
 * Returns a Date object representing the time in the specified timezone
 */
function calculatePlannedExecutionTimestamp(
  scheduleEnabled: boolean,
  scheduleConfig: ScheduleConfiguration | null,
  timezone: string | null
): Date {
  // If schedule not enabled or no config, execute immediately
  if (!scheduleEnabled || !scheduleConfig || !timezone) {
    console.log('Schedule not enabled or missing config, executing immediately');
    return new Date();
  }

  try {
    // Get current UTC time
    const nowUTC = new Date();
    
    // Convert to the specified timezone
    const currentTime = toZonedTime(nowUTC, timezone);
    
    console.log(`Current UTC time: ${nowUTC.toISOString()}`);
    console.log(`Current time in ${timezone}: ${format(currentTime, 'yyyy-MM-dd HH:mm:ss', { timeZone: timezone })}`);

    const dayName = DAY_NAMES[currentTime.getDay()];
    const todayConfig = scheduleConfig.working_hours[dayName];

    // Check if current time is within working hours
    if (
      todayConfig.enabled &&
      !isNonWorkingDate(currentTime, scheduleConfig.non_working_dates) &&
      isWithinWorkingHours(currentTime, todayConfig)
    ) {
      console.log('Current time is within working hours, executing immediately');
      return nowUTC; // Execute immediately (return current UTC time)
    }

    // Find next available working time (in the local timezone)
    console.log('Current time is outside working hours, finding next available slot');
    const nextWorkingTime = findNextWorkingDateTime(
      currentTime,
      scheduleConfig,
      timezone
    );

    // Convert the zoned time back to UTC for storage
    const nextWorkingTimeUTC = fromZonedTime(nextWorkingTime, timezone);
    console.log(`Next working time in ${timezone}: ${format(nextWorkingTime, 'yyyy-MM-dd HH:mm:ss', { timeZone: timezone })}`);
    console.log(`Next working time in UTC: ${nextWorkingTimeUTC.toISOString()}`);

    return nextWorkingTimeUTC;
  } catch (error) {
    console.error('Error calculating planned execution timestamp:', error);
    // Fallback to immediate execution on error
    return new Date();
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: AutomationTriggerRequest = await req.json();
    
    console.log('=== PROCESS AUTOMATION TRIGGER START ===');
    console.log('Trigger type:', requestData.trigger_type);
    console.log('Request data:', JSON.stringify(requestData, null, 2));

    const {
      trigger_type,
      automation_id,
      hs_list_id,
      task_id,
      current_position,
      hs_object_id,
      hs_queue_id,
      completion_date,
      hubspot_owner_id,
      schedule_enabled,
      schedule_configuration,
      timezone
    } = requestData;

    // Fetch automation and category details
    const { data: automationData, error: automationError } = await supabase
      .from('task_automations')
      .select(`
        tasks_configuration,
        task_categories!fk_task_automations_category (
          hs_queue_id
        )
      `)
      .eq('id', automation_id)
      .single();

    if (automationError || !automationData) {
      console.error('Error fetching automation details:', automationError);
      throw new Error(`Failed to fetch automation details: ${automationError?.message}`);
    }

    const tasksConfig = automationData.tasks_configuration as any;
    
    // Determine task name, owner setting, and position based on trigger type
    let taskName: string;
    let taskOwnerSetting: 'no_owner' | 'contact_owner' | 'previous_task_owner' | null = null;
    let positionInSequence: number | null = null;
    
    if (trigger_type === 'list_entry') {
      // For list entry, use the initial task
      taskName = tasksConfig?.initial_task?.name || 'Untitled Task';
      taskOwnerSetting = tasksConfig?.initial_task?.owner || null;
      positionInSequence = 1;
    } else if (trigger_type === 'task_completion') {
      // For task completion, use the next task in sequence
      positionInSequence = (current_position || 0) + 1;
      
      // Initial task is position 1, sequence_tasks[0] is position 2
      const sequenceTaskIndex = positionInSequence - 2;
      
      if (sequenceTaskIndex < 0) {
        // This shouldn't happen, but fallback to initial task
        taskName = tasksConfig?.initial_task?.name || 'Untitled Task';
        taskOwnerSetting = tasksConfig?.initial_task?.owner || null;
      } else if (tasksConfig?.sequence_tasks?.[sequenceTaskIndex]) {
        taskName = tasksConfig.sequence_tasks[sequenceTaskIndex].name || `Task ${positionInSequence}`;
        taskOwnerSetting = tasksConfig.sequence_tasks[sequenceTaskIndex].owner || null;
      } else {
        console.error(`No task found at sequence position ${positionInSequence}`);
        throw new Error(`Invalid sequence position: ${positionInSequence}`);
      }
    } else {
      throw new Error(`Unknown trigger type: ${trigger_type}`);
    }
    
    // Validate task owner setting
    if (taskOwnerSetting && !['no_owner', 'contact_owner', 'previous_task_owner'].includes(taskOwnerSetting)) {
      console.warn(`Invalid task owner setting: ${taskOwnerSetting}, defaulting to null`);
      taskOwnerSetting = null;
    }
    
    const hsQueueId = hs_queue_id || (automationData.task_categories as any)?.hs_queue_id || null;

    console.log('Task name:', taskName);
    console.log('Task owner setting:', taskOwnerSetting);
    console.log('Position in sequence:', positionInSequence);
    console.log('Queue ID:', hsQueueId);

    // Calculate planned execution timestamp based on trigger type
    let plannedExecutionTimestamp: Date | null;
    
    if (trigger_type === 'list_entry') {
      // For list entry, execute based on current time and schedule
      plannedExecutionTimestamp = calculatePlannedExecutionTimestamp(
        schedule_enabled,
        schedule_configuration,
        timezone
      );
    } else {
      // For task completion, execute based on completion date + delay
      const sequenceTaskIndex = (positionInSequence || 2) - 2;
      const delayConfig = tasksConfig?.sequence_tasks?.[sequenceTaskIndex]?.delay;
      
      console.log('Delay configuration:', JSON.stringify(delayConfig));
      console.log('Completion date:', completion_date);
      
      plannedExecutionTimestamp = calculateSequenceExecutionTimestamp(
        completion_date,
        delayConfig,
        schedule_enabled,
        schedule_configuration,
        timezone
      );
      
      // If calculated time is in the past, stop processing
      if (!plannedExecutionTimestamp) {
        console.warn('Cannot create automation run: calculated execution time is in the past');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Calculated execution time is in the past',
            message: 'Cannot schedule task in the past'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        );
      }
    }

    // Format timestamp with timezone offset for storage
    // Default to Europe/Paris (+02) if no timezone specified
    const storageTimezone = timezone || 'Europe/Paris';
    const zonedTime = toZonedTime(plannedExecutionTimestamp, storageTimezone);
    
    // Format for display: "YYYY-MM-DD HH:mm [timezone]"
    const displayTimestamp = `${format(zonedTime, "yyyy-MM-dd HH:mm", { timeZone: storageTimezone })} ${storageTimezone}`;

    console.log(`Planned execution timestamp (UTC): ${plannedExecutionTimestamp.toISOString()}`);
    console.log(`Planned execution timestamp (display): ${displayTimestamp}`);

    // Create automation run entry
    const runData: any = {
      automation_id,
      type: trigger_type === 'list_entry' ? 'create_on_entry' : 'create_from_sequence',
      hs_trigger_object: trigger_type === 'list_entry' ? 'list' : 'task',
      hs_trigger_object_id: trigger_type === 'list_entry' ? hs_list_id : task_id,
      planned_execution_timestamp: plannedExecutionTimestamp.toISOString(),
      planned_execution_timestamp_display: displayTimestamp,
      task_name: taskName,
      task_owner_setting: taskOwnerSetting,
      hs_queue_id: hsQueueId,
      created_task: false,
      position_in_sequence: positionInSequence,
      hs_owner_id_previous_task: trigger_type === 'task_completion' ? hubspot_owner_id : null
    };
    
    const { data: automationRun, error: insertError } = await supabase
      .from('task_automation_runs')
      .insert(runData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating automation run:', insertError);
      throw insertError;
    }

    console.log('✅ Created automation run:', automationRun.id);
    console.log('=== PROCESS AUTOMATION TRIGGER END ===');

    return new Response(
      JSON.stringify({
        success: true,
        automation_run_id: automationRun.id,
        planned_execution_timestamp: displayTimestamp
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in process-automation-trigger:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
