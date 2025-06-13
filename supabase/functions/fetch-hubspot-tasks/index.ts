
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
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN')
    
    if (!hubspotToken) {
      throw new Error('HubSpot access token not found')
    }

    // Get today's date in ISO format for filtering
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    console.log('Fetching tasks modified today:', todayISO)

    // Fetch tasks modified today
    const tasksResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/tasks/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'hs_lastmodifieddate',
                  operator: 'GTE',
                  value: todayISO
                }
              ]
            }
          ],
          properties: [
            'hs_task_subject',
            'hs_task_status',
            'hs_task_priority',
            'hs_task_type',
            'hs_timestamp',
            'hubspot_owner_id',
            'associations'
          ],
          associations: ['contacts'],
          limit: 100
        })
      }
    )

    if (!tasksResponse.ok) {
      throw new Error(`HubSpot API error: ${tasksResponse.status}`)
    }

    const tasksData = await tasksResponse.json()
    console.log('Tasks fetched:', tasksData.results?.length || 0)

    // Get unique contact IDs from task associations
    const contactIds = new Set()
    tasksData.results?.forEach((task: any) => {
      task.associations?.contacts?.results?.forEach((contact: any) => {
        contactIds.add(contact.id)
      })
    })

    // Fetch contact details if we have contact IDs
    let contacts = {}
    if (contactIds.size > 0) {
      const contactsResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/batch/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: Array.from(contactIds).map(id => ({ id })),
            properties: ['firstname', 'lastname', 'email']
          })
        }
      )

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json()
        contacts = contactsData.results?.reduce((acc: any, contact: any) => {
          acc[contact.id] = contact
          return acc
        }, {}) || {}
      }
    }

    // Get owner details
    const ownerIds = new Set()
    tasksData.results?.forEach((task: any) => {
      if (task.properties.hubspot_owner_id) {
        ownerIds.add(task.properties.hubspot_owner_id)
      }
    })

    let owners = {}
    if (ownerIds.size > 0) {
      const ownersResponse = await fetch(
        `https://api.hubapi.com/crm/v3/owners/batch/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: Array.from(ownerIds).map(id => ({ id }))
          })
        }
      )

      if (ownersResponse.ok) {
        const ownersData = await ownersResponse.json()
        owners = ownersData.results?.reduce((acc: any, owner: any) => {
          acc[owner.id] = owner
          return acc
        }, {}) || {}
      }
    }

    // Transform tasks to our format
    const transformedTasks = tasksData.results?.map((task: any) => {
      const props = task.properties
      
      // Get associated contact
      const contactId = task.associations?.contacts?.results?.[0]?.id
      const contact = contactId ? contacts[contactId] : null
      const contactName = contact 
        ? `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`.trim() || contact.properties?.email || 'Unknown Contact'
        : 'No Contact'

      // Get owner
      const owner = owners[props.hubspot_owner_id]
      const ownerName = owner 
        ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Unknown Owner'
        : 'Unassigned'

      // Format due date
      let dueDate = ''
      if (props.hs_timestamp) {
        const date = new Date(parseInt(props.hs_timestamp))
        const day = date.getDate().toString().padStart(2, '0')
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        dueDate = `${day}/${month} à ${hours}:${minutes}`
      }

      // Map priority
      const priorityMap: { [key: string]: string } = {
        'HIGH': 'high',
        'MEDIUM': 'medium',
        'LOW': 'low'
      }

      return {
        id: task.id,
        title: props.hs_task_subject || 'Untitled Task',
        contact: contactName,
        status: props.hs_task_status?.toLowerCase() || 'not_started',
        dueDate,
        priority: priorityMap[props.hs_task_priority] || 'medium',
        owner: ownerName,
        hubspotId: task.id
      }
    }) || []

    return new Response(
      JSON.stringify({ 
        tasks: transformedTasks,
        total: tasksData.total || 0
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error fetching HubSpot tasks:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        tasks: [],
        total: 0
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
