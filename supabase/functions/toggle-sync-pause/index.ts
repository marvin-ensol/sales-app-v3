import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { isPaused, pausedBy, notes } = await req.json();

    console.log(`🔄 Toggling sync pause status to: ${isPaused}`);

    // Update or insert sync control record
    const { data, error } = await supabase
      .from('sync_control')
      .upsert({
        is_paused: isPaused,
        paused_by: isPaused ? (pausedBy || 'unknown') : null,
        paused_at: isPaused ? new Date().toISOString() : null,
        notes: notes || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating sync control:', error);
      throw error;
    }

    console.log(`✅ Sync ${isPaused ? 'paused' : 'resumed'} successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        isPaused,
        data 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in toggle-sync-pause:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});