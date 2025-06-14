
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
    console.log('=== FETCH-HUBSPOT-OWNERS EDGE FUNCTION START ===')
    console.log('Timestamp:', new Date().toISOString())
    console.log('Request method:', req.method)
    
    const requestBody = await req.json().catch(() => ({}))
    console.log('Request body:', JSON.stringify(requestBody, null, 2))
    
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN')
    
    if (!hubspotToken) {
      console.error('❌ HubSpot access token not found in environment variables')
      throw new Error('HubSpot access token not configured. Please check your environment variables.')
    }

    console.log('✅ HubSpot token found, proceeding with API call...')

    // Fetch owners from HubSpot
    console.log('Making request to HubSpot owners API...')
    const ownersResponse = await fetch(
      `https://api.hubapi.com/crm/v3/owners`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        }
      }
    )

    console.log('HubSpot API response status:', ownersResponse.status)

    if (!ownersResponse.ok) {
      const errorText = await ownersResponse.text()
      console.error(`❌ HubSpot API error: ${ownersResponse.status} - ${errorText}`)
      throw new Error(`HubSpot API error: ${ownersResponse.status} - ${errorText}`)
    }

    const ownersData = await ownersResponse.json()
    console.log('=== RAW OWNERS DATA FROM HUBSPOT ===')
    console.log('Total owners fetched from HubSpot API:', ownersData.results?.length || 0)

    // Transform owners to our format and filter by team IDs
    const allowedTeamIds = ['162028741', '135903065']
    console.log('🎯 Allowed team IDs:', allowedTeamIds)
    
    console.log('=== STARTING DETAILED TEAM FILTERING ===')
    
    // Log all owners first
    console.log('=== ALL OWNERS FROM HUBSPOT (BEFORE FILTERING) ===')
    ownersData.results?.forEach((owner: any, index: number) => {
      const ownerTeams = owner.teams || []
      console.log(`${index + 1}. OWNER ${owner.id}: ${owner.firstName} ${owner.lastName} (${owner.email})`)
      console.log(`   Teams: [${ownerTeams.map((t: any) => `${t.id}:${t.name || 'no name'}`).join(', ')}]`)
      
      // Special detailed check for Adrien Holvoet
      if ((owner.firstName?.toLowerCase() === 'adrien' && owner.lastName?.toLowerCase() === 'holvoet') || 
          owner.email?.toLowerCase().includes('adrien')) {
        console.log(`🔍 SPECIAL DETAILED CHECK FOR ADRIEN HOLVOET`)
        console.log(`   Owner ID: ${owner.id}`)
        console.log(`   First Name: "${owner.firstName}"`)
        console.log(`   Last Name: "${owner.lastName}"`)
        console.log(`   Email: "${owner.email}"`)
        console.log(`   Teams: ${JSON.stringify(ownerTeams, null, 4)}`)
        console.log(`   Teams count: ${ownerTeams.length}`)
        
        if (ownerTeams.length > 0) {
          ownerTeams.forEach((team: any, teamIndex: number) => {
            console.log(`   Team ${teamIndex + 1}: ID="${team.id}", Name="${team.name}", Type: ${typeof team.id}`)
            console.log(`   Team ${teamIndex + 1} ID as string: "${team.id?.toString()}"`)
            console.log(`   Is "${team.id?.toString()}" in allowed list? ${allowedTeamIds.includes(team.id?.toString())}`)
          })
        } else {
          console.log(`   ⚠️ Adrien has NO TEAMS assigned`)
        }
      }
    })
    
    console.log('=== NOW FILTERING OWNERS ===')
    
    const transformedOwners = ownersData.results?.filter((owner: any) => {
      const ownerTeams = owner.teams || []
      
      console.log(`\n🔄 FILTERING: ${owner.firstName} ${owner.lastName} (${owner.email})`)
      console.log(`   Owner ID: ${owner.id}`)
      console.log(`   Teams: [${ownerTeams.map((t: any) => `${t.id}:${t.name}`).join(', ')}]`)
      
      if (ownerTeams.length === 0) {
        console.log(`   ❌ EXCLUDED: No teams assigned`)
        return false
      }
      
      const hasAllowedTeam = ownerTeams.some((team: any) => {
        const teamIdString = team.id?.toString()
        const isAllowed = allowedTeamIds.includes(teamIdString)
        console.log(`     Checking team ${teamIdString} (${team.name || 'no name'}) - Allowed: ${isAllowed}`)
        return isAllowed
      })
      
      if (hasAllowedTeam) {
        console.log(`   ✅ INCLUDED: Has allowed team`)
      } else {
        console.log(`   ❌ EXCLUDED: No allowed teams`)
      }
      
      // Extra check for Adrien
      if ((owner.firstName?.toLowerCase() === 'adrien' && owner.lastName?.toLowerCase() === 'holvoet') || 
          owner.email?.toLowerCase().includes('adrien')) {
        console.log(`🚨 ADRIEN HOLVOET FILTER RESULT: ${hasAllowedTeam ? 'INCLUDED' : 'EXCLUDED'}`)
        if (hasAllowedTeam) {
          console.error(`❌❌❌ CRITICAL ISSUE: Adrien Holvoet is being INCLUDED when he should be EXCLUDED!`)
          console.error(`❌❌❌ This means he has a team in the allowed list: ${JSON.stringify(allowedTeamIds)}`)
        }
      }
      
      return hasAllowedTeam
    }).map((owner: any) => {
      const firstName = owner.firstName || ''
      const lastName = owner.lastName || ''
      const email = owner.email || ''
      
      let fullName = `${firstName} ${lastName}`.trim()
      if (!fullName && email) {
        fullName = email
      }
      if (!fullName) {
        fullName = `Owner ${owner.id}`
      }

      return {
        id: owner.id,
        firstName,
        lastName,
        email,
        fullName
      }
    }) || []

    console.log('=== FILTERING COMPLETE ===')
    console.log('📊 Final filtered owners count:', transformedOwners.length)
    console.log('📋 Final filtered owner names:', transformedOwners.map(o => `${o.id}: ${o.fullName} (${o.email})`))
    
    // Final check if Adrien is in the result
    const adrienInFinalList = transformedOwners.some(o => 
      o.fullName.toLowerCase().includes('adrien') || 
      o.email.toLowerCase().includes('adrien')
    )
    console.log(`🎯 Adrien Holvoet in final filtered list: ${adrienInFinalList}`)
    
    if (adrienInFinalList) {
      console.error(`❌❌❌ CRITICAL BUG: Adrien Holvoet made it through the filter!`)
      const adrienDetails = transformedOwners.find(o => 
        o.fullName.toLowerCase().includes('adrien') || 
        o.email.toLowerCase().includes('adrien')
      )
      console.error(`❌❌❌ Adrien final details:`, JSON.stringify(adrienDetails, null, 2))
    }

    console.log('=== EDGE FUNCTION RESPONSE READY ===')
    const response = { 
      owners: transformedOwners,
      total: transformedOwners.length,
      success: true,
      timestamp: new Date().toISOString()
    }
    
    console.log('Returning response with', response.total, 'owners')

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
    console.error('=== CRITICAL ERROR IN FETCH-HUBSPOT-OWNERS ===')
    console.error('Error details:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
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
