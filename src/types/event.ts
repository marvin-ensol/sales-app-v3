export interface EnrichedEvent {
  id: number;
  created_at: string;
  event: string;
  type: string;
  hs_contact_id: string | null;
  contact_firstname: string | null;
  contact_lastname: string | null;
  hs_owner_id: string | null;
  owner_firstname: string | null;
  owner_lastname: string | null;
  hs_engagement_id: string | null;
  hubspot_url: string | null;
  automation_id: string | null;
  logs: EventLogs;
  error_count: number;
  total_count?: number;
}

export interface EventLogs {
  call_details?: CallDetails;
  task_updates?: TaskUpdates;
  task_creation?: TaskCreation;
}

export interface CallDetails {
  call_id: string;
  contact_id: string;
  hs_call_direction: 'INBOUND' | 'OUTBOUND';
  hs_call_duration: number;
  hubspot_owner_id: string | null;
}

export interface TaskUpdates {
  summary: {
    total_incomplete: number;
    total_automation_eligible: number;
    total_update_successful: number;
    total_update_unsuccessful: number;
  };
  task_details: EligibleTask[];
  eligible_tasks?: EligibleTask[]; // Deprecated: kept for backward compatibility with old events
}

export interface EligibleTask {
  id: string;
  hs_task_subject: string | null;
  hubspot_owner_id: string | null;
  status: 'overdue' | 'future';
  hs_timestamp: string;
  automation_enabled: boolean;
  hs_update_successful: boolean | null;
  hs_queue_membership_ids: string | null;
}

export interface TaskCreation {
  task_details: EligibleTask[];
}

export interface ErrorLog {
  id: string;
  created_at: string;
  error_type: string;
  context: string;
  endpoint: string | null;
  status_code: number | null;
  response_message: string | null;
  response_error: string | null;
}

export interface PaginatedEventsResponse {
  events: EnrichedEvent[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}
