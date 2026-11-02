# /rabbitmq — Rapid MQ Integration (Go)

> Activate: khi user muốn thay thế `go func() { ... }()` fire-and-forget bằng RabbitMQ workers với retry + DLQ.
> Graceful fallback: nếu broker down, tự động fallback về goroutine — app không bị gián đoạn.

---

## When to Trigger

- User nói: "thêm message queue", "thêm RabbitMQ", "retry email", "async worker", "dead letter queue"
- App có goroutine fire-and-forget: gửi email, track event, credit reward
- Task liên quan: email verification, device register, referral tracking, reward crediting

---

## Architecture

```
HTTP Request
  └─ Service gọi tryPublish(routingKey, msg, fallback)
        ├─ MQ available → publish to exchange → worker picks up → process (retry 3x)
        └─ MQ down      → go fallback() (goroutine, same behavior)

Exchange: <app> (topic)
Queues:   <app>.email, <app>.device, <app>.referral, <app>.reward → DLX → <app>.dlq
Retry:    3 attempts — 1s / 2s / 4s exponential backoff → nack → DLQ
```

---

## Phase 1 — Add Dependency

```bash
go get github.com/rabbitmq/amqp091-go@v1.11.0
```

---

## Phase 2 — Core MQ Package (`pkg/mq/mq.go`)

```go
package mq

import (
    "encoding/json"
    "fmt"
    "log"
    "time"

    amqp "github.com/rabbitmq/amqp091-go"
)

const appName = "<APP>"  // ← đổi per project: "merchant", "edu", "shop"

func Connect(url string) (*amqp.Connection, error) {
    conn, err := amqp.Dial(url)
    if err != nil {
        return nil, err
    }
    if err := declareTopology(conn); err != nil {
        conn.Close()
        return nil, err
    }
    return conn, nil
}

func declareTopology(conn *amqp.Connection) error {
    ch, err := conn.Channel()
    if err != nil {
        return err
    }
    defer ch.Close()

    if err := ch.ExchangeDeclare(appName, "topic", true, false, false, false, nil); err != nil {
        return err
    }
    dlx := appName + ".dlx"
    if err := ch.ExchangeDeclare(dlx, "fanout", true, false, false, false, nil); err != nil {
        return err
    }
    dlq := appName + ".dlq"
    if _, err := ch.QueueDeclare(dlq, true, false, false, false, nil); err != nil {
        return err
    }
    if err := ch.QueueBind(dlq, "#", dlx, false, nil); err != nil {
        return err
    }
    // Khai báo worker queues — thêm/bỏ theo nhu cầu của app
    queues := []string{
        appName + ".email",
        appName + ".device",
        appName + ".referral",
        appName + ".reward",
    }
    for _, q := range queues {
        args := amqp.Table{"x-dead-letter-exchange": dlx}
        if _, err := ch.QueueDeclare(q, true, false, false, false, args); err != nil {
            return err
        }
        if err := ch.QueueBind(q, q+".*", appName, false, nil); err != nil {
            return err
        }
    }
    return nil
}

func Publish(conn *amqp.Connection, routingKey string, payload any) error {
    ch, err := conn.Channel()
    if err != nil {
        return err
    }
    defer ch.Close()
    body, err := json.Marshal(payload)
    if err != nil {
        return err
    }
    return ch.Publish(appName, routingKey, false, false, amqp.Publishing{
        ContentType:  "application/json",
        DeliveryMode: amqp.Persistent,
        Body:         body,
    })
}

func StartConsumer(conn *amqp.Connection, queue string, handler func(string, []byte) error) {
    for {
        if err := runConsumer(conn, queue, handler); err != nil {
            log.Printf("[mq] consumer %s error: %v — retrying in 5s", queue, err)
            time.Sleep(5 * time.Second)
        }
    }
}

func runConsumer(conn *amqp.Connection, queue string, handler func(string, []byte) error) error {
    ch, err := conn.Channel()
    if err != nil {
        return err
    }
    defer ch.Close()
    ch.Qos(1, 0, false)
    msgs, err := ch.Consume(queue, "", false, false, false, false, nil)
    if err != nil {
        return err
    }
    for msg := range msgs {
        if err := retryHandler(handler, msg.RoutingKey, msg.Body); err != nil {
            log.Printf("[mq] nack %s after retries: %v", msg.RoutingKey, err)
            msg.Nack(false, false) // → DLQ
        } else {
            msg.Ack(false)
        }
    }
    return fmt.Errorf("channel closed")
}

func retryHandler(handler func(string, []byte) error, key string, body []byte) error {
    delays := []time.Duration{0, time.Second, 2 * time.Second, 4 * time.Second}
    var err error
    for i, d := range delays {
        if i > 0 {
            log.Printf("[mq] retry %d for %s: %v", i, key, err)
            time.Sleep(d)
        }
        if err = handler(key, body); err == nil {
            return nil
        }
    }
    return err
}
```

---

## Phase 3 — Message Contracts (`pkg/mq/messages.go`)

```go
package mq

// Routing key pattern: <app>.<queue>.<action>
const (
    KeyEmailVerification   = "<app>.email.verification"
    KeyDeviceRegister      = "<app>.device.register"
    KeyDeviceIncrEntry     = "<app>.device.incr_entry"
    KeyReferralTrack       = "<app>.referral.track"
    KeyRewardEmailVerified = "<app>.reward.email_verified"
    KeyRewardMilestone     = "<app>.reward.milestone"
    KeyRewardDailyStreak   = "<app>.reward.daily_streak"
)

// Flat structs — không nested object
type EmailVerificationMsg  struct{ UserID, Email string }
type DeviceRegisterMsg     struct{ VisitorID, UserID string }
type DeviceIncrEntryMsg    struct{ VisitorID, Date string }
type ReferralTrackMsg      struct{ NewUserID, Code, VisitorID string }
type RewardEmailVerifiedMsg struct{ UserID string }
type RewardMilestoneMsg    struct{ UserID string }
type RewardDailyStreakMsg   struct{ UserID, Timezone string }
```

---

## Phase 4 — tryPublish Helper (`internal/service/mqhelper.go`)

```go
package service

import (
    "log"
    "<module>/global"
    "<module>/pkg/mq"
)

// tryPublish publishes to MQ; falls back to goroutine if broker unavailable.
func tryPublish(routingKey string, msg any, fallback func()) {
    if global.MQ != nil && !global.MQ.IsClosed() {
        if err := mq.Publish(global.MQ, routingKey, msg); err == nil {
            return
        } else {
            log.Printf("[mq] publish %s failed: %v — fallback", routingKey, err)
        }
    }
    go fallback()
}
```

---

## Phase 5 — Workers (`internal/workers/`)

### workers.go
```go
package workers

import amqp "github.com/rabbitmq/amqp091-go"

func StartAll(conn *amqp.Connection) {
    go startEmailWorker(conn)
    go startDeviceWorker(conn)
    go startReferralWorker(conn)
    go startRewardWorker(conn)
}
```

### email_worker.go (template — nhân bản cho queue khác)
```go
package workers

import (
    "encoding/json"
    "<module>/internal/service"
    "<module>/pkg/mq"
    amqp "github.com/rabbitmq/amqp091-go"
)

func startEmailWorker(conn *amqp.Connection) {
    mq.StartConsumer(conn, "<app>.email", handleEmail)
}

func handleEmail(routingKey string, body []byte) error {
    switch routingKey {
    case mq.KeyEmailVerification:
        var msg mq.EmailVerificationMsg
        if err := json.Unmarshal(body, &msg); err != nil {
            return err
        }
        return service.GenerateAndSendVerificationEmail(msg.UserID, msg.Email)
    }
    return nil // unknown key — ack silently
}
```

---

## Phase 6 — Global MQ Var (`global/global.go`)

```go
import amqp "github.com/rabbitmq/amqp091-go"

var (
    DB  *sqlx.DB
    RDB *redis.Client
    Cfg *Config
    MQ  *amqp.Connection  // thêm dòng này
)
```

---

## Phase 7 — Init in `main.go`

```go
import (
    "<module>/internal/workers"
    "<module>/pkg/mq"
)

// Sau khi init DB + Redis:
if url := os.Getenv("RABBITMQ_URL"); url != "" {
    if conn, err := mq.Connect(url); err != nil {
        log.Printf("[mq] connect failed: %v — proceeding without MQ", err)
    } else {
        global.MQ = conn
        workers.StartAll(conn)
        log.Printf("[mq] starting workers: email, device, referral, reward")
    }
}
```

---

## Phase 8 — Replace Goroutines trong Services

**Trước:**
```go
go func() { sendVerificationEmail(userID, email) }()
go func() { trackReferral(userID, code) }()
```

**Sau:**
```go
tryPublish(mq.KeyEmailVerification,
    mq.EmailVerificationMsg{UserID: userID, Email: email},
    func() { _ = service.GenerateAndSendVerificationEmail(userID, email) })

tryPublish(mq.KeyReferralTrack,
    mq.ReferralTrackMsg{NewUserID: userID, Code: code, VisitorID: visitorID},
    func() { service.TrackReferralWithDevice(userID, code, visitorID) })
```

---

## Phase 9 — Docker Compose

### docker-compose.yml (base)
```yaml
volumes:
  rabbitmqdata:

services:
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: <app>-rabbitmq
    networks:
      - <app>-net
    ports:
      - "${RABBITMQ_MGMT_PORT:-15672}:15672"
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS}
      RABBITMQ_DEFAULT_VHOST: <app>
    volumes:
      - rabbitmqdata:/var/lib/rabbitmq
      - ./rabbitmq/rabbitmq.conf:/etc/rabbitmq/conf.d/10-management.conf:ro
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    restart: unless-stopped

  api:
    depends_on:
      rabbitmq:
        condition: service_healthy
```

### docker-compose.prod.yml (override — host-path volume)
```yaml
services:
  rabbitmq:
    ports: []
    volumes:
      - /opt/<app>/data/rabbitmq:/var/lib/rabbitmq
```

### `rabbitmq/rabbitmq.conf`
```
management.path_prefix = /rabbitmq-mgmt
```

### Nginx proxy block
```nginx
location /rabbitmq-mgmt/ {
  set $upstream_rmq rabbitmq:15672;
  proxy_pass         http://$upstream_rmq;
  proxy_set_header   Host $host;
  proxy_set_header   X-Real-IP $remote_addr;
  proxy_http_version 1.1;
  proxy_set_header   Upgrade $http_upgrade;
  proxy_set_header   Connection "upgrade";
}
```

### .env vars
```
RABBITMQ_URL=amqp://<user>:<pass>@rabbitmq:5672/<app>
RABBITMQ_USER=<app>_user
RABBITMQ_PASS=<strong-password>
RABBITMQ_MGMT_PORT=15672
```

---

## Admin UI Page (React)

```jsx
export default function RabbitMQ() {
  return (
    <div className="max-w-md">
      <h1 className="text-xl font-bold mb-2">RabbitMQ Management</h1>
      <a href="/rabbitmq-mgmt/" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-medium text-sm">
        Mở RabbitMQ Manager ↗
      </a>
    </div>
  )
}
```

> **Không dùng iframe** — RabbitMQ management UI dùng WebSocket, sẽ break trong iframe.

---

## Adapter Rules — Những gì PHẢI đổi khi clone

| Item | Đổi sang |
|---|---|
| `appName` constant trong `mq.go` | tên app mới (lowercase, no space) |
| Package import path | `<your-module>/global` |
| `RABBITMQ_DEFAULT_VHOST` | tên app mới |
| `RABBITMQ_URL` vhost | `amqp://...@rabbitmq:5672/<app>` |
| Container name | `<app>-rabbitmq` |
| Docker network | `<app>-net` |
| Host-path volume | `/opt/<app>/data/rabbitmq` |
| Routing key prefix | `<app>.email.verification` |
| Queue names trong workers | `<app>.email`, `<app>.device` |
| Worker queues trong `declareTopology` | thêm/bỏ theo use case của app mới |
| Reward logic trong workers | reward function của app mới |

## Những gì KHÔNG cần đổi

- Toàn bộ `mq.go` logic (Connect, Publish, StartConsumer, retryHandler) — 100% generic
- Retry strategy: 3 attempts, 1s/2s/4s backoff
- DLX/DLQ pattern (fanout DLX → single DLQ)
- `tryPublish` helper pattern
- `rabbitmq.conf` management path prefix
- Nginx proxy block format
- `depends_on: service_healthy` pattern
- Admin UI link approach (NOT iframe)
- Worker template structure (StartConsumer + switch-case handler)
- `*amqp.Connection` type trong global.go

---

## Checklist Clone sang App Mới

```bash
# 1. Backend — copy core MQ package
cp <ref-backend>/pkg/mq/mq.go              → <new-app>/pkg/mq/mq.go
cp <ref-backend>/pkg/mq/messages.go        → <new-app>/pkg/mq/messages.go
# Sửa: appName constant, routing key prefix, message structs per use case

cp -r <ref-backend>/internal/workers/      → <new-app>/internal/workers/
# Sửa: queue names trong StartConsumer calls, service calls, reward logic

cp <ref-backend>/internal/service/mqhelper.go → <new-app>/internal/service/
# Sửa: import path only

# 2. global.go — thêm MQ var
# Thêm: MQ *amqp.Connection vào var block

# 3. main.go — thêm init block
# Copy Phase 7 snippet, đổi import path

# 4. Replace goroutines trong services
# Tìm: go func() { ... }() → đổi sang tryPublish(...)

# 5. Infra
cp <ref-infra>/rabbitmq/rabbitmq.conf      → <new-app>-infra/rabbitmq/
# Không cần đổi gì

# Thêm rabbitmq service vào docker-compose.yml base (Phase 9)
# Thêm host-path override vào docker-compose.prod.yml
# Thêm /rabbitmq-mgmt/ proxy block vào nginx.prod.conf

# 6. .env.example
RABBITMQ_URL=
RABBITMQ_USER=
RABBITMQ_PASS=
RABBITMQ_MGMT_PORT=15672

# 7. Admin UI (nếu có)
cp <ref-admin>/src/pages/RabbitMQ.jsx      → <new-app>-admin/src/pages/
# Không cần đổi gì
```

---

## Deploy Checklist

- [ ] `rabbitmq/rabbitmq.conf` committed vào infra repo
- [ ] `docker-compose.prod.yml` có host-path volume override (không dùng named volume)
- [ ] `.env` trên prod có đủ 4 RABBITMQ vars
- [ ] `nginx.prod.conf` có `/rabbitmq-mgmt/` proxy block
- [ ] **UFW**: `ufw route allow proto tcp to any port 80` (không phải `ufw allow 80`) — critical cho Docker FORWARD chain
- [ ] Deploy RabbitMQ TRƯỚC, đợi `service_healthy`, THEN build + restart api

---

## Verify sau Deploy

```bash
# Workers đã start
docker logs <app>-api-1 2>&1 | grep '\[mq\]'
# Expected: [mq] starting workers: email, device, referral, reward

# Exchange tồn tại
curl -u <user>:<pass> http://localhost:15672/api/exchanges/%2F<app>/<app> | jq '.name'

# DLQ trống (không có failed messages)
curl -u <user>:<pass> http://localhost:15672/api/queues/%2F<app>/<app>.dlq | jq '.messages'
```

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Topic exchange (not direct) | Routing key patterns cho phép nhiều queues subscribe cùng message type |
| Fanout DLX | Toàn bộ failed messages từ mọi queue đổ về 1 DLQ — dễ monitor |
| `tryPublish` fallback | App hoạt động bình thường khi MQ restart — zero downtime |
| Persistent delivery mode | Messages survive RabbitMQ restart |
| 1 goroutine per queue | Đơn giản, tự reconnect khi channel fail |
| Handler nhận routing key | 1 consumer/queue, dispatch bằng switch-case bên trong |
| `depends_on: service_healthy` | Api không start cho đến khi broker sẵn sàng |

