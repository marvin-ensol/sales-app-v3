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
    
    // TEMPORARY KILL SWITCH - Disable incremental sync
    console.log('🚫 Incremental sync temporarily disabled');
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Incremental sync temporarily disabled',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Enhanced scheduling logic for 45-second intervals
    const now = new Date();
    const currentSeconds = now.getSeconds();
    
    // Only trigger at :00 and :45 seconds (45-second intervals)
    if (currentSeconds < 5 || (currentSeconds >= 45 && currentSeconds < 50)) {
      console.log(`🚀 Triggering incremental sync at ${now.toISOString()}`);
      
      // Trigger the incremental sync for global data
      const { data, error } = await supabase.functions.invoke('incremental-sync-hubspot-tasks', {
        body: { 
          ownerId: null, // Global sync
          timestamp: now.toISOString(),
          triggerSource: 'cron-45s'
        }
      });

      if (error) {
        console.error('Error invoking incremental sync:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message,
          message: 'Failed to trigger incremental sync'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('✅ Incremental sync triggered successfully');
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Incremental sync triggered successfully',
        triggerTime: now.toISOString(),
        nextTrigger: new Date(now.getTime() + 45000).toISOString(),
        data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Skip this execution - not the right time interval
      console.log(`⏭️ Skipping sync - current time ${now.toISOString()} (seconds: ${currentSeconds}) not in trigger window`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Sync skipped - not in 45-second trigger window',
        currentTime: now.toISOString(),
        currentSeconds,
        nextTriggerSeconds: currentSeconds < 45 ? 45 : 60 // Next trigger at :45 or next minute :00
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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