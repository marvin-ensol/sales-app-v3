import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotTask {
  id: string;
  properties: {
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface HubSpotResponse {
  results: HubSpotTask[];
  paging?: {
    next?: {
      after: string;
    };
  };
  total: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== HUBSPOT TASKS SYNC START ===');
    
    // Get environment variables
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!hubspotToken) {
      throw new Error('HubSpot access token not found');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration not found');
    }

    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🗑️ Clearing existing hs_tasks data...');
    
    // Clear existing data
    const { error: deleteError } = await supabase
      .from('hs_tasks')
      .delete()
      .neq('hs_object_id', ''); // This deletes all rows

    if (deleteError) {
      console.error('Error clearing existing data:', deleteError);
      throw new Error(`Failed to clear existing data: ${deleteError.message}`);
    }

    console.log('✅ Existing data cleared successfully');

    // Prepare the request body as specified by the user
    const requestBody = {
      limit: 100,
      sorts: ["hs_lastmodifieddate"],
      filterGroups: [
        {
          filters: [
            {
              propertyName: "hs_task_status",
              operator: "NEQ",
              value: "COMPLETED"
            }
          ]
        }
      ],
      properties: [
        "hs_body_preview",
        "hs_body_preview_html",
        "hs_created_by_user_id",
        "hs_createdate",
        "hs_timestamp",
        "hs_date_entered_60b5c368_04c4_4d32_9b4a_457e159f49b7_13292096",
        "hs_date_entered_61bafb31_e7fa_46ed_aaa9_1322438d6e67_1866552342",
        "hs_date_entered_af0e6a5c_2ea3_4c72_b69f_7c6cb3fdb591_1652950531",
        "hs_date_entered_dd5826e4_c976_4654_a527_b59ada542e52_2144133616",
        "hs_date_entered_fc8148fb_3a2d_4b59_834e_69b7859347cb_1813133675",
        "hs_duration",
        "hs_object_id",
        "hs_pipeline",
        "hs_pipeline_stage",
        "hs_queue_membership_ids",
        "hs_task_body",
        "hs_task_completion_count",
        "hs_task_completion_date",
        "hs_task_family",
        "hs_task_for_object_type",
        "hs_task_is_all_day",
        "hs_task_is_overdue",
        "hs_task_last_contact_outreach",
        "hs_task_priority",
        "hs_task_status",
        "hs_task_subject",
        "hs_task_type",
        "hs_timestamp",
        "hs_updated_by_user_id",
        "hubspot_owner_assigneddate",
        "hubspot_owner_id",
        "hubspot_team_id"
      ]
    };

    console.log('📥 Starting HubSpot API fetch...');
    
    let allTasks: HubSpotTask[] = [];
    let hasMore = true;
    let after: string | undefined;
    let pageCount = 0;
    const maxPages = 1000; // Safety limit

    while (hasMore && pageCount < maxPages) {
      pageCount++;
      console.log(`📄 Fetching page ${pageCount}${after ? ` (after: ${after})` : ''}...`);

      // Add pagination parameter if we have it
      const bodyWithPaging = after 
        ? { ...requestBody, after }
        : requestBody;

      const response = await fetch('https://api.hubapi.com/crm/v3/objects/tasks/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyWithPaging),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HubSpot API error (${response.status}):`, errorText);
        throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
      }

      const data: HubSpotResponse = await response.json();
      
      console.log(`📦 Received ${data.results.length} tasks on page ${pageCount}`);
      
      allTasks = allTasks.concat(data.results);
      
      // Check if there are more pages
      hasMore = !!data.paging?.next?.after;
      after = data.paging?.next?.after;

      // Respect API rate limits - wait between requests
      if (hasMore) {
        console.log('⏳ Waiting 300ms to respect rate limits...');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`🎯 Total tasks fetched: ${allTasks.length} from ${pageCount} pages`);

    if (allTasks.length === 0) {
      console.log('⚠️ No tasks found to sync');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No tasks found to sync',
          totalRecords: 0
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    console.log('💾 Inserting tasks into database...');

    // Transform and insert tasks in batches
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < allTasks.length; i += batchSize) {
      const batch = allTasks.slice(i, i + batchSize);
      
      console.log(`📝 Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allTasks.length / batchSize)} (${batch.length} records)...`);
      
      const transformedTasks = batch.map(task => ({
        hs_object_id: task.id,
        hs_body_preview: task.properties.hs_body_preview || null,
        hs_body_preview_html: task.properties.hs_body_preview_html || null,
        hs_created_by_user_id: task.properties.hs_created_by_user_id || null,
        hs_createdate: task.properties.hs_createdate ? new Date(task.properties.hs_createdate).toISOString() : null,
        hs_lastmodifieddate: task.properties.hs_lastmodifieddate ? new Date(task.properties.hs_lastmodifieddate).toISOString() : null,
        hs_timestamp: task.properties.hs_timestamp ? new Date(task.properties.hs_timestamp).toISOString() : null,
        hs_duration: task.properties.hs_duration || null,
        hs_pipeline: task.properties.hs_pipeline || null,
        hs_pipeline_stage: task.properties.hs_pipeline_stage || null,
        hs_queue_membership_ids: task.properties.hs_queue_membership_ids || null,
        hs_task_body: task.properties.hs_task_body || null,
        hs_task_completion_count: task.properties.hs_task_completion_count ? parseInt(task.properties.hs_task_completion_count) : null,
        hs_task_completion_date: task.properties.hs_task_completion_date ? new Date(task.properties.hs_task_completion_date).toISOString() : null,
        hs_task_family: task.properties.hs_task_family || null,
        hs_task_for_object_type: task.properties.hs_task_for_object_type || null,
        hs_task_is_all_day: task.properties.hs_task_is_all_day ? task.properties.hs_task_is_all_day === 'true' : null,
        hs_task_is_overdue: task.properties.hs_task_is_overdue ? task.properties.hs_task_is_overdue === 'true' : null,
        hs_task_last_contact_outreach: task.properties.hs_task_last_contact_outreach ? new Date(task.properties.hs_task_last_contact_outreach).toISOString() : null,
        hs_task_priority: task.properties.hs_task_priority || null,
        hs_task_status: task.properties.hs_task_status || null,
        hs_task_subject: task.properties.hs_task_subject || null,
        hs_task_type: task.properties.hs_task_type || null,
        hs_updated_by_user_id: task.properties.hs_updated_by_user_id || null,
        hubspot_owner_assigneddate: task.properties.hubspot_owner_assigneddate ? new Date(task.properties.hubspot_owner_assigneddate).toISOString() : null,
        hubspot_owner_id: task.properties.hubspot_owner_id || null,
        hubspot_team_id: task.properties.hubspot_team_id || null,
        archived: task.archived || false,
      }));

      const { error: insertError } = await supabase
        .from('hs_tasks')
        .insert(transformedTasks);

      if (insertError) {
        console.error('Error inserting batch:', insertError);
        throw new Error(`Failed to insert batch: ${insertError.message}`);
      }

      insertedCount += batch.length;
      console.log(`✅ Inserted batch successfully. Total inserted: ${insertedCount}/${allTasks.length}`);
    }

    console.log(`🎉 Sync completed successfully! Total records: ${insertedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${insertedCount} HubSpot tasks`,
        totalRecords: insertedCount,
        pagesProcessed: pageCount
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in sync-hubspot-tasks function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        totalRecords: 0
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});