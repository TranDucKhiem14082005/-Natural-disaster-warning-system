# /device-fingerprint — Device Fingerprinting (FingerprintJS + Go)

> **Trigger**: User wants to add device fingerprinting to an app.
> **Stack**: FingerprintJS (client) + any backend (Node/Go/Python/PHP/...) + Redis (rate limit).
> **Use for**: Rate limit bypass protection, multi-account abuse detection, resource gate per device.

---

## Architecture

```
Browser
  └─ FingerprintJS collects ~100 signals → visitorId (stable, unique per device)
  └─ Axios interceptor sends X-Visitor-ID header on every request

Go Backend
  └─ FingerprintMiddleware() reads X-Visitor-ID → sets it into the gin context
  └─ Fallback: hash(IP + User-Agent) if the header is absent
  └─ Handler uses visitorId instead of IP alone
```

---

## Step 1 — Frontend: Install + Setup

```bash
npm install @fingerprintjs/fingerprintjs
```

**`src/utils/fingerprint.js`** — load once, cache, concurrent-safe:

```js
import FingerprintJS from '@fingerprintjs/fingerprintjs'

let cachedVisitorId = null
let loadPromise = null

export async function getVisitorId() {
  if (cachedVisitorId) return cachedVisitorId

  if (!loadPromise) {
    loadPromise = FingerprintJS.load()
      .then((fp) => fp.get())
      .then((result) => {
        cachedVisitorId = result.visitorId
        return cachedVisitorId
      })
      .catch(() => null) // Never block the app if FP fails
  }

  return loadPromise
}
```

**Axios interceptor** — add to the existing request interceptor (must be `async`):

```js
import { getVisitorId } from '../utils/fingerprint'

api.interceptors.request.use(async (config) => {
  // ... existing auth/token logic ...

  const visitorId = await getVisitorId()
  if (visitorId) config.headers['X-Visitor-ID'] = visitorId

  return config
})
```

> **Note**: If the current interceptor is sync → change it to `async`. axios handles the Promise returned by the interceptor automatically.

---

## Step 2 — Backend: Middleware (language-agnostic)

Implement a middleware/interceptor that runs **before all routes**. Adapt to the language in use (Node/Go/Python/PHP/...).

**Required logic:**

```
FUNCTION FingerprintMiddleware(request, response, next):
    visitorId = request.headers["X-Visitor-ID"]

    IF visitorId is empty:
        visitorId = fallbackFingerprint(request)

    request.context["visitor_id"] = visitorId
    next()

FUNCTION fallbackFingerprint(request) → string:
    data = clientIP(request) + request.headers["User-Agent"]
    hash = sha256(data)
    RETURN "fb_" + hex(hash)[0:16]   // prefix "fb_" = fallback, 8 bytes hex

FUNCTION getVisitorID(request) → string:
    IF "visitor_id" IN request.context:
        RETURN request.context["visitor_id"]
    RETURN fallbackFingerprint(request)
```

**Wire into the app — place it BEFORE every route:**

```
app.use(FingerprintMiddleware)   // Node/Express style
router.Use(FingerprintMiddleware) // Go/Gin style
app.before_request(fingerprint)  // Python/Flask style
// ... similarly for the framework in use
```

---

## Step 3 — Use Case 1: Rate Limit Bypass Prevention

**Problem**: IP-based rate limits are easily bypassed by changing the IP.

**Fix**: Use visitorId instead of IP as the Redis key.

```
// Handler
FUNCTION protectedAction(request):
    visitorID = getVisitorID(request)
    attempts  = redis.GET("attempts:" + resourceID + ":" + visitorID) OR 0

    IF attempts >= MAX_ATTEMPTS:
        ttl = redis.TTL("attempts:" + resourceID + ":" + visitorID)
        RETURN 423 { error: "LOCKED_OUT", retry_after_seconds: ttl }

    // ... logic ...

// Redis helpers
FUNCTION getAttempts(resourceID, visitorID) → int:
    RETURN redis.GET("attempts:" + resourceID + ":" + visitorID) OR 0

FUNCTION incrAttempts(resourceID, visitorID, ttlSeconds):
    key   = "attempts:" + resourceID + ":" + visitorID
    count = redis.INCR(key)
    IF count == 1:
        redis.EXPIRE(key, ttlSeconds)   // set TTL only on the first hit
    RETURN count

FUNCTION resetAttempts(resourceID, visitorID):
    redis.DEL("attempts:" + resourceID + ":" + visitorID)
```

---

## Step 4 — Use Case 2: Multi-account Abuse Detection

**Problem**: A user creates many accounts from the same device to farm rewards/referrals.

**Fix**: Store visitorId at register, check before granting a reward.

```
FUNCTION setDeviceRegistered(visitorID, userID):
    redis.SET("device_registered:" + visitorID, userID, EX=2592000)  // 30 days

FUNCTION isDeviceRegistered(visitorID) → bool:
    RETURN redis.EXISTS("device_registered:" + visitorID)

// Service — on register
FUNCTION register(email, password, visitorID):
    user = createUser(email, password)

    IF visitorID != "":
        async setDeviceRegistered(visitorID, user.id)  // non-blocking

    RETURN user

// Service — on grant reward/referral
FUNCTION grantReward(userID, visitorID):
    IF visitorID != "" AND isDeviceRegistered(visitorID):
        RETURN  // same device already has an account — skip reward

    // ... grant reward ...
```

---

## Step 5 — Use Case 3: Resource Gate Per Device

**Problem**: A usage limit (free tier) is bypassed by creating a new account.

**Fix**: Track usage per device in parallel with per user.

```
FUNCTION incrDeviceUsage(visitorID, date):
    key   = "device_usage:" + visitorID + ":" + date
    count = redis.INCR(key)
    IF count == 1:
        redis.EXPIRE(key, 90000)  // 25 hours (buffer across midnight)

FUNCTION getDeviceUsage(visitorID, date) → int:
    RETURN redis.GET("device_usage:" + visitorID + ":" + date) OR 0

FUNCTION todayUTC() → string:
    RETURN now().UTC().format("YYYY-MM-DD")

// Service — check both user count + device count
FUNCTION createResource(userID, visitorID):
    userCount   = getTodayUsageByUser(userID)
    deviceCount = 0

    IF visitorID != "":
        deviceCount = getDeviceUsage(visitorID, todayUTC())

    IF userCount >= FREE_LIMIT OR deviceCount >= FREE_LIMIT:
        RETURN ERR_LIMIT_REACHED  // trigger payment/token gate

    // ... create resource ...

    IF visitorID != "":
        async incrDeviceUsage(visitorID, todayUTC())  // non-blocking
```

---

## Redis Keys Pattern

| Key pattern | TTL | Purpose |
|---|---|---|
| `attempts:<resourceId>:<visitorId>` | Per use case (e.g. 5 min) | Rate limit / brute-force lockout |
| `device_registered:<visitorId>` | 30 days | Detect multi-account per device |
| `device_usage:<visitorId>:<date>` | 25 hours | Daily resource gate per device |

---

## Build Tasks

```
Frontend
- [ ] [S] npm install @fingerprintjs/fingerprintjs
- [ ] [S] src/utils/fingerprint.js (or equivalent) — load + cache visitorId, concurrent-safe
- [ ] [S] HTTP interceptor — make it async, add X-Visitor-ID header to every request

Backend (adapt path/file to the stack in use)
- [ ] [S] FingerprintMiddleware — read X-Visitor-ID header + fallback sha256(IP+UA)
- [ ] [S] Wire middleware into the app — place it BEFORE every route
- [ ] [S] Use Case 1: change the rate limit Redis key from IP → visitorID
- [ ] [M] Use Case 2: setDeviceRegistered + isDeviceRegistered on register + grant reward
- [ ] [S] Use Case 3: incrDeviceUsage + getDeviceUsage on resource creation

Test
- [ ] [S] Change IP, keep the same visitorId → rate limit still holds
- [ ] [S] Register a new account from the same device → reward is skipped
- [ ] [S] Exhaust the limit then switch accounts on the same device → still gated
```

---

## Validation Rules

| Rule | Detail |
|---|---|
| visitorId absent | Fall back to `"fb_" + hash(IP + User-Agent)[:8]` — do not block the request |
| Spoofed visitorId | Cannot be verified — still has basic effect, use it as an extra defense layer |
| Concurrent FP load | `loadPromise` singleton prevents a race condition across simultaneous requests |
| Mobile app (Flutter) | Use the `device_info_plus` package, send the same `X-Visitor-ID` header |
| Incognito mode | Stable ID within the same session; may differ across sessions |

---

## Anti-patterns

- **Don't fully block when there is no visitorId** — fall back to IP hash, do not reject the request
- **Don't store visitorId in the DB** — Redis is enough, TTL cleans up automatically
- **Don't use visitorId as an auth identifier** — it is a secondary signal, not the primary identity
- **Don't trust visitorId 100%** — an advanced user can spoof it
- **Don't leave the interceptor sync** — `getVisitorId()` is async, the interceptor must be an async function
