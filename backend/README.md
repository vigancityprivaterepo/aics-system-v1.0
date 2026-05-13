# AICS Backend

Express + TypeScript + Prisma backend for AICS.

## Local development

1. Copy `.env.example` to `.env` and set credentials.
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Run migrations: `npm run prisma:migrate`
5. Seed data if needed: `npm run prisma:seed`
6. Start the dev server: `npm run dev`

The seed script is for non-production use. In production, seeding is blocked unless `ALLOW_PRODUCTION_SEED=true` is explicitly set for a one-off action.

## Production contract

- Required in production: `DATABASE_URL`, `API_BASE_URL`, `CORS_ORIGIN`, `JWT_SECRET`, `PORTAL_JWT_SECRET`, `DOCUMENT_VERIFY_SECRET`, full SMTP config, and full Semaphore SMS config.
- Health endpoints:
  - `/api/health/live`
  - `/api/health/ready`
- Upload storage must be mounted persistently at `/app/uploads`.
- Production deployments must use `npm run prisma:deploy`, not `prisma migrate dev`.
- This backend currently uses in-memory rate limiting and must be deployed as a single backend instance until the limiter is externalized.

## Deployment

Use the root deployment assets:

- `backend/Dockerfile`
- `frontend/Dockerfile`
- `portal/Dockerfile`
- `docker-compose.yml`
- `DEPLOYMENT.md`
