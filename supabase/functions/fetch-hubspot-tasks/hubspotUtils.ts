
import { HUBSPOT_QUEUES, TIME_CONFIG } from './constants.ts';
import { getParisTimeRange, getParisTimeAdvanced } from './dateUtils.ts';

export interface HubSpotTask {
  id: string;
  properties: {
    hs_task_subject?: string;
    hs_body_preview?: string;
    hs_task_status?: string;
    hs_task_priority?: string;
    hs_task_type?: string;
    hs_timestamp?: string;
    hubspot_owner_id?: string;
    hs_queue_membership_ids?: string;
    hs_lastmodifieddate?: string;
    hs_task_completion_date?: string;
  };
}

export interface HubSpotOwner {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  teams?: Array<{ id: string }>;
}

/**
 * Add delay between API calls
 */
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create request body for unassigned New tasks
 */
export function createUnassignedNewTasksRequest() {
  return {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'hs_task_status',
            operator: 'EQ',
            value: 'NOT_STARTED'
          },
          {
            propertyName: 'hs_queue_membership_ids',
            operator: 'CONTAINS_TOKEN',
            value: HUBSPOT_QUEUES.NEW
          },
          {
            propertyName: 'hubspot_owner_id',
            operator: 'NOT_HAS_PROPERTY'
          }
        ]
      }
    ],
    properties: getTaskProperties(),
    sorts: [
      {
        propertyName: 'hs_timestamp',
        direction: 'ASCENDING'
      }
    ]
  };
}

/**
 * Create request body for owner tasks
 */
export function createOwnerTasksRequest(ownerId: string) {
  return {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'hs_task_status',
            operator: 'EQ',
            value: 'NOT_STARTED'
          },
          {
            propertyName: 'hubspot_owner_id',
            operator: 'EQ',
            value: ownerId
          }
        ]
      }
    ],
    properties: getTaskProperties(),
    sorts: [
      {
        propertyName: 'hs_timestamp',
        direction: 'ASCENDING'
      }
    ]
  };
}

/**
 * Create request body for completed tasks today
 */
export function createCompletedTasksRequest(ownerId: string) {
  const { startTimestamp, endTimestamp } = getParisTimeRange();
  
  return {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'hs_task_status',
            operator: 'EQ',
            value: 'COMPLETED'
          },
          {
            propertyName: 'hubspot_owner_id',
            operator: 'EQ',
            value: ownerId
          },
          {
            propertyName: 'hs_task_completion_date',
            operator: 'GTE',
            value: startTimestamp.toString()
          },
          {
            propertyName: 'hs_task_completion_date',
            operator: 'LT',
            value: endTimestamp.toString()
          }
        ]
      }
    ],
    properties: getTaskProperties(),
    sorts: [
      {
        propertyName: 'hs_task_completion_date',
        direction: 'DESCENDING'
      }
    ]
  };
}

/**
 * Create request body for Rappels & RDV tasks
 */
export function createRappelsRdvTasksRequest(ownerId: string) {
  const oneHourFromNowTimestamp = getParisTimeAdvanced(TIME_CONFIG.RAPPELS_ADVANCE_MINUTES);
  
  return {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'hs_task_status',
            operator: 'EQ',
            value: 'NOT_STARTED'
          },
          {
            propertyName: 'hs_queue_membership_ids',
            operator: 'CONTAINS_TOKEN',
            value: HUBSPOT_QUEUES.RAPPELS_RDV
          },
          {
            propertyName: 'hubspot_owner_id',
            operator: 'EQ',
            value: ownerId
          },
          {
            propertyName: 'hs_timestamp',
            operator: 'LTE',
            value: oneHourFromNowTimestamp.toString()
          }
        ]
      }
    ],
    properties: getTaskProperties(),
    sorts: [
      {
        propertyName: 'hs_timestamp',
        direction: 'ASCENDING'
      }
    ]
  };
}

/**
 * Get standard task properties for API requests
 */
export function getTaskProperties(): string[] {
  return [
    'hs_task_subject',
    'hs_body_preview',
    'hs_task_status',
    'hs_task_priority',
    'hs_task_type',
    'hs_timestamp',
    'hubspot_owner_id',
    'hs_queue_membership_ids',
    'hs_lastmodifieddate',
    'hs_task_completion_date'
  ];
}

/**
 * Determine task queue from queue IDs
 */
export function getTaskQueue(queueIds: string[]): string {
  if (queueIds.includes(HUBSPOT_QUEUES.RAPPELS_RDV)) {
    return 'rappels';
  } else if (queueIds.includes(HUBSPOT_QUEUES.NEW)) {
    return 'new';
  } else if (queueIds.includes(HUBSPOT_QUEUES.SIMULATIONS)) {
    return 'simulations';
  } else if (queueIds.includes(HUBSPOT_QUEUES.COMMUNICATIONS)) {
    return 'communications';
  } else if (queueIds.includes(HUBSPOT_QUEUES.ATTEMPTED)) {
    return 'attempted';
  }
  return 'other';
}

/**
 * Format owner name from HubSpot owner object
 */
export function formatOwnerName(owner: HubSpotOwner): string {
  if (!owner) return 'Unassigned';
  
  const fullName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim();
  return fullName || owner.email || 'Unknown Owner';
}

/**
 * Create batch request for associations
 */
export function createAssociationsBatchRequest(taskIds: string[]) {
  return {
    inputs: taskIds.map(id => ({ id }))
  };
}

/**
 * Create batch request for contacts
 */
export function createContactsBatchRequest(contactIds: string[]) {
  return {
    inputs: contactIds.map(id => ({ id })),
    properties: ['firstname', 'lastname', 'email', 'company', 'hs_object_id', 'mobilephone']
  };
}
