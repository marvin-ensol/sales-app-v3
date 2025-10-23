/**
 * Process Automation Trigger - Sequence Tasks Only
 * 
 * This function now ONLY handles task_completion triggers for sequence tasks.
 * List entry automation is handled by sync-hubspot-list-memberships edge function.
 */

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
  trigger_type: 'task_completion';
  task_id: string;
  current_position: number;
  associated_contact_id: string;
  completion_date: string;
  hubspot_owner_id?: string;
  automation_id: string;
  hs_queue_id: string;
  schedule_enabled: boolean;
  schedule_configuration: ScheduleConfiguration | null;
  timezone: string | null;
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

function isNonWorkingDate(date: Date, nonWorkingDates: string[]): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  return nonWorkingDates.includes(dateStr);
}

function isWithinWorkingHours(
  date: Date,
  workingHours: WorkingHours,
  timezone: string
): boolean {
  if (!workingHours.enabled || !workingHours.start_time || !workingHours.end_time) {
    return false;
  }

  const zonedDate = toZonedTime(date, timezone);
  const currentMinutes = zonedDate.getHours() * 60 + zonedDate.getMinutes();
  
  const start = parseTime(workingHours.start_time);
  const end = parseTime(workingHours.end_time);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

function findNextWorkingDateTime(
  fromDate: Date,
  scheduleConfig: ScheduleConfiguration,
  timezone: string
): Date {
  let candidate = new Date(fromDate);
  const maxIterations = 365;
  let iterations = 0;

  while (iterations < maxIterations) {
    const zonedCandidate = toZonedTime(candidate, timezone);
    const dayName = DAY_NAMES[zonedCandidate.getDay()];
    const dayConfig = scheduleConfig.working_hours[dayName];

    if (isNonWorkingDate(candidate, scheduleConfig.non_working_dates)) {
      candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
      iterations++;
      continue;
    }

    if (!dayConfig.enabled) {
      candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
      iterations++;
      continue;
    }

    if (isWithinWorkingHours(candidate, dayConfig, timezone)) {
      return candidate;
    }

    const start = parseTime(dayConfig.start_time!);
    const zonedStart = new Date(zonedCandidate);
    zonedStart.setHours(start.hours, start.minutes, 0, 0);
    const utcStart = fromZonedTime(zonedStart, timezone);

    if (candidate < utcStart) {
      candidate = utcStart;
    } else {
      candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
      const nextZoned = toZonedTime(candidate, timezone);
      nextZoned.setHours(0, 0, 0, 0);
      candidate = fromZonedTime(nextZoned, timezone);
    }

    iterations++;
  }

  return fromDate;
}

function calculateDelayMs(delayValue: number, delayUnit: string): number {
  switch (delayUnit) {
    case 'minutes': return delayValue * 60 * 1000;
    case 'hours': return delayValue * 60 * 60 * 1000;
    case 'days': return delayValue * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

function calculateSequenceExecutionTimestamp(
  completionDate: string,
  delayValue: number,
  delayUnit: string,
  scheduleEnabled: boolean,
  scheduleConfig: ScheduleConfiguration | null,
  timezone: string | null
): { timestamp: string; display: string } {
  const completionTime = new Date(completionDate);
  const delayMs = calculateDelayMs(delayValue, delayUnit);
  let executionTime = new Date(completionTime.getTime() + delayMs);

  if (scheduleEnabled && scheduleConfig && timezone) {
    executionTime = findNextWorkingDateTime(executionTime, scheduleConfig, timezone);
  }

  const tz = timezone || 'Europe/Paris';
  const zonedTime = toZonedTime(executionTime, tz);
  const displayTimestamp = `${format(zonedTime, "yyyy-MM-dd HH:mm")} ${tz}`;

  return {
    timestamp: executionTime.toISOString(),
    display: displayTimestamp
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const payload: AutomationTriggerRequest = await req.json();
    
    if (payload.trigger_type !== 'task_completion') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unsupported trigger type: ${payload.trigger_type}. This function only handles task_completion.`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('📥 Task completion trigger:', payload.automation_id);

    // Fetch automation details
    const { data: automation, error: autoError } = await supabase
      .from('task_automations')
      .select('id, total_tasks, tasks_configuration')
      .eq('id', payload.automation_id)
      .single();

    if (autoError || !automation) {
      throw new Error(`Failed to fetch automation: ${autoError?.message}`);
    }

    const currentPosition = payload.current_position || 1;
    const nextPosition = currentPosition + 1;

    if (nextPosition > automation.total_tasks) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Sequence complete'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nextTask = automation.tasks_configuration?.[nextPosition - 1];
    if (!nextTask) {
      throw new Error(`No task configuration found for position ${nextPosition}`);
    }

    // Determine task owner
    let hsOwnerIdContact: string | null = null;
    let hsOwnerIdPreviousTask: string | null = null;

    if (nextTask.task_owner_setting === 'contact_owner') {
      const { data: contactData } = await supabase
        .from('hs_contacts')
        .select('hubspot_owner_id')
        .eq('hs_object_id', payload.associated_contact_id)
        .maybeSingle();
      
      hsOwnerIdContact = contactData?.hubspot_owner_id || null;
    } else if (nextTask.task_owner_setting === 'previous_task_owner') {
      hsOwnerIdPreviousTask = payload.hubspot_owner_id || null;
    }

    // Calculate execution timestamp
    const result = calculateSequenceExecutionTimestamp(
      payload.completion_date,
      nextTask.delay_value,
      nextTask.delay_unit,
      payload.schedule_enabled,
      payload.schedule_configuration,
      payload.timezone
    );

    // Check for conflicts
    const { data: conflictingTasks } = await supabase
      .from('hs_tasks')
      .select('hs_object_id')
      .eq('hs_queue_membership_ids', payload.hs_queue_id)
      .eq('associated_contact_id', payload.associated_contact_id)
      .gte('number_in_sequence', nextPosition)
      .eq('hs_task_completion_count', 0);

    if (conflictingTasks && conflictingTasks.length > 0) {
      console.log(`⚠️ Conflict detected - blocking run creation`);
      
      await supabase
        .from('task_automation_runs')
        .insert({
          automation_id: automation.id,
          type: 'create_from_sequence',
          hs_trigger_object: 'task',
          hs_trigger_object_id: payload.task_id,
          hs_contact_id: payload.associated_contact_id,
          hs_queue_id: payload.hs_queue_id,
          planned_execution_timestamp: null,
          task_name: nextTask.task_name,
          task_owner_setting: nextTask.task_owner_setting,
          position_in_sequence: nextPosition,
          hs_owner_id_contact: hsOwnerIdContact,
          hs_owner_id_previous_task: hsOwnerIdPreviousTask,
          hs_action_successful: false,
          failure_description: `Conflicting task exists at position ${nextPosition}`
        });

      return new Response(
        JSON.stringify({ success: true, blocked: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create automation run
    const { data: automationRun, error: insertError } = await supabase
      .from('task_automation_runs')
      .insert({
        automation_id: automation.id,
        type: 'create_from_sequence',
        hs_trigger_object: 'task',
        hs_trigger_object_id: payload.task_id,
        hs_contact_id: payload.associated_contact_id,
        hs_queue_id: payload.hs_queue_id,
        planned_execution_timestamp: result.timestamp,
        planned_execution_timestamp_display: result.display,
        task_name: nextTask.task_name,
        task_owner_setting: nextTask.task_owner_setting,
        position_in_sequence: nextPosition,
        hs_owner_id_contact: hsOwnerIdContact,
        hs_owner_id_previous_task: hsOwnerIdPreviousTask,
        hs_action_successful: false,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log(`✅ Created automation run: ${automationRun.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        automation_run_id: automationRun.id,
        planned_execution: result.display
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
