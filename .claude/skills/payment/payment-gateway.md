# /payment-gateway — SePay + VietQR Implementation Guide

> Activate: khi user yêu cầu implement payment, donation, hoặc VietQR vào một project.
> Always read `.claude/references/sepay-integration-playbook.md` first — it is the source of truth.

---

## When to Trigger

- User nói: "implement payment", "thêm donation", "tích hợp SePay", "VietQR", "payment gateway"
- Task liên quan đến: tạo payment record, QR code thanh toán, webhook từ ngân hàng, admin Money Ledger

---

## Step-by-Step Execution

### Step 1 — Read playbook + understand current project

```
1. Read .claude/references/sepay-integration-playbook.md (toàn bộ)
2. Check project structure: Go backend? React frontend? Admin panel?
3. Ask user (nếu chưa rõ):
   - Tên prefix cho reference_code? (VD: "SHOP", "EDU", "GAME")
   - Có reward/credits system không? Reward bao nhiêu? Min amount?
   - Table name: "payments" hay "donations" hay "orders"?
   - Admin panel có không?
```

### Step 2 — DB migrations (theo thứ tự)

```
File 1: NNN_payments.sql          (từ Phần 3.2 của playbook)
File 2: NNN_payment_activity_log.sql  (từ Phần 9 của playbook)

Thay thế:
- "donations" → tên table của project mới
- reference_code prefix → prefix user chọn
```

### Step 3 — Backend (Go)

Order: repo → service → controller → router

```
Tạo:  internal/repo/paymentRepo.go           (CRUD + admin list)
Tạo:  internal/repo/paymentActivityRepo.go   (LogActivity, GetWebhookAttemptCount, GetActivity)
Tạo:  internal/service/paymentService.go     (CreatePayment, HandleWebhook, AdminComplete)
Tạo:  internal/controllers/paymentController.go
Sửa:  internal/routers/router.go             (thêm 5 routes)
Sửa:  configs/config.go                      (thêm SePayConfig struct)
Sửa:  configs/yaml/config.dev.yaml           (thêm sepay: section)
```

Adapter rule — những gì phải đổi:
- Package import path (`<ref-app>/` → `your-app/`)
- Table name trong SQL
- reference_code prefix trong `GenerateReferenceCode()`
- Reward logic: tìm dòng reward credit → thay bằng reward function của app mới
- Nếu không có reward → xóa phần reward, giữ nguyên `status_changed` log

### Step 4 — Frontend (React)

```
Tạo: src/components/PaymentModal.jsx   (từ Phần 4.2 của playbook)
Tạo: src/api/payment.js

Sửa nếu cần:
- Amount presets (mặc định: 10k, 20k, 50k, 100k)
- Success message text
- Timeout duration (mặc định 15 phút)
- Trigger point (nút donation ở đâu trong app)
```

### Step 5 — Admin panel (nếu có)

```
Tạo: admin/src/pages/Payments.jsx     (Money Ledger + Transaction Detail Modal)
Sửa: admin/src/components/Layout.jsx  (thêm sidebar link)
Sửa: admin/src/App.jsx                (thêm route /payments)
Sửa: admin/src/pages/Users.jsx        (thêm cột "Paid" nếu cần)
```

### Step 6 — Env vars

```
Thêm vào .env.example (không thêm giá trị thật):
SEPAY_BANK_CODE=
SEPAY_ACCOUNT_NO=
SEPAY_ACCOUNT_NAME=
# Nếu dùng HMAC (SePay Pro):
SEPAY_WEBHOOK_SECRET=
```

### Step 7 — Apply migrations + test

```bash
# Dev VPS
ssh <dev-vps> "cat" < migrations/NNN_payments.sql | ssh <dev-vps> "docker exec -i <db> psql -U <user> -d <db>"
ssh <dev-vps> "cat" < migrations/NNN_payment_activity_log.sql | ssh <dev-vps> "docker exec -i <db> psql -U <user> -d <db>"

# Verify
ssh <dev-vps> "docker exec <db> psql -U <user> -d <db> -c '\d payments'"
ssh <dev-vps> "docker exec <db> psql -U <user> -d <db> -c '\d payment_activity_log'"
```

---

## Security Checklist

- [ ] `SEPAY_ACCOUNT_NO` khớp với số TK trên SePay portal
- [ ] Webhook endpoint không bị rate-limit quá chặt (SePay retry nhiều lần)
- [ ] Idempotency: kiểm tra `status != 'pending'` trước khi process
- [ ] Admin routes sau auth middleware
- [ ] Webhook endpoint public (không cần auth) — nhưng verify account number
- [ ] Nếu SePay Pro: verify HMAC signature (xem Phần 6 trong playbook)

---

## Anti-patterns (không làm)

- Không dùng HMAC nếu SePay free tier — họ không ký webhook
- Không aggregate webhook retries vào 1 row — luôn append row mới (dễ debug)
- Không lưu raw body ở ngoài activity log — lưu trong `meta.raw_body` của `webhook_received`
- Không check `transferAmount` để verify — check `reference_code` + `accountNumber` là đủ
- Không expose `SEPAY_WEBHOOK_SECRET` trong response hoặc logs

---

## Reference

- Full playbook: `.claude/references/sepay-integration-playbook.md`
