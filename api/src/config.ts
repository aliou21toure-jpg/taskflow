import { z } from "zod";

const bool = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** How long a login lasts before the user must sign in again. */
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24 * 7),
  /** Send the session cookie over HTTPS only. Defaults to true in production. */
  COOKIE_SECURE: bool,
  /** Login/register attempts allowed per IP address per 15 minutes. */
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).default(20),
});

export type Config = Omit<z.infer<typeof EnvSchema>, "COOKIE_SECURE"> & { COOKIE_SECURE: boolean };

/** Parse and validate environment variables once, failing fast on bad config. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n  ${issues.join("\n  ")}`);
  }
  const c = parsed.data;
  return { ...c, COOKIE_SECURE: c.COOKIE_SECURE ?? c.NODE_ENV === "production" };
}
