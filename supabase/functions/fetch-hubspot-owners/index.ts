
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
      console.log(`❌ HubSpot API error: ${ownersResponse.status} - ${errorText}`)
      throw new Error(`HubSpot API error: ${ownersResponse.status}`)
    }

    const ownersData = await ownersResponse.json()
    console.log(`📊 Total owners from HubSpot: ${ownersData.results?.length || 0}`)

    // Define the specific users we want to include
    const allowedOwnerNames = [
      'Benjamin Rivet',
      'Thomas Bertiaux', 
      'Marine Fessart',
      'Gauthier Bonder',
      'Lucas Grenier',
      'Marvin Luksenberg'
    ]

    console.log(`🎯 Filtering for specific owners: ${allowedOwnerNames.join(', ')}`)
    
    // Filter owners to only include the specified users
    const transformedOwners = ownersData.results?.filter((owner) => {
      const firstName = owner.firstName || ''
      const lastName = owner.lastName || ''
      const fullName = `${firstName} ${lastName}`.trim()
      
      const isAllowed = allowedOwnerNames.includes(fullName)
      
      console.log(`${isAllowed ? '✅' : '❌'} ${isAllowed ? 'INCLUDED' : 'EXCLUDED'}: ${fullName} (${owner.email})`)
      
      return isAllowed
    }).map((owner) => {
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
