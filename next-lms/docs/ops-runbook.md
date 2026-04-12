# Operations Runbook

This runbook documents the 5 production-safety additions:

1. Notification dedupe/throttle
2. Admin audit logs
3. Health endpoint
4. Backup/restore commands
5. E2E smoke flow

## 1) Notification dedupe/throttle

- Location: `src/lib/server/notifications.js`
- Behavior: repeated identical notifications (same `organization_id + type + title + message + recipient`) are suppressed during a window.
- Env:
  - `NOTIFICATION_DEDUPE_WINDOW_MS` (default `120000`)

## 2) Admin audit logs

- API:
  - `GET /api/admin/audit?limit=50&page=1&action=&entity=&search=`
  - `POST /api/admin/audit` (manual note)
- Storage:
  - Saved as `learning_assets` rows under `storagePath` prefix `__audit__/{organizationId}/...`
- Automatic hooks currently added for:
  - Groups: create/update/delete
  - Users: create/update/password reset/delete
  - Courses: create/update/delete
  - Sections: create/update/delete
- Retention env:
  - `AUDIT_LOG_RETENTION_DAYS` (default `180`)
  - `AUDIT_LOG_RETENTION_SWEEP_INTERVAL_MS` (default `21600000`)
- Access control env (optional):
  - `AUDIT_LOG_ALLOWED_USERS` (comma-separated usernames/emails)
  - `AUDIT_LOG_ALLOWED_USER_IDS` (comma-separated numeric user ids)
  - `AUDIT_LOG_SHOW_IN_MENU` (`true/false`, default `false`)

Behavior:

- If `AUDIT_LOG_ALLOWED_USERS` and `AUDIT_LOG_ALLOWED_USER_IDS` are empty, all admins can access.
- If either list is set, only matched admins can access `/api/admin/audit` and `/admin-dashboard/report/audit-log`.
- Menu item is hidden by default; enable explicitly with `AUDIT_LOG_SHOW_IN_MENU=true`.

## 3) Health endpoint

- API: `GET /api/health`
- Returns:
  - app status (`ok` or `degraded`)
  - database connectivity check
  - mail configuration availability
  - app URL visibility
- HTTP status:
  - `200` when healthy
  - `503` when degraded

## Security notes

- `CRON_SECRET` is required for `/api/cron/enrollment-expiry-reminders`.
  - If missing, endpoint returns `503` and will not run.
- `ALLOW_AUTH_SEED=true` now requires both:
  - `AUTH_SEED_TOKEN` (send via `x-seed-token` header)
  - `AUTH_SEED_ADMIN_PASSWORD` (minimum 12 chars)
- `POST /api/auth/forgot-password` always returns a generic success payload to reduce account enumeration risk.

## 4) Backup/restore

Use DB env variables:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Commands:

```bash
npm run backup:db
npm run backup:db -- --out ./backups/manual-2026-04-04.sql
npm run restore:db -- --file ./backups/manual-2026-04-04.sql
npm run restore:db -- --file ./backups/manual-2026-04-04.sql --force
```

Notes:

- Scripts require local MySQL client tools (`mysqldump`, `mysql`) to be installed and available in PATH.
- `restore` is destructive to current DB content.

## 5) E2E smoke flow

Command:

```bash
E2E_BASE_URL=http://127.0.0.1:8080 \
E2E_USERNAME=administrator \
E2E_PASSWORD=your_password \
npm run e2e:click
```

What it checks:

- Login flow works.
- Protected core pages load without HTTP 4xx/5xx.
- Page body does not show `Internal server error`.
