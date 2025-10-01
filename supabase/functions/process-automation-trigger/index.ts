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
  membership_id: string;
  automation_id: string;
  hs_list_id: string;
  hs_object_id: string;
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
 * Calculate planned execution timestamp based on schedule configuration
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
    console.log('Request data:', JSON.stringify(requestData, null, 2));

    const {
      automation_id,
      hs_list_id,
      hs_object_id,
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
    const taskName = tasksConfig?.initial_task?.name || 'Untitled Task';
    const hsQueueId = (automationData.task_categories as any)?.hs_queue_id || null;

    console.log('Task name:', taskName);
    console.log('Queue ID:', hsQueueId);

    // Calculate planned execution timestamp
    const plannedExecutionTimestamp = calculatePlannedExecutionTimestamp(
      schedule_enabled,
      schedule_configuration,
      timezone
    );

    // Format timestamp with timezone offset for storage
    // Default to Europe/Paris (+02) if no timezone specified
    const storageTimezone = timezone || 'Europe/Paris';
    const zonedTime = toZonedTime(plannedExecutionTimestamp, storageTimezone);
    
    // Format for display: "YYYY-MM-DD HH:mm [timezone]"
    const displayTimestamp = `${format(zonedTime, "yyyy-MM-dd HH:mm", { timeZone: storageTimezone })} ${storageTimezone}`;

    console.log(`Planned execution timestamp (UTC): ${plannedExecutionTimestamp.toISOString()}`);
    console.log(`Planned execution timestamp (display): ${displayTimestamp}`);

    // Create automation run entry
    const { data: automationRun, error: insertError } = await supabase
      .from('task_automation_runs')
      .insert({
        automation_id,
        type: 'create_on_entry',
        hs_trigger_object: 'list',
        hs_trigger_object_id: hs_list_id,
        planned_execution_timestamp: plannedExecutionTimestamp.toISOString(),
        planned_execution_timestamp_display: displayTimestamp,
        task_name: taskName,
        hs_queue_id: hsQueueId,
        created_task: false
      })
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
