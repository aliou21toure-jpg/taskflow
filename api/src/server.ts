import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db.js";

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
const app = createApp({
  db: pool,
  logLevel: config.LOG_LEVEL,
  cookieSecure: config.COOKIE_SECURE,
  sessionTtlHours: config.SESSION_TTL_HOURS,
  authRateLimit: config.AUTH_RATE_LIMIT,
});
// Behind a reverse proxy (nginx, a PaaS load balancer) trust its X-Forwarded-* headers,
// so req.ip (rate limiting) and req.protocol (origin check) are correct.
app.set("trust proxy", 1);

const server = app.listen(config.PORT, () => {
  console.log(`TaskFlow API listening on http://localhost:${config.PORT}`);
});

// Graceful shutdown: stop accepting requests, finish in-flight ones, close the pool.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
