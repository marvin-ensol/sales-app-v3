
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
    console.log('=== FETCH-HUBSPOT-OWNERS FUNCTION STARTED ===')
    
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN')
    
    if (!hubspotToken) {
      console.error('HubSpot access token not found in environment variables')
      throw new Error('HubSpot access token not configured. Please check your environment variables.')
    }

    console.log('HubSpot token found, proceeding with API call...')

    // Fetch owners from HubSpot
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

    if (!ownersResponse.ok) {
      const errorText = await ownersResponse.text()
      console.error(`HubSpot API error: ${ownersResponse.status} - ${errorText}`)
      throw new Error(`HubSpot API error: ${ownersResponse.status} - ${errorText}`)
    }

    const ownersData = await ownersResponse.json()
    console.log('=== RAW OWNERS DATA FROM HUBSPOT ===')
    console.log('Total owners fetched from HubSpot API:', ownersData.results?.length || 0)

    // Transform owners to our format and filter by team IDs
    const allowedTeamIds = ['162028741', '135903065']
    console.log('Allowed team IDs:', allowedTeamIds)
    
    console.log('=== STARTING TEAM FILTERING ===')
    
    // Log all owners with their team information first
    ownersData.results?.forEach((owner: any) => {
      const ownerTeams = owner.teams || []
      console.log(`OWNER: ${owner.id} - ${owner.firstName} ${owner.lastName} (${owner.email})`)
      console.log(`  Teams: [${ownerTeams.map((t: any) => `${t.id}:${t.name || 'no name'}`).join(', ')}]`)
      
      // Special check for Adrien Holvoet
      if ((owner.firstName?.toLowerCase() === 'adrien' && owner.lastName?.toLowerCase() === 'holvoet') || 
          owner.email?.toLowerCase().includes('adrien')) {
        console.log(`*** SPECIAL CHECK FOR ADRIEN HOLVOET ***`)
        console.log(`  Owner ID: ${owner.id}`)
        console.log(`  Name: ${owner.firstName} ${owner.lastName}`)
        console.log(`  Email: ${owner.email}`)
        console.log(`  Teams: ${JSON.stringify(ownerTeams, null, 2)}`)
      }
    })
    
    const transformedOwners = ownersData.results?.filter((owner: any) => {
      // Check if owner has teams property and if any team ID matches our allowed list
      const ownerTeams = owner.teams || []
      const hasAllowedTeam = ownerTeams.some((team: any) => {
        const teamIdString = team.id?.toString()
        const isAllowed = allowedTeamIds.includes(teamIdString)
        console.log(`    Team ${teamIdString} (${team.name || 'no name'}) - Allowed: ${isAllowed}`)
        return isAllowed
      })
      
      const result = `Owner ${owner.id} (${owner.firstName} ${owner.lastName}) - Teams: [${ownerTeams.map((t: any) => t.id).join(', ')}] - INCLUDED: ${hasAllowedTeam}`
      console.log(result)
      
      // Extra logging for excluded owners
      if (!hasAllowedTeam) {
        console.log(`  ❌ EXCLUDED: ${owner.firstName} ${owner.lastName} (${owner.email}) - not in allowed teams`)
      } else {
        console.log(`  ✅ INCLUDED: ${owner.firstName} ${owner.lastName} (${owner.email}) - in allowed teams`)
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
    console.log('Final filtered owners count:', transformedOwners.length)
    console.log('Final filtered owner names:', transformedOwners.map(o => `${o.id}: ${o.fullName}`))
    
    // Check if Adrien is in the final list
    const adrienInFinalList = transformedOwners.some(o => 
      o.fullName.toLowerCase().includes('adrien') || 
      o.email.toLowerCase().includes('adrien')
    )
    console.log(`Adrien Holvoet in final filtered list: ${adrienInFinalList}`)

    return new Response(
      JSON.stringify({ 
        owners: transformedOwners,
        total: transformedOwners.length,
        success: true
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('=== ERROR IN FETCH-HUBSPOT-OWNERS ===')
    console.error('Error in fetch-hubspot-owners function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        owners: [],
        total: 0,
        success: false
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
