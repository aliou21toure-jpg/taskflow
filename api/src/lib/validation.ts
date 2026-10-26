import { z } from "zod";

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

const title = z.string().trim().min(1, "title is required").max(200);
const description = z.string().trim().max(5000).nullable();
const assignee = z.string().trim().min(1).max(100).nullable();
const dueDate = z.iso.date("due_date must be YYYY-MM-DD").nullable();

export const CreateTaskSchema = z.strictObject({
  title,
  description: description.optional(),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  assignee: assignee.optional(),
  due_date: dueDate.optional(),
});

export const UpdateTaskSchema = z
  .strictObject({
    title: title.optional(),
    description: description.optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assignee: assignee.optional(),
    due_date: dueDate.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });

export const ListTasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignee: z.string().trim().min(1).max(100).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(["created_at", "due_date", "priority"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

export const RegisterSchema = z.strictObject({
  email,
  // Length is the strongest rule (NIST SP 800-63B); the upper bound caps hashing cost.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export const LoginSchema = z.strictObject({
  email,
  password: z.string().min(1, "password is required").max(128),
});

export const TaskIdSchema = z.uuid("id must be a valid UUID");

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type Credentials = z.infer<typeof LoginSchema>;
export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>;
