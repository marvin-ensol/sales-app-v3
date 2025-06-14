
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
    console.error('=== FETCH-HUBSPOT-OWNERS START ===')
    
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN')
    
    if (!hubspotToken) {
      console.error('❌ HubSpot access token not found')
      throw new Error('HubSpot access token not configured')
    }

    console.error('✅ HubSpot token found, making API call...')

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
      console.error(`❌ HubSpot API error: ${ownersResponse.status} - ${errorText}`)
      throw new Error(`HubSpot API error: ${ownersResponse.status}`)
    }

    const ownersData = await ownersResponse.json()
    console.error(`📊 Total owners from HubSpot: ${ownersData.results?.length || 0}`)

    // Transform owners to our format and filter by team IDs
    const allowedTeamIds = ['162028741', '135903065']
    console.error(`🎯 Allowed team IDs: ${JSON.stringify(allowedTeamIds)}`)
    
    // Check specifically for Adrien first
    const adrienOwner = ownersData.results?.find((owner: any) => 
      (owner.firstName?.toLowerCase() === 'adrien' && owner.lastName?.toLowerCase() === 'holvoet') ||
      owner.email?.toLowerCase().includes('adrien')
    )
    
    if (adrienOwner) {
      console.error(`🔍 FOUND ADRIEN HOLVOET:`)
      console.error(`   ID: ${adrienOwner.id}`)
      console.error(`   Name: ${adrienOwner.firstName} ${adrienOwner.lastName}`)
      console.error(`   Email: ${adrienOwner.email}`)
      console.error(`   Teams: ${JSON.stringify(adrienOwner.teams || [])}`)
      
      if (adrienOwner.teams && adrienOwner.teams.length > 0) {
        adrienOwner.teams.forEach((team: any, index: number) => {
          const teamIdStr = team.id?.toString()
          const isAllowed = allowedTeamIds.includes(teamIdStr)
          console.error(`   Team ${index + 1}: ID="${teamIdStr}", Name="${team.name}", Allowed: ${isAllowed}`)
        })
      } else {
        console.error(`   ⚠️ Adrien has NO TEAMS`)
      }
    } else {
      console.error(`🔍 ADRIEN HOLVOET NOT FOUND in raw data`)
    }
    
    // Filter owners
    const transformedOwners = ownersData.results?.filter((owner: any) => {
      const ownerTeams = owner.teams || []
      
      if (ownerTeams.length === 0) {
        return false
      }
      
      const hasAllowedTeam = ownerTeams.some((team: any) => {
        const teamIdString = team.id?.toString()
        return allowedTeamIds.includes(teamIdString)
      })
      
      // Special logging for Adrien
      if ((owner.firstName?.toLowerCase() === 'adrien' && owner.lastName?.toLowerCase() === 'holvoet') || 
          owner.email?.toLowerCase().includes('adrien')) {
        console.error(`🚨 ADRIEN FILTER RESULT: ${hasAllowedTeam ? 'INCLUDED' : 'EXCLUDED'}`)
        if (hasAllowedTeam) {
          console.error(`❌❌❌ BUG: Adrien should be EXCLUDED but is INCLUDED!`)
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

    console.error(`📋 Final filtered count: ${transformedOwners.length}`)
    
    // Final check for Adrien in results
    const adrienInFinal = transformedOwners.find(o => 
      o.fullName.toLowerCase().includes('adrien') || 
      o.email.toLowerCase().includes('adrien')
    )
    
    if (adrienInFinal) {
      console.error(`❌❌❌ CRITICAL: Adrien is in final results: ${JSON.stringify(adrienInFinal)}`)
    } else {
      console.error(`✅ GOOD: Adrien not in final results`)
    }

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
    console.error('=== CRITICAL ERROR ===')
    console.error('Error:', error.message)
    
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
