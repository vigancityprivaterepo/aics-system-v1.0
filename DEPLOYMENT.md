# AICS Production Deployment

This repository is prepared for a first production deployment on a single server using Docker images, with Dokploy managing service startup, domains, SSL, and secrets.

## Services

- `backend`
  - Container port: `5001`
  - Persistent volume: `/app/uploads`
  - Health endpoints:
    - `/api/health/live`
    - `/api/health/ready`
- `frontend`
  - Container port: `80`
  - Serves the staff UI and proxies `/api` and `/uploads` to the backend service
- `portal`
  - Container port: `80`
  - Serves the applicant portal and proxies `/api` and `/uploads` to the backend service
- `postgres`
  - Use Dokploy-managed Postgres for production
  - Keep regular backups enabled in Dokploy or your hosting layer

## Recommended domains

- Staff frontend: `https://aics-admin.example.gov.ph`
- Portal frontend: `https://aics-portal.example.gov.ph`
- Backend/API: `https://aics-api.example.gov.ph`

If you deploy the frontend and portal separately, keep `CORS_ORIGIN` aligned with the real frontend and portal domains. `API_BASE_URL` must point to the real backend public URL.

## Backend environment variables

Set these in Dokploy secrets/environment:

- `NODE_ENV=production`
- `PORT=5001`
- `DATABASE_URL`
- `API_BASE_URL`
- `CORS_ORIGIN`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORTAL_JWT_SECRET`
- `PORTAL_JWT_EXPIRES_IN`
- `DOCUMENT_VERIFY_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SEMAPHORE_API_KEY`
- `SEMAPHORE_SENDER_ID`
- `TRUST_PROXY=true`
- `RATE_LIMIT_MODE=memory`
- Optional:
  - `LIBREOFFICE_PATH`
  - `PORTAL_EMAIL_NOTIFICATION_STATUSES`
  - `ANTHROPIC_API_KEY`
  - `ANTHROPIC_MODEL`

## Dokploy setup

### Backend

- Build context: `backend`
- Dockerfile: `backend/Dockerfile`
- Mount a persistent volume to `/app/uploads`
- Expose port `5001`
- Health check path: `/api/health/ready`
- The container command already runs `npx prisma migrate deploy && node dist/server.js`

### Frontend

- Build context: `frontend`
- Dockerfile: `frontend/Dockerfile`
- Expose port `80`
- Route the staff domain to this service

### Portal

- Build context: `portal`
- Dockerfile: `portal/Dockerfile`
- Expose port `80`
- Route the portal domain to this service

### Postgres

- Use Dokploy-managed Postgres
- Point `DATABASE_URL` at that Postgres instance
- Enable scheduled backups before go-live

## Operational notes

- The backend will fail fast in production if SMTP or SMS configuration is missing.
- Uploads and generated documents live on the backend volume and must be included in backup strategy.
- Prisma migrations are committed and should be applied with `prisma migrate deploy`.
- Do not run the backend with multiple instances while `RATE_LIMIT_MODE=memory`.
