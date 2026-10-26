import { useState, type FormEvent } from "react";
import { STATUS_LABELS, type Task, type TaskPatch, type TaskPriority, type TaskStatus } from "../types";

interface Props {
  task: Task;
  /** Resolve on success, reject with a user-facing message on failure. */
  onUpdate: (id: string, patch: TaskPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskItem({ task, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<null | "saving" | "deleting">(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "saving" | "deleting", fn: () => Promise<void>): Promise<boolean> {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (editing) {
    return (
      <li className="task task--editing">
        <EditForm
          task={task}
          saving={busy === "saving"}
          error={error}
          onCancel={() => {
            setEditing(false);
            setError(null);
          }}
          onSave={async (patch) => {
            if (await run("saving", () => onUpdate(task.id, patch))) setEditing(false);
          }}
        />
      </li>
    );
  }

  const overdue = task.due_date !== null && task.status !== "done" && task.due_date < today();
  return (
    <li className={`task task--${task.status}`} aria-busy={busy !== null}>
      <span className={`badge badge--${task.priority}`}>{task.priority}</span>
      <div className="task__body">
        <span className="task__title">{task.title}</span>
        {task.description && <span className="task__desc">{task.description}</span>}
        <span className="task__meta">
          {task.assignee && <>@{task.assignee}</>}
          {task.due_date && <span className={overdue ? "overdue" : undefined}> · due {task.due_date}</span>}
        </span>
        {error && (
          <span role="alert" className="error">
            {error}
          </span>
        )}
      </div>
      <select
        aria-label={`Status of ${task.title}`}
        value={task.status}
        disabled={busy !== null}
        onChange={(e) => void run("saving", () => onUpdate(task.id, { status: e.target.value as TaskStatus }))}
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button className="icon" aria-label={`Edit ${task.title}`} disabled={busy !== null} onClick={() => setEditing(true)}>
        ✎
      </button>
      <button
        className="icon"
        aria-label={`Delete ${task.title}`}
        disabled={busy !== null}
        onClick={() => void run("deleting", () => onDelete(task.id))}
      >
        {busy === "deleting" ? "…" : "✕"}
      </button>
    </li>
  );
}

interface EditProps {
  task: Task;
  saving: boolean;
  error: string | null;
  onSave: (patch: TaskPatch) => Promise<void>;
  onCancel: () => void;
}

function EditForm({ task, saving, error, onSave, onCancel }: EditProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void onSave({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assignee: assignee.trim() || null,
      due_date: dueDate || null,
    });
  }

  return (
    <form className="edit-form" onSubmit={handleSubmit} aria-label={`Edit task ${task.title}`}>
      <input aria-label="Edit title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        aria-label="Edit description"
        rows={2}
        maxLength={5000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="edit-form__row">
        <select aria-label="Edit priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input aria-label="Edit assignee" placeholder="Assignee" maxLength={100} value={assignee} onChange={(e) => setAssignee(e.target.value)} />
        <input aria-label="Edit due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="error">
          Couldn't save: {error}
        </p>
      )}
      <div className="edit-form__actions">
        <button type="submit" disabled={saving || !title.trim()}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
