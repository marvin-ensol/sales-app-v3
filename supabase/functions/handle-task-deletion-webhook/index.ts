import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotDeletionEvent {
  appId: number;
  attemptNumber: number;
  changeFlag: "DELETED";
  changeSource: string;
  eventId: number;
  objectId: number;
  objectTypeId: string;
  occurredAt: number;
  portalId: number;
  sourceId: string;
  subscriptionId: number;
  subscriptionType: string;
}

interface WebhookPayload {
  context: any;
  event: {
    body: HubSpotDeletionEvent[];
    client_ip: string;
    headers: Record<string, string>;
    method: string;
    path: string;
    query: Record<string, any>;
    url: string;
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== HUBSPOT TASK DELETION WEBHOOK ===');
  
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse webhook payload
    const webhookPayload: WebhookPayload = await req.json();
    
    console.log('📥 Received webhook payload:', JSON.stringify(webhookPayload, null, 2));

    // Extract deletion events from payload
    const deletionEvents = webhookPayload.event.body.filter(
      event => event.changeFlag === 'DELETED' && event.objectTypeId === '0-27' // 0-27 is HubSpot's task object type
    );

    if (deletionEvents.length === 0) {
      console.log('ℹ️ No task deletion events found in webhook payload');
      return new Response(
        JSON.stringify({ message: 'No task deletion events to process' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🗑️ Processing ${deletionEvents.length} task deletion event(s)`);

    const results = [];

    for (const event of deletionEvents) {
      const taskId = event.objectId.toString();
      console.log(`🗑️ Processing deletion for task ID: ${taskId}`);

      try {
        // Create task sync attempt record for the deletion
        const now = new Date().toISOString();
        const { error: syncAttemptError } = await supabase
          .from('task_sync_attempts')
          .insert({
            execution_id: null, // Not tied to a sync execution
            task_hubspot_id: taskId,
            action_type: 'deleted',
            status: 'completed',
            started_at: now,
            completed_at: now,
            duration_ms: 0,
            hubspot_response: event,
            attempt_number: 1
          });

        if (syncAttemptError) {
          console.error(`❌ Failed to create sync attempt record for task ${taskId}:`, syncAttemptError);
          results.push({
            taskId,
            status: 'error',
            error: `Failed to log deletion: ${syncAttemptError.message}`
          });
          continue;
        }

        console.log(`✅ Created sync attempt record for deleted task ${taskId}`);

        // Update the task status in hs_tasks table
        const { error: updateError } = await supabase
          .from('hs_tasks')
          .update({
            hs_task_status: 'DELETED',
            updated_at: now
          })
          .eq('hs_object_id', taskId);

        if (updateError) {
          console.error(`❌ Failed to update task status for ${taskId}:`, updateError);
          results.push({
            taskId,
            status: 'partial',
            error: `Failed to update task status: ${updateError.message}`,
            syncAttemptLogged: true
          });
        } else {
          console.log(`✅ Updated task ${taskId} status to DELETED`);
          results.push({
            taskId,
            status: 'success',
            syncAttemptLogged: true,
            taskStatusUpdated: true
          });
        }

      } catch (taskError) {
        console.error(`❌ Error processing deletion for task ${taskId}:`, taskError);
        results.push({
          taskId,
          status: 'error',
          error: taskError.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const partialCount = results.filter(r => r.status === 'partial').length;

    console.log(`📊 Deletion processing complete: ${successCount} success, ${partialCount} partial, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        message: 'Task deletion webhook processed',
        processed: deletionEvents.length,
        results: {
          success: successCount,
          partial: partialCount,
          errors: errorCount
        },
        details: results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Webhook processing failed',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});