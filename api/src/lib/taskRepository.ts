import type { Db } from "../db.js";
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from "./validation.js";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  assignee: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = "id, title, description, status, priority, assignee, due_date, created_at, updated_at";

// Column names can't be SQL parameters, so ORDER BY uses a fixed whitelist.
const SORT_SQL: Record<ListTasksQuery["sort"], string> = {
  created_at: "created_at",
  due_date: "due_date",
  priority: "CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END",
};

/**
 * All SQL for tasks lives here. Every value goes through a $n placeholder,
 * so user input is always sent to PostgreSQL as data, never as SQL.
 * Every method takes the owner's id and every statement filters on user_id,
 * so ownership is enforced in the query itself, not checked afterwards.
 */
export class TaskRepository {
  constructor(private readonly db: Db) {}

  async create(userId: string, input: CreateTaskInput): Promise<Task> {
    const { rows } = await this.db.query<Task>(
      `INSERT INTO tasks (user_id, title, description, status, priority, assignee, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNS}`,
      [
        userId,
        input.title,
        input.description ?? null,
        input.status,
        input.priority,
        input.assignee ?? null,
        input.due_date ?? null,
      ],
    );
    return rows[0]!;
  }

  async list(userId: string, q: ListTasksQuery): Promise<{ items: Task[]; total: number }> {
    const where: string[] = ["user_id = $1"];
    const params: unknown[] = [userId];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace("?", `$${params.length}`));
    };

    if (q.status) add("status = ?", q.status);
    if (q.priority) add("priority = ?", q.priority);
    if (q.assignee) add("assignee = ?", q.assignee);
    if (q.q) {
      params.push(`%${escapeLike(q.q)}%`);
      const n = `$${params.length}`;
      where.push(`(title ILIKE ${n} OR description ILIKE ${n})`);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const orderSql = `${SORT_SQL[q.sort]} ${q.order === "asc" ? "ASC" : "DESC"} NULLS LAST, id`;

    const total = await this.db.query<{ count: string }>(
      `SELECT count(*) FROM tasks ${whereSql}`,
      params,
    );
    const items = await this.db.query<Task>(
      `SELECT ${COLUMNS} FROM tasks ${whereSql}
       ORDER BY ${orderSql}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, q.offset],
    );
    return { items: items.rows, total: Number(total.rows[0]!.count) };
  }

  async findById(userId: string, id: string): Promise<Task | null> {
    const { rows } = await this.db.query<Task>(
      `SELECT ${COLUMNS} FROM tasks WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ?? null;
  }

  async update(userId: string, id: string, patch: UpdateTaskInput): Promise<Task | null> {
    const allowed = ["title", "description", "status", "priority", "assignee", "due_date"] as const;
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        params.push(patch[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    params.push(id, userId);
    const { rows } = await this.db.query<Task>(
      `UPDATE tasks SET ${sets.join(", ")}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING ${COLUMNS}`,
      params,
    );
    return rows[0] ?? null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.db.query("DELETE FROM tasks WHERE id = $1 AND user_id = $2", [
      id,
      userId,
    ]);
    return (rowCount ?? 0) > 0;
  }

  async stats(userId: string): Promise<Record<Task["status"], number>> {
    const { rows } = await this.db.query<{ status: Task["status"]; count: string }>(
      "SELECT status, count(*) FROM tasks WHERE user_id = $1 GROUP BY status",
      [userId],
    );
    const out = { todo: 0, in_progress: 0, done: 0 };
    for (const r of rows) out[r.status] = Number(r.count);
    return out;
  }
}

/** Escape LIKE wildcards so a search for "50%" matches literally. */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
