# AICS Windows Server Production Deployment

This project is ready to deploy on a single Windows Server using Docker Desktop or Docker Engine with Linux containers.

## 1. Server prerequisites

Install these on the Windows Server:

- Git
- Docker Desktop or Docker Engine configured for Linux containers
- A domain or fixed server IP for staff, portal, and API access
- Existing server Nginx can keep public `80/443`. AICS should bind to localhost-only ports: backend `127.0.0.1:5101`, staff `127.0.0.1:8081`, portal `127.0.0.1:8082`.

## 2. Copy the project

On the server, clone or copy this repository, then open PowerShell in the `aics-system` folder.

## 3. Create production environment file

Copy the template:

```powershell
Copy-Item .env.production.example .env.production
```

Edit `.env.production` and replace every `CHANGE_ME` value.

Important values:

- `NODE_ENV=production`
- `POSTGRES_PASSWORD` must be strong
- `DATABASE_URL` password must match `POSTGRES_PASSWORD`
- `JWT_SECRET`, `PORTAL_JWT_SECRET`, and `DOCUMENT_VERIFY_SECRET` must all be different and at least 32 characters
- `API_BASE_URL` must be the real backend URL, not localhost
- `CORS_ORIGIN` must contain the staff and portal origins
- SMTP and Semaphore SMS values are required in production because the backend intentionally fails fast without them

Generate secrets in PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Run that command separately for each secret.

## 4. Build and start

```powershell
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

Check status:

```powershell
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 backend
```

The backend should show `AICS backend listening` and no production configuration errors.

## 5. Smoke test

Open these URLs using your configured server/domain:

- Staff UI: `http://SERVER:8081` or your staff domain
- Portal UI: `http://SERVER` or your portal domain
- Backend readiness: `http://SERVER:5101/api/health/ready`

Test before go-live:

- Staff login
- Create/edit client
- Create case
- Save case study details
- Generate DOCX preview/download
- Portal registration/login/application submission
- Admin backup creation


## Existing Nginx reverse proxy example

Your current server already uses Nginx on public `80/443`. Keep AICS containers bound to `127.0.0.1`, then add Nginx virtual hosts similar to this:

```nginx
server {
  server_name aics-admin.example.gov.ph;

  location / {
    proxy_pass http://127.0.0.1:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  server_name aics-portal.example.gov.ph;

  location / {
    proxy_pass http://127.0.0.1:8082;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  server_name aics-api.example.gov.ph;

  location / {
    proxy_pass http://127.0.0.1:5101;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
## 6. Backups

Docker volumes used by production compose:

- `aics_pg_data` for PostgreSQL data
- `aics_uploads` for uploaded files/signatures/documents
- `aics_backups` for app-generated backups

Back up all three volumes. Database backups alone are not enough because uploads live separately.

## 7. Updating later

After copying new code to the server:

```powershell
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

The backend container runs Prisma migrations automatically before starting.

## Production notes

- Do not deploy using `docker-compose.yml`; that file is for local/dev defaults.
- If another app already uses a port, change `BACKEND_PORT`, `FRONTEND_PORT`, or `PORTAL_PORT` in `.env.production` before running compose.
- Use `docker-compose.production.yml` with `.env.production`.
- Do not commit `.env.production`.
- Do not run multiple backend containers while `RATE_LIMIT_MODE=memory`.
- If using HTTPS/reverse proxy, keep `TRUST_PROXY=true`.
