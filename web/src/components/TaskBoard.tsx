import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type ListParams } from "../api";
import { STATUS_LABELS, type NewTask, type Task, type TaskPatch, type TaskStatus, type User } from "../types";
import { TaskForm } from "./TaskForm";
import { TaskItem } from "./TaskItem";

interface Props {
  user: User;
  onLogout: () => Promise<void>;
  /** Called when the server says the session is no longer valid. */
  onSessionExpired: () => void;
}

export function TaskBoard({ user, onLogout, onSessionExpired }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Record<TaskStatus, number>>({ todo: 0, in_progress: 0, done: 0 });
  const [filters, setFilters] = useState<ListParams>({ status: "", q: "", sort: "created_at" });
  const [query, setQuery] = useState<ListParams>(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Wait until typing pauses before searching, instead of one request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(filters), filters.q === query.q ? 0 : 250);
    return () => clearTimeout(t);
  }, [filters, query.q]);

  /** Run an API call; a 401 anywhere means the session ended, so go back to sign-in. */
  const guard = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) onSessionExpired();
        throw e;
      }
    },
    [onSessionExpired],
  );

  const load = useCallback(async () => {
    try {
      const [list, s] = await guard(() => Promise.all([api.list(query), api.stats()]));
      setTasks(list.items);
      setStats(s);
      setError(null);
    } catch (e) {
      setError(`Couldn't load your tasks: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [query, guard]);

  useEffect(() => {
    void load();
  }, [load]);

  // Mutations reject on failure so the component that started them can keep its state
  // (e.g. the new-task form keeps what was typed) and show the error in place.
  const handleCreate = async (task: NewTask) => {
    await guard(() => api.create(task));
    await load();
  };
  const handleUpdate = async (id: string, patch: TaskPatch) => {
    await guard(() => api.update(id, patch));
    await load();
  };
  const handleDelete = async (id: string) => {
    await guard(() => api.remove(id));
    await load();
  };

  return (
    <main className="app">
      <header>
        <div>
          <h1>TaskFlow</h1>
          <ul className="stats" aria-label="Task counts">
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <li key={s}>
                <strong>{stats[s]}</strong> {STATUS_LABELS[s]}
              </li>
            ))}
          </ul>
        </div>
        <div className="account">
          <span className="account__email">{user.email}</span>
          <button
            type="button"
            className="secondary"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              try {
                await onLogout();
              } catch (e) {
                setError(`Couldn't sign out: ${(e as Error).message}`);
                setLoggingOut(false);
              }
            }}
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      <TaskForm onCreate={handleCreate} />

      <div className="filters">
        <input
          aria-label="Search"
          type="search"
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
        <div role="alert" className="error banner">
          <span>{error}</span>
          <button type="button" className="secondary" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p role="status" className="loading">
          Loading your tasks…
        </p>
      ) : tasks.length === 0 ? (
        !error && (
          <p className="empty">
            {query.q || query.status ? "No tasks match these filters." : "No tasks yet. Add your first one above."}
          </p>
        )
      ) : (
        <ul className="tasks">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </main>
  );
}
