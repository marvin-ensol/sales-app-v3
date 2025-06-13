
export type TaskStatus = "not_started" | "in_progress" | "waiting" | "completed" | "deferred";

export interface Task {
  id: string;
  title: string;
  contact: string;
  status: TaskStatus;
  dueDate: string;
  priority: "high" | "medium" | "low";
  owner: string;
  hubspotId?: string;
}
