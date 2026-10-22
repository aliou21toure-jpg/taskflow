import { useCallback, useEffect, useState } from "react";
import { api, type ListParams } from "./api";
import { TaskForm } from "./components/TaskForm";
import { TaskItem } from "./components/TaskItem";
import { STATUS_LABELS, type NewTask, type Task, type TaskStatus } from "./types";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Record<TaskStatus, number>>({ todo: 0, in_progress: 0, done: 0 });
  const [filters, setFilters] = useState<ListParams>({ status: "", q: "", sort: "created_at" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([api.list(filters), api.stats()]);
      setTasks(list.items);
      setStats(s);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  // Wrap every mutation the same way: run it, surface errors, then refresh.
  const mutate = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleCreate = async (task: NewTask) => mutate(() => api.create(task))();
  const handleStatus = (id: string, status: TaskStatus) => void mutate(() => api.update(id, { status }))();
  const handleDelete = (id: string) => void mutate(() => api.remove(id))();

  return (
    <main className="app">
      <header>
        <h1>TaskFlow</h1>
        <ul className="stats" aria-label="Task counts">
          {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
            <li key={s}>
              <strong>{stats[s]}</strong> {STATUS_LABELS[s]}
            </li>
          ))}
        </ul>
      </header>

      <TaskForm onCreate={handleCreate} />

      <div className="filters">
        <input
          aria-label="Search"
          placeholder="Search…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <select
          aria-label="Filter by status"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as TaskStatus | "" }))}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort by"
          value={filters.sort}
          onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as ListParams["sort"] }))}
        >
          <option value="created_at">Newest</option>
          <option value="priority">Priority</option>
          <option value="due_date">Due date</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="empty">No tasks yet. Add one above.</p>
      ) : (
        <ul className="tasks">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} onStatusChange={handleStatus} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </main>
  );
}
