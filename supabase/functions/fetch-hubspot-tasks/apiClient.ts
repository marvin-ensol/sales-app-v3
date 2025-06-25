
import { HubSpotTask, HubSpotOwner } from './hubspotUtils.ts';
import { API_CONFIG } from './constants.ts';

export interface PaginatedResponse<T> {
  results: T[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

export class HubSpotApiClient {
  constructor(private hubspotToken: string) {}

  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeRequest<T>(url: string, requestBody: any): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.hubspotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HubSpot API error: ${response.status} - ${errorText}`);
      throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async makeGetRequest<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.hubspotToken}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HubSpot API error: ${response.status} - ${errorText}`);
      throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async fetchAllPages<T>(url: string, requestBody: any, initialDelay = 0): Promise<T[]> {
    let allResults: T[] = [];
    let after = undefined;
    let hasMore = true;
    let pageCount = 0;

    if (initialDelay > 0) {
      await this.delay(initialDelay);
    }

    while (hasMore) {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);

      const paginatedBody = {
        ...requestBody,
        limit: API_CONFIG.PAGINATION_LIMIT,
        ...(after && { after })
      };

      const data = await this.makeRequest<PaginatedResponse<T>>(url, paginatedBody);
      const results = data.results || [];
      allResults = allResults.concat(results);

      hasMore = data.paging && data.paging.next && data.paging.next.after;
      after = hasMore ? data.paging.next.after : undefined;

      console.log(`Page ${pageCount} fetched: ${results.length} results. Total so far: ${allResults.length}`);

      if (hasMore) {
        await this.delay(API_CONFIG.BATCH_DELAY);
      }
    }

    console.log(`Completed pagination: ${pageCount} pages, ${allResults.length} total results`);
    return allResults;
  }

  async fetchTasksBatch(requestBody: any, delay = 0): Promise<HubSpotTask[]> {
    return this.fetchAllPages<HubSpotTask>(
      'https://api.hubapi.com/crm/v3/objects/tasks/search',
      requestBody,
      delay
    );
  }

  async fetchOwners(): Promise<HubSpotOwner[]> {
    const data = await this.makeGetRequest<{ results: HubSpotOwner[] }>('https://api.hubapi.com/crm/v3/owners');
    return data.results || [];
  }

  async fetchBatchAssociations(taskIds: string[]): Promise<any> {
    return this.makeRequest(
      'https://api.hubapi.com/crm/v4/associations/tasks/contacts/batch/read',
      {
        inputs: taskIds.map(id => ({ id }))
      }
    );
  }

  async fetchBatchContacts(contactIds: string[]): Promise<any> {
    return this.makeRequest(
      'https://api.hubapi.com/crm/v3/objects/contacts/batch/read',
      {
        inputs: contactIds.map(id => ({ id })),
        properties: ['firstname', 'lastname', 'email', 'company', 'hs_object_id', 'mobilephone']
      }
    );
  }
}
