import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessingResult {
  rule1_updated: number;
  rule2_updated: number;
  total_processed: number;
  errors: any[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('=== POPULATE TASK SEQUENCE NUMBERS START ===');
    
    const result: ProcessingResult = {
      rule1_updated: 0,
      rule2_updated: 0,
      total_processed: 0,
      errors: []
    };

    // Rule 1: Extract numbers from "Tentative X" subjects
    console.log('📋 Processing Rule 1: Tentative [x] pattern...');
    
    // Get tasks that match the Tentative pattern
    const { data: tentativeTasks, error: tentativeError } = await supabaseClient
      .from('hs_tasks')
      .select('hs_object_id, hs_task_subject')
      .like('hs_task_subject', 'Tentative %');

    if (tentativeError) {
      console.error('❌ Rule 1 fetch error:', tentativeError);
      result.errors.push({ rule: 1, error: tentativeError.message });
    } else {
      // Process each tentative task
      for (const task of tentativeTasks) {
        const match = task.hs_task_subject?.match(/Tentative (\d+)/);
        if (match) {
          const sequenceNumber = parseInt(match[1]);
          const { error: updateError } = await supabaseClient
            .from('hs_tasks')
            .update({ number_in_sequence: sequenceNumber })
            .eq('hs_object_id', task.hs_object_id);

          if (updateError) {
            console.error(`❌ Rule 1 update error for task ${task.hs_object_id}:`, updateError);
            result.errors.push({ rule: 1, task_id: task.hs_object_id, error: updateError.message });
          } else {
            result.rule1_updated++;
          }
        }
      }
      console.log(`✅ Rule 1 completed: ${result.rule1_updated} tasks updated`);
    }

    // Rule 2: Sequence numbering for non-22859490 queues
    console.log('📋 Processing Rule 2: Queue sequence numbering...');
    
    // Get all tasks that need sequence numbering (not queue 22859490)
    const { data: queueTasks, error: queueError } = await supabaseClient
      .from('hs_tasks')
      .select('hs_object_id, hs_queue_membership_ids, associated_contact_id, hs_createdate')
      .neq('hs_queue_membership_ids', '22859490')
      .not('hs_queue_membership_ids', 'is', null)
      .not('associated_contact_id', 'is', null)
      .not('hs_createdate', 'is', null)
      .order('hs_createdate', { ascending: true });

    if (queueError) {
      console.error('❌ Rule 2 fetch error:', queueError);
      result.errors.push({ rule: 2, error: queueError.message });
    } else {
      // Group tasks by queue and contact, then assign sequence numbers
      const taskGroups: { [key: string]: any[] } = {};
      
      for (const task of queueTasks) {
        const groupKey = `${task.hs_queue_membership_ids}-${task.associated_contact_id}`;
        if (!taskGroups[groupKey]) {
          taskGroups[groupKey] = [];
        }
        taskGroups[groupKey].push(task);
      }

      // Update sequence numbers for each group
      for (const [groupKey, tasks] of Object.entries(taskGroups)) {
        for (let i = 0; i < tasks.length; i++) {
          const sequenceNumber = i + 1;
          const task = tasks[i];
          
          const { error: updateError } = await supabaseClient
            .from('hs_tasks')
            .update({ number_in_sequence: sequenceNumber })
            .eq('hs_object_id', task.hs_object_id);

          if (updateError) {
            console.error(`❌ Rule 2 update error for task ${task.hs_object_id}:`, updateError);
            result.errors.push({ rule: 2, task_id: task.hs_object_id, error: updateError.message });
          } else {
            result.rule2_updated++;
          }
        }
      }
      console.log(`✅ Rule 2 completed: ${result.rule2_updated} tasks updated`);
    }

    result.total_processed = result.rule1_updated + result.rule2_updated;

    console.log('🎉 Task sequence population completed:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Task sequence numbers populated successfully',
        stats: result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to populate task sequence numbers'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});