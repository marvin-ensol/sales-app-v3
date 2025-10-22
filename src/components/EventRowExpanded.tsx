import { EnrichedEvent, ErrorLog } from "@/types/event";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface EventRowExpandedProps {
  event: EnrichedEvent;
}

export const EventRowExpanded = ({ event }: EventRowExpandedProps) => {
  const { logs } = event;

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

  return (
    <div className="space-y-4 p-4 bg-muted/30">
      {/* Call Summary Section */}
      {logs.call_details && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Call Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Call ID:</span>
              <a
                href={event.hubspot_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono flex items-center gap-1 hover:underline text-primary"
              >
                {logs.call_details.call_id}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Direction:</span>
              <Badge variant={logs.call_details.hs_call_direction === 'INBOUND' ? 'default' : 'secondary'}>
                {logs.call_details.hs_call_direction}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Duration:</span>
              <span className="text-sm">{logs.call_details.hs_call_duration}ms</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Updates Section */}
      {logs.task_updates && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Task Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Total Eligible</div>
                  <div className="text-lg font-semibold">{logs.task_updates.summary.total_eligible}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-xs text-muted-foreground">Successful</div>
                  <div className="text-lg font-semibold text-green-600">
                    {logs.task_updates.summary.total_update_successful}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                  <div className="text-lg font-semibold text-destructive">
                    {logs.task_updates.summary.total_update_unsuccessful}
                  </div>
                </div>
              </div>
            </div>

            {/* Eligible Tasks Table */}
            {logs.task_updates.eligible_tasks.length > 0 && (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Queue</TableHead>
                      <TableHead>Automation</TableHead>
                      <TableHead>Update Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.task_updates.eligible_tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-mono text-xs">{task.id}</TableCell>
                        <TableCell>
                          <Badge variant={task.status === 'overdue' ? 'destructive' : 'outline'}>
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(task.hs_timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">{task.hs_queue_membership_ids}</TableCell>
                        <TableCell>
                          {task.automation_enabled ? (
                            <Badge variant="secondary" className="text-xs">Enabled</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.hs_update_successful === true && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          {task.hs_update_successful === false && (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          {task.hs_update_successful === null && (
                            <span className="text-xs text-muted-foreground">N/A</span>
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
