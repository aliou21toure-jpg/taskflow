# Deploying to Vercel

The hosted demo runs the React app and the API on **one HTTPS origin**: static files from
the Vite build, and the Express app as a single serverless function under `/api`. One origin
means the session cookie is first-party, `SameSite=Lax` blocks cross-site requests, and no
CORS configuration is needed.

```bash
sh deploy/vercel/prepare.sh      # assembles .vercel-build/ from api/src and web/
cd .vercel-build
vercel deploy --prod
```

`prepare.sh` copies `api/src` to `server/` and the web app to `web/`, alongside the files in
this folder (`api/index.ts`, `vercel.json`, `vite.config.js`, `package.json`).

## Environment variables

| Name | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (use the provider's connection pooler for serverless) |
| `COOKIE_SECURE` | Leave unset: it defaults to `true` because Vercel sets `NODE_ENV=production` |
| `VITE_DEMO_EMAIL`, `VITE_DEMO_PASSWORD` | Optional public demo account shown on the sign-in screen |

Run the SQL migrations in `api/sql/` against the database before the first deploy
(`npm run db:migrate` from `api/` with `DATABASE_URL` set).

The database role the app connects with owns only the TaskFlow tables. It is not a superuser
and cannot bypass row-level security.
