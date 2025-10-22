import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Simplified scheduling logic - let cron handle the 30-second frequency
    const now = new Date();
    console.log(`🚀 Triggering global incremental sync at ${now.toISOString()}`);
    
    // Trigger the incremental sync (global only, no owner-specific logic)
    const { data, error } = await supabase.functions.invoke('incremental-sync-hubspot-tasks', {
      body: { 
        triggerSource: 'cron-every-minute',
        triggerTime: now.toISOString()
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

    console.log('✅ Global incremental sync triggered successfully');
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Global incremental sync triggered successfully',
      triggerTime: now.toISOString(),
      nextTrigger: new Date(now.getTime() + 30000).toISOString(),
      data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Scheduled sync error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: (error as Error)?.message || 'Unknown error',
      message: 'Scheduled incremental sync failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});