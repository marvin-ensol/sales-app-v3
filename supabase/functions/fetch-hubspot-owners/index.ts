
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== FETCH-HUBSPOT-OWNERS START ===')
    
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN')
    
    if (!hubspotToken) {
      console.log('❌ HubSpot access token not found')
      throw new Error('HubSpot access token not configured')
    }

    console.log('✅ HubSpot token found, making API call...')

    // Fetch users from HubSpot with pagination
    let allUsers: any[] = []
    let after = ''
    let hasMore = true
    
    while (hasMore) {
      const url = `https://api.hubapi.com/crm/v3/objects/users?properties=hs_given_name,hs_family_name,hs_email,hs_deactivated,hubspot_owner_id,hs_user_assigned_primary_team&limit=100${after ? `&after=${after}` : ''}`
      
      const usersResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        }
      })

      if (!usersResponse.ok) {
        const errorText = await usersResponse.text()
        console.log(`❌ HubSpot API error: ${usersResponse.status} - ${errorText}`)
        throw new Error(`HubSpot API error: ${usersResponse.status}`)
      }

      const usersData = await usersResponse.json()
      const users = usersData.results || []
      allUsers = [...allUsers, ...users]
      
      // Check if there are more pages
      if (usersData.paging?.next?.after) {
        after = usersData.paging.next.after
      } else {
        hasMore = false
      }
    }
    
    console.log(`📊 Total users from HubSpot: ${allUsers.length}`)

    // Transform users to our format and filter by team IDs
    const allowedTeamIds = ['162028741', '135903065']
    console.log(`🎯 Allowed team IDs: ${JSON.stringify(allowedTeamIds)}`)
    
    // Log ALL users first
    console.log('=== ALL USERS FROM HUBSPOT ===')
    allUsers.forEach((user, index) => {
      const teamId = user.properties.hs_user_assigned_primary_team || 'none'
      const isDeactivated = user.properties.hs_deactivated === 'true'
      console.log(`User ${index + 1}: ${user.properties.hs_given_name || ''} ${user.properties.hs_family_name || ''} (${user.properties.hs_email || ''}) - Team: ${teamId}, Deactivated: ${isDeactivated}`)
    })
    
    // Filter users based on team membership and active status
    const transformedOwners = allUsers.filter((user) => {
      const teamId = user.properties.hs_user_assigned_primary_team
      const isDeactivated = user.properties.hs_deactivated === 'true'
      
      if (isDeactivated) {
        console.log(`❌ EXCLUDING ${user.properties.hs_given_name || ''} ${user.properties.hs_family_name || ''} - DEACTIVATED`)
        return false
      }
      
      if (!teamId) {
        console.log(`❌ EXCLUDING ${user.properties.hs_given_name || ''} ${user.properties.hs_family_name || ''} - NO TEAM`)
        return false
      }
      
      const hasAllowedTeam = allowedTeamIds.includes(teamId)
      
      // Log every filtering decision
      const result = hasAllowedTeam ? 'INCLUDED' : 'EXCLUDED'
      console.log(`${hasAllowedTeam ? '✅' : '❌'} ${result}: ${user.properties.hs_given_name || ''} ${user.properties.hs_family_name || ''} (${user.properties.hs_email || ''})`)
      
      return hasAllowedTeam
    }).map((user) => {
      const firstName = user.properties.hs_given_name || ''
      const lastName = user.properties.hs_family_name || ''
      const email = user.properties.hs_email || ''
      
      let fullName = `${firstName} ${lastName}`.trim()
      if (!fullName && email) {
        fullName = email
      }
      if (!fullName) {
        fullName = `User ${user.properties.hubspot_owner_id}`
      }

      return {
        id: user.properties.hubspot_owner_id,
        firstName,
        lastName,
        email,
        fullName
      }
    })

    console.log(`📋 Final filtered count: ${transformedOwners.length}`)

    const response = { 
      owners: transformedOwners,
      total: transformedOwners.length,
      success: true,
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.log('=== CRITICAL ERROR ===')
    console.log('Error:', error.message)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        owners: [],
        total: 0,
        success: false,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
