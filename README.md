# TapGro Marketing Backend

NestJS + MongoDB API for the TapGro salon social media feature.

| Area | Base path | Swagger |
|------|-----------|---------|
| Admin panel | `/api/backend/v1` | `/swagger/backend` |
| Customer app (business owners) | `/api/customer/v1` | `/swagger/customer` |
| Public (website / apps) | `/api/public/v1` | `/swagger/backend` |

## Customer app

- **Login:** `POST /auth/send-otp { mobile }` → `POST /auth/verify-otp { mobile, otp, name?, businessName? }` → Bearer `token` (+ `refreshToken`). First login creates the account.
- **OTP delivery:** SMS template `customer_login_otp` (needs SMS gateway + DLT id in Templates), WhatsApp template as fallback. `CUSTOMER_OTP_TEST_MODE=true` returns `devOtp` (never in production).
- **TapGro users:** admins import known TapGro Hub mobiles (`POST /api/backend/v1/tapgro-members/import`); matching customers get `isTapgroUser=true` on login. Admins can also set it per customer.
- **Channels:** `GET /platforms` lists only admin-enabled platforms with my connections; `POST /channels/connect` returns the Zernio `authUrl`; the browser returns to `socialProvider.customerRedirectUrl`.
- **Leads:** Meta Lead Gen leads arrive via the Zernio `lead.received` webhook on the customer's Facebook Page; plus manual leads, status, notes and follow-up.

## Quick start

```bash
npm install
cp .env.example .env   # fill DB_URL, ADMIN_JWT_* secrets, default admin
npm run seed           # permissions, Admin role + default admin, platforms, templates
npm run start:dev      # http://localhost:3000
```

Open `http://localhost:3000/swagger/backend` and call `POST /api/backend/v1/adminLogin`.
Then set SMTP under `PUT /settings` (`email` section) so password reset, welcome and support emails go out.

## Admin panel modules

| Module | What it does |
|--------|--------------|
| Auth | Login (locks 15 min after 5 wrong passwords), refresh token, logout, logout everywhere, forgot / reset password by emailed OTP |
| Admins | CRUD, enable/disable, set password, force logout, per-user permission overrides, login history |
| Roles / Permissions | Roles with create/view/edit/delete per module |
| Dashboard | Counts, last-24h logins and integration health, recent activity |
| Platforms | Social platforms salons can connect (Facebook, Instagram, Google Business…) |
| Plans | Subscription plans with prices, trial, features, limits (public pricing list) |
| Support | Tickets from the public contact form; assign, reply by email, internal notes |
| CMS | FAQs, banners (with schedule), pages (public read APIs) |
| Templates | Email / SMS / WhatsApp templates with `{{variables}}`, preview, test send |
| Notifications | Bell icon notifications, announcements to all admins |
| Upload | Images / PDF up to 5 MB (S3 or local `./uploads`) |
| Export | CSV / Excel for admins, audit trail, login history, tickets, logs, plans, platforms |
| Settings | Company, SMTP, SMS, WhatsApp, Zernio/Ayrshare, maintenance mode, app versions, legal pages |
| Integration logs | Every email / SMS / WhatsApp send and inbound webhook (kept 90 days) |
| Audit trail | Who changed what |

## Social channels (Zernio)

1. Create an API key at zernio.com → `PUT /settings` with
   `socialProvider: { enabled: true, provider: "zernio", apiKey, webhookSecret, panelRedirectUrl, brandName }`.
2. Set `APP_BASE_URL` in `.env` to the public URL of this API.
3. `POST /social/provider/test` — checks the key and returns the `callbackUrl` and `webhookUrl`.
4. In the Zernio dashboard add a webhook to `webhookUrl` with the same secret, events `account.connected` + `account.disconnected`.
5. `POST /social/profile` (one per brand / salon) → `POST /social/profile/:id/connect { platform }` → open `authUrl`.
   The browser comes back to `panelRedirectUrl?social_connect=success|error&channelId=…`; or poll `GET /social/connect/:session`.
6. `POST /social/channel/:id/test` — `mode: "health"` (safe) or `mode: "post"` (real post, needs `confirmPublish: true`).

Only platforms marked active under Platforms can be connected (Facebook, Instagram, Google Business, Meta Ads by default).

## Public APIs (`/api/public/v1`)

`GET settings` is at `/api/backend/v1/settings/public`. Others: `GET legal`, `GET faqs`, `GET banners`, `GET pages/:slug`, `GET plans`, `POST support`, `POST webhooks/:provider`.

## Permissions

Routes are guarded with `@RequirePermissions('<action>:<slug>')`, e.g. `read:platform`, `update:settings`.
Actions: `create` · `read` · `update` · `delete`. Slugs live in `src/utils/permission-modules.constants.ts`.
The `Admin` role bypasses checks. Effective permissions = role permissions OR per-user overrides.

## Security notes

- Access tokens carry a `tokenVersion`; password change/reset, disabling an admin and "logout everywhere" revoke all existing tokens.
- Refresh tokens and reset OTPs are stored only as SHA-256 hashes.
- Rate limit: 300 req/min/IP globally, 10/min on login, forgot/reset password and the public support form. Set `TRUST_PROXY` behind a proxy.
- Secrets in settings are returned as `********`; sending `********` or blank keeps the stored value.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Dev server with watch |
| `npm run build` / `npm run start:prod` | Production |
| `npm run seed` | Seed everything (safe to re-run, never overwrites admin edits) |
| `npm run seed:admin` / `npm run seed:platform` | Seed one part |
