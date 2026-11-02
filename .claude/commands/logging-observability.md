# /logging-observability — Structured Logging (bản kết hợp hệ sinh thái)

> *"A log you can't search, correlate, or trust is just noise on disk."*

**Bản này = logging + nối vào observability/monitoring/rabbitmq/device-fingerprint của repo.**
Hệ nhỏ chỉ cần logging thuần, không có tracing/Loki/queue → dùng [`logging.md`](logging.md)
(standalone, tự chứa, không link ngoài). File này dành cho hệ đã/đang xây observability stack.

**Trigger**: khi user muốn thêm/chuẩn hoá logging cho một service (Go/Node/Python/…), sửa
log lộn xộn, thêm request_id/trace correlation, hoặc chuẩn bị đẩy log lên Loki/ELK.

**Khác với [`observability.md`](observability.md)**: file đó là tầng tư duy 3-pillar (metrics/logs/
traces) + SLO. File này đi sâu **riêng pillar Logs** — cách viết một dòng log đúng, field chuẩn,
correlation, redaction PII, sampling, và snippet thật cho từng stack. Log liên kết với traces qua
`trace_id` (xem observability §6).

---

## 0. Quyết định trước khi code (Discovery)

| # | Câu hỏi | Ảnh hưởng |
|---|---------|-----------|
| Q1 | Backend stack? (Go/Node/Python/Java) | Chọn thư viện + middleware snippet |
| Q2 | Đã có tracing (OTel/Jaeger) chưa? | Có → log phải mang `trace_id` để nối log ↔ trace |
| Q3 | Log đi đâu? (stdout → Docker → Loki / ELK / Datadog) | Quyết định format + rotation |
| Q4 | Có PII/secret trong request không? (auth, payment, health) | Bắt buộc redaction + retention policy |
| Q5 | Volume log/ngày? | Cao → cần sampling DEBUG + async |

> Không đoán. Q1 sai → mọi snippet sai. Q4 bỏ qua → rò rỉ PII ra log = sự cố compliance.

---

## 1. Nguyên tắc cốt lõi

1. **Log là JSON có cấu trúc, một dòng một event** — không `printf`, không nối chuỗi. Máy parse
   được, người vẫn đọc được.
2. **Log ra `stdout`/`stderr`, không ghi file trong app** — để Docker/k8s/agent thu gom. App không
   tự lo rotation.
3. **Mỗi log mang đủ ngữ cảnh để hiểu event mà không cần tra cứu thêm** — id, actor, kết quả.
4. **Không bao giờ log secret/PII thô** — redact tại nguồn, không phải sửa sau.
5. **Đúng level, log một lần đúng chỗ** — không log cùng lỗi ở 3 tầng.
6. **Log liên kết được** — mọi dòng trong một request mang chung `request_id`; xuyên service mang
   chung `trace_id`.

---

## 2. Standard fields — có trong MỌI dòng log

| Field | Kiểu | Ví dụ | Bắt buộc |
|---|---|---|---|
| `timestamp` | ISO 8601 + tz | `2026-08-02T10:30:00.123Z` | ✅ |
| `level` | string | `info` / `warn` / `error` | ✅ |
| `message` | string | `payment completed` | ✅ |
| `service` | string | `payment-api` | ✅ |
| `version` | string | `1.3.0` | ✅ |
| `env` | string | `production` | ✅ |
| `request_id` | string | `req_ab12…` | ✅ (trong request) |
| `trace_id` / `span_id` | string | `4bf92f35…` | ✅ nếu có tracing |
| `caller` | string | `paymentSvc.go:88` | nên có |
| `latency_ms` | number | `42` | ở access log |
| `error.type` / `error.stack` | string | `TimeoutError` / … | ở error log |

> **Cardinality cảnh báo:** field OK nhiều giá trị (unlike Prometheus label). Nhưng đừng nhét cả
> response body/khối JSON lớn vào mỗi dòng — tốn storage + chậm ingest.

---

## 3. Log levels — dùng nhất quán

| Level | Khi nào | Ví dụ | ❌ Đừng dùng cho |
|---|---|---|---|
| `debug` | Chi tiết chẩn đoán, chỉ bật ở dev/sampling | "cache key = …", payload nhỏ | Bật tràn ở prod |
| `info` | Sự kiện vận hành bình thường, đổi trạng thái | "user registered", "order placed" | Mọi dòng vòng lặp |
| `warn` | Bất thường nhưng đã xử lý được | "retry 2/3", "fallback to cache" | Lỗi thật (dùng error) |
| `error` | Thất bại ảnh hưởng request hiện tại | "payment gateway 500" | Lỗi input hợp lệ của user |
| `fatal` | Chết service, cần can thiệp ngay | "cannot connect DB at boot" | Lỗi 1 request lẻ |

**Prod mặc định `info`.** Bật `debug` toàn cục ở prod = ngập log + rò dữ liệu.

---

## 4. Snippet theo stack (chọn theo Q1)

### Go — `log/slog` (chuẩn thư viện, Go 1.21+)

```go
package logger

import (
    "context"
    "log/slog"
    "os"
)

type ctxKey string
const RequestIDKey ctxKey = "request_id"

func Init(env, version string) *slog.Logger {
    level := slog.LevelInfo
    if env == "development" {
        level = slog.LevelDebug
    }
    h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level:     level,
        AddSource: true, // → field "source" (caller)
    })
    l := slog.New(h).With(
        slog.String("service", "payment-api"),
        slog.String("version", version),
        slog.String("env", env),
    )
    slog.SetDefault(l)
    return l
}

// Lấy logger đã gắn request_id/trace_id từ context
func From(ctx context.Context) *slog.Logger {
    l := slog.Default()
    if rid, ok := ctx.Value(RequestIDKey).(string); ok {
        l = l.With(slog.String("request_id", rid))
    }
    return l
}
```

**Gin middleware — access log + request_id (nối vào [`monitoring.md`](monitoring.md) middleware):**

```go
func RequestLogger() gin.HandlerFunc {
    return func(c *gin.Context) {
        rid := c.GetHeader("X-Request-ID")
        if rid == "" { rid = uuid.NewString() }
        ctx := context.WithValue(c.Request.Context(), logger.RequestIDKey, rid)
        c.Request = c.Request.WithContext(ctx)
        c.Header("X-Request-ID", rid)

        start := time.Now()
        c.Next()

        logger.From(ctx).Info("http_request",
            slog.String("method", c.Request.Method),
            slog.String("path", c.FullPath()),        // pattern, không phải UUID
            slog.Int("status", c.Writer.Status()),
            slog.Int64("latency_ms", time.Since(start).Milliseconds()),
            slog.String("ip", c.ClientIP()),
        )
    }
}
```

> Muốn nhanh + zero-alloc: dùng `zerolog` hoặc `zap`. API khác nhưng field + JSON output giữ nguyên.

### Node — `pino`

```js
import pino from 'pino'

export const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'payment-api', version: process.env.APP_VERSION, env: process.env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['req.headers.authorization', 'password', 'token', '*.card_number'], // ← §6
})

// Express middleware — child logger mang request_id
export function requestLogger(req, res, next) {
  const rid = req.headers['x-request-id'] || crypto.randomUUID()
  req.log = log.child({ request_id: rid })
  res.setHeader('x-request-id', rid)
  const start = Date.now()
  res.on('finish', () => {
    req.log.info({ method: req.method, path: req.route?.path || 'unknown',
      status: res.statusCode, latency_ms: Date.now() - start }, 'http_request')
  })
  next()
}
```

### Python — `structlog`

```python
import structlog, logging, sys

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,   # request_id từ contextvars
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.dict_tracebacks,       # stack có cấu trúc
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)
log = structlog.get_logger(service="payment-api", version="1.3.0", env="production")

# log.info("payment_completed", order_id=oid, amount=amount)
```

---

## 5. Correlation — nối log trong request và xuyên service

```
Client ──X-Request-ID──► Service A ──traceparent──► Service B ──► Service C
             │ mọi log của A mang request_id + trace_id
             └ B, C nhận trace_id qua header, log tiếp cùng trace_id
```

- **Trong 1 request:** gắn `request_id` vào context/MDC ở middleware → mọi log con tự mang theo.
  Không truyền tay qua từng hàm.
- **Xuyên service (HTTP):** truyền header `traceparent` (chuẩn W3C, OTel tự làm). Service nhận đọc
  ra `trace_id` → gắn vào logger.
- **Xuyên queue (RabbitMQ/Kafka):** nhét `trace_id` vào message header/metadata, worker đọc lại.
  Xem [`rabbitmq.md`](../skills/rabbitmq/rabbitmq.md) — thêm field vào message struct.
- **Log ↔ Trace:** cùng `trace_id` → click từ Grafana/Loki nhảy thẳng sang Jaeger/Tempo.

---

## 6. Security & Privacy — KHÔNG log những thứ này

**Danh sách cấm log thô:**
- Password, token, JWT, API key, `Authorization` header, cookie session
- Số thẻ, CVV, số tài khoản ngân hàng
- PII: email/SĐT/địa chỉ/CCCD đầy đủ, dữ liệu sức khoẻ
- Raw request/response body của endpoint nhạy cảm (auth, payment)

**Cách xử lý:**
```
email  → hash hoặc mask: "a***@gmail.com"
token  → chỉ log 4 ký tự cuối: "…a1b2" hoặc bỏ hẳn
user   → log user_id (opaque), KHÔNG log tên/email
card   → chỉ 4 số cuối: "**** 4242"
```
- Redact **tại nguồn** (config redact của pino/zap, processor của structlog) — không dựa vào việc
  "nhớ không log".
- Access control cho log platform + retention policy (GDPR: xoá theo hạn, PCI: không lưu PAN).
- Audit việc truy cập log của hệ thống nhạy cảm.

> Gắn với [`device-fingerprint.md`](device-fingerprint.md): visitorId **không** log ở level INFO.

---

## 7. Error logging — log một lần, đủ ngữ cảnh

- **Log lỗi MỘT lần, ở boundary trên cùng** (handler/middleware), không log lại ở mỗi tầng khi
  bubble up → tránh 1 lỗi thành 5 dòng.
- Kèm đủ: `error.type`, `message`, `error.stack`, và chuỗi nguyên nhân (wrapped/`errors.Is`,
  `cause`).
- Kèm ngữ cảnh request (`request_id`, `order_id`, input đã redact).
- Phân biệt: lỗi hệ thống (`error`) vs input user sai (`warn`/không log, chỉ trả 4xx).

```go
// ❌ Sai — log ở mọi tầng
func repo() error { ...; log.Error("db failed", err); return err }
func svc()  error { ...; log.Error("svc failed", err); return err }  // trùng

// ✅ Đúng — trả lỗi có wrap, log 1 lần ở handler
func repo() error { return fmt.Errorf("insert payment: %w", err) }
func handler(c *gin.Context) {
    if err := svc.Pay(...); err != nil {
        logger.From(ctx).Error("payment_failed",
            slog.String("order_id", oid), slog.Any("error", err))
        c.JSON(500, gin.H{"error": "INTERNAL"})
    }
}
```

---

## 8. Performance & Aggregation

**Performance:**
- Async/non-blocking logging — không chặn request thread (pino, zap async).
- Sampling DEBUG ở prod: log 1/N dòng debug volume cao, giữ 100% error/warn.
- Đừng log trong hot loop → gộp thành 1 dòng summary.

**Aggregation:**
- Gom log mọi service về 1 nơi: **Loki** (nhẹ, hợp Grafana) hoặc **ELK** (mạnh, nặng). Dev nhỏ → Loki.
- Docker driver hoặc agent (promtail/vector/fluent-bit) đọc stdout → đẩy về.
- Rotation + retention: prod thường 15–30 ngày hot, archive lâu hơn nếu cần compliance.
- Alert theo pattern log: `level=error rate > X`, hoặc chuỗi lỗi cụ thể.
- Rate-limit log spam: 1 lỗi lặp 10k lần/phút → sample, đừng ghi hết.

---

## 9. Message guidelines

- Message ngắn, mô tả **event đã xảy ra**, dạng `snake_case` ổn định để filter: `payment_completed`,
  `http_request`, `db_connect_failed`.
- Dữ liệu biến thiên (id, số tiền) là **field**, không nhét vào message string.
- Cấm message generic: "Error occurred", "Done", "Success" (không filter/hiểu được).
- Thuật ngữ nhất quán toàn app.

```
❌ log.Error("Something went wrong with user 12345 amount 500")
✅ log.Error("payment_failed", user_id=12345, amount=500, error.type="Timeout")
```

---

## 10. Cấu hình theo môi trường

| Env | Level | Output | Ghi chú |
|---|---|---|---|
| Development | `debug` | console pretty (pino-pretty / tint) | verbose, dễ đọc |
| Staging | `info` | JSON | full context, giống prod |
| Production | `info` (`warn` nếu ồn) | JSON → stdout | sampling debug, redact bật |

```
LOG_LEVEL=info
LOG_FORMAT=json          # dev có thể =pretty
APP_VERSION=1.3.0
APP_ENV=production
```

---

## 11. Pre-ship checklist

- [ ] Log ra stdout dạng JSON, 1 dòng/event (không printf, không ghi file trong app)
- [ ] Mọi dòng có: timestamp, level, message, service, version, env
- [ ] Middleware gắn `request_id`, phát header `X-Request-ID`, mọi log con mang theo
- [ ] Có tracing → log mang `trace_id` (nối log ↔ Jaeger/Tempo)
- [ ] Access log có method/path(pattern)/status/latency_ms
- [ ] Redact bật: không có password/token/PII/card trong log (test thử endpoint auth + payment)
- [ ] Level đúng: input user sai không phải `error`; lỗi log **một lần** ở boundary
- [ ] Prod = info; debug có sampling; async không chặn request
- [ ] Log đẩy về Loki/ELK; có rotation + retention + alert theo pattern error
- [ ] Message dạng snake_case ổn định, dữ liệu biến thiên là field

---

## 12. Anti-patterns

- `fmt.Println` / `console.log` / `print` rải rác thay vì logger có cấu trúc → không filter được.
- Ghi log ra file trong app rồi tự rotate → để Docker/agent lo, app chỉ stdout.
- Log cùng một lỗi ở repo + service + handler → 1 lỗi thành nhiều dòng, khó đếm.
- Log password/token/PII "để debug" → rò rỉ compliance; redact tại nguồn.
- Bật `debug` toàn cục ở prod → ngập log + lộ dữ liệu + tốn tiền storage.
- Message generic "error"/"done" + nhồi biến vào chuỗi → không filter, không hiểu.
- Không có `request_id`/`trace_id` → không nối được các dòng của cùng một request.
- Level sai: input user sai (400) log thành `error` → nhiễu alert, che lỗi thật.
- Nhét cả response body lớn vào mỗi dòng log → chậm ingest, phình storage.
- Log đồng bộ chặn thread trong hot path → tăng latency request.

---

## 13. Khi nào chạy /logging

- Service mới, cần chuẩn logging từ đầu.
- Log hiện tại là `printf` lộn xộn, không filter/correlate được.
- Vừa thêm tracing → cần nối `trace_id` vào log.
- Trước khi đẩy log lên Loki/ELK (cần format nhất quán).
- Sau sự cố "không tìm được log của request nào" → thiếu request_id/correlation.
- Sau đó dùng [`observability.md`](observability.md) để ghép metrics + traces + SLO.
