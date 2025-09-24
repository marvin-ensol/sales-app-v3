import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CleanupResult {
  task_sync_attempts_deleted: number;
  sync_executions_deleted: number;
  duration_ms: number;
  cutoff_date: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('=== CLEANUP OLD SYNC DATA START ===');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate cutoff date (5 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 5);
    const cutoffIsoString = cutoffDate.toISOString();
    
    console.log(`🗑️ Cleaning up records older than: ${cutoffIsoString}`);

    // First, delete from task_sync_attempts (child records)
    console.log('🔍 Counting task_sync_attempts to delete...');
    const { count: taskSyncCount } = await supabase
      .from('task_sync_attempts')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffIsoString);

    console.log(`📊 Found ${taskSyncCount || 0} task_sync_attempts records to delete`);

    const { error: taskSyncError } = await supabase
      .from('task_sync_attempts')
      .delete()
      .lt('created_at', cutoffIsoString);

    if (taskSyncError) {
      throw new Error(`Failed to delete task_sync_attempts: ${taskSyncError.message}`);
    }

    console.log(`✅ Deleted ${taskSyncCount || 0} task_sync_attempts records`);

    // Then, delete from sync_executions (parent records)
    console.log('🔍 Counting sync_executions to delete...');
    const { count: syncExecCount } = await supabase
      .from('sync_executions')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffIsoString);

    console.log(`📊 Found ${syncExecCount || 0} sync_executions records to delete`);

    const { error: syncExecError } = await supabase
      .from('sync_executions')
      .delete()
      .lt('created_at', cutoffIsoString);

    if (syncExecError) {
      throw new Error(`Failed to delete sync_executions: ${syncExecError.message}`);
    }

    console.log(`✅ Deleted ${syncExecCount || 0} sync_executions records`);

    const duration = Date.now() - startTime;
    const result: CleanupResult = {
      task_sync_attempts_deleted: taskSyncCount || 0,
      sync_executions_deleted: syncExecCount || 0,
      duration_ms: duration,
      cutoff_date: cutoffIsoString
    };

    console.log('=== CLEANUP COMPLETE ===');
    console.log(`🕒 Total duration: ${duration}ms`);
    console.log(`📊 Total records deleted: ${(taskSyncCount || 0) + (syncExecCount || 0)}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    
    return new Response(JSON.stringify({
      error: (error as Error)?.message || 'Unknown error',
      duration_ms: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});