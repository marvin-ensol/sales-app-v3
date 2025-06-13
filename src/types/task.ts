
export type TaskStatus = "not_started" | "in_progress" | "waiting" | "completed" | "deferred";

export type TaskQueue = "new" | "attempted" | "other";

export interface Task {
  id: string;
  title: string;
  description?: string;
  contact: string;
  contactId: string | null;
  status: TaskStatus;
  dueDate: string;
  priority: "high" | "medium" | "low";
  owner: string;
  hubspotId?: string;
  queue: TaskQueue;
  queueIds?: string[];
}
