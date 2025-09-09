
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

    // Transform owners to our format and filter by team IDs
    const allowedTeamIds = ['162028741', '135903065']
    console.log(`🎯 Allowed team IDs: ${JSON.stringify(allowedTeamIds)}`)
    
    // Log ALL owners first
    console.log('=== ALL OWNERS FROM HUBSPOT ===')
    ownersData.results?.forEach((owner, index) => {
      const teams = owner.teams || []
      const teamIds = teams.map(t => t.id?.toString())
      console.log(`Owner ${index + 1}: ${owner.firstName} ${owner.lastName} (${owner.email}) - Teams: [${teamIds.join(', ')}]`)
    })
    
    // Check specifically for Adrien first
    const adrienOwner = ownersData.results?.find((owner) => 
      (owner.firstName?.toLowerCase() === 'adrien' && owner.lastName?.toLowerCase() === 'holvoet') ||
      owner.email?.toLowerCase().includes('adrien')
    )
    
    if (adrienOwner) {
      console.log(`🔍 FOUND ADRIEN HOLVOET:`)
      console.log(`   ID: ${adrienOwner.id}`)
      console.log(`   Name: ${adrienOwner.firstName} ${adrienOwner.lastName}`)
      console.log(`   Email: ${adrienOwner.email}`)
      console.log(`   Teams: ${JSON.stringify(adrienOwner.teams || [])}`)
      
      if (adrienOwner.teams && adrienOwner.teams.length > 0) {
        adrienOwner.teams.forEach((team, index) => {
          const teamIdStr = team.id?.toString()
          const isAllowed = allowedTeamIds.includes(teamIdStr)
          console.log(`   Team ${index + 1}: ID="${teamIdStr}", Name="${team.name}", Allowed: ${isAllowed}`)
        })
      } else {
        console.log(`   ⚠️ Adrien has NO TEAMS`)
      }
    } else {
      console.log(`🔍 ADRIEN HOLVOET NOT FOUND in raw data`)
    }
    
    // Filter owners
    const transformedOwners = ownersData.results?.filter((owner) => {
      const ownerTeams = owner.teams || []
      
      if (ownerTeams.length === 0) {
        console.log(`❌ EXCLUDING ${owner.firstName} ${owner.lastName} - NO TEAMS`)
        return false
      }
      
      const hasAllowedTeam = ownerTeams.some((team) => {
        const teamIdString = team.id?.toString()
        return allowedTeamIds.includes(teamIdString)
      })
      
      // Log every filtering decision
      const result = hasAllowedTeam ? 'INCLUDED' : 'EXCLUDED'
      console.log(`${hasAllowedTeam ? '✅' : '❌'} ${result}: ${owner.firstName} ${owner.lastName} (${owner.email})`)
      
      // Special logging for Adrien
      if ((owner.firstName?.toLowerCase() === 'adrien' && owner.lastName?.toLowerCase() === 'holvoet') || 
          owner.email?.toLowerCase().includes('adrien')) {
        console.log(`🚨 ADRIEN FILTER RESULT: ${hasAllowedTeam ? 'INCLUDED' : 'EXCLUDED'}`)
        if (hasAllowedTeam) {
          console.log(`❌❌❌ BUG: Adrien should be EXCLUDED but is INCLUDED!`)
          console.log(`❌❌❌ Adrien's teams that are causing inclusion:`)
          ownerTeams.forEach(team => {
            const teamIdStr = team.id?.toString()
            if (allowedTeamIds.includes(teamIdStr)) {
              console.log(`❌❌❌ PROBLEM TEAM: ID="${teamIdStr}", Name="${team.name}"`)
            }
          })
        }
      }
      
      return hasAllowedTeam
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
    
    // Final check for Adrien in results
    const adrienInFinal = transformedOwners.find(o => 
      o.fullName.toLowerCase().includes('adrien') || 
      o.email.toLowerCase().includes('adrien')
    )
    
    if (adrienInFinal) {
      console.log(`❌❌❌ CRITICAL: Adrien is in final results: ${JSON.stringify(adrienInFinal)}`)
    } else {
      console.log(`✅ GOOD: Adrien not in final results`)
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
