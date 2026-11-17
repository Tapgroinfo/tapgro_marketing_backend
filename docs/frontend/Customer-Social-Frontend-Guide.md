# TapGro Marketing — Frontend Implementation Guide

**Audience:** Customer app + Admin panel frontend teams  
**Backend base:** `/api/customer/v1` (salon app) · `/api/backend/v1` (admin)  
**Swagger:** `/swagger/customer` · `/swagger/backend`  
**Dev test UI:** `/test/social/` (backend harness — not production UI)

This doc covers the **complete phase-1 flow**: OTP login → Zernio profile (auto) → connect Instagram / Google / Facebook → health check → leads. Posting / comments / DMs APIs come in a later phase; connect must work first.

---

## 1. Big picture

```
Salon opens app
    → OTP login (JWT)
    → Home / Platforms screen
    → Tap “Connect Instagram” (or Google / Facebook)
    → Backend creates Zernio profile if missing
    → Backend returns authUrl
    → App opens authUrl (in-app browser / new tab)
    → User logs in on Meta / Google and picks Page or location
    → Browser returns to customerRedirectUrl
       ?social_connect=success|error&platform=&channelId=&session=&message=
    → App polls connect session (optional) → refresh channels
    → Show connected account + “needs reconnect” if token dies later
```

| Concept | Meaning |
|--------|---------|
| **Customer** | Salon / business owner (OTP login) |
| **Social profile** | One Zernio profile per customer (created automatically on first connect) |
| **Platform** | `instagram`, `google_business`, `facebook`, `meta_ads`, … |
| **Channel** | One connected account on a platform (Page, IG pro, GBP location) |
| **Session** | Short-lived connect attempt id returned with `authUrl` |

---

## 2. Auth (customer app)

**Base:** `/api/customer/v1/auth`  
**Header after login:** `Authorization: Bearer <token>`  
**Swagger security name:** `customerBearerAuth`

### 2.1 Send OTP

`POST /api/customer/v1/auth/send-otp`

```json
{ "mobile": "9876543210" }
```

**Response (shape):**

```json
{
  "success": true,
  "message": "OTP sent",
  "data": {
    "mobile": "******3210",
    "isNewCustomer": true,
    "expiresIn": 300,
    "resendAfter": 30,
    "deliveredVia": "sms",
    "devOtp": "123456"
  }
}
```

- `isNewCustomer: true` → show **Name** + **Business name** on the next screen.  
- `devOtp` appears only when backend has `CUSTOMER_OTP_TEST_MODE=true` (local/QA).  
- Resend after `resendAfter` seconds; max 5 sends / hour.

### 2.2 Verify OTP → tokens

`POST /api/customer/v1/auth/verify-otp`

```json
{
  "mobile": "9876543210",
  "otp": "123456",
  "name": "Priya Sharma",
  "businessName": "Glow Salon"
}
```

`name` / `businessName` required for first signup UX (recommended).

**Response:**

```json
{
  "success": true,
  "message": "Account created",
  "token": "<access JWT>",
  "refreshToken": "<refresh>",
  "expiresIn": "7d",
  "data": {
    "isNewCustomer": true,
    "profileComplete": true,
    "customer": { "id": "...", "mobile": "9876543210", "name": "...", "isTapgroUser": false }
  }
}
```

**Frontend store:**

| Key | Use |
|-----|-----|
| `token` | All customer API calls |
| `refreshToken` | `POST /auth/refresh` when access expires |
| `customer` | Profile UI |

### 2.3 Refresh / logout

- `POST /api/customer/v1/auth/refresh` → `{ "refreshToken": "..." }` → new `token`
- `POST /api/customer/v1/auth/logout` (Bearer) — this device
- `POST /api/customer/v1/auth/logout-all` (Bearer) — all devices

### 2.4 Me (home)

`GET /api/customer/v1/me`

Returns profile + channel counts + lead summary. Use for home dashboard.

`PUT /api/customer/v1/me` — update name, email, businessName, city, avatarUrl, …

---

## 3. Platforms & connect (core flow)

All routes below need **Bearer customer token**.

### 3.1 List platforms (Platforms screen)

`GET /api/customer/v1/platforms`

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Instagram",
      "slug": "instagram",
      "capabilities": ["publish", "analytics", "comments", "leads"],
      "iconUrl": null,
      "connected": [
        {
          "id": "channelId",
          "username": "glowsalon",
          "displayName": "Glow Salon",
          "avatarUrl": "https://...",
          "status": "connected"
        }
      ],
      "needsReconnect": false
    }
  ]
}
```

**UI rules:**

| Field | UI |
|-------|----|
| `slug` | Pass this to connect API |
| `connected.length === 0` | Show **Connect** |
| `connected` + `status: connected` | Show account chip + Disconnect |
| `needsReconnect: true` or channel `status: needs_reconnect` | Show **Reconnect** (same connect API) |
| Inactive platforms | Not returned (admin must enable) |

**Phase-1 priority slugs:**

| Slug | User action on OAuth |
|------|----------------------|
| `instagram` | Instagram Login (Business/Creator) or Facebook Login + linked Page |
| `google_business` | Google login → pick **verified location** |
| `facebook` | Facebook login → pick **Page** |
| `meta_ads` | Ads scopes (after FB/IG as needed) |

### 3.2 Start connect

`POST /api/customer/v1/channels/connect`

```json
{ "platform": "instagram" }
```

**Response:**

```json
{
  "success": true,
  "message": "Open authUrl in the browser to connect the channel",
  "data": {
    "authUrl": "https://zernio.com/...",
    "session": "a1b2c3...",
    "expiresAt": "2026-11-17T08:00:00.000Z"
  }
}
```

**Frontend must:**

1. Save `session` (memory / localStorage).
2. Open `authUrl`:
   - **Web:** `window.open(authUrl, '_blank')` or same-tab redirect.
   - **Mobile:** in-app browser / Custom Tabs / `SFSafariViewController` / deep-link friendly WebView that allows OAuth redirects.
3. Do **not** embed Meta/Google login in a locked WebView that blocks cookies — OAuth will fail.

Backend auto-creates the customer’s Zernio profile on first connect (no separate “create profile” call for the app).

### 3.3 Return URL (deep link / web)

Backend redirects the browser to:

`settings.socialProvider.customerRedirectUrl`

Examples:

- Web: `https://app.tapgro.com/social`
- Mobile deep link: `tapgro://social`
- Local lab: `http://localhost:3001/test/social/`

**Query params:**

| Param | Values |
|-------|--------|
| `social_connect` | `success` \| `error` |
| `platform` | e.g. `instagram` |
| `channelId` | Mongo id when success |
| `session` | Same connect session |
| `message` | Error / status text |

**Frontend landing page / deep-link handler:**

```text
if social_connect === success
  → toast “Connected”
  → GET /channels + GET /platforms
else
  → toast message
```

Also poll session while waiting (see below) in case the return URL is slow or the user stays on the OAuth tab.

### 3.4 Poll connect session

`GET /api/customer/v1/channels/connect/:session`

```json
{
  "success": true,
  "data": {
    "status": "pending",
    "platform": "instagram",
    "message": null,
    "channel": null,
    "expiresAt": "..."
  }
}
```

| `status` | Action |
|----------|--------|
| `pending` | Keep polling every 2s (max ~2 min) |
| `connected` | Stop; refresh channels/platforms |
| `failed` | Stop; show `message` |

### 3.5 List / sync / disconnect / test

| Method | Path | Notes |
|--------|------|--------|
| GET | `/channels?includeDisconnected=true` | Full list |
| POST | `/channels/sync` | Refresh health from Zernio |
| DELETE | `/channels/:id` | Disconnect (stops billing for that account) |
| POST | `/channels/:id/test` | See below |

**Health test (safe):**

```json
{ "mode": "health" }
```

**Real post test (publishes live — avoid in production UX):**

```json
{
  "mode": "post",
  "content": "Hello from TapGro",
  "confirmPublish": true,
  "mediaUrl": "https://cdn.example.com/photo.jpg",
  "mediaType": "image"
}
```

Instagram **requires** `mediaUrl`. Prefer hiding “test post” behind a QA flag.

### 3.6 Channel statuses (UI)

| Status | Badge | CTA |
|--------|-------|-----|
| `connected` | Green | Disconnect |
| `needs_reconnect` | Amber | Reconnect (= connect again) |
| `disconnected` | Grey | Connect |

---

## 4. Recommended customer screens

### Screen A — Login
1. Mobile → Send OTP  
2. OTP (+ name/business if `isNewCustomer`) → Verify  
3. Persist tokens → navigate Home  

### Screen B — Home (`GET /me`)
- Profile completeness banner if `!profileComplete`  
- Connected channel count / needsReconnect  
- Lead summary cards  

### Screen C — Platforms (`GET /platforms`)
- Card per platform with Connect / Reconnect / Connected state  
- On Connect → open `authUrl` → handle return deep link  

### Screen D — Channels (`GET /channels`)
- List accounts with avatar, username, status  
- Actions: Sync, Health, Disconnect  

### Screen E — Leads
See section 5.

---

## 5. Leads API

**Base:** `/api/customer/v1/leads` (Bearer)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/leads/summary` | Counts by status/source |
| GET | `/leads?page=&limit=&status=&source=&search=` | List |
| GET | `/leads/:id` | Detail |
| POST | `/leads` | Manual lead |
| PUT | `/leads/:id` | Update status / follow-up |
| POST | `/leads/:id/notes` | Add note |
| DELETE | `/leads/:id` | Remove |

**Create body example:**

```json
{
  "name": "Riya Mehta",
  "mobile": "9876543210",
  "email": "riya@example.com",
  "message": "Bridal makeup enquiry",
  "source": "manual",
  "platform": "instagram",
  "status": "new",
  "followUpAt": "2026-11-20T10:00:00.000Z"
}
```

**Statuses:** `new`, `contacted`, `qualified`, `won`, `lost`, … (see Swagger enum)  
**Sources:** `manual`, `meta_lead_ad`, `instagram`, `google_business`, …

Meta lead-ad form submits appear automatically when Facebook + lead ads are connected (`source=meta_lead_ad`). Poll list or refresh on focus; push notifications can come later.

---

## 6. OAuth return — Web vs Mobile

### Web
1. Set `customerRedirectUrl` to your app route, e.g. `https://app.tapgro.com/social/callback`.  
2. That route reads query params and updates UI.  
3. Clear query from the URL after handling (`history.replaceState`).

### Mobile (React Native / Flutter / native)
1. Register deep link / App Link, e.g. `tapgro://social` or `https://app.tapgro.com/social`.  
2. Ask backend/admin to set `customerRedirectUrl` to that exact value.  
3. Open `authUrl` in **system browser** or **Chrome Custom Tabs / SFSafariViewController** (not a cookie-blocked WebView).  
4. On resume / deep link → parse `social_connect` → refresh APIs.  
5. Optionally poll `GET /channels/connect/:session` while the browser is open.

### Checklist for FE
- [ ] Store `session` before opening `authUrl`  
- [ ] Handle success + error query params  
- [ ] Poll session as backup  
- [ ] Refresh platforms + channels after success  
- [ ] Show clear error if user cancels OAuth  

---

## 7. Admin panel (short)

**Base:** `/api/backend/v1` + admin JWT (`backendBearerAuth`)

| Step | API |
|------|-----|
| Login | `POST /adminLogin` `{ email, password }` → `token` |
| Test Zernio key | `POST /social/provider/test` |
| Create profile | `POST /social/profile` `{ name, description? }` |
| Connect | `POST /social/profile/:id/connect` `{ platform }` → `authUrl` + `session` |
| Poll | `GET /social/connect/:session` |
| Channels | `GET /social/channels`, `POST /social/channel/:id/test`, `DELETE /social/channel/:id` |

Return URL for admin is `settings.socialProvider.panelRedirectUrl` (same query params as customer).

Settings the panel should expose (or ops configures once):

- `socialProvider.enabled`, `provider: "zernio"`, `apiKey`  
- `customerRedirectUrl`, `panelRedirectUrl`  
- `brandName`, `logoUrl` (optional welcome screen)

---

## 8. Error handling

Typical shapes:

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

```json
{
  "statusCode": 400,
  "message": "Platform \"tiktok\" is not enabled. Activate it under Platforms first."
}
```

| HTTP | Frontend |
|------|----------|
| 401 | Refresh token or force re-login |
| 403 | Account blocked / no permission |
| 404 | Channel/session not found |
| 422 | Validation — show field errors |
| 429 | OTP / rate limit — show wait message |
| 502 / provider errors | “Social provider unavailable — try again” |

---

## 9. Phase map (what FE builds now vs later)

| Phase | Backend | Frontend |
|-------|---------|----------|
| **Now (phase 1)** | Auth, platforms, connect, channels, health, leads | Login, Platforms, Channels, Leads, OAuth return |
| **Next** | Create/schedule posts, media upload | Composer, calendar |
| **Later** | Comments, DMs, analytics, ads boost | Inbox, insights, boost UI |

Do **not** wait for posts/inbox to ship connect — salons must connect IG/Google/FB first.

---

## 10. Example TypeScript client snippets

```ts
const API = process.env.NEXT_PUBLIC_API_URL; // e.g. https://api.tapgro.com

async function customerFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || res.statusText);
  return body;
}

// Connect Instagram
const { data } = await customerFetch('/api/customer/v1/channels/connect', token, {
  method: 'POST',
  body: JSON.stringify({ platform: 'instagram' }),
});
sessionStorage.setItem('social_session', data.session);
window.location.href = data.authUrl; // or window.open

// On return page
const q = new URLSearchParams(location.search);
if (q.get('social_connect') === 'success') {
  await customerFetch('/api/customer/v1/platforms', token);
  await customerFetch('/api/customer/v1/channels', token);
}
```

---

## 11. Local testing

1. Backend running (`npm run start:dev`).  
2. Open **Social Connect Lab:** `http://localhost:<PORT>/test/social/`  
3. Env: `CUSTOMER_OTP_TEST_MODE=true`, `APP_BASE_URL=http://localhost:<PORT>`  
4. Settings: Zernio API key + `customerRedirectUrl` = lab URL (or your FE callback).  
5. Customer tab: Send OTP → Verify → Connect Instagram / Google / Facebook with **real** accounts (no Meta/Google sandbox).  

Full interactive API docs: **`/swagger/customer`**.

---

## 12. Acceptance checklist (frontend)

- [ ] OTP login + token persistence + refresh  
- [ ] Platforms list from API (no hardcoded-only list)  
- [ ] Connect opens `authUrl` correctly on web + mobile  
- [ ] Return deep link / callback handles success & error  
- [ ] Session poll works if user returns slowly  
- [ ] Reconnect path for `needs_reconnect`  
- [ ] Disconnect confirms before DELETE  
- [ ] Leads list / detail / manual create / notes  
- [ ] Empty states: no platforms, no channels, OAuth cancelled  

---

**Owner notes:** Backend social stack uses Zernio (`@zernio/node` inside `ZernioClient`). Frontend never calls Zernio directly — only TapGro customer/admin APIs.

See also: [Manager Panel Frontend Guide](./Manager-Panel-Frontend-Guide.md).
