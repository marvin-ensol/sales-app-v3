
import { HubSpotTask } from './hubspotUtils.ts';
import { HubSpotApiClient } from './apiClient.ts';
import { API_CONFIG } from './constants.ts';
import {
  createUnassignedNewTasksRequest,
  createOwnerTasksRequest,
  createCompletedTasksRequest,
  createRappelsRdvTasksRequest
} from './hubspotUtils.ts';

export class TaskFetcher {
  constructor(private apiClient: HubSpotApiClient) {}

  async fetchUnassignedNewTasks(): Promise<HubSpotTask[]> {
    console.log('Fetching unassigned New tasks...');
    const requestBody = createUnassignedNewTasksRequest();
    const results = await this.apiClient.fetchTasksBatch(requestBody);
    console.log('Unassigned New tasks fetched:', results.length);
    return results;
  }

  async fetchOwnerTasks(ownerId: string): Promise<HubSpotTask[]> {
    console.log('Fetching owner tasks for:', ownerId);
    const requestBody = createOwnerTasksRequest(ownerId);
    const results = await this.apiClient.fetchTasksBatch(requestBody, API_CONFIG.FETCH_DELAY);
    console.log('Owner tasks fetched:', results.length);
    return results;
  }

  async fetchCompletedTasksToday(ownerId: string): Promise<HubSpotTask[]> {
    console.log('Fetching completed tasks for today for owner:', ownerId);
    const requestBody = createCompletedTasksRequest(ownerId);
    const results = await this.apiClient.fetchTasksBatch(requestBody, API_CONFIG.FETCH_DELAY);
    console.log('Completed tasks fetched:', results.length);
    return results;
  }

  async fetchRappelsRdvTasks(ownerId: string): Promise<HubSpotTask[]> {
    console.log('Fetching Rappels & RDV tasks for owner:', ownerId);
    const requestBody = createRappelsRdvTasksRequest(ownerId);
    const results = await this.apiClient.fetchTasksBatch(requestBody, API_CONFIG.FETCH_DELAY * 2);
    console.log('Rappels & RDV tasks fetched:', results.length);
    return results;
  }

  async fetchAllTasks(ownerId?: string): Promise<HubSpotTask[]> {
    console.log('Owner filter:', ownerId);
    console.log('Starting API calls with delays and pagination to retrieve all tasks...');

    const unassignedTasks = await this.fetchUnassignedNewTasks();
    
    let ownerTasks: HubSpotTask[] = [];
    let completedTasks: HubSpotTask[] = [];
    let rappelsRdvTasks: HubSpotTask[] = [];
    
    if (ownerId) {
      ownerTasks = await this.fetchOwnerTasks(ownerId);
      completedTasks = await this.fetchCompletedTasksToday(ownerId);
      rappelsRdvTasks = await this.fetchRappelsRdvTasks(ownerId);
    }

    // Combine and deduplicate tasks
    const allTasks = [...unassignedTasks, ...completedTasks, ...rappelsRdvTasks];
    const taskIds = new Set(unassignedTasks.map(task => task.id));
    
    completedTasks.forEach(task => {
      if (!taskIds.has(task.id)) {
        taskIds.add(task.id);
      }
    });
    
    rappelsRdvTasks.forEach(task => {
      if (!taskIds.has(task.id)) {
        allTasks.push(task);
        taskIds.add(task.id);
      }
    });
    
    ownerTasks.forEach(task => {
      if (!taskIds.has(task.id)) {
        allTasks.push(task);
        taskIds.add(task.id);
      }
    });

    console.log(`Combined tasks: ${allTasks.length} (${unassignedTasks.length} unassigned + ${ownerTasks.length} owner tasks + ${completedTasks.length} completed today + ${rappelsRdvTasks.length} rappels & rdv)`);
    
    return allTasks;
  }
}
