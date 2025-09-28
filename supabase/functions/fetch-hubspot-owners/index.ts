import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    console.log(`🔄 [DATABASE] Fetching HubSpot owners from local database...`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query the hs_users table directly instead of HubSpot API
    const { data: owners, error: dbError } = await supabase
      .from('hs_users')
      .select('user_id, owner_id, first_name, last_name, full_name, email, team_id, team_name')
      .eq('archived', false)
      .order('full_name');

    if (dbError) {
      console.error('Database query error:', dbError);
      return new Response(
        JSON.stringify({ 
          error: `Database query failed: ${dbError.message}`, 
          success: false 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ [DATABASE] Successfully fetched ${owners?.length || 0} owners from database`);

    // Transform database result to match expected API format
    const transformedOwners = (owners || []).map(owner => ({
      id: owner.user_id,
      ownerId: owner.owner_id,
      firstName: owner.first_name || '',
      lastName: owner.last_name || '',
      email: owner.email || '',
      fullName: owner.full_name || `${owner.first_name || ''} ${owner.last_name || ''}`.trim(),
      teamId: owner.team_id || null,
      teamName: owner.team_name || null
    }));

    // Log performance metrics
    console.log(`📊 [PERFORMANCE] Database query completed - ${owners?.length || 0} owners processed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        owners: transformedOwners,
        source: 'database',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [ERROR] Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        error: `Edge function failed: ${(error as Error)?.message || 'Unknown error'}`, 
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});