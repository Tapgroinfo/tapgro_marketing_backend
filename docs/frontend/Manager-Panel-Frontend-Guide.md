# TapGro Marketing — Manager Panel Frontend Guide

**Audience:** Admin / manager panel frontend team  
**Backend base:** `/api/backend/v1`  
**Auth header:** `Authorization: Bearer <admin token>`  
**Swagger:** `/swagger/backend`  
**Dev harness:** `/test/social/` → **Admin** tab  

Related: [Customer app guide](./Customer-Social-Frontend-Guide.md)

This doc is the complete manager-panel flow for phase 1: login → Zernio settings → platforms → customers → social profiles/channels → leads → dashboard / logs.

---

## 1. Panel map (screens to build)

| # | Screen | APIs |
|---|--------|------|
| 1 | Login | `POST /adminLogin` |
| 2 | Dashboard home | `GET /dashboard` |
| 3 | Settings → Social (Zernio) | `GET/PUT /settings`, `POST /social/provider/test` |
| 4 | Platforms | `GET/POST/PUT/DELETE /platforms`, `/platform/:id` |
| 5 | Customers | `GET /customers`, `/customer/:id`, status / TapGro flag, members import |
| 6 | Social profiles & channels | `/social/*` |
| 7 | Leads | `GET /leads`, `/lead/:id` |
| 8 | Integration logs | (existing integration log module) |
| 9 | Plans / CMS / Support | existing modules (out of social scope) |

---

## 2. Auth

`POST /api/backend/v1/adminLogin`

```json
{ "email": "admin@tapgro.com", "password": "********" }
```

```json
{
  "success": true,
  "token": "<JWT>",
  "refresh_token": "...",
  "user": { "id": "...", "name": "...", "email": "...", "role": { "id": "...", "name": "..." } }
}
```

- Store `token` → send as Bearer on every panel call.  
- Refresh: `POST /refreshToken` with `{ "refresh_token": "..." }` (see Swagger).  
- Permissions are role-based (`read:channel`, `update:settings`, …). Hide menu items the role cannot access; still handle **403**.

---

## 3. Settings — Zernio (required before connect)

`GET /api/backend/v1/settings`  
`PUT /api/backend/v1/settings`

Partial update example:

```json
{
  "socialProvider": {
    "enabled": true,
    "provider": "zernio",
    "apiKey": "sk_...",
    "webhookSecret": "...",
    "panelRedirectUrl": "https://admin.tapgro.com/social/callback",
    "customerRedirectUrl": "https://app.tapgro.com/social",
    "brandName": "TapGro",
    "logoUrl": "https://cdn…/logo.png"
  }
}
```

| Field | Panel UI |
|-------|----------|
| `enabled` | Toggle |
| `apiKey` | Password input; API returns masked — send `********` or omit to keep |
| `webhookSecret` | Same |
| `panelRedirectUrl` | **Must** be your admin OAuth return route |
| `customerRedirectUrl` | Customer app deep link / web route |
| `brandName` / `logoUrl` | Optional Zernio welcome screen |

**Test button:** `POST /api/backend/v1/social/provider/test`

Shows: API key valid, callback URL, webhook URL, Zernio vs local profile/channel counts.

**Ops must also set env** `APP_BASE_URL` (HTTPS) so callback is:

`{APP_BASE_URL}/api/public/v1/social/connect/callback`

Webhook (Zernio dashboard):

`{APP_BASE_URL}/api/public/v1/webhooks/zernio`

---

## 4. Platforms

| Method | Path |
|--------|------|
| GET | `/platforms` |
| POST | `/platform` |
| PUT | `/platform/:id` |
| GET | `/platform/:id` |
| DELETE | `/platform/:id` |

Seeded slugs managers care about for phase 1:

- `facebook`, `instagram`, `google_business`, `meta_ads` (active)  
- Others can stay inactive until later  

UI: list + enable/disable (`isActive`) + edit name/icon/capabilities. Customer app only shows **active** platforms.

Permissions: `read:platform`, `create:platform`, `update:platform`, `delete:platform`.

---

## 5. Customers

| Method | Path | Notes |
|--------|------|--------|
| GET | `/customers?search=&status=&isTapgroUser=` | Paginated |
| GET | `/customer/:id` | Includes `socialProfileId`, `channels`, `leadsByStatus` |
| PUT | `/customer/:id` | Profile fields |
| PATCH | `/customer/:id/status` | `{ "status": "blocked" \| "active" }` |
| PATCH | `/customer/:id/tapgro` | Mark Hub member |
| GET | `/tapgro-members` | Directory |
| POST | `/tapgro-members/import` | Bulk mobiles |
| DELETE | `/tapgro-member/:id` | |

**Customer detail actions (social):**

1. If `socialProfileId` is null → **Ensure profile** or **Connect Instagram** (helper APIs below).  
2. If profile exists → open profile detail / connect more platforms.  
3. Show channel status badges (`connected`, `needs_reconnect`, …).

---

## 6. Social profiles & channels (core manager flow)

**Base:** `/api/backend/v1/social`  
Permissions: `read:channel`, `create:channel`, `update:channel`, `delete:channel`

### 6.1 Profiles

| Method | Path |
|--------|------|
| GET | `/social/profiles?search=&isActive=&customerId=&page=&limit=` |
| POST | `/social/profile` |
| GET | `/social/profile/:id` |
| PUT | `/social/profile/:id` |
| DELETE | `/social/profile/:id` |
| POST | `/social/profile/:id/sync` |

**Create profile** (same shape as Zernio dashboard “Create new profile”)

```json
{
  "name": "Glow Salon — Andheri",
  "description": "Pilot salon",
  "color": "#F8A5A5",
  "timezone": "Asia/Kolkata",
  "externalRef": "hub:123",
  "customerId": "665f1c0a9e2b5af0012ab34cd"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `name` | Yes | Profile name |
| `description` | No | Optional |
| `color` | No | Hex `#RGB` / `#RRGGBB` |
| `timezone` | No | IANA; use `Asia/Kolkata` for India (`Asia/Calcutta` is normalized) |
| `customerId` | No | Link to customer app user (recommended) |

`customerId` is optional but recommended so the salon’s app and panel share one Zernio profile.

**Update** can set `customerId` or `null` to unlink.

### 6.2 Connect a platform (profile already known)

`POST /social/profile/:id/connect`

```json
{ "platform": "instagram" }
```

```json
{
  "success": true,
  "data": {
    "authUrl": "https://zernio.com/...",
    "session": "abc...",
    "expiresAt": "..."
  }
}
```

1. Open `authUrl` in a **new tab**.  
2. Poll `GET /social/connect/:session` until `connected` / `failed`.  
3. Browser returns to `panelRedirectUrl?social_connect=success|error&platform=&channelId=&session=&message=`.

### 6.3 Connect for a customer (manager assist) — preferred from Customer detail

| Method | Path |
|--------|------|
| POST | `/social/customers/:customerId/ensure-profile` |
| POST | `/social/customers/:customerId/connect` |

```json
{ "platform": "google_business" }
```

Creates the linked Zernio profile if missing, then returns `authUrl`. OAuth returns to **panel** redirect (not customer app).

**UI flow on Customer detail:**

```
[Connect Instagram] [Connect Google] [Connect Facebook]
  → POST .../customers/:id/connect { platform }
  → window.open(authUrl)
  → on return / poll → refresh customer detail
```

### 6.4 Channels

| Method | Path |
|--------|------|
| GET | `/social/channels?profileId=&platform=&status=` |
| GET | `/social/channel/:id` |
| POST | `/social/channel/:id/test` |
| DELETE | `/social/channel/:id` |
| GET | `/social/summary` |
| POST | `/social/sync` | Sync all active profiles |

**Health (safe):**

```json
{ "mode": "health" }
```

**Live test post (QA only):**

```json
{
  "mode": "post",
  "content": "TapGro panel test",
  "confirmPublish": true,
  "mediaUrl": "https://…/image.jpg",
  "mediaType": "image"
}
```

### 6.5 OAuth return page (admin)

Route = `panelRedirectUrl`, e.g. `/social/callback`

```ts
const q = new URLSearchParams(location.search);
if (q.get('social_connect') === 'success') {
  // toast + refresh profile/channels
} else if (q.get('social_connect') === 'error') {
  // toast q.get('message')
}
```

---

## 7. Leads (manager view)

| Method | Path |
|--------|------|
| GET | `/leads?customerId=&status=&source=&platform=&search=` |
| GET | `/lead/:id` |

List response includes a `summary` object. Meta lead ads appear when the salon’s Facebook Page is connected and lead forms fire webhooks.

---

## 8. Dashboard

`GET /dashboard` — home counts / recent health (use for panel landing).

---

## 9. Complete manager journeys

### Journey A — First-time Zernio setup
1. Login  
2. Settings → paste API key, set panel + customer redirect URLs, enable  
3. **Test provider** must succeed  
4. Confirm platforms Instagram / Google / Facebook are active  

### Journey B — Help a salon connect (pilot)
1. Customers → open salon  
2. **Connect Instagram** → `POST /social/customers/:id/connect`  
3. Salon owner logs in on Meta in the opened tab  
4. Return to panel callback → channel shows on customer  
5. Repeat for `google_business` / `facebook`  
6. Run **Health** on each channel  

### Journey C — Internal TapGro accounts
1. Create profile without customer (or with internal flag)  
2. `POST /social/profile/:id/connect`  
3. Use free Zernio slots for TapGro’s own Page / IG  

### Journey D — Reconnect
1. Channel `needs_reconnect`  
2. Same connect API again (`profile/.../connect` or `customers/.../connect`)  

---

## 10. Suggested menu & permissions

| Menu | Permission examples |
|------|---------------------|
| Dashboard | `read:dashboard` |
| Customers | `read:customer`, `update:customer` |
| Social profiles | `read:channel`, `create:channel`, … |
| Platforms | `read:platform`, `update:platform` |
| Leads | `read:lead` |
| Settings | `read:settings`, `update:settings` |
| Integration logs | `read:integrationLog` (or project equivalent) |

---

## 11. Error handling

| HTTP | UI |
|------|----|
| 401 | Re-login |
| 403 | “No permission” |
| 400 | Show `message` (e.g. customer already has profile) |
| 404 | Not found |
| 402 / provider payment | Zernio billing — show message + dashboard link if present |
| 502 | Provider unreachable |

---

## 12. Acceptance checklist (manager panel)

- [ ] Admin login + token refresh  
- [ ] Social settings form + masked secrets + Test provider  
- [ ] Platforms list enable/disable  
- [ ] Customers list/detail with TapGro flag + block  
- [ ] Ensure profile + connect-for-customer from customer detail  
- [ ] Profiles list filtered by `customerId`  
- [ ] OAuth new-tab + `panelRedirectUrl` callback page  
- [ ] Channel health / disconnect / sync  
- [ ] Leads list filtered by customer  
- [ ] Dashboard loads  

---

## 13. Local testing

1. `npm run start:dev`  
2. Lab: `http://localhost:<PORT>/test/social/` → **Admin** tab  
3. Or Swagger `/swagger/backend`  
4. Set `panelRedirectUrl` to your local admin callback or the lab URL  

---

**Note:** Frontend never calls Zernio directly. All social actions go through `/api/backend/v1/social/*` (SDK is wrapped server-side in `ZernioClient`).
