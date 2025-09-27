import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotMember {
  membershipTimestamp: string;
  recordId: string;
}

interface HubSpotMembershipsResponse {
  results: HubSpotMember[];
  paging?: {
    next?: {
      after: string;
    };
  };
  total: number;
}

interface TaskAutomation {
  id: string;
  hs_list_id: string;
  hs_list_object: string;
  task_category_id: number;
}

interface ExistingMembership {
  id: string;
  hs_object_id: string;
  hs_list_entry_date: string;
  list_exit_date: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const executionId = `list-sync-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  console.log(`=== [${executionId}] HUBSPOT LIST MEMBERSHIPS SYNC START ===`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');

    if (!supabaseUrl || !supabaseServiceKey || !hubspotToken) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const syncStartTime = new Date().toISOString();
    
    console.log(`[${executionId}] ⏰ Sync started at: ${syncStartTime}`);

    console.log(`[${executionId}] 🔍 Fetching active task automations...`);

    // Get all active task automations with their category info
    const { data: automations, error: automationsError } = await supabase
      .from('task_automations')
      .select(`
        id,
        hs_list_id,
        hs_list_object,
        task_category_id
      `)
      .eq('automation_enabled', true)
      .not('hs_list_id', 'is', null);

    // Get category info separately
    const categoryIds = automations?.map(a => a.task_category_id) || [];
    const { data: categories } = await supabase
      .from('task_categories')
      .select('id, hs_queue_id')
      .in('id', categoryIds);
    
    const categoryMap = new Map();
    categories?.forEach(cat => categoryMap.set(cat.id, cat.hs_queue_id));

    if (automationsError) {
      throw new Error(`Failed to fetch automations: ${automationsError.message}`);
    }

    if (!automations || automations.length === 0) {
      console.log(`[${executionId}] ✅ No active automations found - sync complete`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active automations found',
        executionId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${executionId}] 📊 Found ${automations.length} active automation(s)`);

    let totalProcessed = 0;
    let totalErrors = 0;

    // Process each automation
    for (const automation of automations as TaskAutomation[]) {
      try {
        console.log(`[${executionId}] 📄 Processing automation ${automation.id} with list ${automation.hs_list_id}...`);
        
        // Fetch all members from HubSpot list with pagination
        const allMembers: HubSpotMember[] = [];
        let after: string | undefined;
        let page = 1;

        do {
          const url = `https://api.hubapi.com/crm/v3/lists/${automation.hs_list_id}/memberships?limit=250${after ? `&after=${after}` : ''}`;
          
          console.log(`[${executionId}] 🌐 Fetching page ${page} for automation ${automation.id}...`);
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${hubspotToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`HubSpot API error: ${response.status} ${response.statusText}`);
          }

          const data: HubSpotMembershipsResponse = await response.json();
          allMembers.push(...data.results);
          
          console.log(`[${executionId}] 📦 Received ${data.results.length} members on page ${page} (total so far: ${allMembers.length})`);
          
          after = data.paging?.next?.after;
          page++;

          // Small delay to respect rate limits
          if (after) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } while (after);

        console.log(`[${executionId}] 🎯 Total members fetched for automation ${automation.id}: ${allMembers.length}`);

        // Get existing memberships for this automation (only active ones)
        const { data: existingMemberships, error: existingError } = await supabase
          .from('hs_list_memberships')
          .select('id, hs_object_id, hs_list_entry_date, list_exit_date')
          .eq('automation_id', automation.id)
          .is('list_exit_date', null);

        if (existingError) {
          throw new Error(`Failed to fetch existing memberships: ${existingError.message}`);
        }

        const existingMap = new Map<string, ExistingMembership>();
        (existingMemberships || []).forEach((membership: ExistingMembership) => {
          existingMap.set(membership.hs_object_id, membership);
        });

        const currentMemberIds = new Set(allMembers.map(m => m.recordId));
        const newMemberships = [];
        const updatedMemberships = [];
        const exitedMemberIds = [];
        const reenteredMembers = [];
        
        // Check for re-entered members (have exited records but appear in current list)
        const { data: exitedMemberships, error: exitedError } = await supabase
          .from('hs_list_memberships')
          .select('hs_object_id')
          .eq('automation_id', automation.id)
          .not('list_exit_date', 'is', null);
          
        if (exitedError) {
          console.error(`[${executionId}] ⚠️ Failed to fetch exited memberships: ${exitedError.message}`);
        }
        
        const exitedMemberIds_Set = new Set((exitedMemberships || []).map(m => m.hs_object_id));

        // Process current members
        for (const member of allMembers) {
          const existing = existingMap.get(member.recordId);
          const hasExitedBefore = exitedMemberIds_Set.has(member.recordId);
          
          if (!existing) {
            // Check if this is a re-entry (member has exited before but no active record)
            if (hasExitedBefore) {
              reenteredMembers.push(member.recordId);
              console.log(`[${executionId}] 🔄 Detected re-entry for member ${member.recordId}`);
            }
            
            // New member or re-entered member - create new record
            newMemberships.push({
              automation_id: automation.id,
              hs_list_id: automation.hs_list_id,
              hs_list_object: automation.hs_list_object,
              hs_queue_id: categoryMap.get(automation.task_category_id),
              hs_object_id: member.recordId,
              hs_list_entry_date: member.membershipTimestamp,
              list_exit_date: null,
              last_api_call: syncStartTime
            });
          } else if (existing.hs_list_entry_date !== member.membershipTimestamp) {
            // Update entry date if it changed
            updatedMemberships.push({
              id: existing.id,
              hs_list_entry_date: member.membershipTimestamp,
              last_api_call: syncStartTime,
              updated_at: new Date().toISOString()
            });
          } else {
            // No changes, but update last_api_call to track when we last confirmed membership
            updatedMemberships.push({
              id: existing.id,
              last_api_call: syncStartTime,
              updated_at: new Date().toISOString()
            });
          }
        }

        // Find members who have exited
        for (const [objectId, existing] of existingMap) {
          if (!currentMemberIds.has(objectId)) {
            exitedMemberIds.push(existing.id);
          }
        }

        // Batch insert new memberships
        if (newMemberships.length > 0) {
          const { error: insertError } = await supabase
            .from('hs_list_memberships')
            .insert(newMemberships);

          if (insertError) {
            throw new Error(`Failed to insert new memberships: ${insertError.message}`);
          }
          console.log(`[${executionId}] ✅ Inserted ${newMemberships.length} new memberships`);
        }

        // Batch update existing memberships
        if (updatedMemberships.length > 0) {
          for (const update of updatedMemberships) {
            const updateData: any = {
              last_api_call: update.last_api_call,
              updated_at: update.updated_at
            };
            
            // Only update entry date if it's provided (changed)
            if (update.hs_list_entry_date) {
              updateData.hs_list_entry_date = update.hs_list_entry_date;
            }
            
            const { error: updateError } = await supabase
              .from('hs_list_memberships')
              .update(updateData)
              .eq('id', update.id);

            if (updateError) {
              console.error(`[${executionId}] ⚠️ Failed to update membership ${update.id}:`, updateError.message);
            }
          }
          console.log(`[${executionId}] ✅ Updated ${updatedMemberships.length} existing memberships (last_api_call: ${syncStartTime})`);
        }

        // Mark exited members
        if (exitedMemberIds.length > 0) {
          const { error: exitError } = await supabase
            .from('hs_list_memberships')
            .update({
              list_exit_date: syncStartTime,
              updated_at: new Date().toISOString()
            })
            .in('id', exitedMemberIds);

          if (exitError) {
            throw new Error(`Failed to mark exited members: ${exitError.message}`);
          }
          console.log(`[${executionId}] ✅ Marked ${exitedMemberIds.length} members as exited`);
        }

        // Log re-entries if any
        if (reenteredMembers.length > 0) {
          console.log(`[${executionId}] 🔄 Detected ${reenteredMembers.length} re-entries for automation ${automation.id}`);
        }
        
        console.log(`[${executionId}] ✅ Completed processing automation ${automation.id} (last_api_call: ${syncStartTime})`);
        totalProcessed++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[${executionId}] ❌ Error processing automation ${automation.id}:`, errorMessage);
        totalErrors++;
      }
    }

    const duration = Date.now() - new Date(syncStartTime).getTime();
    console.log(`[${executionId}] 🎉 Sync completed: ${totalProcessed}/${automations.length} automations processed, ${totalErrors} errors, duration: ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      executionId,
      automationsProcessed: totalProcessed,
      automationsTotal: automations.length,
      errors: totalErrors,
      durationMs: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${executionId}] ❌ Critical error in list memberships sync:`, errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      executionId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});