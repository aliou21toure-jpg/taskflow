export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskList {
  items: Task[];
  total: number;
  limit: number;
  offset: number;
}

export type NewTask = Pick<Task, "title" | "priority"> &
  Partial<Pick<Task, "description" | "assignee" | "due_date" | "status">>;

export type TaskPatch = Partial<Pick<Task, "title" | "description" | "status" | "priority" | "assignee" | "due_date">>;

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};
