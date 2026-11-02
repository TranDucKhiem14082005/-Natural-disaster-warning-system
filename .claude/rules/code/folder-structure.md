# Folder Structure — Per-Language / Per-Framework Canonical Layout

> **Level:** MANDATORY when a stack is chosen.
> **Rule:** Khi user chọn (hoặc dự án đang dùng) một ngôn ngữ / framework trong bảng dưới,
> **PHẢI** theo đúng cấu trúc thư mục chuẩn tương ứng. Không tự chế layout riêng, không trộn
> convention của framework khác.

---

## How to use

1. Xác định stack thật của dự án (đọc `package.json`, `go.mod`, `pyproject.toml`, `pom.xml`,
   config file, thư mục hiện có) — **không đoán**.
2. Tra bảng "Reference Layout" bên dưới → mở link chuẩn tương ứng làm nguồn sự thật.
3. Tạo file/thư mục mới đúng vị trí quy ước của layout đó.
4. Nếu dự án đã có layout khác chuẩn nhưng nhất quán → **theo layout hiện có của dự án**, không
   refactor toàn bộ chỉ để khớp chuẩn (trừ khi user yêu cầu rõ). Chuẩn dưới đây áp cho **dự án
   mới** hoặc phần mới thêm vào.
5. Repo này đã có [`project-structure.md`](project-structure.md) mô tả Go chi tiết — với Go, ưu
   tiên file đó; bảng dưới là bản tổng hợp đa ngôn ngữ.

---

## Reference Layout — bảng tra nhanh

| Stack | Reference chuẩn | Thư mục gốc bắt buộc |
|---|---|---|
| **Go + Gin** | https://github.com/golang-standards/project-layout | `cmd/` `internal/` `pkg/` `api/` `configs/` `migrations/` |
| **ReactJS (SPA)** | https://github.com/fdhhhdjd/react-enterprise-boilerplate | `src/` → `components/` `pages/` `features/` `hooks/` `services/` `store/` `utils/` |
| **Next.js (App Router)** | https://nextjs.org/docs/app/getting-started/project-structure | `app/` `components/` `lib/` `public/` (route colocation) |
| **Node.js + Express** | https://github.com/goldbergyoni/nodebestpractices | `src/` → `components/` (per-domain) `libraries/` + `config/` `test/` |
| **NestJS** | https://docs.nestjs.com/ (module-per-feature) | `src/` → `<feature>/` (`*.module.ts` `*.controller.ts` `*.service.ts`) `common/` `config/` |
| **Python + FastAPI** | https://github.com/zhanymkanov/fastapi-best-practices | `src/` → `<domain>/` (`router.py` `service.py` `schemas.py` `models.py`) |
| **Python + Django** | https://docs.djangoproject.com/ + app-per-feature | `<project>/` `apps/<app>/` (`models.py` `views.py` `urls.py` `admin.py`) |
| **Vue 3 / Nuxt** | https://vuejs.org/guide/scaling-up/ + Nuxt convention | `src/` → `components/` `views/`|`pages/` `composables/` `stores/` `router/` |
| **Java + Spring Boot** | https://docs.spring.io/ (layered / package-by-feature) | `src/main/java/<pkg>/` → `controller/` `service/` `repository/` `model/` `config/` |
| **Rust** | https://doc.rust-lang.org/cargo/guide/project-layout.html | `src/` (`main.rs`/`lib.rs`) `src/bin/` `tests/` `benches/` `examples/` |
| **Flutter** | https://docs.flutter.dev/ (feature-first) | `lib/` → `features/<feature>/` (`data/` `domain/` `presentation/`) `core/` |

> Link không mở được (offline) → theo mô tả cột "Thư mục gốc bắt buộc" + Detail bên dưới.

---

## Detail per stack

### Go + Gin — `golang-standards/project-layout`

```
project/
├── cmd/<app>/main.go        # entry points (server, cronjob, worker)
├── internal/                # private code, không import từ ngoài
│   ├── controllers/         # HTTP handlers (thin)
│   ├── routers/             # route + middleware chain
│   ├── middlewares/
│   ├── service/             # business logic
│   ├── repo/                # data access
│   └── models/
├── pkg/                     # public reusable packages
├── api/                     # OpenAPI/proto spec
├── configs/                 # config files
├── migrations/              # SQL migrations
├── global/                  # DB/Redis/Config singletons
├── go.mod
└── Makefile
```
Rule: handler mỏng → service → repo. `internal/` cho code riêng, `pkg/` cho code tái sử dụng.
Chi tiết đầy đủ: [`project-structure.md`](project-structure.md).

### ReactJS (SPA) — `react-enterprise-boilerplate`

```
src/
├── components/              # UI dùng chung, không gắn business
├── pages/                   # route-level components
├── features/               # feature-first: mỗi feature gom component+hook+api+slice
│   └── <feature>/
│       ├── components/
│       ├── hooks/
│       ├── api/
│       └── slice.js
├── hooks/                   # shared hooks
├── services/ (hoặc api/)    # axios instance, API clients
├── store/                   # redux/zustand global state
├── routes/
├── utils/
├── assets/
└── App.jsx
```
Rule: file kebab-case, component PascalCase. Business logic gom trong `features/`, không nhét hết
vào `pages/`. Axios instance + interceptor ở 1 chỗ (`services/`).

### Next.js (App Router)

```
project/
├── app/                    # routing = folder structure
│   ├── layout.tsx
│   ├── page.tsx
│   └── <route>/page.tsx
├── components/             # UI tái sử dụng
├── lib/                    # helpers, db client, server utils
├── public/                 # static assets
└── next.config.*
```
Rule: colocation — file riêng của 1 route (`components/`, `actions.ts`) đặt cùng thư mục route đó.
Server Component là mặc định; chỉ `"use client"` khi cần.

### Node.js + Express — `nodebestpractices`

```
src/
├── components/             # package-by-feature, KHÔNG layer-by-type toàn cục
│   └── <domain>/
│       ├── <domain>.controller.js
│       ├── <domain>.service.js
│       ├── <domain>.repository.js
│       └── <domain>.routes.js
├── libraries/              # cross-cutting: logger, error handler
├── config/
└── app.js
test/
```
Rule: chia theo **domain**, không gom toàn bộ controller/service vào 1 folder phẳng.

### NestJS

```
src/
├── <feature>/
│   ├── <feature>.module.ts
│   ├── <feature>.controller.ts
│   ├── <feature>.service.ts
│   ├── dto/
│   └── entities/
├── common/                 # guards, interceptors, filters, pipes
├── config/
├── app.module.ts
└── main.ts
```
Rule: 1 feature = 1 module. Guard/interceptor dùng chung ở `common/`.

### Python + FastAPI — `fastapi-best-practices`

```
src/
├── <domain>/
│   ├── router.py           # endpoints
│   ├── service.py          # business logic
│   ├── schemas.py          # pydantic models
│   ├── models.py           # ORM models
│   ├── dependencies.py
│   └── exceptions.py
├── config.py
├── database.py
└── main.py
tests/
```
Rule: chia theo domain, mỗi domain đủ router/service/schema/model. Không đặt hết vào `main.py`.

### Python + Django

```
project/
├── manage.py
├── <config>/               # settings, urls, wsgi
└── apps/
    └── <app>/
        ├── models.py
        ├── views.py
        ├── urls.py
        ├── serializers.py   # nếu DRF
        ├── admin.py
        └── migrations/
```
Rule: 1 chức năng = 1 Django app. Business logic tách khỏi views khi phức tạp (`services.py`).

### Vue 3 / Nuxt

```
src/                        # (Nuxt: dùng root convention, không cần src/)
├── components/
├── views/ | pages/         # pages/ auto-route với Nuxt/vue-router file-based
├── composables/            # logic tái sử dụng (use*)
├── stores/                 # Pinia
├── router/
├── assets/
└── App.vue
```
Rule: logic tái sử dụng vào `composables/` (`useXxx`), state vào Pinia `stores/`.

### Java + Spring Boot

```
src/main/java/<pkg>/
├── controller/
├── service/
├── repository/
├── model/ (hoặc entity/)
├── dto/
├── config/
└── Application.java
src/main/resources/         # application.yml, static, templates
src/test/java/
```
Rule: layered (controller→service→repository) hoặc package-by-feature. Chọn 1, giữ nhất quán.

### Rust — Cargo layout

```
crate/
├── Cargo.toml
├── src/
│   ├── main.rs             # binary crate
│   ├── lib.rs              # library crate
│   └── bin/<name>.rs       # binary phụ
├── tests/                  # integration tests
├── benches/
└── examples/
```
Rule: theo đúng Cargo convention — Cargo auto-discover, không config path thủ công.

### Flutter — feature-first

```
lib/
├── main.dart
├── core/                   # theme, constants, shared utils, di
└── features/
    └── <feature>/
        ├── data/           # models, datasources, repositories impl
        ├── domain/         # entities, repository interfaces, usecases
        └── presentation/   # widgets, pages, state (bloc/provider)
```
Rule: mỗi feature 3 lớp data/domain/presentation (Clean Architecture).

---

## Chọn giữa 2 pattern chính

| Pattern | Khi nào | Áp cho |
|---|---|---|
| **Layer-by-type** (controllers/, services/, models/ toàn cục) | Dự án nhỏ, ít domain | Go, Spring layered đơn giản |
| **Feature/Package-by-domain** (mỗi feature gom đủ thứ) | Dự án vừa→lớn, nhiều domain độc lập | React features/, NestJS, FastAPI, Express nodebestpractices |

> Dự án lớn → ưu tiên **feature-first**. Không trộn 2 pattern trong cùng codebase.

---

## Anti-patterns

- Tự chế cấu trúc thư mục riêng khi stack đã có chuẩn rõ ràng.
- Trộn convention: Next.js `app/` router + đồng thời tự làm router thủ công kiểu SPA.
- Nhét toàn bộ logic vào `pages/` (React) hoặc `main.py`/`app.js` (backend) thay vì tách domain.
- Đặt `internal/` code Go vào `pkg/` (mất tính private) hoặc ngược lại.
- Layer-by-type cho dự án lớn nhiều domain → folder phẳng khổng lồ, khó tìm.
- Refactor toàn bộ layout của dự án đang chạy chỉ để khớp chuẩn, khi user không yêu cầu.

---

## Checklist khi tạo file mới trong dự án

- [ ] Đã xác định đúng stack (đọc manifest, không đoán)?
- [ ] Layout dự án hiện có nhất quán → theo dự án. Dự án mới → theo chuẩn ở bảng.
- [ ] File mới đặt đúng thư mục quy ước của stack (controller vào `controllers/`/`router.py`...)?
- [ ] Naming đúng convention ngôn ngữ (Go `camelCase.go`, React `PascalCase.jsx` + kebab file...)?
- [ ] Không trộn 2 pattern (layer-by-type vs feature-first) trong cùng codebase?
