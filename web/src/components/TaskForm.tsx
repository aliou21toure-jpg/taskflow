import { useState, type FormEvent } from "react";
import type { NewTask, TaskPriority } from "../types";

interface Props {
  /** Resolves when the task is saved; rejects with a user-facing message otherwise. */
  onCreate: (task: NewTask) => Promise<void>;
}

export function TaskForm({ onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assignee: assignee.trim() || null,
        due_date: dueDate || null,
      });
      // Only clear the form once the server has saved the task.
      setTitle("");
      setDescription("");
      setAssignee("");
      setDueDate("");
      setPriority("medium");
    } catch (err) {
      setError(`Couldn't save the task: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} aria-label="New task">
      <div className="task-form__row">
        <input
          aria-label="Task title"
          placeholder="What needs doing?"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input aria-label="Assignee" placeholder="Assignee" maxLength={100} value={assignee} onChange={(e) => setAssignee(e.target.value)} />
        <input aria-label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <textarea
        aria-label="Description"
        placeholder="Details (optional)"
        rows={2}
        maxLength={5000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting || !title.trim()}>
        {submitting ? "Saving…" : "Add task"}
      </button>
    </form>
  );
}
