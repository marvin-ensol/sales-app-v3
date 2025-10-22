import { EnrichedEvent, ErrorLog } from "@/types/event";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckSquare, Clock, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsers } from "@/hooks/useUsers";

interface EventRowExpandedProps {
  event: EnrichedEvent;
}

export const EventRowExpanded = ({ event }: EventRowExpandedProps) => {
  const { logs } = event;
  const { owners } = useUsers();

  // Fetch error logs if there are errors
  const { data: errorLogs, isLoading: errorLogsLoading } = useQuery({
    queryKey: ['error-logs', event.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ErrorLog[];
    },
    enabled: event.error_count > 0,
  });

  // Fetch task categories for mapping queue IDs to names
  const { data: taskCategories } = useQuery({
    queryKey: ['task-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_categories')
        .select('id, hs_queue_id, label, color')
        .order('order_column');
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // 5 minutes
  });

  // Helper functions
  const getCategoryName = (queueId: string | null) => {
    if (!queueId) return '-';
    const category = taskCategories?.find(cat => cat.hs_queue_id === queueId);
    return category?.label || queueId;
  };

  const getTaskOwnerDisplay = (ownerId: string | null) => {
    if (!ownerId) return '-';
    const owner = owners?.find(o => o.id === ownerId || o.ownerId === ownerId);
    if (!owner) return '-';
    if (owner.firstName && owner.lastName) {
      return `${owner.firstName} ${owner.lastName.charAt(0)}.`;
    }
    return ownerId;
  };

  const formatTaskDueDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const buildTaskUrl = (contactId: string, taskId: string) => {
    return `https://app-eu1.hubspot.com/contacts/142467012/contact/${contactId}/?engagement=${taskId}`;
  };

  // Sort tasks by due date ascending
  const sortedTasks = logs.task_updates?.eligible_tasks 
    ? [...logs.task_updates.eligible_tasks].sort((a, b) => {
        return new Date(a.hs_timestamp).getTime() - new Date(b.hs_timestamp).getTime();
      })
    : [];

  return (
    <div className="space-y-4 p-4 bg-muted/30">
      {/* Task Updates Section */}
      {logs.task_updates && logs.task_updates.eligible_tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Task Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Eligible Tasks Table */}
            {logs.task_updates.eligible_tasks.length > 0 && (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Due Date</TableHead>
                      <TableHead>Task name</TableHead>
                      <TableHead>Task ID</TableHead>
                      <TableHead>Task Category</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Update Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {task.status === 'overdue' ? (
                              <div className="flex-shrink-0 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                                <AlertCircle className="h-3 w-3 text-white" />
                              </div>
                            ) : (
                              <div className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                                <Clock className="h-3 w-3 text-white" />
                              </div>
                            )}
                            <span className="text-xs">{formatTaskDueDate(task.hs_timestamp)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {task.hs_task_subject || '-'}
                        </TableCell>
                        <TableCell>
                          {event.hs_contact_id ? (
                            <a
                              href={buildTaskUrl(event.hs_contact_id, task.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs hover:underline text-primary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <CheckSquare className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>{task.id}</span>
                            </a>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CheckSquare className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>{task.id}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {getCategoryName(task.hs_queue_membership_ids)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {getTaskOwnerDisplay(task.hubspot_owner_id)}
                        </TableCell>
                        <TableCell>
                          {task.hs_update_successful === null && (
                            <Badge variant="outline" className="text-xs">Not applicable</Badge>
                          )}
                          {task.hs_update_successful === true && (
                            <Badge className="text-xs bg-green-500 text-white hover:bg-green-600">Success</Badge>
                          )}
                          {task.hs_update_successful === false && (
                            <Badge variant="destructive" className="text-xs">Failed</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Details Section */}
      {event.error_count > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Error Details ({event.error_count})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {errorLogsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
              </div>
            ) : errorLogs && errorLogs.length > 0 ? (
              <div className="space-y-3">
                {errorLogs.map((error) => (
                  <div key={error.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="destructive">{error.error_type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(error.created_at).toLocaleString()}
                      </span>
                    </div>
                    {error.endpoint && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Endpoint:</span>{' '}
                        <code className="bg-muted px-1 py-0.5 rounded">{error.endpoint}</code>
                      </div>
                    )}
                    {error.status_code && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Status Code:</span>{' '}
                        <Badge variant="outline">{error.status_code}</Badge>
                      </div>
                    )}
                    {error.response_message && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Message:</span>{' '}
                        <span>{error.response_message}</span>
                      </div>
                    )}
                    {error.response_error && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Error:</span>{' '}
                        <pre className="mt-1 bg-muted p-2 rounded text-xs overflow-auto">
                          {error.response_error}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No error details available</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
