import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== SCHEDULED INCREMENTAL SYNC TRIGGER ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all owners that need syncing (those with recent activity or that haven't been synced recently)
    const { data: owners, error: ownersError } = await supabase
      .from('hs_users')
      .select('owner_id')
      .eq('archived', false);

    if (ownersError) {
      console.error('Error fetching owners:', ownersError);
      throw new Error(`Failed to fetch owners: ${ownersError.message}`);
    }

    console.log(`🔄 Triggering incremental sync for ${owners?.length || 0} owners`);

    // Trigger incremental sync for each owner
    const results = [];
    
    for (const owner of owners || []) {
      try {
        console.log(`🚀 Triggering incremental sync for owner ${owner.owner_id}`);
        
        const { data, error } = await supabase.functions.invoke('incremental-sync-hubspot-tasks', {
          body: { ownerId: owner.owner_id }
        });

        if (error) {
          console.error(`Error syncing owner ${owner.owner_id}:`, error);
          results.push({ ownerId: owner.owner_id, success: false, error: error.message });
        } else {
          console.log(`✅ Successfully triggered sync for owner ${owner.owner_id}`);
          results.push({ ownerId: owner.owner_id, success: true, data });
        }

        // Small delay between owner syncs to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Exception syncing owner ${owner.owner_id}:`, error);
        results.push({ ownerId: owner.owner_id, success: false, error: error.message });
      }
    }

    // Also trigger a global sync for unassigned tasks
    try {
      console.log('🌐 Triggering global incremental sync for unassigned tasks');
      
      const { data, error } = await supabase.functions.invoke('incremental-sync-hubspot-tasks', {
        body: { ownerId: null }
      });

      if (error) {
        console.error('Error in global sync:', error);
        results.push({ ownerId: 'global', success: false, error: error.message });
      } else {
        console.log('✅ Successfully triggered global sync');
        results.push({ ownerId: 'global', success: true, data });
      }
    } catch (error) {
      console.error('Exception in global sync:', error);
      results.push({ ownerId: 'global', success: false, error: error.message });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`=== SCHEDULED SYNC COMPLETE ===`);
    console.log(`✅ Successful syncs: ${successCount}`);
    console.log(`❌ Failed syncs: ${failureCount}`);

    return new Response(JSON.stringify({ 
      success: failureCount === 0,
      message: `Scheduled incremental sync completed: ${successCount} successful, ${failureCount} failed`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Scheduled sync error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      message: 'Scheduled incremental sync failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});