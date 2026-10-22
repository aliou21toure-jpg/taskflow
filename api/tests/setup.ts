import { existsSync } from "node:fs";

// Load .env.test locally; in CI the variables come from the workflow instead.
if (existsSync(".env.test")) process.loadEnvFile(".env.test");

const url = process.env.DATABASE_URL ?? "";
// Safety net: tests TRUNCATE tables, so refuse to run against a non-test database.
if (!/_test(\?|$)/.test(url)) {
  throw new Error(`Refusing to run tests: DATABASE_URL must point at a *_test database (got "${url}")`);
}
