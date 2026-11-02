---
description: SEO Launch Checklist — từ zero đến Google index. Covers landing page, sitemap, robots.txt, meta tags, Search Console, và monitoring. App-agnostic.
---

# /seo — SEO Launch Checklist

> *"Google không thể index trang bạn nếu nó không biết trang bạn tồn tại."*

**Phạm vi:** Bất kỳ web app nào cần xuất hiện trên Google Search.
**Thứ tự:** Làm đúng thứ tự — Phase 1 → 2 → 3 → 4. Không skip.

**Biến — thay trước khi chạy:**
```
<APP_DOMAIN>     ví dụ: nhatky.online
<APP_NAME>       ví dụ: Nhatky.online
<APP_DESC>       ví dụ: Nhật ký online riêng tư, miễn phí mãi mãi
<APP_LANG>       vi hoặc en
<PROD_CONTAINER> ví dụ: <app>-infra-web-1
<PROD_VPS>       ví dụ: my-vps-prod (alias trong ~/.ssh/config)
<PUBLIC_DIR>     đường dẫn tới public/ trong container, ví dụ: /usr/share/nginx/html
```

---

## Phase 1 — Kỹ thuật (local, trước khi deploy)

### 1.1 Landing page tại `/`

**WHY:** Google crawl bot đọc `/` đầu tiên. Nếu `/` redirect thẳng vào app (login/dashboard), bot không thấy nội dung — domain sẽ không có keyword nào để rank.

**CHECK:**
```
Route /  →  Đang render gì?
- Navigate redirect sang /login  ← SAI cho SEO
- Landing page thực có H1, mô tả, CTA  ← ĐÚNG
```

**Yêu cầu tối thiểu cho landing page SEO:**
- `<h1>` chứa keyword chính (ví dụ: "online journal", "task manager")
- Đoạn mô tả 50-100 từ về app là gì, dùng cho ai
- Không có `noindex` meta tag
- Silent renew auth (nếu user đã login → redirect vào app, không show landing)

**Auth pattern cho landing page (React SPA):**
```jsx
const [ready, setReady] = useState(false)

useEffect(() => {
  if (token) { navigate('/home', { replace: true }); return }
  axios.post(`${baseURL}/auth/renew`, {}, { withCredentials: true })
    .then(({ data }) => {
      setAccessToken(data.data.access_token)
      navigate('/home', { replace: true })
    })
    .catch(() => setReady(true))
}, [])

if (!ready) return <Spinner />
```

> ⚠️ **PrivateRoute phải dùng `authed` state riêng** (không phụ thuộc Zustand reactivity) để tránh redirect loop khi LandingPage và PrivateRoute cùng gọi `/renew`:
```jsx
function PrivateRoute({ children }) {
  const [checking, setChecking] = useState(!token)
  const [authed, setAuthed] = useState(!!token)
  // ... sau renew: setAuthed(true), setChecking(false)
  if (checking) return <Spinner />
  return authed ? children : <Navigate to="/login" replace />
}
```

---

### 1.2 `<title>` và `<meta description>`

**File:** `public/index.html` (Vite) hoặc `<Head>` component (Next.js)

**Rules:**
- Title: **45-60 ký tự** — dài hơn Google tự cắt
- Description: **120-155 ký tự** — ngắn hơn bị bỏ phí, dài hơn bị cắt
- Chứa keyword chính (tiếng địa phương nếu target thị trường cụ thể)
- Không dùng generic: "Home", "Welcome", "Trang chủ"

**Template:**
```html
<title><APP_NAME> — <mô tả ngắn 5-8 từ></title>
<meta name="description" content="<keyword chính>, <benefit 1>, <benefit 2>. <CTA ngắn>.">

<!-- Open Graph (cho share lên mạng xã hội) -->
<meta property="og:title" content="<APP_NAME> — <tagline>">
<meta property="og:description" content="<mô tả 1 câu>">
<meta property="og:image" content="https://<APP_DOMAIN>/og-image.png">
<meta property="og:url" content="https://<APP_DOMAIN>/">
<meta property="og:type" content="website">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<APP_NAME>">
<meta name="twitter:description" content="<mô tả>">
<meta name="twitter:image" content="https://<APP_DOMAIN>/og-image.png">

<!-- Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "<APP_NAME>",
  "url": "https://<APP_DOMAIN>",
  "description": "<APP_DESC>",
  "inLanguage": "<APP_LANG>",
  "applicationCategory": "LifestyleApplication",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
}
</script>
```

**VERIFY:**
```bash
# Check title length (phải < 60 ký tự)
echo -n "Your title here" | wc -c

# Check description length (phải < 155 ký tự)
echo -n "Your description here" | wc -c
```

---

### 1.3 `robots.txt`

**File:** `public/robots.txt`

```txt
User-agent: *
Allow: /
Disallow: /journals/
Disallow: /account
Disallow: /admin-panel/
Disallow: /api/

Sitemap: https://<APP_DOMAIN>/sitemap.xml
```

**Rules:**
- `Disallow` các route yêu cầu auth — bot không cần crawl
- `Disallow` `/api/` — tránh bot crawl API endpoints
- `Sitemap:` line **bắt buộc** — giúp Google tìm sitemap

---

### 1.4 `sitemap.xml`

**File:** `public/sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://<APP_DOMAIN>/</loc>
    <lastmod>2026-06-21</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://<APP_DOMAIN>/register</loc>
    <lastmod>2026-06-21</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://<APP_DOMAIN>/login</loc>
    <lastmod>2026-06-21</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <!-- Thêm các public page khác nếu có -->
</urlset>
```

> ⚠️ **Khi inject bằng SSH vào container, dùng `printf` — KHÔNG dùng heredoc.**
> Heredoc xóa quotes trong XML attributes → `version=1.0` thay vì `version="1.0"` → Google báo lỗi "Định dạng tệp không được hỗ trợ".

---

## Phase 2 — Deploy lên Prod

### 2.1 Deploy qua git (nếu có deploy key trên VPS)

```bash
# Backend + Frontend cùng tag
git tag v<X.Y.Z>
git push origin v<X.Y.Z>

ssh <PROD_VPS> "
  cd /opt/<app>/<frontend-repo>
  git fetch --tags --force
  git checkout v<X.Y.Z>
  cd /opt/<app>/infra
  docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache web
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps web
"
```

### 2.2 Inject file vào container (workaround khi chưa có deploy key)

```bash
# robots.txt
ssh <PROD_VPS> "docker exec <PROD_CONTAINER> sh -c 'cat > <PUBLIC_DIR>/robots.txt'" << 'ROBOTS'
User-agent: *
Allow: /
Disallow: /journals/
Sitemap: https://<APP_DOMAIN>/sitemap.xml
ROBOTS

# sitemap.xml — PHẢI dùng printf, không dùng heredoc
ssh <PROD_VPS> "docker exec <PROD_CONTAINER> sh -c \"printf '%s' '\
<?xml version=\"1.0\" encoding=\"UTF-8\"?>\
<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\
  <url><loc>https://<APP_DOMAIN>/</loc><lastmod>$(date +%F)</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\
</urlset>' > <PUBLIC_DIR>/sitemap.xml\""

# VERIFY
ssh <PROD_VPS> "curl -s https://<APP_DOMAIN>/sitemap.xml | head -3"
ssh <PROD_VPS> "curl -s https://<APP_DOMAIN>/robots.txt"
```

> ⚠️ **File inject vào container bị mất nếu container bị recreate.** Fix vĩnh viễn: setup GitHub deploy key trên VPS (xem `/ssh-vps`).

### 2.3 Verify sau deploy

```bash
# Title đúng chưa
curl -s https://<APP_DOMAIN>/ | grep -o '<title>[^<]*</title>'

# robots.txt đúng chưa
curl -s https://<APP_DOMAIN>/robots.txt

# sitemap.xml valid XML không
curl -s https://<APP_DOMAIN>/sitemap.xml | python3 -c "import sys; import xml.etree.ElementTree as ET; ET.parse(sys.stdin); print('XML valid')"

# noindex check — phải KHÔNG có dòng nào in ra
curl -s https://<APP_DOMAIN>/ | grep -i "noindex"
```

---

## Phase 3 — Google Search Console

### 3.1 Setup (1 lần duy nhất per domain)

1. Vào [search.google.com/search-console](https://search.google.com/search-console)
2. **Thêm thuộc tính** → chọn **"Domain"** (không phải "URL prefix") → nhập `<APP_DOMAIN>`
3. **Xác minh qua DNS:**
   - Copy TXT record Google cấp
   - Vào Cloudflare DNS → Add record → Type: TXT, Name: `@`, Value: paste giá trị
   - Quay lại Search Console → Xác minh
   - DNS propagation: 5-30 phút

### 3.2 Submit sitemap

1. Menu trái → **Sơ đồ trang web (Sitemaps)**
2. Nhập **full URL**: `https://<APP_DOMAIN>/sitemap.xml` (không phải chỉ `sitemap.xml`)
3. Bấm **Gửi**
4. Verify trạng thái: phải thấy "Thành công" sau vài phút

> ⚠️ Lỗi "Định dạng tệp không được hỗ trợ" → file XML bị mất quotes. Kiểm tra `curl -s https://<APP_DOMAIN>/sitemap.xml | head -1` — phải thấy `version="1.0"` có ngoặc kép.

### 3.3 Request Indexing cho từng URL public

1. Menu trái → **Kiểm tra URL**
2. Nhập `https://<APP_DOMAIN>/` → Enter
3. Bấm **"Yêu cầu lập chỉ mục"**
4. Lặp lại cho `/register`, `/login`, và mọi public page trong sitemap

**Dấu hiệu thành công:**
- "Google có thể lập chỉ mục URL này" ✅
- "Đã yêu cầu lập chỉ mục" ✅
- Preview bên phải hiện đúng landing page

---

## Phase 4 — Monitor

### Timeline thực tế

| Mốc | Thời gian | Hành động |
|---|---|---|
| Sau Request Indexing | 1-7 ngày | Google recrawl và cập nhật index |
| Sau khi index | 2-4 tuần | Bắt đầu xuất hiện trong search results |
| Ranking keyword cạnh tranh | 2-3 tháng | Cần backlink + content |

### Cách check

```bash
# Check Google đã index chưa (chạy từ máy, không dùng tool US-proxy)
# → Mở Google.com → search: site:<APP_DOMAIN>
# Kết quả xuất hiện = đã index

# Check Search Console
# → Tổng quan → "Tổng số lần hiển thị" bắt đầu tăng = đang index
```

### Checklist theo dõi hàng tuần (4 tuần đầu)

- [ ] Search `site:<APP_DOMAIN>` — số trang được index tăng?
- [ ] Search Console → Coverage → số URL "Hợp lệ" tăng?
- [ ] Search Console → Hiệu suất → có impression nào chưa?
- [ ] Title + Description hiển thị đúng trong kết quả search?

---

## Checklist Tổng — Trước Khi Đánh Dấu Done

### Phase 1 — Kỹ thuật
- [ ] Route `/` render landing page (không redirect thẳng vào auth)
- [ ] Landing page có `<h1>` chứa keyword chính
- [ ] Silent renew + spinner trong khi check auth
- [ ] `<title>` 45-60 ký tự, có keyword
- [ ] `<meta description>` 120-155 ký tự
- [ ] OG tags: og:title, og:description, og:image, og:url
- [ ] JSON-LD structured data
- [ ] `robots.txt` tồn tại và có `Sitemap:` line
- [ ] `sitemap.xml` tồn tại, valid XML, có tất cả public URL

### Phase 2 — Deploy
- [ ] `curl https://<APP_DOMAIN>/sitemap.xml` → XML valid, có ngoặc kép
- [ ] `curl https://<APP_DOMAIN>/robots.txt` → đúng nội dung
- [ ] `grep noindex` trên homepage → không có kết quả

### Phase 3 — Search Console
- [ ] Domain verified
- [ ] Sitemap submitted → trạng thái "Thành công"
- [ ] Request Indexing cho tất cả public URL trong sitemap

### Phase 4 — Monitor
- [ ] Lịch nhắc: check sau 7 ngày, 30 ngày, 90 ngày

---

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| "Định dạng tệp không được hỗ trợ" (sitemap) | Heredoc xóa quotes trong XML | Dùng `printf` thay heredoc |
| "Địa chỉ sơ đồ trang web không hợp lệ" | Nhập tên file thay vì full URL | Nhập `https://domain/sitemap.xml` |
| ERR_TOO_MANY_REDIRECTS | LandingPage + PrivateRoute cùng gọi `/renew`, Zustand chưa hydrate | PrivateRoute dùng `authed` state riêng, không check Zustand trực tiếp |
| Landing page bị noindex | React page set `noindex` trong `useEffect` | Kiểm tra Helmet/Head component trong trang |
| Sitemap mất sau vài ngày | File inject vào container bị xóa khi recreate | Setup GitHub deploy key, commit vào repo |
| Google cache cũ (domain trước đây là parking) | Index chưa được cập nhật | Request Indexing + chờ 1-7 ngày |
| WebSearch tool thấy kết quả cũ | Tool chạy từ US IP, Google geo-serve khác | Verify trực tiếp từ máy + Search Console |
