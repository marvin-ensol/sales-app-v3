
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { CORS_HEADERS, TASK_STATUS } from './constants.ts';
import { HubSpotApiClient } from './apiClient.ts';
import { TaskFetcher } from './taskFetcher.ts';
import { DataEnricher } from './dataEnricher.ts';
import { OwnerManager } from './ownerManager.ts';
import { TaskProcessor } from './taskProcessor.ts';

interface TaskFilterParams {
  ownerId?: string;
  hubspotToken: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    console.log('Starting HubSpot tasks fetch with pagination and staggered API calls...');
    
    const hubspotToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN');
    
    if (!hubspotToken) {
      console.error('HubSpot access token not found in environment variables');
      throw new Error('HubSpot access token not configured. Please check your environment variables.');
    }

    let ownerId = null;
    try {
      const body = await req.json();
      ownerId = body?.ownerId;
    } catch (e) {
      // No body or invalid JSON, continue without owner filter
    }

    // Initialize service classes
    const apiClient = new HubSpotApiClient(hubspotToken);
    const taskFetcher = new TaskFetcher(apiClient);
    const dataEnricher = new DataEnricher(apiClient);
    const ownerManager = new OwnerManager(apiClient);
    const taskProcessor = new TaskProcessor();

    // Fetch all tasks
    const tasks = await taskFetcher.fetchAllTasks(ownerId);
    const taskIds = tasks.map(task => task.id);

    // Fetch task associations
    const taskContactMap = await dataEnricher.fetchTaskAssociations(taskIds);

    // Filter tasks with contact associations
    const filteredTasks = tasks.filter(task => {
      const isCompleted = task.properties?.hs_task_status === TASK_STATUS.COMPLETED;
      const hasContact = taskContactMap[task.id];
      
      if (isCompleted) {
        return true;
      } else {
        if (!hasContact) {
          console.log(`❌ DROPPED: Task ${task.id} has no contact association`);
          return false;
        }
        return true;
      }
    });

    console.log(`Filtered tasks: ${filteredTasks.length} out of ${tasks.length} total tasks`);

    // Fetch contact details
    const contactIds = new Set(Object.values(taskContactMap));
    const contacts = await dataEnricher.fetchContactDetails(contactIds);

    // Fetch and filter owners
    const { validOwnerIds, ownersMap } = await ownerManager.fetchValidOwners();

    // Process tasks
    const tasksWithAllowedOwners = taskProcessor.filterTasksByValidOwners(filteredTasks, validOwnerIds);
    const transformedTasks = taskProcessor.transformTasks(tasksWithAllowedOwners, taskContactMap, contacts, ownersMap);
    const sortedTasks = taskProcessor.sortTasks(transformedTasks);

    console.log('Final transformed and sorted tasks:', sortedTasks.length);
    console.log('API calls completed with pagination and staggered delays to avoid rate limiting');

    return new Response(
      JSON.stringify({ 
        tasks: sortedTasks.map(({ taskDueDate, ...task }) => task),
        total: sortedTasks.length,
        success: true
      }),
      { 
        headers: { 
          ...CORS_HEADERS,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in fetch-hubspot-tasks function:', error);
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
          ...CORS_HEADERS, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
