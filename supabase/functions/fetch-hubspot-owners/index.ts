
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
    console.log('Starting HubSpot owners fetch...')
    
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
    console.log('Owners fetched successfully:', ownersData.results?.length || 0)

    // Transform owners to our format and filter by team IDs
    const allowedTeamIds = ['162028741', '135903065']
    
    const transformedOwners = ownersData.results?.filter((owner: any) => {
      // Check if owner has teams property and if any team ID matches our allowed list
      const ownerTeams = owner.teams || []
      const hasAllowedTeam = ownerTeams.some((team: any) => allowedTeamIds.includes(team.id.toString()))
      
      console.log(`Owner ${owner.id} (${owner.firstName} ${owner.lastName}) teams:`, ownerTeams.map((t: any) => t.id), 'Included:', hasAllowedTeam)
      
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

    console.log('Transformed and filtered owners successfully:', transformedOwners.length)

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
