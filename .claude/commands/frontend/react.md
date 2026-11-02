---
name: react
description: React performance & composition best practices — re-render, bundle, hooks, composition. Use when writing/reviewing React components.
---

## 1. Bundle Size

**`bundle-barrel-imports`** `[CRITICAL]` — import thẳng từ source, tránh barrel file.
Barrel (`index.js` re-export cả nghìn module) tốn **200–800ms mỗi cold start**; tree-shaking không
cứu được (external → không tối ưu; bundle để tree-shake → build chậm hẳn). Direct import: dev boot
nhanh 15–70%, build nhanh 28%, cold start nhanh 40%.
```tsx
// ❌ import { Check, X } from "lucide-react"      // nạp 1,583 module (~1MB)
// ✅
import Check from "lucide-react/dist/esm/icons/check";
import X from "lucide-react/dist/esm/icons/x";     // 2 module (~2KB)
```
Thư viện hay dính: `lucide-react`, `@mui/material`, `@mui/icons-material`, `react-icons`,
`@tabler/icons-react`, `@headlessui/react`, `@radix-ui/react-*`, `lodash`, `ramda`, `date-fns`, `rxjs`.

**`bundle-conditional`** `[HIGH]` — chỉ nạp module/data lớn khi feature bật.
```tsx
useEffect(() => {
  if (enabled && !frames && typeof window !== "undefined") {
    import("./animation-frames.js").then((m) => setFrames(m.frames)).catch(() => setEnabled(false));
  }
}, [enabled, frames, setEnabled]);
// typeof window !== "undefined" → không bundle module này cho SSR
```

**`bundle-preload`** `[MEDIUM]` — preload lúc hover/focus (hoặc khi flag bật) để giảm độ trễ cảm nhận.
```tsx
const preload = () => { if (typeof window !== "undefined") void import("./monaco-editor"); };
<button onMouseEnter={preload} onFocus={preload} onClick={open}>Open Editor</button>
```

---

## 2. Hooks & useEffect

**`hooks-limit-useeffect`** `[HIGH]` — Effect là **escape hatch** để đồng bộ với hệ thống ngoài,
KHÔNG phải chỗ chứa logic React. Nguồn bug hàng đầu (missing deps, infinite loop, stale closure) +
chạy sau render → thêm re-render.

| Thay vì Effect để… | Dùng |
|---|---|
| Derive state từ props/state | Tính khi render |
| Tính toán đắt | `useMemo` |
| Phản ứng hành động user | Event handler |
| Reset state khi prop đổi | prop `key` (`<Profile key={userId} />`) |
| Transform data để render | Tính khi render |
| **Subscribe hệ ngoài / tích hợp lib bên thứ 3 / analytics** | `useEffect` (đúng chỗ) |

```tsx
// ❌ useState + useEffect(() => setFiltered(items.filter(...)), [items,query])
// ✅ const filtered = items.filter(i => i.name.includes(query))       // derive khi render
// ✅ const filtered = useMemo(() => items.filter(...), [items, query]) // nếu đắt
```

**`hooks-useeffect-named-functions`** `[MEDIUM]` — đặt tên hàm trong `useEffect` (và cả cleanup):
hiện trong stack trace, tự mô tả, ép một concern/effect.
```tsx
useEffect(function subscribeOnline() {
  window.addEventListener("online", handleOnline);
  return function unsubscribeOnline() { window.removeEventListener("online", handleOnline); };
}, []);
```
Quy ước tên: `sync*` / `subscribeTo*` / `initialize*` / `handle*` / `track*` / `reset*` / cleanup `destroy*`/`remove*`/`unsubscribeFrom*`.

---

## 3. Composition

**`composition-avoid-boolean-props`** `[HIGH]` — không thêm boolean prop đổi hành vi; mỗi boolean
nhân đôi số state (2^n), tạo conditional khó bảo trì. **≥2 boolean ảnh hưởng render → dùng composition.**
```tsx
// ❌ <Composer isThread isEditing showAttachments channelId="abc" />
// ✅ <ThreadComposer channelId="abc" />   <EditComposer />
```
Boolean đơn lẻ cho toggle đơn giản thì OK: `<Button isDisabled>`, `<Modal isOpen>`.

**`composition-explicit-variants`** `[MEDIUM]` — thay 1 component nhiều mode bằng các variant tường
minh, tên tự mô tả. Chia sẻ compound components/hooks/utils, **KHÔNG** chia sẻ conditional logic.

**`composition-compound-components`** `[HIGH]` — component phức tạp = compound + shared context;
subcomponent đọc state qua context, không qua prop. **Ranh giới Provider quyết định quyền truy cập,
không phải vị trí lồng nhau** — nút Submit có thể nằm ngoài `Frame` mà vẫn submit được.
```tsx
<Composer.Provider state={state} actions={actions}>
  <Composer.Frame><Composer.Input /><Composer.Footer><Composer.Submit /></Composer.Footer></Composer.Frame>
</Composer.Provider>
```

**`composition-state-provider`** `[HIGH]` — nâng state vào provider để component ngoài UI chính vẫn
truy cập (tránh prop drilling / ref / effect sync ngược). Cùng UI chạy với nhiều provider khác nhau
(local state vs global synced) miễn implement chung interface context.

**`composition-children-over-render-props`** `[MEDIUM]` — ưu tiên `children`; render prop chỉ khi
cần **truyền data ngược** cho consumer.

| Use case | Pattern |
|---|---|
| Cấu trúc tĩnh | `children` |
| Truyền data ngược | render prop |
| Nhiều named slot | compound components |
| Children phụ thuộc state | render prop có state |
```tsx
<Card><Card.Header>Title</Card.Header><Card.Body>Content</Card.Body></Card>
<List data={items} renderItem={({ item }) => <Item {...item} />} />   {/* OK: truyền data */}
```
Render prop không nhận tham số → nên là `children`.

**`composition-avoid-overabstraction`** `[HIGH]` — ưu tiên API dạng element/children gần HTML native
hơn config object cứng nhắc. Cần shared config → dùng context, không prop-drill.
```tsx
// ❌ <Select options={[{label,value}...]} />
// ✅ <Select value="abc" onChange={...}><Option value="abc">ABC</Option></Select>
```

**`composition-typescript-namespaces`** `[LOW]` — gộp component + type qua namespace (một import,
`Button.Props`/`Button.Variant`). **Namespace CHỈ chứa type, không chứa runtime code** (const/function
trong namespace phá tree-shaking).
```tsx
export namespace Button { export type Variant = "solid"|"ghost"; export interface Props { variant?: Variant; children: React.ReactNode } }
export function Button({ variant = "solid", children }: Button.Props) { /* ... */ }
```

---

## 4. Re-render Optimization

**`rerender-derived-state-no-effect`** `[MEDIUM]` — value tính được từ props/state thì **derive khi
render**, đừng lưu state + effect (tránh thừa render + state drift).
```tsx
// ❌ useState("") + useEffect(() => setFullName(a+" "+b), [a,b])
// ✅ const fullName = firstName + " " + lastName
```

**`rerender-derived-state`** `[MEDIUM]` — subscribe boolean đã derive, không phải giá trị liên tục.
```tsx
// ❌ const isMobile = useWindowWidth() < 768   // re-render mỗi pixel
// ✅ const isMobile = useMediaQuery("(max-width: 767px)")
```

**`rerender-functional-setstate`** `[MEDIUM]` — setState phụ thuộc state hiện tại → dùng dạng
functional: callback ổn định + tránh stale closure + bớt dependency.
```tsx
// ❌ useCallback((x) => setItems([...items, x]), [items])   // recreate / stale
// ✅ useCallback((x) => setItems((curr) => [...curr, x]), [])
```
Direct update OK khi set giá trị tĩnh/từ args: `setCount(0)`, `setName(newName)`.

**`rerender-lazy-state-init`** `[MEDIUM]` — giá trị khởi tạo đắt → truyền **hàm** vào `useState`
(nếu không, initializer chạy mỗi render).
```tsx
// ❌ useState(buildSearchIndex(items))       // chạy mỗi render
// ✅ useState(() => buildSearchIndex(items))  // chỉ lần đầu
```
Primitive/cheap literal (`useState(0)`, `useState({})`) không cần dạng hàm.

**`rerender-memo`** `[MEDIUM]` — tách việc nặng ra component `memo` riêng để **early-return trước
khi tính** (thay vì `useMemo` vẫn chạy dù đang loading).
```tsx
const UserAvatar = memo(function UserAvatar({ user }) { const id = useMemo(() => computeAvatarId(user), [user]); return <Avatar id={id} /> });
function Profile({ user, loading }) { if (loading) return <Skeleton />; return <UserAvatar user={user} /> }
```

**`rerender-memo-with-default-value`** `[MEDIUM]` — default non-primitive của component `memo` phải
hoist ra constant (mỗi render tạo instance mới → phá `memo`).
```tsx
const NOOP = () => {};
const Button = memo(({ onClick = NOOP }) => /* ... */);
```

**`rerender-simple-expression-in-memo`** `[LOW-MEDIUM]` — **đừng** bọc biểu thức primitive đơn giản
trong `useMemo` (overhead so sánh dep > chi phí phép tính).
```tsx
// ❌ useMemo(() => a.loading || b.loading, [...])
// ✅ const isLoading = a.loading || b.loading
```

**`rerender-move-effect-to-event`** `[MEDIUM]` — side effect do hành động user (submit/click) chạy
trong **event handler**, không mô hình hoá thành state + effect (tránh effect chạy lại vì thay đổi
không liên quan + double side effect).
```tsx
// ❌ useEffect(() => { if (submitted) post(...) }, [submitted, theme])
// ✅ const handleSubmit = () => { post("/api/register"); showToast("Registered", theme); }
```

**`rerender-dependencies`** `[LOW]` — dep của effect là **primitive** (`user.id`), không phải object
(`user`) → bớt effect chạy thừa.

**`rerender-transitions`** `[MEDIUM]` — update tần suất cao, không khẩn cấp → `startTransition` giữ
UI mượt.
```tsx
const handler = () => startTransition(() => setScrollY(window.scrollY));
```

**`rerender-use-ref-transient-values`** `[MEDIUM]` — giá trị biến thiên liên tục (mouse tracker,
flag tạm) → `useRef` + cập nhật DOM trực tiếp (ref đổi không re-render).
```tsx
const lastXRef = useRef(0), dotRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const onMove = (e) => { lastXRef.current = e.clientX; if (dotRef.current) dotRef.current.style.transform = `translateX(${e.clientX}px)`; };
  window.addEventListener("mousemove", onMove);
  return () => window.removeEventListener("mousemove", onMove);
}, []);
```

---

## 5. Rendering & Hydration

**`rendering-content-visibility`** `[HIGH]` — list dài → `content-visibility: auto` bỏ layout/paint
item ngoài màn hình (~10x render đầu nhanh hơn cho 1000 item).
```css
.list-item { content-visibility: auto; contain-intrinsic-size: 0 80px; }
```

**`rendering-conditional-render`** `[LOW]` — dùng ternary, không dùng `&&` với số (render ra "0").
```tsx
// ❌ {count && <Badge/>}   → khi count=0 render "0"
// ✅ {count > 0 ? <Badge/> : null}
```

**`rendering-hoist-jsx`** `[LOW]` — JSX tĩnh (đặc biệt SVG lớn) hoist ra ngoài component để không tạo lại.
```tsx
const skeleton = <div className="animate-pulse h-20 bg-gray-200" />;
function Container({ loading }) { return loading ? skeleton : <Content />; }
```

**`rendering-animate-svg-wrapper`** `[LOW]` — animate `<div>` bọc ngoài, không animate `<svg>`
(nhiều browser không GPU-accelerate CSS animation trên SVG). `<div className="animate-spin"><svg/></div>`

**`rendering-svg-precision`** `[LOW]` — giảm độ chính xác toạ độ SVG bằng SVGO: `npx svgo --precision=1 --multipass icon.svg`

**`rendering-client-only`** `[MEDIUM]` — component chỉ chạy browser → `<ClientOnly fallback={<Skeleton/>}>{() => <Map/>}</ClientOnly>` (luôn có fallback tránh layout shift).

**`rendering-use-hydrated`** `[MEDIUM]` — SSR/CSR khác nhau → `useHydrated()`: trả cùng fallback ở
SSR + render CSR đầu, đổi sang UI client sau hydrate.

**`rendering-hydration-no-flicker`** `[MEDIUM]` — data từ localStorage/cookie: inline script chạy
đồng bộ set DOM **trước khi** React hydrate → không vỡ SSR, không nhấp nháy (thay vì `useEffect`
set sau hydrate gây flash).

**`rendering-hydration-suppress-warning`** `[LOW-MEDIUM]` — mismatch **dự kiến** (giờ, ngày, random
id) → `<span suppressHydrationWarning>`. Không dùng để giấu bug thật, không lạm dụng.

**`rendering-usetransition-loading`** `[LOW]` — ưu tiên `useTransition` (`isPending`) hơn state
loading thủ công: tự reset kể cả khi throw, tự huỷ transition cũ.
```tsx
const [isPending, startTransition] = useTransition();
const handleSearch = (v) => { setQuery(v); startTransition(async () => setResults(await fetchResults(v))); };
```

**`fault-tolerant-error-boundaries`** `[HIGH]` — đặt error boundary ở **ranh giới feature**, không
chỉ 1 boundary top-level (crash cả app) và không bọc mọi leaf (UI vỡ vụn). Heuristic: *"component này
crash thì sibling có nên crash theo không?"* — không → boundary tại feature này.
```tsx
<ErrorBoundary fallback={<SidebarError/>}><Sidebar/></ErrorBoundary>
<ErrorBoundary fallback={<FeedError/>}><Feed/></ErrorBoundary>
```

---

## 6. Client Patterns

**`client-passive-event-listeners`** `[MEDIUM]` — `{ passive: true }` cho `wheel`/`touchstart` để
scroll không bị chặn chờ listener. Đừng dùng passive nếu cần `preventDefault()` (custom swipe/zoom).
```tsx
document.addEventListener("wheel", handler, { passive: true });
```

**`client-localstorage-schema`** `[MEDIUM]` — version hoá key (`config:v2`) + chỉ lưu field cần +
**luôn bọc try/catch** (`getItem`/`setItem` throw ở incognito/quota/disabled). Tránh lưu token/PII.
```ts
const VERSION = "v2";
function saveConfig(c: Config) { try { localStorage.setItem(`config:${VERSION}`, JSON.stringify(c)); } catch {} }
```

---

## Review output format (khi dùng để review PR)

Bảng Before/After, một dòng một vấn đề — không phải list "Before:/After:" rời:

| Before | After | Rule `[impact]` |
| --- | --- | --- |
| `import { Check } from "lucide-react"` | `import Check from "lucide-react/dist/esm/icons/check"` | bundle-barrel-imports `[CRITICAL]` |
| `useEffect` để derive/transform state | tính khi render / `useMemo` | hooks-limit-useeffect `[HIGH]` |
| `{count && <Badge/>}` | `{count > 0 ? <Badge/> : null}` | rendering-conditional-render `[LOW]` |
| `useState(buildIndex())` | `useState(() => buildIndex())` | rerender-lazy-state-init `[MEDIUM]` |
| `isThread isEditing showX` props | variant components | composition-avoid-boolean-props `[HIGH]` |
| 1 error boundary top-level | boundary theo feature | fault-tolerant-error-boundaries `[HIGH]` |

---

## Checklist trước khi merge component React

- [ ] Đã **profile** (DevTools) trước khi thêm memoization — không đoán bottleneck
- [ ] Import icon/util thẳng từ source, không qua barrel file `[CRITICAL]`
- [ ] Module nặng nạp có điều kiện / lazy; preload lúc hover nếu là tương tác chính
- [ ] Không có `useEffect` để derive/transform state (tính khi render / `useMemo`); reset bằng `key`
- [ ] `useEffect` có tên hàm (+ cleanup có tên); một concern/effect
- [ ] setState phụ thuộc state cũ → functional form; giá trị init đắt → `useState(() => …)`
- [ ] Component nhiều mode dùng composition/variant, không boolean-prop explosion
- [ ] State cần chia sẻ ngoài UI chính → provider; ưu tiên `children` hơn render prop
- [ ] Error boundary theo feature; list dài dùng `content-visibility`
- [ ] `&&` với số đổi sang ternary; không bọc primitive đơn giản trong `useMemo`
- [ ] (React 19 + Compiler) không rải `memo`/`useMemo` thủ công thừa
- [ ] Listener scroll/touch `{ passive: true }`; localStorage version + try/catch

---

## Anti-patterns

- **Tối ưu khi chưa đo** — rải `memo`/`useMemo` khắp nơi chưa profile → phức tạp thừa, có khi chậm hơn.
- **`useEffect` để derive/transform/sync state** — thêm render + state drift; tính khi render / `key` để reset.
- **Barrel import** (`import { X } from "lib"`) — kéo cả library, 200–800ms mỗi cold start.
- **Boolean-prop explosion** (`isThread isEditing showX`) — 2^n state; tách variant.
- **`{count && <X/>}`** với số — render ra "0".
- **`useState(expensive())`** không dạng hàm — chạy lại mỗi render.
- **setState `[...items, x]` với dep `[items]`** — recreate callback / stale closure; dùng functional.
- **1 error boundary top-level** — 1 lỗi sập cả app; đặt theo feature.
- **Namespace chứa runtime code** — phá tree-shaking; namespace chỉ để type.
- **Rải memo thủ công khi đã bật React Compiler** — thừa.
- **`localStorage.getItem/setItem` không try/catch** — throw ở incognito/quota → vỡ app.

---

## Khi nào chạy /react-best-practices

- Viết component mới cần performance tốt từ đầu.
- Review PR React về re-render / bundle / composition / hydration.
- Refactor "boolean-prop explosion" hoặc `useEffect` thừa.
- Trước khi tối ưu bundle (kết hợp bundle analyzer).
- Không dùng cho non-React stack; một phần cho React Native (bỏ rule DOM/hydration/SSR).

---

# Rules — chi tiết đầy đủ (6 nhóm)


## Nhóm: bundle


# React Rules — Bundle Size

Nhóm `bundle`: 3 rule. File con chi tiết của [`react-best-practices.md`](../react-best-practices.md).

---

> Rule: `bundle-barrel-imports` — impact **CRITICAL**


## Avoid Barrel File Imports

Import directly from source files instead of barrel files to avoid loading thousands of unused modules. **Barrel files** are entry points that re-export multiple modules (e.g., `index.js` that does `export * from './module'`).

Popular icon and component libraries can have **up to 10,000 re-exports** in their entry file. For many React packages, **it takes 200-800ms just to import them**, affecting both development speed and production cold starts.

**Why tree-shaking doesn't help:** When a library is marked as external (not bundled), the bundler can't optimize it. If you bundle it to enable tree-shaking, builds become substantially slower analyzing the entire module graph.

**Incorrect (imports entire library):**

```tsx
import { Check, X, Menu } from "lucide-react";
// Loads 1,583 modules, takes ~2.8s extra in dev
// Runtime cost: 200-800ms on every cold start

import { Button, TextField } from "@mui/material";
// Loads 2,225 modules, takes ~4.2s extra in dev
```

**Correct (imports only what you need):**

```tsx
import Check from "lucide-react/dist/esm/icons/check";
import X from "lucide-react/dist/esm/icons/x";
import Menu from "lucide-react/dist/esm/icons/menu";
// Loads only 3 modules (~2KB vs ~1MB)

import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
// Loads only what you use
```

Direct imports provide 15-70% faster dev boot, 28% faster builds, 40% faster cold starts, and significantly faster HMR.

Libraries commonly affected: `lucide-react`, `@mui/material`, `@mui/icons-material`, `@tabler/icons-react`, `react-icons`, `@headlessui/react`, `@radix-ui/react-*`, `lodash`, `ramda`, `date-fns`, `rxjs`, `react-use`.

---

> Rule: `bundle-conditional` — impact **HIGH**


## Conditional Module Loading

Load large data or modules only when a feature is activated.

**Example (lazy-load animation frames):**

```tsx
function AnimationPlayer({
  enabled,
  setEnabled,
}: {
  enabled: boolean;
  setEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [frames, setFrames] = useState<Frame[] | null>(null);

  useEffect(() => {
    if (enabled && !frames && typeof window !== "undefined") {
      import("./animation-frames.js")
        .then((mod) => setFrames(mod.frames))
        .catch(() => setEnabled(false));
    }
  }, [enabled, frames, setEnabled]);

  if (!frames) return <Skeleton />;
  return <Canvas frames={frames} />;
}
```

The `typeof window !== 'undefined'` check prevents bundling this module for SSR, optimizing server bundle size and build speed.

---

> Rule: `bundle-preload` — impact **MEDIUM**


## Preload Based on User Intent

Preload heavy bundles before they're needed to reduce perceived latency.

**Example (preload on hover/focus):**

```tsx
function EditorButton({ onClick }: { onClick: () => void }) {
  let preload = () => {
    if (typeof window !== "undefined") {
      void import("./monaco-editor");
    }
  };

  return (
    <button onMouseEnter={preload} onFocus={preload} onClick={onClick}>
      Open Editor
    </button>
  );
}
```

**Example (preload when feature flag is enabled):**

```tsx
function FlagsProvider({ children, flags }: Props) {
  useEffect(() => {
    if (flags.editorEnabled && typeof window !== "undefined") {
      void import("./monaco-editor").then((mod) => mod.init());
    }
  }, [flags.editorEnabled]);

  return (
    <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>
  );
}
```

The `typeof window !== 'undefined'` check prevents bundling preloaded modules for SSR, optimizing server bundle size and build speed.

## Nhóm: hooks


# React Rules — Hooks & useEffect

Nhóm `hooks`: 2 rule. File con chi tiết của [`react-best-practices.md`](../react-best-practices.md).

---

> Rule: `hooks-limit-useeffect` — impact **HIGH**


## Limit useEffect Usage

Use `useEffect` only when absolutely necessary. Prefer derived state, event handlers, or other patterns.

### Why

1. **Effects are escape hatches** - For synchronizing with external systems, not for React logic
2. **Common source of bugs** - Missing dependencies, infinite loops, stale closures
3. **Performance overhead** - Runs after render, can cause extra re-renders
4. **Usually unnecessary** - Most "effects" are better expressed differently

### When NOT to Use useEffect

#### Deriving State from Props/State

```tsx
// Bad: useEffect to derive state
function FilteredList({ items, query }: Props) {
  let [filtered, setFiltered] = useState(items);

  useEffect(() => {
    setFiltered(items.filter((item) => item.name.includes(query)));
  }, [items, query]);

  return <List items={filtered} />;
}

// Good: derive during render
function FilteredList({ items, query }: Props) {
  let filtered = items.filter((item) => item.name.includes(query));
  return <List items={filtered} />;
}

// Good: useMemo if expensive
function FilteredList({ items, query }: Props) {
  let filtered = useMemo(
    () => items.filter((item) => item.name.includes(query)),
    [items, query],
  );
  return <List items={filtered} />;
}
```

#### Responding to Events

```tsx
// Bad: useEffect to handle form submission result
function Form() {
  let [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) {
      showToast("Submitted!");
      navigate("/success");
    }
  }, [submitted]);

  return <form onSubmit={() => setSubmitted(true)}>...</form>;
}

// Good: handle in event handler
function Form() {
  function handleSubmit() {
    // Do it directly in the handler
    showToast("Submitted!");
    navigate("/success");
  }

  return <form onSubmit={handleSubmit}>...</form>;
}
```

#### Resetting State on Prop Change

```tsx
// Bad: useEffect to reset state
function UserProfile({ userId }: Props) {
  let [user, setUser] = useState(null);

  useEffect(() => {
    setUser(null); // Reset when userId changes
  }, [userId]);
}

// Good: use key to reset component
<UserProfile key={userId} userId={userId} />;
```

#### Transforming Data for Render

```tsx
// Bad: useEffect to transform
function Chart({ data }: Props) {
  let [chartData, setChartData] = useState([]);

  useEffect(() => {
    setChartData(data.map((d) => ({ x: d.date, y: d.value })));
  }, [data]);
}

// Good: transform during render
function Chart({ data }: Props) {
  let chartData = data.map((d) => ({ x: d.date, y: d.value }));
  return <LineChart data={chartData} />;
}
```

### When to Use useEffect

#### Synchronizing with External Systems

```tsx
// Good: subscribing to browser APIs
function useOnlineStatus() {
  let [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
```

#### Connecting to Third-Party Libraries

```tsx
// Good: integrating with non-React code
function Map({ center }: Props) {
  let mapRef = useRef<HTMLDivElement>(null);
  let mapInstance = useRef<MapLibrary | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    mapInstance.current = new MapLibrary(mapRef.current, { center });

    return () => {
      mapInstance.current?.destroy();
    };
  }, []);

  // Update map when center changes
  useEffect(() => {
    mapInstance.current?.setCenter(center);
  }, [center]);

  return <div ref={mapRef} />;
}
```

#### Analytics/Logging (fire and forget)

```tsx
// Good: logging page views
useEffect(() => {
  analytics.logPageView(pathname);
}, [pathname]);
```

### Summary

| Scenario                     | Use Instead               |
| ---------------------------- | ------------------------- |
| Derive state from props      | Calculate during render   |
| Expensive calculation        | `useMemo`                 |
| Respond to user action       | Event handler             |
| Reset state on prop change   | `key` prop                |
| Transform data               | Calculate during render   |
| Subscribe to external system | `useEffect` (correct use) |
| Connect to third-party lib   | `useEffect` (correct use) |

---

> Rule: `hooks-useeffect-named-functions` — impact **MEDIUM**


# Name useEffect Functions

Use named function declarations instead of arrow functions in `useEffect`. Also name cleanup functions.

## Why

1. **Stack traces**: Named functions appear in error stack traces, making debugging easier
2. **Self-documentation**: The function name explains what the effect does
3. **Single responsibility**: Naming encourages one concern per effect
4. **Code review**: Easier to understand effect purpose at a glance

## Bad: Anonymous Arrow Functions

```tsx
// Bad: anonymous functions hide intent
useEffect(() => {
  document.title = title;
}, [title]);

useEffect(() => {
  let handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [onClose]);
```

When these effects error, the stack trace shows `anonymous` or `<anonymous>`.

## Good: Named Function Declarations

```tsx
// Good: named functions are self-documenting
useEffect(
  function syncDocumentTitle() {
    document.title = title;
  },
  [title],
);

useEffect(
  function handleEscapeKey() {
    let handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);

    return function removeEscapeKeyHandler() {
      window.removeEventListener("keydown", handler);
    };
  },
  [onClose],
);
```

Stack traces now show `syncDocumentTitle` or `handleEscapeKey`.

## Pattern Examples

### Data Synchronization

```tsx
useEffect(
  function syncLocalStorage() {
    localStorage.setItem("preferences", JSON.stringify(preferences));
  },
  [preferences],
);
```

### Subscriptions

```tsx
useEffect(function subscribeToOnlineStatus() {
  function handleOnline() {
    setIsOnline(true);
  }
  function handleOffline() {
    setIsOnline(false);
  }

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return function unsubscribeFromOnlineStatus() {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}, []);
```

### Form Reset (Remix pattern)

```tsx
useEffect(
  function resetFormOnSuccess() {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      formRef.current?.reset();
    }
  },
  [fetcher.state, fetcher.data],
);
```

### Third-Party Integration

```tsx
useEffect(function initializeMap() {
  if (!mapRef.current) return;

  let map = new MapLibrary(mapRef.current, { center });
  mapInstanceRef.current = map;

  return function destroyMap() {
    map.destroy();
  };
}, []);
```

### Analytics

```tsx
useEffect(
  function trackPageView() {
    analytics.page(pathname);
  },
  [pathname],
);
```

## Naming Conventions

| Effect Purpose | Name Pattern                                             |
| -------------- | -------------------------------------------------------- |
| Sync data      | `sync[What]` - `syncDocumentTitle`, `syncLocalStorage`   |
| Subscribe      | `subscribeTo[What]` - `subscribeToOnlineStatus`          |
| Initialize     | `initialize[What]` - `initializeMap`, `initializeChart`  |
| Handle event   | `handle[What]` - `handleEscapeKey`, `handleResize`       |
| Track/log      | `track[What]` - `trackPageView`, `logError`              |
| Reset          | `reset[What]` - `resetFormOnSuccess`                     |
| Cleanup        | `destroy[What]`, `remove[What]`, `unsubscribeFrom[What]` |

## Multiple Effects

Named functions make it clear why you have separate effects:

```tsx
function UserProfile({ userId }: Props) {
  useEffect(
    function fetchUserData() {
      // Fetch user when userId changes
    },
    [userId],
  );

  useEffect(
    function trackProfileView() {
      // Analytics - separate concern
      analytics.track("profile_viewed", { userId });
    },
    [userId],
  );

  useEffect(function setupKeyboardShortcuts() {
    // Keyboard handling - separate concern
  }, []);
}
```

## Rules

1. Always use named function declarations in `useEffect`, not arrow functions
2. Name cleanup functions too (`return function cleanup() { ... }`)
3. Use descriptive names that explain the effect's purpose
4. One concern per effect - if you can't name it clearly, split it
5. Follow naming conventions: `sync*`, `subscribeTo*`, `initialize*`, `handle*`, `track*`

## Nhóm: composition


# React Rules — Composition

Nhóm `composition`: 7 rule. File con chi tiết của [`react-best-practices.md`](../react-best-practices.md).

---

> Rule: `composition-avoid-boolean-props` — impact **HIGH**


# Avoid Boolean Prop Proliferation

Don't add boolean props like `isThread`, `isEditing`, `isDMThread` to customize component behavior. Use composition instead.

## Why

- Each boolean doubles possible states (2^n complexity)
- Creates unmaintainable conditional logic inside components
- Hard to reason about all possible combinations
- Changes require modifying the monolithic component

## Bad: Boolean Props

```tsx
function Composer({
  onSubmit,
  isThread,
  channelId,
  isDMThread,
  dmId,
  isEditing,
  isForwarding,
}: Props) {
  return (
    <form>
      <Header />
      <Input />
      {isDMThread ? (
        <AlsoSendToDMField id={dmId} />
      ) : isThread ? (
        <AlsoSendToChannelField id={channelId} />
      ) : null}
      {isEditing ? (
        <EditActions />
      ) : isForwarding ? (
        <ForwardActions />
      ) : (
        <DefaultActions />
      )}
      <Footer onSubmit={onSubmit} />
    </form>
  );
}

// Usage: what does this actually render?
<Composer
  isThread
  isEditing={false}
  channelId="abc"
  showAttachments
  showFormatting={false}
/>;
```

## Good: Explicit Variants via Composition

```tsx
// Each variant is explicit about what it renders
function ChannelComposer() {
  return (
    <Composer.Frame>
      <Composer.Header />
      <Composer.Input />
      <Composer.Footer>
        <Composer.Attachments />
        <Composer.Formatting />
        <Composer.Emojis />
        <Composer.Submit />
      </Composer.Footer>
    </Composer.Frame>
  );
}

function ThreadComposer({ channelId }: { channelId: string }) {
  return (
    <Composer.Frame>
      <Composer.Header />
      <Composer.Input />
      <AlsoSendToChannelField id={channelId} />
      <Composer.Footer>
        <Composer.Formatting />
        <Composer.Emojis />
        <Composer.Submit />
      </Composer.Footer>
    </Composer.Frame>
  );
}

function EditComposer() {
  return (
    <Composer.Frame>
      <Composer.Input />
      <Composer.Footer>
        <Composer.Formatting />
        <Composer.CancelEdit />
        <Composer.SaveEdit />
      </Composer.Footer>
    </Composer.Frame>
  );
}

// Usage: immediately clear what this renders
<ThreadComposer channelId="abc" />
<EditComposer />
```

## When Boolean Props Are OK

Simple, non-combinatorial toggles:

```tsx
// OK: single boolean for a specific feature
<Button isDisabled>Submit</Button>
<Input isReadOnly />
<Modal isOpen={showModal} />

// NOT OK: multiple booleans that change structure
<Form isEditing isThread showAdvanced hideFooter />
```

## Rules

1. If you have 2+ boolean props that affect rendering, use composition
2. Create explicit variant components instead of prop combinations
3. Use compound components to share internals without sharing conditionals
4. Each variant should be self-documenting about what it renders
5. Single boolean props for simple toggles (disabled, loading) are fine

---

> Rule: `composition-explicit-variants` — impact **MEDIUM**


# Create Explicit Component Variants

Instead of one component with many boolean props, create explicit variant components. Each variant composes the pieces it needs.

## Why

- Self-documenting code - the variant name tells you what it does
- No hidden conditionals or impossible state combinations
- Each variant is explicit about its rendering and behavior
- Easier to test, maintain, and reason about

## Bad: One Component, Many Modes

```tsx
// What does this actually render?
<Composer
  isThread
  isEditing={false}
  channelId="abc"
  showAttachments
  showFormatting={false}
/>

// Inside Composer: nested conditionals everywhere
function Composer({ isThread, isEditing, channelId, ... }) {
  return (
    <form>
      {isThread && !isEditing && <ThreadHeader channelId={channelId} />}
      {isEditing && <EditHeader />}
      {!isThread && !isEditing && <DefaultHeader />}
      {/* ... more conditionals */}
    </form>
  );
}
```

## Good: Explicit Variants

```tsx
// Immediately clear what each renders
<ThreadComposer channelId="abc" />
<EditMessageComposer messageId="xyz" />
<ForwardMessageComposer />

// Each implementation is unique, explicit, and self-contained
function ThreadComposer({ channelId }: { channelId: string }) {
  return (
    <ThreadProvider channelId={channelId}>
      <Composer.Frame>
        <Composer.Input />
        <AlsoSendToChannelField channelId={channelId} />
        <Composer.Footer>
          <Composer.Formatting />
          <Composer.Emojis />
          <Composer.Submit />
        </Composer.Footer>
      </Composer.Frame>
    </ThreadProvider>
  );
}

function EditMessageComposer({ messageId }: { messageId: string }) {
  return (
    <EditMessageProvider messageId={messageId}>
      <Composer.Frame>
        <Composer.Input />
        <Composer.Footer>
          <Composer.Formatting />
          <Composer.CancelEdit />
          <Composer.SaveEdit />
        </Composer.Footer>
      </Composer.Frame>
    </EditMessageProvider>
  );
}

function ForwardMessageComposer() {
  return (
    <Composer.Frame>
      <Composer.Input placeholder="Add a message, if you'd like." />
      <Composer.Footer>
        <Composer.Formatting />
        <Composer.Emojis />
      </Composer.Footer>
    </Composer.Frame>
  );
}
```

## Each Variant Is Explicit About

1. **What provider/state it uses** - ThreadProvider, EditMessageProvider, etc.
2. **What UI elements it includes** - which subcomponents are rendered
3. **What actions are available** - Submit vs SaveEdit vs Forward
4. **What props it needs** - channelId, messageId, etc.

## Sharing Logic Between Variants

Variants can share:

- **Compound components** - Composer.Input, Composer.Footer
- **Hooks** - useComposerState, useSubmit
- **Utilities** - formatting functions, validation

But NOT conditional rendering logic.

```tsx
// Shared compound components
function ThreadComposer({ channelId }) {
  return (
    <Composer.Frame>
      <Composer.Input /> {/* Shared */}
      <AlsoSendToChannel /> {/* Thread-specific */}
      <Composer.Footer>
        {" "}
        {/* Shared */}
        <Composer.Submit /> {/* Shared */}
      </Composer.Footer>
    </Composer.Frame>
  );
}

function DMComposer({ dmId }) {
  return (
    <Composer.Frame>
      <Composer.Input /> {/* Shared */}
      <AlsoSendToDM /> {/* DM-specific */}
      <Composer.Footer>
        {" "}
        {/* Shared */}
        <Composer.Submit /> {/* Shared */}
      </Composer.Footer>
    </Composer.Frame>
  );
}
```

## Rules

1. If a component has mode-switching logic, split into variants
2. Name variants descriptively: ThreadComposer, EditComposer, ForwardComposer
3. Each variant should be obvious about what it renders (no hidden behavior)
4. Share internals (compound components, hooks) but not conditional logic
5. No boolean prop combinations to reason about, no impossible states

---

> Rule: `composition-compound-components` — impact **HIGH**


# Use Compound Components

Structure complex components as compound components with shared context. Each subcomponent accesses shared state via context, not props.

## Why

- Consumers compose exactly what they need
- No hidden conditionals or prop drilling
- Subcomponents can be rearranged freely
- State is shared without passing through every component

## Bad: Monolithic with Render Props

```tsx
function Composer({
  renderHeader,
  renderFooter,
  renderActions,
  showAttachments,
  showFormatting,
  showEmojis,
}: Props) {
  return (
    <form>
      {renderHeader?.()}
      <Input />
      {showAttachments && <Attachments />}
      {renderFooter ? (
        renderFooter()
      ) : (
        <Footer>
          {showFormatting && <Formatting />}
          {showEmojis && <Emojis />}
          {renderActions?.()}
        </Footer>
      )}
    </form>
  );
}
```

## Good: Compound Components

```tsx
// Define shared context
interface ComposerContextValue {
  state: ComposerState;
  actions: ComposerActions;
  meta: ComposerMeta;
}

const ComposerContext = createContext<ComposerContextValue | null>(null);

function useComposer() {
  let context = useContext(ComposerContext);
  if (!context) throw new Error("Must be used within Composer.Provider");
  return context;
}

// Provider component
function ComposerProvider({ children, state, actions, meta }: ProviderProps) {
  return (
    <ComposerContext.Provider value={{ state, actions, meta }}>
      {children}
    </ComposerContext.Provider>
  );
}

// Compound components access context
function ComposerFrame({ children }: { children: React.ReactNode }) {
  return <form className="composer">{children}</form>;
}

function ComposerInput() {
  const { state, actions, meta } = useComposer();
  return (
    <textarea
      ref={meta.inputRef}
      value={state.input}
      onChange={(e) => actions.update((s) => ({ ...s, input: e.target.value }))}
    />
  );
}

function ComposerSubmit() {
  const { actions } = useComposer();
  return <Button onPress={actions.submit}>Send</Button>;
}

// Export as namespace
const Composer = {
  Provider: ComposerProvider,
  Frame: ComposerFrame,
  Input: ComposerInput,
  Submit: ComposerSubmit,
  Header: ComposerHeader,
  Footer: ComposerFooter,
  Attachments: ComposerAttachments,
  Formatting: ComposerFormatting,
  Emojis: ComposerEmojis,
};

export { Composer };
```

## Usage

```tsx
// Consumers compose exactly what they need
<Composer.Provider state={state} actions={actions} meta={meta}>
  <Composer.Frame>
    <Composer.Header />
    <Composer.Input />
    <Composer.Footer>
      <Composer.Formatting />
      <Composer.Submit />
    </Composer.Footer>
  </Composer.Frame>
</Composer.Provider>
```

## Pattern: Components Outside the Frame

Components that need state don't have to be visually inside the frame:

```tsx
function ForwardMessageDialog() {
  return (
    <ForwardMessageProvider>
      <Dialog>
        {/* The composer UI */}
        <Composer.Frame>
          <Composer.Input placeholder="Add a message..." />
        </Composer.Frame>

        {/* Preview lives OUTSIDE Composer.Frame but can read state */}
        <MessagePreview />

        {/* Submit button OUTSIDE Composer.Frame but can submit */}
        <DialogActions>
          <CancelButton />
          <ForwardButton />
        </DialogActions>
      </Dialog>
    </ForwardMessageProvider>
  );
}

// These work because they're inside the Provider
function ForwardButton() {
  const { actions } = useComposer();
  return <Button onPress={actions.submit}>Forward</Button>;
}

function MessagePreview() {
  const { state } = useComposer();
  return <Preview message={state.input} />;
}
```

## Rules

1. Define a context for shared state and actions
2. Create small, focused subcomponents that consume context
3. Export as namespace object (Composer.Input, Composer.Submit)
4. Provider boundary determines access, not visual nesting
5. Prefer children over render props for composition

---

> Rule: `composition-state-provider` — impact **HIGH**


# Lift State into Provider Components

Move state management into dedicated provider components. This allows sibling components outside the main UI to access and modify state.

## Why

- Components outside the main UI can access state
- State implementation is decoupled from UI
- Same UI works with different state sources
- No prop drilling or awkward refs

## Bad: State Trapped Inside Component

```tsx
function ForwardMessageComposer() {
  let [state, setState] = useState(initialState);
  let forwardMessage = useForwardMessage();

  return (
    <Composer.Frame>
      <Composer.Input />
      <Composer.Footer />
    </Composer.Frame>
  );
}

// Problem: How does ForwardButton access composer state?
function ForwardMessageDialog() {
  return (
    <Dialog>
      <ForwardMessageComposer />
      <MessagePreview /> {/* Needs composer state - can't access it */}
      <DialogActions>
        <CancelButton />
        <ForwardButton /> {/* Needs to call submit - can't access it */}
      </DialogActions>
    </Dialog>
  );
}
```

## Bad: useEffect to Sync State Up

```tsx
function ForwardMessageDialog() {
  const [input, setInput] = useState("");
  return (
    <Dialog>
      <ForwardMessageComposer onInputChange={setInput} />
      <MessagePreview input={input} />
    </Dialog>
  );
}

function ForwardMessageComposer({ onInputChange }) {
  const [state, setState] = useState(initialState);

  // Syncing state on every change is messy
  useEffect(() => {
    onInputChange(state.input);
  }, [state.input, onInputChange]);
}
```

## Good: State Lifted to Provider

```tsx
function ForwardMessageProvider({ children }: { children: React.ReactNode }) {
  let [state, setState] = useState(initialState);
  let forwardMessage = useForwardMessage();
  let inputRef = useRef(null);

  return (
    <Composer.Provider
      state={state}
      actions={{ update: setState, submit: forwardMessage }}
      meta={{ inputRef }}
    >
      {children}
    </Composer.Provider>
  );
}

function ForwardMessageDialog() {
  return (
    <ForwardMessageProvider>
      <Dialog>
        <ForwardMessageComposer />
        <MessagePreview /> {/* Can access state via context */}
        <DialogActions>
          <CancelButton />
          <ForwardButton /> {/* Can access submit via context */}
        </DialogActions>
      </Dialog>
    </ForwardMessageProvider>
  );
}

function ForwardButton() {
  const { actions } = useComposer();
  return <Button onPress={actions.submit}>Forward</Button>;
}

function MessagePreview() {
  const { state } = useComposer();
  return <Preview message={state.input} attachments={state.attachments} />;
}
```

## Different Providers, Same UI

The same UI components work with different state implementations:

```tsx
// Local state for ephemeral forms
function ForwardMessageProvider({ children }) {
  let [state, setState] = useState(initialState);
  let forwardMessage = useForwardMessage();

  return (
    <Composer.Provider
      state={state}
      actions={{ update: setState, submit: forwardMessage }}
    >
      {children}
    </Composer.Provider>
  );
}

// Global synced state for channels
function ChannelProvider({ channelId, children }) {
  const { state, update, submit } = useGlobalChannel(channelId);

  return (
    <Composer.Provider state={state} actions={{ update, submit }}>
      {children}
    </Composer.Provider>
  );
}

// Same Composer.Input works with both!
<ForwardMessageProvider>
  <Composer.Input /> {/* Uses local state */}
</ForwardMessageProvider>

<ChannelProvider channelId="abc">
  <Composer.Input /> {/* Uses global synced state */}
</ChannelProvider>
```

## Define Generic Context Interface

```tsx
interface ComposerState {
  input: string;
  attachments: Attachment[];
  isSubmitting: boolean;
}

interface ComposerActions {
  update: (updater: (state: ComposerState) => ComposerState) => void;
  submit: () => void;
}

interface ComposerMeta {
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

interface ComposerContextValue {
  state: ComposerState;
  actions: ComposerActions;
  meta: ComposerMeta;
}
```

Any provider that implements this interface works with the UI components.

## Rules

1. State management lives in provider components, not UI components
2. UI components only know about the context interface
3. Different providers can implement the same interface differently
4. Provider boundary is what matters, not visual nesting
5. Components outside the "main" UI can still access state if inside provider

---

> Rule: `composition-children-over-render-props` — impact **MEDIUM**


# Prefer Children Over Render Props

Use `children` for composition instead of `renderX` props. Children are more readable, compose naturally, and don't require understanding callback signatures.

## Why

- More readable and familiar JSX structure
- No callback signatures to understand
- Better composability with other patterns
- Cleaner API surface

## Bad: Render Props

```tsx
function Composer({
  renderHeader,
  renderFooter,
  renderActions,
}: {
  renderHeader?: () => React.ReactNode;
  renderFooter?: () => React.ReactNode;
  renderActions?: () => React.ReactNode;
}) {
  return (
    <form>
      {renderHeader?.()}
      <Input />
      {renderFooter ? renderFooter() : <DefaultFooter />}
      {renderActions?.()}
    </form>
  );
}

// Usage is awkward
<Composer
  renderHeader={() => <CustomHeader />}
  renderFooter={() => (
    <>
      <Formatting />
      <Emojis />
    </>
  )}
  renderActions={() => <SubmitButton />}
/>;
```

## Good: Compound Components with Children

```tsx
function ComposerFrame({ children }: { children: React.ReactNode }) {
  return <form className="composer">{children}</form>;
}

function ComposerFooter({ children }: { children: React.ReactNode }) {
  return <footer className="composer-footer">{children}</footer>;
}

// Usage is natural JSX
<Composer.Frame>
  <CustomHeader />
  <Composer.Input />
  <Composer.Footer>
    <Composer.Formatting />
    <Composer.Emojis />
    <SubmitButton />
  </Composer.Footer>
</Composer.Frame>;
```

## When Render Props Are Appropriate

Render props work well when the parent needs to **provide data** to the child:

```tsx
// GOOD: Render props when passing data back
<List
  data={items}
  renderItem={({ item, index }) => (
    <Item item={item} index={index} />
  )}
/>

// GOOD: Render props for slot patterns with context
<Combobox>
  {({ open, selected }) => (
    <>
      <Combobox.Button>{selected?.name}</Combobox.Button>
      {open && <Combobox.Options />}
    </>
  )}
</Combobox>
```

## Decision Guide

| Use Case                            | Pattern                 |
| ----------------------------------- | ----------------------- |
| Static structure composition        | `children`              |
| Need to pass data back to consumer  | Render props            |
| Multiple named slots                | Compound components     |
| Conditional children based on state | Render props with state |

## Examples

### Static Structure → Children

```tsx
// Children for layout
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

### Data to Consumer → Render Props

```tsx
// Render props when providing data
<Autocomplete
  options={options}
  renderOption={(option, { selected, active }) => (
    <div className={cn(active && "bg-blue-100")}>
      {selected && <Check />}
      {option.label}
    </div>
  )}
/>
```

### Named Slots → Compound Components

```tsx
// Compound components for named slots
<Dialog>
  <Dialog.Title>Confirm</Dialog.Title>
  <Dialog.Description>Are you sure?</Dialog.Description>
  <Dialog.Actions>
    <Button>Cancel</Button>
    <Button>Confirm</Button>
  </Dialog.Actions>
</Dialog>
```

## Rules

1. Default to `children` for composition
2. Use compound components for multiple named slots
3. Use render props only when passing data back to consumer
4. Render props with no arguments should be `children` instead
5. Keep API surface minimal - don't add renderX props "just in case"

---

> Rule: `composition-avoid-overabstraction` — impact **HIGH**


# Avoid Over-Abstracting Component APIs

Prefer composable, element-like APIs over rigid configuration objects.

## Why

- Large abstractions require more configuration surface
- Options objects hide native semantics and limit flexibility
- Children-based APIs are easier to compose and extend

## Pattern

```tsx
// Bad: data-driven options hide native capabilities
type SelectProps = {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
};

function Select({ options, value, onChange }: SelectProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// Good: composable API, close to native HTML
type SelectProps = React.ComponentPropsWithoutRef<"select">;
type OptionProps = React.ComponentPropsWithoutRef<"option">;

function Select({ children, ...props }: SelectProps) {
  return <select {...props}>{children}</select>;
}

function Option({ children, ...props }: OptionProps) {
  return <option {...props}>{children}</option>;
}

<Select value="abc" onChange={...}>
  <Option value="abc">ABC</Option>
  <Option value="xyz">XYZ</Option>
</Select>
```

## When You Need Shared Behavior

Use context for shared config instead of adding more props to every child:

```tsx
const SelectContext = React.createContext({ variant: "default" });

function Select({ variant = "default", children, ...props }: SelectProps & { variant?: string }) {
  return (
    <select {...props}>
      <SelectContext.Provider value={{ variant }}>
        {children}
      </SelectContext.Provider>
    </select>
  );
}

function Option({ children, ...props }: OptionProps) {
  let { variant } = React.useContext(SelectContext);
  return (
    <option {...props} data-variant={variant}>
      {children}
    </option>
  );
}
```

## Rules

1. Keep component abstractions small and focused
2. Prefer children-based APIs over configuration objects
3. Preserve native HTML behavior and props when possible
4. Use context for shared configuration instead of prop drilling

---

> Rule: `composition-typescript-namespaces` — impact **LOW**


# Use TypeScript Namespaces for Component Types

Combine a component and its related types using TypeScript namespaces for cleaner imports.

## Why

- Single import gives you component + all its types
- Avoids naming conflicts (`ButtonProps` vs `Button.Props`)
- Groups related types together (`Button.Props`, `Button.Variant`, `Button.Size`)
- Cleaner API for consumers of the component

## Important: Types Only

**Namespaces should only contain type definitions, never runtime code.**

```tsx
// Good: namespace contains only types
export namespace Button {
  export type Props = { ... };
  export type Variant = "solid" | "ghost";
}

// Bad: namespace contains runtime code
export namespace Button {
  export const defaultVariant = "solid"; // Don't do this
  export function getClassName() { ... } // Don't do this
}
```

## Pattern

```tsx
// components/button.tsx

export namespace Button {
  export type Variant = "solid" | "ghost" | "outline";
  export type Size = "sm" | "md" | "lg";

  export interface Props {
    variant?: Variant;
    size?: Size;
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }
}

export function Button({
  variant = "solid",
  size = "md",
  children,
  onClick,
  disabled,
}: Button.Props) {
  return (
    <button
      className={getButtonClasses(variant, size)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
```

## Usage

Consumers import once and get everything:

```tsx
import { Button } from "~/components/button";

// Use the component
<Button variant="ghost" size="lg">
  Click me
</Button>;

// Use the types
function CustomButton(props: Button.Props) {
  return <Button {...props} />;
}

// Use specific type
function getVariantColor(variant: Button.Variant): string {
  switch (variant) {
    case "solid":
      return "blue";
    case "ghost":
      return "transparent";
    case "outline":
      return "white";
  }
}
```

## Without Namespaces (Comparison)

```tsx
// Without namespace - multiple exports, potential naming conflicts
import {
  Button,
  ButtonProps,
  ButtonVariant,
  ButtonSize,
} from "~/components/button";

// Or with renaming
import { Button, type Props as ButtonProps } from "~/components/button";
```

## Extending Types

When creating a component that extends another:

```tsx
// components/icon-button.tsx
import { Button } from "./button";

export namespace IconButton {
  export interface Props extends Omit<Button.Props, "children"> {
    icon: React.ReactNode;
    label: string; // For accessibility
  }
}

export function IconButton({ icon, label, ...buttonProps }: IconButton.Props) {
  return (
    <Button {...buttonProps} aria-label={label}>
      {icon}
    </Button>
  );
}
```

## Complex Component Example

```tsx
// components/select.tsx

export namespace Select {
  export interface Option<T = string> {
    value: T;
    label: string;
    disabled?: boolean;
  }

  export interface Props<T = string> {
    options: Option<T>[];
    value: T;
    onChange: (value: T) => void;
    placeholder?: string;
    disabled?: boolean;
  }

  export type Size = "sm" | "md" | "lg";
}

export function Select<T extends string>({
  options,
  value,
  onChange,
  placeholder,
  disabled,
}: Select.Props<T>) {
  // Implementation
}
```

Usage:

```tsx
import { Select } from "~/components/select";

type Status = "active" | "inactive" | "pending";

let options: Select.Option<Status>[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" },
];

<Select<Status> options={options} value={status} onChange={setStatus} />;
```

## When to Use

| Scenario                              | Recommendation                  |
| ------------------------------------- | ------------------------------- |
| Simple component with Props only      | Optional - either pattern works |
| Component with multiple related types | Use namespace                   |
| Type might conflict with other types  | Use namespace                   |
| Building a component library          | Use namespace                   |
| Internal utility component            | Optional                        |

## Rules

1. **Types only** - Never put runtime code (values, functions) in namespaces
2. Export both namespace and function with the same name
3. Use `Button.Props` instead of `ButtonProps` naming convention
4. Group all component-related types in the namespace
5. Prefer `interface` for Props, `type` for unions/aliases

## Nhóm: rerender


# React Rules — Re-render

Nhóm `rerender`: 11 rule. File con chi tiết của [`react-best-practices.md`](../react-best-practices.md).

---

> Rule: `rerender-derived-state-no-effect` — impact **MEDIUM**


## Calculate Derived State During Rendering

If a value can be computed from current props/state, do not store it in state or update it in an effect. Derive it during render to avoid extra renders and state drift. Do not set state in effects solely in response to prop changes; prefer derived values or keyed resets instead.

**Incorrect (redundant state and effect):**

```tsx
function Form() {
  const [firstName, setFirstName] = useState("First");
  const [lastName, setLastName] = useState("Last");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    setFullName(firstName + " " + lastName);
  }, [firstName, lastName]);

  return <p>{fullName}</p>;
}
```

**Correct (derive during render):**

```tsx
function Form() {
  let [firstName, setFirstName] = useState("First");
  let [lastName, setLastName] = useState("Last");
  let fullName = firstName + " " + lastName;

  return <p>{fullName}</p>;
}
```

References: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

---

> Rule: `rerender-derived-state` — impact **MEDIUM**


## Subscribe to Derived State

Subscribe to derived boolean state instead of continuous values to reduce re-render frequency.

**Incorrect (re-renders on every pixel change):**

```tsx
function Sidebar() {
  let width = useWindowWidth(); // updates continuously
  let isMobile = width < 768;
  return <nav className={isMobile ? "mobile" : "desktop"} />;
}
```

**Correct (re-renders only when boolean changes):**

```tsx
function Sidebar() {
  let isMobile = useMediaQuery("(max-width: 767px)");
  return <nav className={isMobile ? "mobile" : "desktop"} />;
}
```

---

> Rule: `rerender-functional-setstate` — impact **MEDIUM**


## Use Functional setState Updates

When updating state based on the current state value, use the functional update form of setState instead of directly referencing the state variable. This prevents stale closures, eliminates unnecessary dependencies, and creates stable callback references.

**Incorrect (requires state as dependency):**

```tsx
function TodoList() {
  let [items, setItems] = useState(initialItems)
  
  // Callback must depend on items, recreated on every items change
  let addItems = useCallback((newItems: Item[]) => {
    setItems([...items, ...newItems])
  }, [items])  // items dependency causes recreations
  
  // Risk of stale closure if dependency is forgotten
  let removeItem = useCallback((id: string) => {
    setItems(items.filter(item => item.id !== id))
  }, [])  // Missing items dependency - will use stale items!
  
  return <ItemsEditor items={items} onAdd={addItems} onRemove={removeItem} />
}
```

The first callback is recreated every time `items` changes, which can cause child components to re-render unnecessarily. The second callback has a stale closure bug - it will always reference the initial `items` value.

**Correct (stable callbacks, no stale closures):**

```tsx
function TodoList() {
  let [items, setItems] = useState(initialItems)
  
  // Stable callback, never recreated
  let addItems = useCallback((newItems: Item[]) => {
    setItems(curr => [...curr, ...newItems])
  }, [])  // No dependencies needed
  
  // Always uses latest state, no stale closure risk
  let removeItem = useCallback((id: string) => {
    setItems(curr => curr.filter(item => item.id !== id))
  }, [])  // Safe and stable
  
  return <ItemsEditor items={items} onAdd={addItems} onRemove={removeItem} />
}
```

**Benefits:**

1. **Stable callback references** - Callbacks don't need to be recreated when state changes
2. **No stale closures** - Always operates on the latest state value
3. **Fewer dependencies** - Simplifies dependency arrays and reduces memory leaks
4. **Prevents bugs** - Eliminates the most common source of React closure bugs

**When to use functional updates:**

- Any setState that depends on the current state value
- Inside useCallback/useMemo when state is needed
- Event handlers that reference state
- Async operations that update state

**When direct updates are fine:**

- Setting state to a static value: `setCount(0)`
- Setting state from props/arguments only: `setName(newName)`
- State doesn't depend on previous value

---

> Rule: `rerender-lazy-state-init` — impact **MEDIUM**


## Use Lazy State Initialization

Pass a function to `useState` for expensive initial values. Without the function form, the initializer runs on every render even though the value is only used once.

**Incorrect (runs on every render):**

```tsx
function FilteredList({ items }: { items: Item[] }) {
  // buildSearchIndex() runs on EVERY render, even after initialization
  const [searchIndex, setSearchIndex] = useState(buildSearchIndex(items));
  const [query, setQuery] = useState("");

  // When query changes, buildSearchIndex runs again unnecessarily
  return <SearchResults index={searchIndex} query={query} />;
}

function UserProfile() {
  // JSON.parse runs on every render
  const [settings, setSettings] = useState(
    JSON.parse(localStorage.getItem("settings") || "{}"),
  );

  return <SettingsForm settings={settings} onChange={setSettings} />;
}
```

**Correct (runs only once):**

```tsx
function FilteredList({ items }: { items: Item[] }) {
  // buildSearchIndex() runs ONLY on initial render
  const [searchIndex, setSearchIndex] = useState(() => buildSearchIndex(items));
  const [query, setQuery] = useState("");

  return <SearchResults index={searchIndex} query={query} />;
}

function UserProfile() {
  // JSON.parse runs only on initial render
  let [settings, setSettings] = useState(() => {
    let stored = localStorage.getItem("settings");
    return stored ? JSON.parse(stored) : {};
  });

  return <SettingsForm settings={settings} onChange={setSettings} />;
}
```

Use lazy initialization when computing initial values from localStorage/sessionStorage, building data structures (indexes, maps), reading from the DOM, or performing heavy transformations.

For simple primitives (`useState(0)`), direct references (`useState(props.value)`), or cheap literals (`useState({})`), the function form is unnecessary.

---

> Rule: `rerender-memo` — impact **MEDIUM**


## Extract to Memoized Components

Extract expensive work into memoized components to enable early returns before computation.

**Incorrect (computes avatar even when loading):**

```tsx
function Profile({ user, loading }: Props) {
  let avatar = useMemo(() => {
    let id = computeAvatarId(user);
    return <Avatar id={id} />;
  }, [user]);

  if (loading) return <Skeleton />;
  return <div>{avatar}</div>;
}
```

**Correct (skips computation when loading):**

```tsx
const UserAvatar = memo(function UserAvatar({ user }: { user: User }) {
  let id = useMemo(() => computeAvatarId(user), [user]);
  return <Avatar id={id} />;
});

function Profile({ user, loading }: Props) {
  if (loading) return <Skeleton />;
  return (
    <div>
      <UserAvatar user={user} />
    </div>
  );
}
```

---

> Rule: `rerender-memo-with-default-value` — impact **MEDIUM**


## Extract Default Non-primitive Parameter Value from Memoized Component to Constant

When memoized component has a default value for some non-primitive optional parameter, such as an array, function, or object, calling the component without that parameter results in broken memoization. This is because new value instances are created on every rerender, and they do not pass strict equality comparison in `memo()`.

To address this issue, extract the default value into a constant.

**Incorrect (`onClick` has different values on every rerender):**

```tsx
const UserAvatar = memo(function UserAvatar({ onClick = () => {} }: { onClick?: () => void }) {
  // ...
})

// Used without optional onClick
<UserAvatar />
```

**Correct (stable default value):**

```tsx
const NOOP = () => {};

const UserAvatar = memo(function UserAvatar({ onClick = NOOP }: { onClick?: () => void }) {
  // ...
})

// Used without optional onClick
<UserAvatar />
```

---

> Rule: `rerender-simple-expression-in-memo` — impact **LOW-MEDIUM**


## Do not wrap a simple expression with a primitive result type in useMemo

When an expression is simple (few logical or arithmetical operators) and has a primitive result type (boolean, number, string), do not wrap it in `useMemo`.
Calling `useMemo` and comparing hook dependencies may consume more resources than the expression itself.

**Incorrect:**

```tsx
function Header({ user, notifications }: Props) {
  let isLoading = useMemo(() => {
    return user.isLoading || notifications.isLoading;
  }, [user.isLoading, notifications.isLoading]);

  if (isLoading) return <Skeleton />;
  // return some markup
}
```

**Correct:**

```tsx
function Header({ user, notifications }: Props) {
  let isLoading = user.isLoading || notifications.isLoading;

  if (isLoading) return <Skeleton />;
  // return some markup
}
```

---

> Rule: `rerender-move-effect-to-event` — impact **MEDIUM**


## Put Interaction Logic in Event Handlers

If a side effect is triggered by a specific user action (submit, click, drag), run it in that event handler. Do not model the action as state + effect; it makes effects re-run on unrelated changes and can duplicate the action.

**Incorrect (event modeled as state + effect):**

```tsx
function Form() {
  let [submitted, setSubmitted] = useState(false);
  let theme = useContext(ThemeContext);

  useEffect(() => {
    if (submitted) {
      post("/api/register");
      showToast("Registered", theme);
    }
  }, [submitted, theme]);

  return <button onClick={() => setSubmitted(true)}>Submit</button>;
}
```

**Correct (do it in the handler):**

```tsx
function Form() {
  let theme = useContext(ThemeContext);

  function handleSubmit() {
    post("/api/register");
    showToast("Registered", theme);
  }

  return <button onClick={handleSubmit}>Submit</button>;
}
```

Reference: [Should this code move to an event handler?](https://react.dev/learn/removing-effect-dependencies#should-this-code-move-to-an-event-handler)

---

> Rule: `rerender-dependencies` — impact **LOW**


## Narrow Effect Dependencies

Specify primitive dependencies instead of objects to minimize effect re-runs.

**Incorrect (re-runs on any user field change):**

```tsx
useEffect(() => {
  console.log(user.id);
}, [user]);
```

**Correct (re-runs only when id changes):**

```tsx
useEffect(() => {
  console.log(user.id);
}, [user.id]);
```

**For derived state, compute outside effect:**

```tsx
// Incorrect: runs on width=767, 766, 765...
useEffect(() => {
  if (width < 768) {
    enableMobileMode();
  }
}, [width]);

// Correct: runs only on boolean transition
const isMobile = width < 768;
useEffect(() => {
  if (isMobile) {
    enableMobileMode();
  }
}, [isMobile]);
```

---

> Rule: `rerender-transitions` — impact **MEDIUM**


## Use Transitions for Non-Urgent Updates

Mark frequent, non-urgent state updates as transitions to maintain UI responsiveness.

**Incorrect (blocks UI on every scroll):**

```tsx
function ScrollTracker() {
  let [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    let handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
}
```

**Correct (non-blocking updates):**

```tsx
import { startTransition } from "react";

function ScrollTracker() {
  let [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    let handler = () => {
      startTransition(() => setScrollY(window.scrollY));
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
}
```

---

> Rule: `rerender-use-ref-transient-values` — impact **MEDIUM**


## Use useRef for Transient Values

When a value changes frequently and you don't want a re-render on every update (e.g., mouse trackers, intervals, transient flags), store it in `useRef` instead of `useState`. Keep component state for UI; use refs for temporary DOM-adjacent values. Updating a ref does not trigger a re-render.

**Incorrect (renders every update):**

```tsx
function Tracker() {
  let [lastX, setLastX] = useState(0);

  useEffect(() => {
    let onMove = (e: MouseEvent) => setLastX(e.clientX);
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: lastX,
        width: 8,
        height: 8,
        background: "black",
      }}
    />
  );
}
```

**Correct (no re-render for tracking):**

```tsx
function Tracker() {
  let lastXRef = useRef(0);
  let dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let onMove = (e: MouseEvent) => {
      lastXRef.current = e.clientX;
      let node = dotRef.current;
      if (node) {
        node.style.transform = `translateX(${e.clientX}px)`;
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={dotRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 8,
        height: 8,
        background: "black",
        transform: "translateX(0px)",
      }}
    />
  );
}
```

## Nhóm: rendering


# React Rules — Rendering & Hydration

Nhóm `rendering`: 11 rule. File con chi tiết của [`react-best-practices.md`](../react-best-practices.md).

---

> Rule: `rendering-content-visibility` — impact **HIGH**


## CSS content-visibility for Long Lists

Apply `content-visibility: auto` to defer off-screen rendering.

**CSS:**

```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

**Example:**

```tsx
function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="overflow-y-auto h-screen">
      {messages.map((msg) => (
        <div key={msg.id} className="message-item">
          <Avatar user={msg.author} />
          <div>{msg.content}</div>
        </div>
      ))}
    </div>
  );
}
```

For 1000 messages, browser skips layout/paint for ~990 off-screen items (10x faster initial render).

---

> Rule: `rendering-conditional-render` — impact **LOW**


## Use Explicit Conditional Rendering

Use explicit ternary operators (`? :`) instead of `&&` for conditional rendering when the condition can be `0`, `NaN`, or other falsy values that render.

**Incorrect (renders "0" when count is 0):**

```tsx
function Badge({ count }: { count: number }) {
  return <div>{count && <span className="badge">{count}</span>}</div>;
}

// When count = 0, renders: <div>0</div>
// When count = 5, renders: <div><span class="badge">5</span></div>
```

**Correct (renders nothing when count is 0):**

```tsx
function Badge({ count }: { count: number }) {
  return <div>{count > 0 ? <span className="badge">{count}</span> : null}</div>;
}

// When count = 0, renders: <div></div>
// When count = 5, renders: <div><span class="badge">5</span></div>
```

---

> Rule: `rendering-hoist-jsx` — impact **LOW**


## Hoist Static JSX Elements

Extract static JSX outside components to avoid re-creation.

**Incorrect (recreates element every render):**

```tsx
function LoadingSkeleton() {
  return <div className="animate-pulse h-20 bg-gray-200" />;
}

function Container() {
  return <div>{loading && <LoadingSkeleton />}</div>;
}
```

**Correct (reuses same element):**

```tsx
const loadingSkeleton = <div className="animate-pulse h-20 bg-gray-200" />;

function Container() {
  return <div>{loading && loadingSkeleton}</div>;
}
```

This is especially helpful for large and static SVG nodes, which can be expensive to recreate on every render.

---

> Rule: `rendering-animate-svg-wrapper` — impact **LOW**


## Animate SVG Wrapper Instead of SVG Element

Many browsers don't have hardware acceleration for CSS3 animations on SVG elements. Wrap SVG in a `<div>` and animate the wrapper instead.

**Incorrect (animating SVG directly - no hardware acceleration):**

```tsx
function LoadingSpinner() {
  return (
    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" />
    </svg>
  );
}
```

**Correct (animating wrapper div - hardware accelerated):**

```tsx
function LoadingSpinner() {
  return (
    <div className="animate-spin">
      <svg width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" />
      </svg>
    </div>
  );
}
```

This applies to all CSS transforms and transitions (`transform`, `opacity`, `translate`, `scale`, `rotate`). The wrapper div allows browsers to use GPU acceleration for smoother animations.

---

> Rule: `rendering-svg-precision` — impact **LOW**


## Optimize SVG Precision

Reduce SVG coordinate precision to decrease file size. The optimal precision depends on the viewBox size, but in general reducing precision should be considered.

**Incorrect (excessive precision):**

```svg
<path d="M 10.293847 20.847362 L 30.938472 40.192837" />
```

**Correct (1 decimal place):**

```svg
<path d="M 10.3 20.8 L 30.9 40.2" />
```

**Automate with SVGO:**

```bash
npx svgo --precision=1 --multipass icon.svg
```

---

> Rule: `rendering-client-only` — impact **MEDIUM**


# Use ClientOnly for Browser-Only UI

Render browser-only components on the client with a stable SSR fallback.

## Pattern

```tsx
import { ClientOnly } from "remix-utils/client-only";

export function MapSection() {
  return (
    <ClientOnly fallback={<StaticMapPreview />}>
      {() => <InteractiveMap />}
    </ClientOnly>
  );
}
```

## Rules

1. Always provide a fallback to avoid layout shift
2. Use ClientOnly for DOM APIs or browser-only libraries

---

> Rule: `rendering-use-hydrated` — impact **MEDIUM**


# Use useHydrated for SSR/CSR Divergence

Use `useHydrated` to render safe SSR fallbacks without mismatches.

## Pattern

```tsx
import { useHydrated } from "remix-utils/use-hydrated";

export function CopyButton({ text }: { text: string }) {
  let hydrated = useHydrated();
  return (
    <button
      type="button"
      disabled={!hydrated}
      onClick={() => navigator.clipboard.writeText(text)}
    >
      Copy
    </button>
  );
}
```

## Rules

1. Return the same fallback on SSR and first CSR render
2. Switch to client UI after hydration

---

> Rule: `rendering-hydration-no-flicker` — impact **MEDIUM**


## Prevent Hydration Mismatch Without Flickering

When rendering content that depends on client-side storage (localStorage, cookies), avoid both SSR breakage and post-hydration flickering by injecting a synchronous script that updates the DOM before React hydrates.

**Incorrect (breaks SSR):**

```tsx
function ThemeWrapper({ children }: { children: ReactNode }) {
  // localStorage is not available on server - throws error
  let theme = localStorage.getItem("theme") || "light";

  return <div className={theme}>{children}</div>;
}
```

Server-side rendering will fail because `localStorage` is undefined.

**Incorrect (visual flickering):**

```tsx
function ThemeWrapper({ children }: { children: ReactNode }) {
  let [theme, setTheme] = useState("light");

  useEffect(() => {
    // Runs after hydration - causes visible flash
    let stored = localStorage.getItem("theme");
    if (stored) {
      setTheme(stored);
    }
  }, []);

  return <div className={theme}>{children}</div>;
}
```

Component first renders with default value (`light`), then updates after hydration, causing a visible flash of incorrect content.

**Correct (no flicker, no hydration mismatch):**

```tsx
function ThemeWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <div id="theme-wrapper">{children}</div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('theme') || 'light';
                var el = document.getElementById('theme-wrapper');
                if (el) el.className = theme;
              } catch (e) {}
            })();
          `,
        }}
      />
    </>
  );
}
```

The inline script executes synchronously before showing the element, ensuring the DOM already has the correct value. No flickering, no hydration mismatch.

This pattern is especially useful for theme toggles, user preferences, authentication states, and any client-only data that should render immediately without flashing default values.

---

> Rule: `rendering-hydration-suppress-warning` — impact **LOW-MEDIUM**


## Suppress Expected Hydration Mismatches

In SSR frameworks, some values are intentionally different on server vs client (random IDs, dates, locale/timezone formatting). For these _expected_ mismatches, wrap the dynamic text in an element with `suppressHydrationWarning` to prevent noisy warnings. Do not use this to hide real bugs. Don't overuse it.

**Incorrect (known mismatch warnings):**

```tsx
function Timestamp() {
  return <span>{new Date().toLocaleString()}</span>;
}
```

**Correct (suppress expected mismatch only):**

```tsx
function Timestamp() {
  return <span suppressHydrationWarning>{new Date().toLocaleString()}</span>;
}
```

---

> Rule: `rendering-usetransition-loading` — impact **LOW**


## Use useTransition Over Manual Loading States

Use `useTransition` instead of manual `useState` for loading states. This provides built-in `isPending` state and automatically manages transitions.

**Incorrect (manual loading state):**

```tsx
function SearchResults() {
  let [query, setQuery] = useState("");
  let [results, setResults] = useState([]);
  let [isLoading, setIsLoading] = useState(false);

  let handleSearch = async (value: string) => {
    setIsLoading(true);
    setQuery(value);
    let data = await fetchResults(value);
    setResults(data);
    setIsLoading(false);
  };

  return (
    <>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {isLoading && <Spinner />}
      <ResultsList results={results} />
    </>
  );
}
```

**Correct (useTransition with built-in pending state):**

```tsx
import { useTransition, useState } from "react";

function SearchResults() {
  let [query, setQuery] = useState("");
  let [results, setResults] = useState([]);
  let [isPending, startTransition] = useTransition();

  let handleSearch = (value: string) => {
    setQuery(value); // Update input immediately

    startTransition(async () => {
      // Fetch and update results
      let data = await fetchResults(value);
      setResults(data);
    });
  };

  return (
    <>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {isPending && <Spinner />}
      <ResultsList results={results} />
    </>
  );
}
```

**Benefits:**

- **Automatic pending state**: No need to manually manage `setIsLoading(true/false)`
- **Error resilience**: Pending state correctly resets even if the transition throws
- **Better responsiveness**: Keeps the UI responsive during updates
- **Interrupt handling**: New transitions automatically cancel pending ones

Reference: [useTransition](https://react.dev/reference/react/useTransition)

---

> Rule: `fault-tolerant-error-boundaries` — impact **HIGH**


# Place Error Boundaries at Feature Boundaries

Add error boundaries around independent features, not just at the top and not around every leaf.

## Why

- A single top-level boundary brings down the whole app on any error
- Too many boundaries create partially broken UI and confusing states
- Feature-level boundaries isolate failures while keeping the rest usable

## Pattern

```tsx
// Good: boundaries at feature seams
<ErrorBoundary fallback={<SidebarError />}> 
  <Sidebar />
</ErrorBoundary>

<ErrorBoundary fallback={<FeedError />}> 
  <Feed />
</ErrorBoundary>

<ErrorBoundary fallback={<TrendsError />}>
  <Trends />
</ErrorBoundary>
```

## Heuristic

Ask: “If this component crashes, should its siblings also crash?”

- If yes, put the boundary higher
- If no, put the boundary at this feature boundary

## Rules

1. Avoid only a single top-level error boundary
2. Avoid wrapping every component with a boundary
3. Place boundaries around independent feature areas
4. Use feature-specific fallbacks to prevent broken UX

## Nhóm: client


# React Rules — Client Patterns

Nhóm `client`: 2 rule. File con chi tiết của [`react-best-practices.md`](../react-best-practices.md).

---

> Rule: `client-passive-event-listeners` — impact **MEDIUM**


## Use Passive Event Listeners for Scrolling Performance

Add `{ passive: true }` to touch and wheel event listeners to enable immediate scrolling. Browsers normally wait for listeners to finish to check if `preventDefault()` is called, causing scroll delay.

**Incorrect:**

```typescript
useEffect(() => {
  let handleTouch = (e: TouchEvent) => console.log(e.touches[0].clientX);
  let handleWheel = (e: WheelEvent) => console.log(e.deltaY);

  document.addEventListener("touchstart", handleTouch);
  document.addEventListener("wheel", handleWheel);

  return () => {
    document.removeEventListener("touchstart", handleTouch);
    document.removeEventListener("wheel", handleWheel);
  };
}, []);
```

**Correct:**

```typescript
useEffect(() => {
  let handleTouch = (e: TouchEvent) => console.log(e.touches[0].clientX);
  let handleWheel = (e: WheelEvent) => console.log(e.deltaY);

  document.addEventListener("touchstart", handleTouch, { passive: true });
  document.addEventListener("wheel", handleWheel, { passive: true });

  return () => {
    document.removeEventListener("touchstart", handleTouch);
    document.removeEventListener("wheel", handleWheel);
  };
}, []);
```

**Use passive when:** tracking/analytics, logging, any listener that doesn't call `preventDefault()`.

**Don't use passive when:** implementing custom swipe gestures, custom zoom controls, or any listener that needs `preventDefault()`.

---

> Rule: `client-localstorage-schema` — impact **MEDIUM**


## Version and Minimize localStorage Data

Add version prefix to keys and store only needed fields. Prevents schema conflicts and accidental storage of sensitive data.

**Incorrect:**

```typescript
// No version, stores everything, no error handling
localStorage.setItem("userConfig", JSON.stringify(fullUserObject));
const data = localStorage.getItem("userConfig");
```

**Correct:**

```typescript
const VERSION = "v2";

function saveConfig(config: { theme: string; language: string }) {
  try {
    localStorage.setItem(`userConfig:${VERSION}`, JSON.stringify(config));
  } catch {
    // Throws in incognito/private browsing, quota exceeded, or disabled
  }
}

function loadConfig() {
  try {
    let data = localStorage.getItem(`userConfig:${VERSION}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// Migration from v1 to v2
function migrate() {
  try {
    let v1 = localStorage.getItem("userConfig:v1");
    if (v1) {
      let old = JSON.parse(v1);
      saveConfig({
        theme: old.darkMode ? "dark" : "light",
        language: old.lang,
      });
      localStorage.removeItem("userConfig:v1");
    }
  } catch {}
}
```

**Store minimal fields from server responses:**

```typescript
// User object has 20+ fields, only store what UI needs
function cachePrefs(user: FullUser) {
  try {
    localStorage.setItem(
      "prefs:v1",
      JSON.stringify({
        theme: user.preferences.theme,
        notifications: user.preferences.notifications,
      }),
    );
  } catch {}
}
```

**Always wrap in try-catch:** `getItem()` and `setItem()` throw in incognito/private browsing (Safari, Firefox), when quota exceeded, or when disabled.

**Benefits:** Schema evolution via versioning, reduced storage size, prevents storing tokens/PII/internal flags.
