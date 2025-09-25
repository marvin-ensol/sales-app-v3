export type TaskQueue = "rappels" | "new" | "simulations" | "communications" | "attempted" | "other";

export type TaskStatus = "not_started" | "completed";

export interface Task {
  id: string;
  title: string;
  description?: string;
  contact: string;
  contactId: string | null;
  contactPhone?: string | null;
  status: TaskStatus;
  dueDate: string;
  priority: "high" | "medium" | "low";
  owner: string;
  hubspotId: string;
  queue: TaskQueue;
  queueIds: string[];
  isUnassigned?: boolean;
  completionDate?: Date | null;
  hsTimestamp?: Date | null;
}
