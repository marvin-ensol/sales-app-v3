import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrphanTask {
  hs_object_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🗑️ Starting orphan task deletion process...');

    // Query orphan tasks from database
    const { data: orphanTasks, error: queryError } = await supabase
      .from('hs_tasks')
      .select('hs_object_id')
      .is('associated_contact_id', null)
      .is('associated_deal_id', null)
      .is('associated_company_id', null)
      .eq('archived', false)
      .neq('hs_task_status', 'DELETED');

    if (queryError) {
      console.error('❌ Error querying orphan tasks:', queryError);
      throw new Error(`Database query failed: ${queryError.message}`);
    }

    const totalOrphans = orphanTasks?.length || 0;
    console.log(`📊 Found ${totalOrphans} orphan tasks to delete`);

    if (totalOrphans === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No orphan tasks found',
        deleted: 0,
        total: 0,
        errors: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalDeleted = 0;
    let totalErrors = 0;
    const errors: string[] = [];
    const batchSize = 100;

    // Process in batches of 100
    for (let i = 0; i < orphanTasks.length; i += batchSize) {
      const batch = orphanTasks.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(orphanTasks.length / batchSize);
      
      console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} tasks)`);

      try {
        // Prepare batch data for HubSpot API
        const batchInputs = batch.map(task => ({ id: task.hs_object_id }));

        // Call HubSpot batch archive API
        const hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/tasks/batch/archive', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: batchInputs })
        });

        if (!hubspotResponse.ok) {
          const errorText = await hubspotResponse.text();
          console.error(`❌ HubSpot API error for batch ${batchNumber}: ${hubspotResponse.status} ${hubspotResponse.statusText}`, errorText);
          errors.push(`Batch ${batchNumber}: ${hubspotResponse.status} ${errorText}`);
          totalErrors += batch.length;
          continue;
        }

        // Handle successful responses - HubSpot may return 204 No Content with empty body
        const contentType = hubspotResponse.headers.get('content-type');
        let hubspotResult = null;
        
        if (hubspotResponse.status === 204 || !contentType?.includes('application/json')) {
          // 204 No Content or non-JSON response - this is expected for successful deletions
          console.log(`✅ Batch ${batchNumber} deleted successfully (${hubspotResponse.status} ${hubspotResponse.statusText})`);
        } else {
          // Try to parse JSON only if we expect JSON content
          const responseText = await hubspotResponse.text();
          if (responseText.trim()) {
            try {
              hubspotResult = JSON.parse(responseText);
              console.log(`✅ Batch ${batchNumber} deleted successfully with response`);
            } catch (parseError) {
              console.error(`⚠️ Could not parse response for batch ${batchNumber}, but request was successful (${hubspotResponse.status})`);
            }
          } else {
            console.log(`✅ Batch ${batchNumber} deleted successfully (empty response)`);
          }
        }
        
        totalDeleted += batch.length;

        // Small delay between batches to be respectful to HubSpot API
        if (i + batchSize < orphanTasks.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error: any) {
        console.error(`❌ Error processing batch ${batchNumber}:`, error);
        errors.push(`Batch ${batchNumber}: ${error.message}`);
        totalErrors += batch.length;
      }
    }

    console.log(`🎉 Orphan task deletion complete. Deleted: ${totalDeleted}, Errors: ${totalErrors}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted ${totalDeleted} orphan tasks${totalErrors > 0 ? ` with ${totalErrors} errors` : ''}`,
      deleted: totalDeleted,
      total: totalOrphans,
      errors: errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Fatal error in delete-orphan-tasks:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      deleted: 0,
      total: 0,
      errors: [error.message]
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});