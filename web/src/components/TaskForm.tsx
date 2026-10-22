import { useState, type FormEvent } from "react";
import type { NewTask, TaskPriority } from "../types";

interface Props {
  onCreate: (task: NewTask) => Promise<void>;
}

export function TaskForm({ onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        priority,
        assignee: assignee.trim() || null,
        due_date: dueDate || null,
      });
      setTitle("");
      setAssignee("");
      setDueDate("");
      setPriority("medium");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} aria-label="New task">
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
      <input aria-label="Assignee" placeholder="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
      <input aria-label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <button type="submit" disabled={submitting || !title.trim()}>
        Add task
      </button>
    </form>
  );
}
