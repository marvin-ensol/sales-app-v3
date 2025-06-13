
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
    console.log('Starting HubSpot tasks fetch...')
    
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN')
    
    if (!hubspotToken) {
      console.error('HubSpot access token not found in environment variables')
      throw new Error('HubSpot access token not configured. Please check your environment variables.')
    }

    console.log('HubSpot token found, proceeding with API calls...')

    // Get today's date in ISO format for filtering
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    console.log('Fetching tasks modified today:', todayISO)

    // Fetch tasks modified today, filtered by owner and status
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
                },
                {
                  propertyName: 'hubspot_owner_id',
                  operator: 'EQ',
                  value: '1288346562'
                },
                {
                  propertyName: 'hs_task_status',
                  operator: 'EQ',
                  value: 'NOT_STARTED'
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
            'hs_queue_membership_ids'
          ],
          associations: ['contacts'],
          limit: 100
        })
      }
    )

    if (!tasksResponse.ok) {
      const errorText = await tasksResponse.text()
      console.error(`HubSpot API error: ${tasksResponse.status} - ${errorText}`)
      throw new Error(`HubSpot API error: ${tasksResponse.status} - ${errorText}`)
    }

    const tasksData = await tasksResponse.json()
    console.log('Tasks fetched successfully:', tasksData.results?.length || 0)

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

    // Get owner details (though we know it's owner 1288346562)
    let owner = null
    const ownersResponse = await fetch(
      `https://api.hubapi.com/crm/v3/owners/batch/read`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubspotToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: [{ id: '1288346562' }]
        })
      }
    )

    if (ownersResponse.ok) {
      const ownersData = await ownersResponse.json()
      owner = ownersData.results?.[0]
    }

    const ownerName = owner 
      ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Unknown Owner'
      : 'Unassigned'

    // Transform tasks to our format
    const transformedTasks = tasksData.results?.map((task: any) => {
      const props = task.properties
      
      // Get associated contact
      const contactId = task.associations?.contacts?.results?.[0]?.id
      const contact = contactId ? contacts[contactId] : null
      const contactName = contact 
        ? `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`.trim() || contact.properties?.email || 'Unknown Contact'
        : 'No Contact'

      // Format due date - fix the date parsing
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

      // Determine queue based on hs_queue_membership_ids
      let queue = 'other'
      const queueIds = props.hs_queue_membership_ids ? props.hs_queue_membership_ids.split(';') : []
      
      // Check for specific queue IDs
      if (queueIds.includes('22859490')) {
        // Both New and Attempted have the same ID, need to check task subject or other criteria
        // For now, let's check the task subject to determine if it's "New" or "Attempted"
        const taskSubject = props.hs_task_subject?.toLowerCase() || ''
        if (taskSubject.includes('new')) {
          queue = 'new'
        } else if (taskSubject.includes('attempted')) {
          queue = 'attempted'
        } else {
          // Default to 'new' for queue ID 22859490 if we can't determine from subject
          queue = 'new'
        }
      }

      console.log(`Task: ${props.hs_task_subject}, Queue IDs: ${queueIds.join(',')}, Assigned Queue: ${queue}`)

      return {
        id: task.id,
        title: props.hs_task_subject || 'Untitled Task',
        contact: contactName,
        status: 'not_started',  // All tasks are not_started now
        dueDate,
        priority: priorityMap[props.hs_task_priority] || 'medium',
        owner: ownerName,
        hubspotId: task.id,
        queue: queue,
        queueIds: queueIds
      }
    }) || []

    console.log('Transformed tasks successfully:', transformedTasks.length)

    return new Response(
      JSON.stringify({ 
        tasks: transformedTasks,
        total: tasksData.total || 0,
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
    console.error('Error in fetch-hubspot-tasks function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        tasks: [],
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
