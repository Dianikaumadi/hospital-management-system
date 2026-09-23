# Deployment

## Backend

1. Create a Neon project and copy the **pooled** connection string from **Connect > Node.js**.
   Keep `?sslmode=verify-full` and set `DATABASE_SSL=true`.
2. Set `DATABASE_URL`, a strong `JWT_SECRET`, `CLIENT_URL`, and `NODE_ENV=production`.
3. Run `npm ci` at the repository root and `npm run build --workspace backend`.
4. Run `npm start --workspace backend`. Put the process behind HTTPS (Render, Railway,
   Fly.io, or a managed VM with a reverse proxy are suitable).
5. Use a managed object store for uploads in production and replace the local `uploads/`
   disk adapter with its provider adapter.

The API calls `sequelize.sync()` for the initial release. Before production schema changes,
replace this with Sequelize CLI migrations and disable automatic synchronization.

Neon provides PostgreSQL storage and backups. Configure the Neon project branch, compute
scaling, and network access according to your deployment environment. Never commit the Neon
connection string or expose it through frontend variables.

## Frontend

1. Set `VITE_API_URL` to the public API URL.
2. Run `npm run build --workspace frontend`.
3. Publish `frontend/dist` as a static site (Vercel, Netlify, S3/CloudFront, or Nginx).
4. Configure the host to fall back to `index.html` for React Router routes.

## Security checklist

- Use a randomly generated secret of at least 32 bytes for `JWT_SECRET`.
- Restrict `CLIENT_URL` to the deployed frontend origin.
- Enable HTTPS and secure database networking.
- Add an external object store and malware scanning for patient documents.
- Configure database backups, audit logging, and a secrets manager.
