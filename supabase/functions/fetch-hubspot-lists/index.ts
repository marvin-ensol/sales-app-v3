import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HubSpotList {
  listId: string;
  name: string;
  updatedAt: string;
  objectTypeId: string;
  processingType: string;
  additionalProperties?: {
    hs_list_size?: string;
    hs_list_reference_count?: string;
  };
}

interface HubSpotListsResponse {
  lists: HubSpotList[];
  total: number;
  hasMore: boolean;
}

Deno.serve(async (req) => {
  console.log('=== FETCH HUBSPOT LISTS START ===');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get HubSpot access token
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    if (!hubspotToken) {
      throw new Error('HubSpot access token not configured');
    }

    console.log('🔍 Fetching contact lists from HubSpot...');

    // Call HubSpot Lists API with the exact structure requested
    const requestBody = {
      "count": 500,
      "offset": 0,
      "query": "",
      "sort": "-HS_UPDATED_AT",
      "processingTypes": [
        "MANUAL", 
        "DYNAMIC"
      ]
    };

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    const hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/lists/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 HubSpot API response status:', hubspotResponse.status);

    if (!hubspotResponse.ok) {
      const errorText = await hubspotResponse.text();
      console.error('❌ HubSpot API error:', errorText);
      throw new Error(`HubSpot API error: ${hubspotResponse.status} - ${errorText}`);
    }

    const hubspotData: HubSpotListsResponse = await hubspotResponse.json();
    console.log(`📦 Received ${hubspotData.lists.length} total lists from HubSpot`);

    // Filter for contact lists only (objectTypeId: "0-1")
    const contactLists = hubspotData.lists.filter(list => list.objectTypeId === "0-1");
    console.log(`🎯 Filtered to ${contactLists.length} contact lists`);

    // Sort by updatedAt (most recent first)
    contactLists.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Store in database (upsert)
    const { error: upsertError } = await supabase
      .from('lists')
      .upsert({
        type: 'contacts',
        data: contactLists,
        last_updated_at: new Date().toISOString()
      }, {
        onConflict: 'type'
      });

    if (upsertError) {
      console.error('❌ Database upsert error:', upsertError);
      throw new Error(`Database error: ${upsertError.message}`);
    }

    console.log('✅ Successfully stored contact lists in database');

    return new Response(
      JSON.stringify({
        success: true,
        lists: contactLists,
        total: contactLists.length
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
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});