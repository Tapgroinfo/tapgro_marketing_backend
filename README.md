# TapGro Marketing Backend

NestJS + MongoDB API for the TapGro salon social media feature.

| Area | Base path | Swagger |
|------|-----------|---------|
| Admin panel | `/api/backend/v1` | `/swagger/backend` |
| Public | `/api/public/v1` | — |

## Quick start

```bash
npm install
cp .env.example .env   # fill DB_URL, ADMIN_JWT_* secrets, default admin
npm run seed           # permissions, Admin role + default admin, platforms
npm run start:dev      # http://localhost:3000
```

Then open `http://localhost:3000/swagger/backend` and call `POST /api/backend/v1/adminLogin`.

## Modules

| Module | Purpose |
|--------|---------|
| `admin` | Login, refresh token, logout, profile, admin user CRUD |
| `role` | Roles with per-module create/view/edit/delete flags |
| `permission` | Permission module catalog (slugs used by roles) |
| `platform` | Social platforms salons can connect (Facebook, Instagram, Google Business…) |
| `settings` | Company, SMTP email, legal pages, social provider (Zernio / Ayrshare) |
| `auditTrail` | Read-only log of admin changes |

## Permissions

Routes are guarded with `@RequirePermissions('<action>:<slug>')`, e.g. `read:platform`, `update:settings`.
Actions: `create` · `read` · `update` · `delete`. Slugs are seeded from `src/utils/permission-modules.constants.ts`.
The `Admin` role bypasses checks. Effective permissions = role permissions OR per-user overrides.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Dev server with watch |
| `npm run build` / `npm run start:prod` | Production |
| `npm run seed` | Seed everything (safe to re-run) |
| `npm run seed:admin` / `npm run seed:platform` | Seed one part |
