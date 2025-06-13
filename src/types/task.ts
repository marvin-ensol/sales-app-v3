
export type TaskStatus = "a-faire" | "communications" | "attempted" | "custom";

export interface Task {
  id: string;
  title: string;
  contact: string;
  status: TaskStatus;
  dueDate: string;
  priority: "high" | "medium" | "low";
  owner: string;
}
