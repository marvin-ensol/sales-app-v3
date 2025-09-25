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

// Column Configuration
export const KANBAN_COLUMNS = [
  { id: "rappels", title: "Rappels & RDV", color: "border-l-4 border-l-purple-400" },
  { id: "new", title: "New", color: "border-l-4 border-l-blue-400" },
  { id: "simulations", title: "Simulations", color: "border-l-4 border-l-green-400" },
  { id: "communications", title: "Communications", color: "border-l-4 border-l-yellow-400" },
  { id: "attempted", title: "Attempted", color: "border-l-4 border-l-orange-400" },
  { id: "upsell", title: "Upsell", color: "border-l-4 border-l-pink-400" },
  { id: "securisation", title: "Sécurisation", color: "border-l-4 border-l-indigo-400" },
  { id: "other", title: "Autres", color: "border-l-4 border-l-gray-400" }
] as const;

// CORS Headers
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const;
