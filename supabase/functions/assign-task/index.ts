
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AssignTaskRequest {
  taskId: string;
  contactId: string;
}

async function getCurrentUser() {
  // For now, we'll use a hardcoded user ID since we don't have authentication
  // In a real scenario, this would come from the authenticated user
  return {
    id: "29270912", // This should be replaced with actual user authentication
    hubspotOwnerId: "29270912"
  };
}

async function checkContactOwnership(contactId: string, hubspotToken: string) {
  console.log('Checking contact ownership for:', contactId);
  
  const response = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=hubspot_owner_id`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to check contact ownership: ${response.status} - ${errorText}`);
    throw new Error(`Failed to check contact ownership: ${response.status}`);
  }

  const contactData = await response.json();
  const ownerId = contactData.properties?.hubspot_owner_id;
  
  console.log('Contact owner ID:', ownerId);
  return ownerId;
}

async function assignContactToOwner(contactId: string, ownerId: string, hubspotToken: string) {
  console.log('Assigning contact', contactId, 'to owner', ownerId);
  
  const response = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          hubspot_owner_id: ownerId
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to assign contact: ${response.status} - ${errorText}`);
    throw new Error(`Failed to assign contact: ${response.status}`);
  }

  const result = await response.json();
  console.log('Contact assigned successfully');
  return result;
}

async function assignTaskToOwner(taskId: string, ownerId: string, hubspotToken: string) {
  console.log('Assigning task', taskId, 'to owner', ownerId);
  
  const response = await fetch(
    `https://api.hubapi.com/crm/v3/objects/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          hubspot_owner_id: ownerId
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to assign task: ${response.status} - ${errorText}`);
    throw new Error(`Failed to assign task: ${response.status}`);
  }

  const result = await response.json();
  console.log('Task assigned successfully');
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting task assignment...')
    
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN')
    
    if (!hubspotToken) {
      console.error('HubSpot access token not found in environment variables')
      throw new Error('HubSpot access token not configured')
    }

    const body: AssignTaskRequest = await req.json()
    const { taskId, contactId } = body

    if (!taskId || !contactId) {
      throw new Error('Missing required parameters: taskId and contactId')
    }

    console.log('Assigning task:', taskId, 'for contact:', contactId)

    // Get current user (in a real app, this would come from authentication)
    const currentUser = await getCurrentUser()
    
    // Check if contact is still unassigned
    const currentContactOwner = await checkContactOwnership(contactId, hubspotToken)
    
    if (currentContactOwner && currentContactOwner !== null && currentContactOwner !== '') {
      console.log('Contact already assigned to owner:', currentContactOwner)
      return new Response(
        JSON.stringify({ 
          error: 'Contact is already assigned to another owner',
          success: false
        }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    // Assign contact to current user
    await assignContactToOwner(contactId, currentUser.hubspotOwnerId, hubspotToken)
    
    // Assign task to current user
    await assignTaskToOwner(taskId, currentUser.hubspotOwnerId, hubspotToken)

    console.log('Task and contact assignment completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Task and contact assigned successfully'
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in assign-task function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
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
