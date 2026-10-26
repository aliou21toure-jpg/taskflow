import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Db } from "./db.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { SessionRepository } from "./lib/sessionRepository.js";
import { TaskRepository } from "./lib/taskRepository.js";
import { UserRepository } from "./lib/userRepository.js";
import { requireAuth } from "./middleware/auth.js";
import { requireSameOrigin } from "./middleware/sameOrigin.js";
import { authRouter } from "./routes/auth.js";
import { tasksRouter } from "./routes/tasks.js";

export interface AppOptions {
  db: Db;
  logLevel?: string;
  /** Mark the session cookie Secure (HTTPS only). On in production. */
  cookieSecure?: boolean;
  sessionTtlHours?: number;
  authRateLimit?: number;
  /** Extra origins allowed to make write requests (the API's own origin is always allowed). */
  trustedOrigins?: string[];
}

/**
 * Build the Express app without starting a server.
 * Tests import this directly; server.ts adds the network listener.
 *
 * The React app is served from the same origin as the API (a dev-server proxy locally,
 * nginx in Docker, a rewrite on Vercel), so no CORS is needed and the session cookie
 * stays first-party.
 */
export function createApp({
  db,
  logLevel = "info",
  cookieSecure = false,
  sessionTtlHours = 24 * 7,
  authRateLimit = 20,
  trustedOrigins = [],
}: AppOptions): Express {
  const app = express();
  const sessions = new SessionRepository(db, sessionTtlHours);
  const auth = requireAuth(sessions);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(pinoHttp({ level: logLevel, redact: ["req.headers.cookie", 'res.headers["set-cookie"]'] }));
  app.use(express.json({ limit: "100kb" }));
  app.use(requireSameOrigin(trustedOrigins));
  // Authenticated responses are per-user: never let a browser or proxy cache them.
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/health", async (_req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.use(
    "/auth",
    authRouter({
      users: new UserRepository(db),
      sessions,
      requireAuth: auth,
      cookieSecure,
      rateLimitPerWindow: authRateLimit,
    }),
  );
  app.use("/tasks", auth, tasksRouter(new TaskRepository(db)));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
