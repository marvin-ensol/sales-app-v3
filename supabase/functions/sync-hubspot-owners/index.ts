import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HubSpotOwner {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  teams?: Array<{
    id: string
    name: string
    primary: boolean
  }>
}

interface HubSpotTeam {
  id: string
  name: string
  userIds: string[]
  secondaryUserIds?: string[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get HubSpot access token
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN')
    if (!hubspotToken) {
      throw new Error('HUBSPOT_ACCESS_TOKEN not configured')
    }

    console.log('🔄 Starting HubSpot owners and teams sync...')

    // Fetch teams data first
    console.log('📋 Fetching teams from HubSpot...')
    const teamsResponse = await fetch('https://api.hubapi.com/settings/v3/users/teams', {
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!teamsResponse.ok) {
      throw new Error(`HubSpot teams API error: ${teamsResponse.status} - ${teamsResponse.statusText}`)
    }

    const teamsData = await teamsResponse.json()
    const teams: HubSpotTeam[] = teamsData.results || []
    
    console.log(`✅ Fetched ${teams.length} teams from HubSpot`)

    // Create teams map for quick lookup
    const teamsMap = new Map<string, string>()
    teams.forEach(team => {
      teamsMap.set(team.id, team.name)
    })

    // Fetch owners data
    console.log('👥 Fetching owners from HubSpot...')
    const ownersResponse = await fetch('https://api.hubapi.com/crm/v3/owners?limit=100', {
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!ownersResponse.ok) {
      throw new Error(`HubSpot owners API error: ${ownersResponse.status} - ${ownersResponse.statusText}`)
    }

    const ownersData = await ownersResponse.json()
    const owners: HubSpotOwner[] = ownersData.results || []

    console.log(`✅ Fetched ${owners.length} owners from HubSpot`)

    // Process and upsert owners data
    const processedOwners = owners.map(owner => {
      // Get primary team info
      const primaryTeam = owner.teams?.find(team => team.primary) || owner.teams?.[0]
      const teamId = primaryTeam?.id || null
      const teamName = teamId ? teamsMap.get(teamId) || primaryTeam?.name || null : null
      
      const fullName = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || null

      return {
        owner_id: owner.id,
        first_name: owner.firstName || null,
        last_name: owner.lastName || null,
        full_name: fullName,
        email: owner.email || null,
        team_id: teamId,
        team_name: teamName,
        updated_at: new Date().toISOString()
      }
    })

    console.log(`🔄 Upserting ${processedOwners.length} owners to database...`)

    // Upsert owners data
    const { error: upsertError } = await supabase
      .from('hs_owners')
      .upsert(processedOwners, { 
        onConflict: 'owner_id',
        ignoreDuplicates: false
      })

    if (upsertError) {
      throw new Error(`Database upsert error: ${upsertError.message}`)
    }

    console.log('✅ HubSpot owners and teams sync completed successfully')

    return new Response(JSON.stringify({
      success: true,
      message: 'HubSpot owners and teams synced successfully',
      stats: {
        teams_fetched: teams.length,
        owners_processed: processedOwners.length
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('❌ Sync error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})