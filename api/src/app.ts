import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Db } from "./db.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { TaskRepository } from "./lib/taskRepository.js";
import { tasksRouter } from "./routes/tasks.js";

export interface AppOptions {
  db: Db;
  corsOrigin?: string;
  logLevel?: string;
}

/**
 * Build the Express app without starting a server.
 * Tests import this directly; server.ts adds the network listener.
 */
export function createApp({ db, corsOrigin, logLevel = "info" }: AppOptions): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(pinoHttp({ level: logLevel }));
  app.use(express.json({ limit: "100kb" }));

  // Minimal CORS so the React app (a different origin in dev) can call the API.
  if (corsOrigin) {
    app.use((req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", corsOrigin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  app.get("/health", async (_req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.use("/tasks", tasksRouter(new TaskRepository(db)));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
