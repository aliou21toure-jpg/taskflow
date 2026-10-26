/**
 * Entry point for serverless hosting (Vercel). Serves the same Express app under /api,
 * so the React frontend and the API share one HTTPS origin and the cookie stays first-party.
 * See deploy/vercel/README.md.
 */
import express from "express";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db.js";

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
const root = express();
root.set("trust proxy", 1);
root.disable("x-powered-by");
root.use(
  "/api",
  createApp({
    db: pool,
    logLevel: config.LOG_LEVEL,
    cookieSecure: config.COOKIE_SECURE,
    sessionTtlHours: config.SESSION_TTL_HOURS,
    authRateLimit: config.AUTH_RATE_LIMIT,
  }),
);

export default root;
