import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HubSpotUser {
  id: string
  properties: {
    hs_given_name?: string
    hs_family_name?: string
    hs_email?: string
    hs_deactivated?: string
    hubspot_owner_id?: string
    hs_user_assigned_primary_team?: string
  }
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

    // Fetch users data with pagination
    console.log('👥 Fetching users from HubSpot...')
    let allUsers: HubSpotUser[] = []
    let after = ''
    let hasMore = true
    
    while (hasMore) {
      const url = `https://api.hubapi.com/crm/v3/objects/users?properties=hs_given_name,hs_family_name,hs_email,hs_deactivated,hubspot_owner_id,hs_user_assigned_primary_team&limit=100${after ? `&after=${after}` : ''}`
      
      const usersResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!usersResponse.ok) {
        throw new Error(`HubSpot users API error: ${usersResponse.status} - ${usersResponse.statusText}`)
      }

      const usersData = await usersResponse.json()
      const users: HubSpotUser[] = usersData.results || []
      allUsers = [...allUsers, ...users]
      
      // Check if there are more pages
      if (usersData.paging?.next?.after) {
        after = usersData.paging.next.after
      } else {
        hasMore = false
      }
    }

    console.log(`✅ Fetched ${allUsers.length} users from HubSpot`)

    // Process and upsert users data
    const processedUsers = allUsers.map(user => {
      // Get team info from primary team assignment
      const teamId = user.properties.hs_user_assigned_primary_team || null
      const teamName = teamId ? teamsMap.get(teamId) || null : null
      
      const firstName = user.properties.hs_given_name || null
      const lastName = user.properties.hs_family_name || null
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

      return {
        owner_id: user.properties.hubspot_owner_id || null,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        email: user.properties.hs_email || null,
        team_id: teamId,
        team_name: teamName,
        archived: user.properties.hs_deactivated === 'true',
        updated_at: new Date().toISOString()
      }
    })

    console.log(`🔄 Upserting ${processedUsers.length} users to database...`)

    // Upsert users data
    const { error: upsertError } = await supabase
      .from('hs_users')
      .upsert(processedUsers, { 
        onConflict: 'owner_id',
        ignoreDuplicates: false
      })

    if (upsertError) {
      throw new Error(`Database upsert error: ${upsertError.message}`)
    }

    console.log('✅ HubSpot users and teams sync completed successfully')

    return new Response(JSON.stringify({
      success: true,
      message: 'HubSpot users and teams synced successfully',
      stats: {
        teams_fetched: teams.length,
        users_processed: processedUsers.length
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
      error: (error as Error)?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})