# Asset Placement — File KHÔNG phải `.md` cũng phải nằm đúng chỗ, gốc dự án luôn sạch

> **Level:** MANDATORY.
> **Rule:** Khi AI tạo (hoặc tải về) một file **không phải `.md`** cho dự án — `.html`, `.json`,
> `.csv`, ảnh, `.sh`/`.py` tiện ích, `.zip`, dump, export, screenshot… → **PHẢI** đặt vào đúng thư
> mục theo loại/mục đích, **KHÔNG** vứt ở **thư mục gốc** hay rải lung tung.
> **Cặp đôi với [docs-placement](docs-placement.md):** file đó lo `.md`, file này lo **mọi loại còn lại**.
>
> Mục tiêu: **gốc dự án chỉ chứa file cấu hình/quy ước bắt buộc ở gốc** — không có artifact lạc lõng.

---

## Nguyên tắc 1 câu

> File ở gốc dự án phải **bắt buộc ở gốc** (tool/convention yêu cầu). Mọi thứ khác → vào thư mục của nó.

---

## Cấu trúc đích (mặc định — theo [folder-structure](../code/folder-structure.md) nếu dự án đã có khác)

```
<gốc dự án>/
├── (chỉ file cấu hình/quy ước — xem "NGOẠI LỆ")
├── docs/           # .md + .html/diagram/report cho CON NGƯỜI đọc (qua docs-placement: 06-design cho sơ đồ…)
├── assets/         # ảnh/media DÙNG LÂU DÀI trong repo: logo, icon, screenshot tài liệu (.png/.jpg/.svg/.webp/.gif/.mp4)
├── data/           # dữ liệu & export KHÔNG phải config: .json/.csv/.xml/.yaml/.ndjson, dump, fixture lớn
│   └── <nguồn>/    #   chia subfolder theo nguồn/mục đích (vd data/exports/, data/samples/)
├── scripts/        # script tiện ích ONE-OFF không thuộc app: .sh/.py/.js/.mjs tooling, migration thủ công
└── tmp/ | downloads/   # file tải về / trung gian / untrusted — GITIGNORE (xem docs-placement style)
```

> Dự án đã có quy ước khác (vd `public/`, `static/`, `test/fixtures/`) → **theo cái có sẵn**, không tự đẻ thư mục trùng vai trò.

---

## Quyết định: file này đi đâu?

| Loại file / mục đích | Đặt ở |
|---|---|
| `.html` tự chứa cho người xem: sơ đồ, report, explainer, trang preview | `docs/<nhóm>/` (chọn nhóm qua [docs-placement](docs-placement.md); sơ đồ → `06-design/`, report kỹ thuật → `02-ky-thuat/`) |
| Ảnh/media dùng lâu dài trong repo (logo, icon, screenshot cho doc) | `assets/` (hoặc `docs/<nhóm>/assets/` nếu gắn chặt 1 doc) |
| Dữ liệu / export / dump (`.json`,`.csv`,`.xml`,`.yaml` **là DATA, không phải config**) | `data/<nguồn>/` |
| Fixture/sample dữ liệu cho test | theo [folder-structure](../code/folder-structure.md) (`test/fixtures/`, `__fixtures__/`); chưa có → `data/samples/` |
| Script tiện ích one-off (không phải code app) | `scripts/` |
| File tải về / archive / third-party / untrusted | `tmp/` hoặc `downloads/` (gitignore); repo lạ → [/repo-scan](../../commands/repo-scan.md) trước khi tin |
| Output do build/tool sinh ra (`dist/`, `.next/`, `coverage/`, `*.log`) | thư mục build của tool + **gitignore**, KHÔNG commit |

> Không chắc → hỏi user 1 câu ngắn; vẫn không rõ → `tmp/` (gitignored), **KHÔNG để ở gốc**.

---

## Naming (giống docs-placement)

- **kebab-case** có nghĩa: `order-flow.html`, `users-export-2026-10.json`.
- Không dấu tiếng Việt, không khoảng trắng.
- Có yếu tố thời gian → prefix ISO date: `2026-10-29-db-dump.json`.
- Cấm tên vô nghĩa: `test.html`, `data.json`, `tmp.json`, `untitled.*`, `new.*`.

---

## NGOẠI LỆ — PHẢI giữ nguyên ở gốc / path tool yêu cầu (tuyệt đối không di chuyển)

Di chuyển mấy file này = **hỏng dự án**. Luôn giữ nguyên:

- **Toàn bộ `.claude/**`** — skills (`SKILL.md`), rules, commands, references, agents, plans, và mọi file
  phụ của chúng (`.json`,`.yaml`,`.sh`,`.html`…). Đây là instruction/asset của skill, đặt sai là hỏng nạp context.
- **Manifest / lockfile:** `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`,
  `go.mod`, `go.sum`, `composer.json/lock`, `Cargo.toml/lock`, `pyproject.toml`, `requirements*.txt`,
  `Gemfile`, `pom.xml`, `*.csproj`.
- **Config ở gốc theo quy ước tool:** `tsconfig*.json`, `*.config.{js,ts,mjs,cjs}` (vite/next/tailwind/
  jest/eslint/postcss…), `.eslintrc*`, `.prettierrc*`, `.babelrc*`, `.editorconfig`, `.npmrc`,
  `.nvmrc`, `.browserslistrc`, `components.json`, `manifest.json`, `app.json`.
- **Entry HTML của SPA:** `index.html` ở gốc (Vite/CRA) — thuộc app, không phải docs.
- **Hạ tầng/CI:** `Dockerfile*`, `docker-compose*.yml`, `Makefile`, `.github/**`, `.gitlab-ci.yml`,
  `Jenkinsfile`, `*.tf`, `k8s/**`, `netlify.toml`, `vercel.json`, `nginx*.conf`.
- **Env/convention:** `.env*`, `.gitignore`, `.gitattributes`, `.dockerignore`, `LICENSE*`,
  `CHANGELOG*`, `CONTRIBUTING*`, `CODE_OF_CONDUCT*`, `SECURITY*`, `README*` (ở gốc + cạnh module).
- **File app source** nằm trong `src/`, `app/`, `internal/`, `cmd/`… → theo [folder-structure](../code/folder-structure.md),
  KHÔNG phải "artifact lạc chỗ".
- File mà một tool/framework **bắt buộc ở path cố định** (site generator, static host…).

> Nghi ngờ 1 file có phải config/tool-required không → **giữ nguyên + hỏi user**, không tự chuyển.

---

## Quy trình khi AI tạo 1 file không-`.md` mới

1. File này là **artifact** (do người xem/dùng) hay **config/source của app**? Nếu config/source →
   không thuộc rule này (theo tool/[folder-structure](../code/folder-structure.md)).
2. Có rơi vào **NGOẠI LỆ** không? → giữ đúng path quy định.
3. Còn lại → chọn thư mục theo bảng "đi đâu?" → tạo tại đó (tạo thư mục nếu chưa có).
4. File sinh tự động / tải về / trung gian → đặt trong `tmp/` hoặc `downloads/` và **thêm vào `.gitignore`**.
5. `.html` là doc/diagram cho người đọc → theo [docs-placement](docs-placement.md): đặt trong `docs/<nhóm>/`
   và cập nhật index `docs/README.md` như một doc.
6. Báo user đúng 1 dòng: đã đặt file ở đâu.

---

## Di chuyển file lộn xộn đã có ở gốc (chỉ khi user yêu cầu)

- Rule này áp cho **file mới tạo**. KHÔNG tự ý gom/di chuyển hàng loạt file cũ ở gốc khi user không yêu cầu.
- Khi user yêu cầu dọn: **liệt kê trước** từng file + đích đến, chờ duyệt; dùng **`git mv`** (giữ lịch
  sử); file nào là NGOẠI LỆ thì **không đụng**; sửa mọi reference (import/link/path) trỏ tới file đã chuyển.
- File sinh tự động/tải về → không di chuyển mà **gitignore + xoá khỏi tracking** nếu lỡ commit.
- Tuân [write-guard](../../policies/write-guard.md): `mv`/xoá là thao tác cần yêu cầu rõ ràng.

---

## Anti-patterns

- Để `.html`/`.json`/ảnh/`.zip` "tạm" ở **gốc dự án** → rác root, mất dấu.
- Di chuyển nhầm file config (`package.json`, `tsconfig.json`, `index.html` của SPA, `docker-compose.yml`)
  khỏi gốc → **build/CI gãy**.
- Đụng vào file trong `.claude/**` (coi là "json lung tung") → hỏng skill/rule.
- Commit file sinh tự động/tải về (`dist/`, `coverage/`, dump, `node_modules/`) → phình repo. Gitignore.
- Bịa thư mục mới mỗi lần (`stuff/`, `misc/`, `output2/`) → trùng vai trò `data/`/`assets/`/`scripts/`.
- Tên vô nghĩa (`data.json`, `test.html`, `tmp.zip`).
- Tạo xong quên: `.html` là doc thì phải cập nhật index `docs/` (docs-placement); file tải về phải gitignore.
- Tự ý dọn hàng loạt file cũ khi user chưa duyệt (xem mục "Di chuyển").

---

## Checklist trước khi ghi 1 file không-`.md`

- [ ] Không phải config/source/NGOẠI LỆ (nếu là → giữ đúng path tool, bỏ qua rule này)?
- [ ] Đã chọn đúng thư mục theo bảng (`docs/`/`assets/`/`data/`/`scripts/`/`tmp/`)?
- [ ] KHÔNG để file ở gốc dự án?
- [ ] Tên kebab-case có nghĩa, không dấu, không khoảng trắng?
- [ ] File sinh tự động/tải về → đã thêm `.gitignore`?
- [ ] `.html` là doc → đã đặt trong `docs/<nhóm>/` + cập nhật index `docs/README.md` (docs-placement)?
- [ ] Di chuyển file cũ → đã được user duyệt + dùng `git mv` + sửa reference?
