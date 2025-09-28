import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TaskSummaryRequest {
  team_id: string;
  owner_id?: string;
}

interface TasksByStatus {
  status: string;
  task_queues: Record<string, number>;
  total: number;
}

interface OwnerSummary {
  owner_id: string;
  tasks: TasksByStatus[];
  total_tasks: number;
}

interface TaskSummaryResponse {
  task_summary: {
    owners: OwnerSummary[];
    grand_totals: {
      by_status: Record<string, number>;
      by_task_queue: Record<string, number>;
      total_all_tasks: number;
    };
  };
  owner_header_summary?: {
    completed_today_count: number;
    overdue_count: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { team_id, owner_id }: TaskSummaryRequest = await req.json();

    if (!team_id) {
      return new Response(
        JSON.stringify({ error: 'team_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching task summary for team_id: ${team_id}, owner_id: ${owner_id || 'all'}`);

    // Get team owners
    const { data: teamOwners, error: ownersError } = await supabase
      .from('hs_users')
      .select('owner_id, full_name')
      .eq('team_id', team_id)
      .eq('archived', false);

    if (ownersError) {
      throw new Error(`Failed to fetch team owners: ${ownersError.message}`);
    }

    if (!teamOwners || teamOwners.length === 0) {
      console.log(`No owners found for team_id: ${team_id}`);
      return new Response(
        JSON.stringify({
          task_summary: {
            owners: [],
            grand_totals: {
              by_status: {},
              by_task_queue: {},
              total_all_tasks: 0
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ownerIds = teamOwners.map(o => o.owner_id);
    console.log(`Found ${ownerIds.length} team owners:`, ownerIds);

    // Get all tasks for team owners
    const { data: tasks, error: tasksError } = await supabase
      .from('hs_tasks')
      .select(`
        hubspot_owner_id,
        hs_task_status,
        hs_timestamp,
        hs_task_completion_date,
        hs_queue_membership_ids
      `)
      .eq('archived', false)
      .in('hubspot_owner_id', ownerIds);

    if (tasksError) {
      throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
    }

    console.log(`Found ${tasks?.length || 0} tasks for team`);

    // Get current time in Paris timezone for "completed today" calculation
    const now = new Date();
    const parisNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
    const parisToday = parisNow.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Process tasks by owner
    const ownerSummaries: OwnerSummary[] = [];
    const grandTotalsByStatus: Record<string, number> = {};
    const grandTotalsByQueue: Record<string, number> = {};
    let grandTotalAllTasks = 0;

    // Initialize owner summaries
    for (const owner of teamOwners) {
      const ownerTasks = tasks?.filter(t => t.hubspot_owner_id === owner.owner_id) || [];
      
      const statusBreakdowns: Record<string, Record<string, number>> = {
        'COMPLETED_TODAY': {},
        'NOT_STARTED': {},
        'WAITING': {}
      };

      let ownerTotalTasks = 0;

      // Process each task for this owner
      for (const task of ownerTasks) {
        ownerTotalTasks++;
        const queueId = task.hs_queue_membership_ids || 'null';
        
        // Determine task status category
        let statusCategory: string | null = null;
        
        if (task.hs_task_status === 'COMPLETED' && task.hs_task_completion_date) {
          // Check if completed today in Paris timezone
          const completionDate = new Date(task.hs_task_completion_date);
          const completionParis = completionDate.toLocaleString("en-US", { timeZone: "Europe/Paris" });
          const completionParisDate = new Date(completionParis).toISOString().split('T')[0];
          
          if (completionParisDate === parisToday) {
            statusCategory = 'COMPLETED_TODAY';
          }
        } else if (task.hs_task_status === 'NOT_STARTED') {
          statusCategory = 'NOT_STARTED';
        } else if (task.hs_task_status === 'WAITING') {
          statusCategory = 'WAITING';
        }

        // Add to breakdowns if it matches our categories
        if (statusCategory) {
          if (!statusBreakdowns[statusCategory][queueId]) {
            statusBreakdowns[statusCategory][queueId] = 0;
          }
          statusBreakdowns[statusCategory][queueId]++;

          // Update grand totals
          if (!grandTotalsByStatus[statusCategory]) {
            grandTotalsByStatus[statusCategory] = 0;
          }
          grandTotalsByStatus[statusCategory]++;

          if (!grandTotalsByQueue[queueId]) {
            grandTotalsByQueue[queueId] = 0;
          }
          grandTotalsByQueue[queueId]++;
        }
      }

      grandTotalAllTasks += ownerTotalTasks;

      // Build owner summary
      const ownerTasksByStatus: TasksByStatus[] = [];
      
      for (const [status, queueBreakdown] of Object.entries(statusBreakdowns)) {
        const total = Object.values(queueBreakdown).reduce((sum, count) => sum + count, 0);
        if (total > 0) {
          ownerTasksByStatus.push({
            status,
            task_queues: queueBreakdown,
            total
          });
        }
      }

      if (ownerTotalTasks > 0) {
        ownerSummaries.push({
          owner_id: owner.owner_id,
          tasks: ownerTasksByStatus,
          total_tasks: ownerTotalTasks
        });
      }
    }

    // Build response
    const response: TaskSummaryResponse = {
      task_summary: {
        owners: ownerSummaries,
        grand_totals: {
          by_status: grandTotalsByStatus,
          by_task_queue: grandTotalsByQueue,
          total_all_tasks: grandTotalAllTasks
        }
      }
    };

    // Add owner header summary if requested
    if (owner_id) {
      const ownerTasks = tasks?.filter(t => t.hubspot_owner_id === owner_id) || [];
      let completedTodayCount = 0;
      let overdueCount = 0;

      for (const task of ownerTasks) {
        // Check completed today
        if (task.hs_task_status === 'COMPLETED' && task.hs_task_completion_date) {
          const completionDate = new Date(task.hs_task_completion_date);
          const completionParis = completionDate.toLocaleString("en-US", { timeZone: "Europe/Paris" });
          const completionParisDate = new Date(completionParis).toISOString().split('T')[0];
          
          if (completionParisDate === parisToday) {
            completedTodayCount++;
          }
        }

        // Check overdue (NOT_STARTED or WAITING with past due date)
        if ((task.hs_task_status === 'NOT_STARTED' || task.hs_task_status === 'WAITING') && task.hs_timestamp) {
          const dueDate = new Date(task.hs_timestamp);
          if (dueDate < now) {
            overdueCount++;
          }
        }
      }

      response.owner_header_summary = {
        completed_today_count: completedTodayCount,
        overdue_count: overdueCount
      };
    }

    console.log(`Task summary generated:`, {
      team_id,
      owner_count: ownerSummaries.length,
      total_tasks: grandTotalAllTasks,
      owner_header_summary: response.owner_header_summary
    });

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in team-task-summary:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});