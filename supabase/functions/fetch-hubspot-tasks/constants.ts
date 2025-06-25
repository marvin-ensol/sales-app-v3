// HubSpot Queue IDs
export const HUBSPOT_QUEUES = {
  RAPPELS_RDV: '22933271',
  NEW: '22859489',
  ATTEMPTED: '22859490',
  SIMULATIONS: '22934016',
  COMMUNICATIONS: '22934015'
} as const;

// HubSpot Team IDs (allowed teams)
export const HUBSPOT_ALLOWED_TEAMS = ['162028741', '135903065'] as const;

// API Configuration
export const API_CONFIG = {
  FETCH_DELAY: 300,
  BATCH_DELAY: 200,
  BATCH_SIZE: 100,
  RETRY_DELAY_BASE: 1000,
  MAX_RETRY_DELAY: 10000,
  MAX_RETRIES: 3,
  POLLING_INTERVAL: 20000,
  PAGINATION_LIMIT: 100
} as const;

// Time Configuration
export const TIME_CONFIG = {
  RAPPELS_ADVANCE_MINUTES: 60,
  TIMEZONE: 'Europe/Paris'
} as const;

// Task Status
export const TASK_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  COMPLETED: 'COMPLETED',
  not_started: 'not_started',
  completed: 'completed'
} as const;

// Task Priority Mapping
export const PRIORITY_MAP = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
} as const;

// CORS Headers
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const;
