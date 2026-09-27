# Deployment

Free-tier setup: **Neon** (PostgreSQL) + **Render** (API) + **Vercel** (frontend).
Deploy in this order: database → backend → frontend → connect them.

## 1. Database (Neon)

1. Create a Neon project and copy the **pooled** connection string from **Connect > Node.js**.
2. Keep it private; it becomes `DATABASE_URL`. Tables are created by the API on first start
   (`sequelize.sync()`).

## 2. Backend (Render)

The repository includes a [render.yaml](render.yaml) Blueprint.

1. On Render choose **New > Blueprint**, select this repository, and apply `render.yaml`.
2. When prompted, enter `DATABASE_URL` (Neon string) and `CLIENT_URL` (use
   `http://localhost:5173` for now; it is updated in step 4). `JWT_SECRET` is generated.
3. Wait for `Hospital API listening on port ...`, then open `https://<service>.onrender.com/health`.

Manual alternative (**New > Web Service**): leave Root Directory empty and use
- Build: `npm ci --workspace backend --include=dev && npm run build --workspace backend`
- Start: `npm start --workspace backend`
- Env: `NODE_ENV=production`, `NODE_VERSION=22`, `DATABASE_SSL=true`, `DATABASE_URL`,
  `JWT_SECRET` (32+ random bytes), `CLIENT_URL`. Do not set `PORT`; Render provides it.

`--include=dev` is required because `NODE_ENV=production` otherwise skips TypeScript.

## 3. Frontend (Vercel)

1. Import the repository in Vercel and set **Root Directory** to `frontend` (preset: Vite).
2. Add `VITE_API_URL=https://<service>.onrender.com/api` and deploy.
   `VITE_*` values are baked in at build time, so redeploy after changing them.
3. [frontend/vercel.json](frontend/vercel.json) rewrites all routes to `index.html` for React Router.

## 4. Connect frontend and API

Set `CLIENT_URL` on Render to the exact Vercel origin (for example
`https://hospital.vercel.app`, no trailing slash). This is the only origin CORS allows.

## 5. First administrator

Anonymous registration is disabled. From your machine, with `backend/.env` pointing
`DATABASE_URL` at the Neon database:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='admin123' npm run create-admin --workspace backend
```

(PowerShell: `$env:ADMIN_EMAIL='...'; $env:ADMIN_PASSWORD='...'; npm run create-admin --workspace backend`.)
Optional: `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`. The script does nothing if the email exists.

## Free-tier limitations

- Render free services sleep after ~15 minutes idle; the first request then takes 30–60 s.
- Render's filesystem is ephemeral, so uploaded patient documents are stored in PostgreSQL
  (`patient_documents` table) and survive restarts. For large volumes, use an object store instead.
- Render free instances may block outbound SMTP. If invitation emails fail, use an HTTP email
  API or deliver the token returned by `POST /api/users/invitations` manually.
- The API calls `sequelize.sync()`. Before production schema changes, switch to Sequelize CLI
  migrations and disable automatic synchronization.

## Security checklist

- Use a randomly generated secret of at least 32 bytes for `JWT_SECRET`.
- Restrict `CLIENT_URL` to the deployed frontend origin.
- Never commit the Neon connection string or expose it through `VITE_*` variables.
- Add an external object store and malware scanning for patient documents.
- Configure database backups, audit logging, and a secrets manager.
- A free-tier stack is suitable for demos, not real patient data.
