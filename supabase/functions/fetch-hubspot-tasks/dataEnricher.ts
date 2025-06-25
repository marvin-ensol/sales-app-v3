
import { HubSpotApiClient } from './apiClient.ts';
import { API_CONFIG } from './constants.ts';

export class DataEnricher {
  constructor(private apiClient: HubSpotApiClient) {}

  async fetchTaskAssociations(taskIds: string[]): Promise<{ [key: string]: string }> {
    let taskContactMap: { [key: string]: string } = {};
    
    if (taskIds.length > 0) {
      await this.apiClient.delay(API_CONFIG.FETCH_DELAY);
      
      console.log(`Fetching task associations for ${taskIds.length} tasks in batches of ${API_CONFIG.BATCH_SIZE}...`);

      for (let i = 0; i < taskIds.length; i += API_CONFIG.BATCH_SIZE) {
        const batch = taskIds.slice(i, i + API_CONFIG.BATCH_SIZE);
        const batchNumber = Math.floor(i / API_CONFIG.BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(taskIds.length / API_CONFIG.BATCH_SIZE);
        
        console.log(`Fetching associations batch ${batchNumber}/${totalBatches} (${batch.length} tasks)...`);

        if (i > 0) {
          await this.apiClient.delay(API_CONFIG.BATCH_DELAY);
        }

        try {
          const associationsData = await this.apiClient.fetchBatchAssociations(batch);
          console.log(`Associations batch ${batchNumber} fetched successfully`);
          
          associationsData.results?.forEach((result: any) => {
            if (result.to && result.to.length > 0) {
              taskContactMap[result.from.id] = result.to[0].toObjectId;
            }
          });
        } catch (error) {
          console.error(`Failed to fetch associations batch ${batchNumber}:`, error);
        }
      }

      console.log(`Total task-contact associations fetched: ${Object.keys(taskContactMap).length}`);
    }

    return taskContactMap;
  }

  async fetchContactDetails(contactIds: Set<string>): Promise<any> {
    let contacts = {};
    
    if (contactIds.size > 0) {
      console.log('Fetching contact details for', contactIds.size, 'contacts');
      
      await this.apiClient.delay(API_CONFIG.FETCH_DELAY);
      
      const contactIdsArray = Array.from(contactIds);
      
      for (let i = 0; i < contactIdsArray.length; i += API_CONFIG.BATCH_SIZE) {
        const batch = contactIdsArray.slice(i, i + API_CONFIG.BATCH_SIZE);
        const batchNumber = Math.floor(i / API_CONFIG.BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(contactIdsArray.length / API_CONFIG.BATCH_SIZE);
        
        console.log(`Fetching contacts batch ${batchNumber}/${totalBatches} (${batch.length} contacts)...`);
        
        if (i > 0) {
          await this.apiClient.delay(API_CONFIG.BATCH_DELAY);
        }
        
        try {
          const contactsData = await this.apiClient.fetchBatchContacts(batch);
          
          const batchContacts = contactsData.results?.reduce((acc: any, contact: any) => {
            acc[contact.id] = contact;
            return acc;
          }, {}) || {};
          
          contacts = { ...contacts, ...batchContacts };
          console.log(`Contacts batch ${batchNumber} fetched: ${Object.keys(batchContacts).length} contacts`);
        } catch (error) {
          console.error(`Failed to fetch contact batch ${batchNumber}:`, error);
        }
      }
      
      console.log('Total contacts fetched:', Object.keys(contacts).length);
    }

    return contacts;
  }
}
