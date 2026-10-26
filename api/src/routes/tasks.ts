import { Router } from "express";
import { HttpError } from "../lib/errors.js";
import type { TaskRepository } from "../lib/taskRepository.js";
import {
  CreateTaskSchema,
  ListTasksQuerySchema,
  TaskIdSchema,
  UpdateTaskSchema,
} from "../lib/validation.js";
import { currentUser } from "../middleware/auth.js";

/**
 * Routes stay thin: validate input → call the repository → shape the response.
 * The router is mounted behind requireAuth, and every repository call is scoped to
 * the signed-in user, so one user can never read or change another user's tasks.
 * A task that belongs to someone else returns 404, exactly like one that doesn't exist,
 * so its existence is not revealed either.
 * Express 5 forwards rejected promises to the error handler automatically.
 */
export function tasksRouter(repo: TaskRepository): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const input = CreateTaskSchema.parse(req.body);
    const task = await repo.create(currentUser(req).id, input);
    res.status(201).location(`/tasks/${task.id}`).json(task);
  });

  router.get("/", async (req, res) => {
    const query = ListTasksQuerySchema.parse(req.query);
    const { items, total } = await repo.list(currentUser(req).id, query);
    res.json({ items, total, limit: query.limit, offset: query.offset });
  });

  router.get("/stats", async (req, res) => {
    res.json(await repo.stats(currentUser(req).id));
  });

  router.get("/:id", async (req, res) => {
    const id = TaskIdSchema.parse(req.params.id);
    const task = await repo.findById(currentUser(req).id, id);
    if (!task) throw new HttpError(404, "Task not found");
    res.json(task);
  });

  router.patch("/:id", async (req, res) => {
    const id = TaskIdSchema.parse(req.params.id);
    const patch = UpdateTaskSchema.parse(req.body);
    const task = await repo.update(currentUser(req).id, id, patch);
    if (!task) throw new HttpError(404, "Task not found");
    res.json(task);
  });

  router.delete("/:id", async (req, res) => {
    const id = TaskIdSchema.parse(req.params.id);
    const deleted = await repo.delete(currentUser(req).id, id);
    if (!deleted) throw new HttpError(404, "Task not found");
    res.status(204).end();
  });

  return router;
}
