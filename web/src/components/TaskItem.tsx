import { STATUS_LABELS, type Task, type TaskStatus } from "../types";

interface Props {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onStatusChange, onDelete }: Props) {
  const overdue = task.due_date !== null && task.status !== "done" && task.due_date < today();
  return (
    <li className={`task task--${task.status}`}>
      <span className={`badge badge--${task.priority}`}>{task.priority}</span>
      <div className="task__body">
        <span className="task__title">{task.title}</span>
        <span className="task__meta">
          {task.assignee && <>@{task.assignee}</>}
          {task.due_date && <span className={overdue ? "overdue" : undefined}> · due {task.due_date}</span>}
        </span>
      </div>
      <select
        aria-label={`Status of ${task.title}`}
        value={task.status}
        onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button className="icon" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task.id)}>
        ✕
      </button>
    </li>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
