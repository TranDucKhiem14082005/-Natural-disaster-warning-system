# /db-index — Database Indexing Strategy Playbook

> *"Index giống mục lục sách — không lật từng trang, tra mục lục rồi nhảy thẳng đến trang cần tìm."*

Áp dụng cho: PostgreSQL, MySQL/MariaDB, MongoDB (đánh dấu khác biệt theo engine). Dùng khi
truy vấn chậm, cần thiết kế index cho bảng mới, hoặc audit index thừa/thiếu trên một dự án.

---

## 0. Discovery — hỏi trước khi đề xuất index

| # | Câu hỏi | Vì sao quan trọng |
|---|---------|---------------------|
| D1 | DB engine gì? (Postgres / MySQL / MariaDB / MongoDB) | Cú pháp + loại index hỗ trợ khác nhau hoàn toàn |
| D2 | Query nào đang chậm? (`EXPLAIN ANALYZE` output nếu có) | Không đoán — index sai chỗ tốn dung lượng mà không tăng tốc |
| D3 | Bảng có bao nhiêu dòng, tăng bao nhiêu/ngày? | Bảng nhỏ (< 10k dòng) thường không cần index, full scan đã đủ nhanh |
| D4 | Tỷ lệ đọc/ghi (read-heavy hay write-heavy)? | Mỗi index thêm = ghi chậm hơn. Bảng ghi nhiều (log, event) phải cân nhắc kỹ |
| D5 | Query lọc theo range, equality, hay full-text? | Quyết định B-Tree vs Hash vs GIN/Full-text |

Không có `EXPLAIN ANALYZE` → chạy trước khi đề xuất bất kỳ index nào:

```sql
-- Postgres / MySQL
EXPLAIN ANALYZE SELECT * FROM orders WHERE created_at >= '2024-10-18' AND created_at < '2024-10-25';
```

```js
// MongoDB
db.orders.find({ createdAt: { $gte: ISODate("2024-10-18"), $lt: ISODate("2024-10-25") } }).explain("executionStats")
```

Đọc kết quả: `Seq Scan` / `COLLSCAN` = không dùng index (chậm). `Index Scan` / `IXSCAN` = đang dùng index.

---

## 1. B-Tree Index — "Cây thư mục phân cấp"

**Dùng khi:** tìm theo khoảng giá trị (range), sắp xếp (`ORDER BY`), hoặc so sánh `>`, `<`, `BETWEEN`.
**Ví dụ đời thực:** thư viện tra mục lục theo năm xuất bản thay vì đi dọc từng kệ.

```sql
-- Postgres / MySQL — mặc định B-Tree, không cần khai báo loại
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Query hưởng lợi:
SELECT * FROM orders WHERE created_at >= '2024-10-18' AND created_at < '2024-10-25';
-- 2 triệu bản ghi: full scan ~8s → index scan ~45ms
```

```js
// MongoDB
db.orders.createIndex({ createdAt: 1 })  // 1 = ascending, -1 = descending
```

---

## 2. Hash Index — "Tủ hồ sơ thông minh"

**Dùng khi:** CHỈ so khớp chính xác (`=`). KHÔNG dùng được cho range, `LIKE`, hay `ORDER BY`.
**Ví dụ đời thực:** tủ chìa khóa khách sạn — tra đúng số phòng, không cần tìm theo khoảng.

```sql
-- Postgres — Hash index (hiếm dùng, B-Tree đã đủ nhanh cho equality trong hầu hết trường hợp)
CREATE INDEX idx_sessions_token ON sessions USING HASH (token);

-- MySQL — chỉ InnoDB Memory engine hỗ trợ HASH tường minh; InnoDB mặc định dùng B-Tree
-- (InnoDB tự tối ưu B-Tree cho equality lookup, không cần ép kiểu HASH)
```

```js
// MongoDB — hashed index, dùng cho sharding key phân bố đều
db.sessions.createIndex({ token: "hashed" })
```

> **Lưu ý:** Trong thực tế, đa số DB engine (Postgres, MySQL InnoDB) khuyến nghị dùng B-Tree
> ngay cả cho equality lookup — B-Tree hỗ trợ cả `=` lẫn range, còn Hash chỉ hỗ trợ `=`. Chỉ chọn
> Hash khi đã benchmark thấy lợi ích rõ ràng (bảng cực lớn, chỉ query `=`, không bao giờ range/sort).

---

## 3. Specialized Indexes — công cụ đặc biệt cho nhu cầu đặc biệt

### 3.1 Full-Text Search — "Tìm kiếm toàn văn"

Thay `LIKE '%keyword%'` (luôn full scan, không dùng được index thường) bằng full-text index:

```sql
-- Postgres — GIN index + tsvector
ALTER TABLE articles ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || body)) STORED;
CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);

SELECT * FROM articles WHERE search_vector @@ to_tsquery('english', 'database & index');
```

```sql
-- MySQL — FULLTEXT index (InnoDB/MyISAM)
CREATE FULLTEXT INDEX idx_articles_search ON articles(title, body);
SELECT * FROM articles WHERE MATCH(title, body) AGAINST('database index' IN NATURAL LANGUAGE MODE);
```

```js
// MongoDB — text index
db.articles.createIndex({ title: "text", body: "text" })
db.articles.find({ $text: { $search: "database index" } })
```

> Full-text search phức tạp (typo tolerance, ranking, facet) → cân nhắc Elasticsearch/Meilisearch
> thay vì ép DB engine chính làm full-text — xem thêm nếu dự án cần search UX nâng cao.

### 3.2 Spatial Index — "Bản đồ GPS"

Tìm "tất cả điểm trong bán kính N km" mà không tính khoảng cách từng dòng:

```sql
-- Postgres — cần extension PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE restaurants ADD COLUMN location geography(Point, 4326);
CREATE INDEX idx_restaurants_location ON restaurants USING GIST (location);

SELECT * FROM restaurants
WHERE ST_DWithin(location, ST_MakePoint(106.7009, 10.7769)::geography, 5000); -- 5km
```

```sql
-- MySQL — SPATIAL index (InnoDB >= 5.7)
ALTER TABLE restaurants ADD COLUMN location POINT NOT NULL SRID 4326;
CREATE SPATIAL INDEX idx_restaurants_location ON restaurants(location);
```

```js
// MongoDB — 2dsphere index
db.restaurants.createIndex({ location: "2dsphere" })
db.restaurants.find({ location: { $near: { $geometry: { type: "Point", coordinates: [106.7009, 10.7769] }, $maxDistance: 5000 } } })
```

### 3.3 Partial Index — "Đánh chỉ mục có điều kiện"

Chỉ index những dòng thường được truy vấn, bỏ qua phần còn lại → index nhỏ hơn, nhanh hơn.

```sql
-- Postgres — partial index (rất mạnh, dùng nhiều trong production)
CREATE INDEX idx_orders_pending ON orders(created_at) WHERE status = 'pending';
-- Chỉ hữu ích nếu query LUÔN có điều kiện WHERE status = 'pending' khớp chính xác

-- MySQL — KHÔNG hỗ trợ partial index trực tiếp (trước MySQL 8.0.13)
-- Workaround: dùng generated column + index trên generated column
ALTER TABLE orders ADD COLUMN is_pending BOOLEAN GENERATED ALWAYS AS (status = 'pending') STORED;
CREATE INDEX idx_orders_is_pending ON orders(is_pending, created_at);
```

```js
// MongoDB — partial index
db.orders.createIndex({ createdAt: 1 }, { partialFilterExpression: { status: "pending" } })
```

---

## 4. Composite Index — nguyên tắc "trái sang phải" (leftmost prefix)

Index `(A, B, C)` chỉ hiệu quả cho query lọc theo `A`, `A+B`, hoặc `A+B+C`.
**KHÔNG hiệu quả** nếu bỏ qua cột đầu tiên `A`.

**Ví dụ đời thực:** danh bạ sắp xếp theo Họ → Tên → Số nhà. Tìm nhanh "Nguyễn Văn A" hoặc
"Nguyễn" được, nhưng không tìm nhanh tất cả người tên "Văn" hay số nhà "12" vì đã bỏ qua Họ.

```sql
CREATE INDEX idx_users_lastname_firstname_dob ON users(last_name, first_name, date_of_birth);

-- ✅ Dùng được index (khớp leftmost prefix)
SELECT * FROM users WHERE last_name = 'Nguyen';
SELECT * FROM users WHERE last_name = 'Nguyen' AND first_name = 'Van';
SELECT * FROM users WHERE last_name = 'Nguyen' AND first_name = 'Van' AND date_of_birth = '1990-01-01';

-- ❌ KHÔNG dùng được index hiệu quả (bỏ qua last_name)
SELECT * FROM users WHERE first_name = 'Van';
SELECT * FROM users WHERE date_of_birth = '1990-01-01';
```

**Quy tắc chọn thứ tự cột trong composite index:**
1. Cột dùng `=` (equality) đặt trước cột dùng range (`>`, `<`, `BETWEEN`).
2. Cột có độ chọn lọc cao (cardinality cao — nhiều giá trị khác nhau) đặt trước.
3. Cột xuất hiện trong hầu hết query đặt trước cột chỉ dùng thỉnh thoảng.

```sql
-- Đúng thứ tự: status (equality, ít giá trị) TRƯỚC created_at (range)
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
SELECT * FROM orders WHERE status = 'completed' AND created_at >= '2024-01-01';
```

MongoDB áp dụng cùng nguyên tắc ESR (**E**quality → **S**ort → **R**ange):

```js
// Query: find({status: "completed"}).sort({createdAt: -1})
db.orders.createIndex({ status: 1, createdAt: -1 })
```

---

## 5. Covering Index — index bao phủ toàn bộ query

Index chứa đủ mọi cột query cần → DB trả lời thẳng từ index, không cần đọc bảng gốc (no
"table lookup" / "bookmark lookup").

```sql
-- Postgres — INCLUDE để thêm cột không cần sort/filter nhưng cần SELECT
CREATE INDEX idx_orders_covering ON orders(status, created_at) INCLUDE (total_amount, customer_id);

SELECT total_amount, customer_id FROM orders
WHERE status = 'completed' AND created_at >= '2024-01-01';
-- Toàn bộ query trả lời từ index — Postgres gọi đây là "Index Only Scan"
```

```sql
-- MySQL — không có INCLUDE, phải thêm cột trực tiếp vào composite index
CREATE INDEX idx_orders_covering ON orders(status, created_at, total_amount, customer_id);
```

```js
// MongoDB — covered query: mọi field trong query + projection đều nằm trong index
db.orders.createIndex({ status: 1, createdAt: 1, totalAmount: 1, customerId: 1 })
db.orders.find({ status: "completed" }, { totalAmount: 1, customerId: 1, _id: 0 })
```

> **Trade-off:** covering index tốn thêm dung lượng đĩa + chậm hơn khi `INSERT/UPDATE/DELETE`
> (mỗi lần ghi phải cập nhật cả index). Chỉ áp dụng cho query cực kỳ quan trọng/tần suất cao
> (dashboard, API hot-path) — không áp dụng tràn lan.

---

## 6. Bảo trì Index — dọn dẹp định kỳ

Theo thời gian, index bị "phình" (bloat) do bản ghi đã xóa/update vẫn chiếm chỗ trong cấu trúc
B-Tree (giống tủ sách bỏ sách đi nhưng chỗ trống không được dọn ngay).

```sql
-- Postgres
VACUUM ANALYZE orders;              -- dọn dead tuples + cập nhật thống kê planner
REINDEX INDEX CONCURRENTLY idx_orders_status_created;  -- rebuild không khóa bảng (Postgres 12+)

-- Tìm index không được dùng (candidate để xóa)
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Tìm index trùng lặp/thừa (cùng cột, khác thứ tự tên)
SELECT indrelid::regclass, array_agg(indexrelid::regclass) AS duplicate_indexes
FROM pg_index
GROUP BY indrelid, indkey
HAVING COUNT(*) > 1;
```

```sql
-- MySQL
OPTIMIZE TABLE orders;              -- rebuild table + index, giải phóng dung lượng
ANALYZE TABLE orders;               -- cập nhật thống kê cho query optimizer

-- Tìm index không dùng (cần bật performance_schema trước)
SELECT object_schema, object_name, index_name
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE index_name IS NOT NULL AND count_star = 0
ORDER BY object_schema, object_name;
```

```js
// MongoDB
db.orders.reIndex()                          // rebuild toàn bộ index của collection
db.orders.aggregate([{ $indexStats: {} }])    // xem tần suất dùng từng index — index có "accesses.ops": 0 là candidate xóa
```

**Lịch bảo trì đề xuất:**

| Task | Tần suất | Ghi chú |
|---|---|---|
| `VACUUM ANALYZE` (Postgres autovacuum) | Tự động, kiểm tra config mỗi quý | Đảm bảo `autovacuum` không bị tắt trên bảng lớn |
| Rà soát index không dùng (`idx_scan = 0`) | Hàng tháng | Xóa index không dùng sau ít nhất 30 ngày quan sát (tránh xóa index dùng cho báo cáo cuối tháng/quý) |
| `REINDEX CONCURRENTLY` bảng ghi nhiều | Hàng quý hoặc khi thấy index bloat > 30% | Không khóa bảng, an toàn chạy trên prod |
| Rà soát index trùng lặp | Sau mỗi đợt thêm index mới | Composite index thừa gây tốn ghi mà không tăng tốc đọc |

---

## 7. Checklist trước khi thêm index mới

- [ ] Đã chạy `EXPLAIN ANALYZE` xác nhận query thật sự chậm và đang full scan
- [ ] Bảng có > 10k dòng (bảng nhỏ hơn thường không cần index)
- [ ] Đã xác định loại truy vấn: equality / range / sort / full-text / spatial → chọn đúng loại index
- [ ] Composite index đặt cột equality trước, cột range/sort sau (nguyên tắc leftmost prefix / ESR)
- [ ] Đã kiểm tra không trùng với index đã có (cùng leftmost columns)
- [ ] Đã cân nhắc write overhead — bảng ghi nhiều (log/event) hạn chế số lượng index
- [ ] Đã đo lại `EXPLAIN ANALYZE` SAU khi thêm index — xác nhận chuyển từ Seq Scan → Index Scan
- [ ] Đã lên lịch rà soát index không dùng định kỳ (Section 6)

---

## 8. Anti-patterns

- Thêm index cho MỌI cột "để cho chắc" — mỗi index làm chậm `INSERT/UPDATE/DELETE`, tốn dung lượng đĩa.
- Composite index sai thứ tự cột (range trước equality) — làm giảm hiệu quả leftmost prefix.
- Dùng `LIKE '%keyword%'` (wildcard ở đầu) rồi kỳ vọng index thường tăng tốc — B-Tree không hỗ trợ, phải dùng full-text/trigram (`pg_trgm` cho Postgres).
- Tạo Hash index cho cột thỉnh thoảng cần range/sort — Hash chỉ hỗ trợ `=`, phải tạo thêm B-Tree song song → tốn gấp đôi.
- Covering index cho mọi query — chỉ dùng cho hot-path thật sự quan trọng, không tràn lan vì tốn ghi.
- Không bao giờ rà soát index không dùng — index chết vẫn tốn dung lượng + chậm ghi vô thời hạn.
- Thêm index trên bảng nhỏ (< 10k dòng) — planner thường chọn full scan vì rẻ hơn, index chỉ thêm overhead.
- Chạy `REINDEX` (không `CONCURRENTLY`) trên bảng lớn ở giờ cao điểm — khóa bảng, gây downtime.

---

## 9. Adapter theo DB Engine — tổng hợp nhanh

| Nhu cầu | PostgreSQL | MySQL / MariaDB | MongoDB |
|---|---|---|---|
| Range/sort | B-Tree (mặc định) | B-Tree (mặc định, InnoDB) | `{field: 1}` |
| Equality-only | B-Tree (khuyến nghị) hoặc `USING HASH` | B-Tree (InnoDB tự tối ưu) | `{field: "hashed"}` (chủ yếu cho sharding) |
| Full-text | GIN + `tsvector` | `FULLTEXT` | Text index |
| Spatial | GIST + PostGIS | `SPATIAL` (InnoDB) | `2dsphere` |
| Điều kiện lọc | Partial index (`WHERE`) | Không hỗ trợ trực tiếp — dùng generated column | `partialFilterExpression` |
| Covering | `INCLUDE (...)` | Thêm cột vào composite index | Field nằm sẵn trong index + projection |
| Rebuild không khóa | `REINDEX CONCURRENTLY` | `OPTIMIZE TABLE` (khóa bảng MyISAM, online với InnoDB) | `reIndex()` |
| Tìm index không dùng | `pg_stat_user_indexes` | `performance_schema` | `$indexStats` |

---

## 10. Khi nào dùng /db-index

- Query báo cáo (dashboard, admin panel) chạy chậm dần khi dữ liệu tăng.
- Thiết kế bảng mới, cần quyết định index nào cần tạo trước khi ship.
- Audit định kỳ: tìm index thừa (tốn ghi) hoặc thiếu (query chậm).
- Chuẩn bị scale — trước khi traffic tăng đột biến (campaign, Black Friday...).
- Không cần chạy nếu bảng còn nhỏ (< 10k dòng) và chưa có dấu hiệu chậm — index sớm quá là tối ưu sai chỗ.
