---
name: javascript
description: JavaScript performance optimization guidelines. Use when writing, reviewing, or refactoring JavaScript/TypeScript code to ensure optimal performance patterns. Triggers on tasks involving loops, data structures, DOM manipulation, or general JS optimization.
---


# JavaScript Best Practices

Performance optimization and code style patterns for JavaScript and TypeScript code. Contains 17 rules focused on reducing unnecessary computation, optimizing data structures, and maintaining consistent conventions.

## When to Apply

Reference these guidelines when:

- Writing loops or array operations
- Working with data structures (Map, Set, arrays)
- Manipulating the DOM directly
- Caching values or function results
- Optimizing hot code paths
- Declaring variables or functions

## Rules Summary

### const-let-usage (MEDIUM) — @rules/const-let-usage.md

Use `const` at module level, `let` inside functions.

```typescript
// Module level: const with UPPER_SNAKE_CASE for primitives
const MAX_RETRIES = 3;
const userCache = new Map<string, User>();

// Inside functions: always let
function process(items: Item[]) {
  let total = 0;
  let result = [];
  for (let item of items) {
    total += item.price;
  }
  return { total, result };
}
```

### function-declarations (MEDIUM) — @rules/function-declarations.md

Prefer function declarations over arrow functions for named functions.

```typescript
// Good: function declaration
function calculateTotal(items: Item[]): number {
  let total = 0;
  for (let item of items) {
    total += item.price;
  }
  return total;
}

// Good: arrow for inline callbacks
let active = users.filter((u) => u.isActive);

// Good: arrow when type requires it
const handler: ActionFunction = async ({ request }) => {
  // ...
};
```

### no-default-exports (MEDIUM) — @rules/no-default-exports.md

Use named exports. Avoid default exports (except Remix route components).

```typescript
// Bad: default export
export default function formatCurrency(amount: number) { ... }

// Good: named export
export function formatCurrency(amount: number) { ... }

// Exception: Remix routes use default export named "Component"
export default function Component() { ... }
```

### no-as-type-casts (HIGH) — @rules/no-as-type-casts.md

Avoid `as Type` casts. Use type guards or Zod validation instead.

```typescript
// Bad: type assertion
let user = response.data as User;

// Good: Zod validation
let user = UserSchema.parse(response.data);

// Good: type guard
if (isUser(response.data)) {
  let user = response.data;
}
```

### comments-meaningful-only (MEDIUM) — @rules/comments-meaningful-only.md

Only comment when adding info the code cannot express.

```typescript
// Bad: restates the code
// Set the user's name
let userName = user.name;

// Good: explains business rule
// Transactions under $250 don't require written acknowledgment per policy
if (transaction.amount < 250) {
  return { requiresAcknowledgment: false };
}
```

### set-map-lookups (LOW-MEDIUM) — @rules/set-map-lookups.md

Use Set/Map for O(1) lookups instead of Array methods.

```typescript
// Bad: O(n) per check
const allowedIds = ["a", "b", "c"];
items.filter((item) => allowedIds.includes(item.id));

// Good: O(1) per check
const allowedIds = new Set(["a", "b", "c"]);
items.filter((item) => allowedIds.has(item.id));
```

### index-maps (LOW-MEDIUM) — @rules/index-maps.md

Build Map once for repeated lookups.

```typescript
// Bad: O(n) per lookup = O(n*m) total
orders.map((order) => ({
  ...order,
  user: users.find((u) => u.id === order.userId),
}));

// Good: O(1) per lookup = O(n+m) total
const userById = new Map(users.map((u) => [u.id, u]));
orders.map((order) => ({
  ...order,
  user: userById.get(order.userId),
}));
```

### tosorted-immutable (MEDIUM-HIGH) — @rules/tosorted-immutable.md

Use `toSorted()` instead of `sort()` to avoid mutation.

```typescript
// Bad: mutates original array
const sorted = users.sort((a, b) => a.name.localeCompare(b.name));

// Good: creates new sorted array
const sorted = users.toSorted((a, b) => a.name.localeCompare(b.name));
```

### combine-iterations (LOW-MEDIUM) — @rules/combine-iterations.md

Combine multiple filter/map into one loop.

```typescript
// Bad: 3 iterations
const admins = users.filter((u) => u.isAdmin);
const testers = users.filter((u) => u.isTester);
const inactive = users.filter((u) => !u.isActive);

// Good: 1 iteration
const admins: User[] = [],
  testers: User[] = [],
  inactive: User[] = [];
for (const user of users) {
  if (user.isAdmin) admins.push(user);
  if (user.isTester) testers.push(user);
  if (!user.isActive) inactive.push(user);
}
```

### cache-property-access (LOW-MEDIUM) — @rules/cache-property-access.md

Cache object properties in loops.

```typescript
// Bad: repeated lookups
for (let i = 0; i < arr.length; i++) {
  process(obj.config.settings.value);
}

// Good: cached lookup
const value = obj.config.settings.value;
const len = arr.length;
for (let i = 0; i < len; i++) {
  process(value);
}
```

### cache-function-results (MEDIUM) — @rules/cache-function-results.md

Cache expensive function results in module-level Map.

```typescript
const slugifyCache = new Map<string, string>();

function cachedSlugify(text: string): string {
  if (!slugifyCache.has(text)) {
    slugifyCache.set(text, slugify(text));
  }
  return slugifyCache.get(text)!;
}
```

### cache-storage (LOW-MEDIUM) — @rules/cache-storage.md

Cache localStorage/sessionStorage reads in memory.

```typescript
const storageCache = new Map<string, string | null>();

function getLocalStorage(key: string) {
  if (!storageCache.has(key)) {
    storageCache.set(key, localStorage.getItem(key));
  }
  return storageCache.get(key);
}
```

### early-exit (LOW-MEDIUM) — @rules/early-exit.md

Return early when result is determined.

```typescript
// Bad: continues after finding error
function validate(users: User[]) {
  let error = "";
  for (const user of users) {
    if (!user.email) error = "Email required";
  }
  return error ? { error } : { valid: true };
}

// Good: returns immediately
function validate(users: User[]) {
  for (const user of users) {
    if (!user.email) return { error: "Email required" };
  }
  return { valid: true };
}
```

### length-check-first (MEDIUM-HIGH) — @rules/length-check-first.md

Check array length before expensive comparison.

```typescript
// Bad: always sorts even when lengths differ
function hasChanges(a: string[], b: string[]) {
  return a.sort().join() !== b.sort().join();
}

// Good: early return if lengths differ
function hasChanges(a: string[], b: string[]) {
  if (a.length !== b.length) return true;
  let aSorted = a.toSorted();
  let bSorted = b.toSorted();
  return aSorted.some((v, i) => v !== bSorted[i]);
}
```

### min-max-loop (LOW) — @rules/min-max-loop.md

Use loop for min/max instead of sort.

```typescript
// Bad: O(n log n)
const latest = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)[0];

// Good: O(n)
let latest = projects[0];
for (const p of projects) {
  if (p.updatedAt > latest.updatedAt) latest = p;
}
```

### hoist-regexp (LOW-MEDIUM) — @rules/hoist-regexp.md

Hoist RegExp creation outside loops.

```typescript
// Bad: creates regex every iteration
items.forEach(item => {
  if (/pattern/.test(item.text)) { ... }
})

// Good: create once
const PATTERN = /pattern/
items.forEach(item => {
  if (PATTERN.test(item.text)) { ... }
})
```

### batch-dom-css (MEDIUM) — @rules/batch-dom-css.md

Batch DOM reads before writes to avoid layout thrashing.

```typescript
// Bad: interleaved reads/writes force reflows
element.style.width = "100px";
const width = element.offsetWidth; // forces reflow
element.style.height = "200px";

// Good: batch writes, then read
element.style.width = "100px";
element.style.height = "200px";
const { width, height } = element.getBoundingClientRect();
```

### result-type (MEDIUM) — @rules/result-type.md

Use an explicit `Result` type for success/failure.

```typescript
let result = success(data);
if (isFailure(result)) return handleError(result.error);
```

---

# Rules — chi tiết đầy đủ


# frontend-js-best-practices — rules (18)

File con cua [`frontend-js-best-practices.md`](./frontend-js-best-practices.md). Moi rule mot muc, mo dau bang `> Rule:`.

---

> Rule: `batch-dom-css` — impact **MEDIUM**


## Avoid Layout Thrashing

Avoid interleaving style writes with layout reads. When you read a layout property (like `offsetWidth`, `getBoundingClientRect()`, or `getComputedStyle()`) between style changes, the browser is forced to trigger a synchronous reflow.

**This is OK (browser batches style changes):**

```typescript
function updateElementStyles(element: HTMLElement) {
  // Each line invalidates style, but browser batches the recalculation
  element.style.width = "100px";
  element.style.height = "200px";
  element.style.backgroundColor = "blue";
  element.style.border = "1px solid black";
}
```

**Incorrect (interleaved reads and writes force reflows):**

```typescript
function layoutThrashing(element: HTMLElement) {
  element.style.width = "100px";
  let width = element.offsetWidth; // Forces reflow
  element.style.height = "200px";
  let height = element.offsetHeight; // Forces another reflow
}
```

**Correct (batch writes, then read once):**

```typescript
function updateElementStyles(element: HTMLElement) {
  // Batch all writes together
  element.style.width = "100px";
  element.style.height = "200px";
  element.style.backgroundColor = "blue";
  element.style.border = "1px solid black";

  // Read after all writes are done (single reflow)
  const { width, height } = element.getBoundingClientRect();
}
```

**Correct (batch reads, then writes):**

```typescript
function avoidThrashing(element: HTMLElement) {
  // Read phase - all layout queries first
  let rect1 = element.getBoundingClientRect();
  let offsetWidth = element.offsetWidth;
  let offsetHeight = element.offsetHeight;

  // Write phase - all style changes after
  element.style.width = "100px";
  element.style.height = "200px";
}
```

**Better: use CSS classes**

```css
.highlighted-box {
  width: 100px;
  height: 200px;
  background-color: blue;
  border: 1px solid black;
}
```

```typescript
function updateElementStyles(element: HTMLElement) {
  element.classList.add("highlighted-box");

  const { width, height } = element.getBoundingClientRect();
}
```

**React example:**

```tsx
// Incorrect: interleaving style changes with layout queries
function Box({ isHighlighted }: { isHighlighted: boolean }) {
  let ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && isHighlighted) {
      ref.current.style.width = "100px";
      let width = ref.current.offsetWidth; // Forces layout
      ref.current.style.height = "200px";
    }
  }, [isHighlighted]);

  return <div ref={ref}>Content</div>;
}

// Correct: toggle class
function Box({ isHighlighted }: { isHighlighted: boolean }) {
  return <div className={isHighlighted ? "highlighted-box" : ""}>Content</div>;
}
```

Prefer CSS classes over inline styles when possible. CSS files are cached by the browser, and classes provide better separation of concerns and are easier to maintain.

See [this gist](https://gist.github.com/paulirish/5d52fb081b3570c81e3a) and [CSS Triggers](https://csstriggers.com/) for more information on layout-forcing operations.

---

> Rule: `cache-function-results` — impact **MEDIUM**


## Cache Repeated Function Calls

Use a module-level Map to cache function results when the same function is called repeatedly with the same inputs.

**Incorrect (redundant computation):**

```typescript
function processProjects(projects: Project[]) {
  return projects.map((project) => {
    // slugify() called 100+ times for same project names
    let slug = slugify(project.name);
    return { ...project, slug };
  });
}
```

**Correct (cached results):**

```typescript
// Module-level cache
const slugifyCache = new Map<string, string>();

function cachedSlugify(text: string): string {
  if (slugifyCache.has(text)) {
    return slugifyCache.get(text)!;
  }
  let result = slugify(text);
  slugifyCache.set(text, result);
  return result;
}

function processProjects(projects: Project[]) {
  return projects.map((project) => {
    // Computed only once per unique project name
    let slug = cachedSlugify(project.name);
    return { ...project, slug };
  });
}
```

**Simpler pattern for single-value functions:**

```typescript
let isLoggedInCache: boolean | null = null;

function isLoggedIn(): boolean {
  if (isLoggedInCache !== null) {
    return isLoggedInCache;
  }

  isLoggedInCache = document.cookie.includes("auth=");
  return isLoggedInCache;
}

// Clear cache when auth changes
function onAuthChange() {
  isLoggedInCache = null;
}
```

**With LRU limits (prevent memory leaks):**

```typescript
const MAX_CACHE_SIZE = 1000;

function cachedSlugify(text: string): string {
  if (slugifyCache.has(text)) {
    return slugifyCache.get(text)!;
  }

  // Prevent unbounded growth
  if (slugifyCache.size >= MAX_CACHE_SIZE) {
    let firstKey = slugifyCache.keys().next().value;
    slugifyCache.delete(firstKey);
  }

  let result = slugify(text);
  slugifyCache.set(text, result);
  return result;
}
```

Use a Map (not React hooks) so it works everywhere: utilities, event handlers, loaders, etc.

---

> Rule: `cache-property-access` — impact **LOW-MEDIUM**


## Cache Property Access in Loops

Cache object property lookups in hot paths.

**Incorrect (3 lookups x N iterations):**

```typescript
for (let i = 0; i < arr.length; i++) {
  process(obj.config.settings.value);
}
```

**Correct (1 lookup total):**

```typescript
const value = obj.config.settings.value;
const len = arr.length;
for (let i = 0; i < len; i++) {
  process(value);
}
```

---

> Rule: `cache-storage` — impact **LOW-MEDIUM**


## Cache Storage API Calls

`localStorage`, `sessionStorage`, and `document.cookie` are synchronous and expensive. Cache reads in memory.

**Incorrect (reads storage on every call):**

```typescript
function getTheme() {
  return localStorage.getItem("theme") ?? "light";
}
// Called 10 times = 10 storage reads
```

**Correct (Map cache):**

```typescript
const storageCache = new Map<string, string | null>();

function getLocalStorage(key: string) {
  if (!storageCache.has(key)) {
    storageCache.set(key, localStorage.getItem(key));
  }
  return storageCache.get(key);
}

function setLocalStorage(key: string, value: string) {
  localStorage.setItem(key, value);
  storageCache.set(key, value); // keep cache in sync
}
```

Use a Map (not a hook) so it works everywhere: utilities, event handlers, not just React components.

**Cookie caching:**

```typescript
let cookieCache: Record<string, string> | null = null;

function getCookie(name: string) {
  if (!cookieCache) {
    cookieCache = Object.fromEntries(
      document.cookie.split("; ").map((c) => c.split("=")),
    );
  }
  return cookieCache[name];
}
```

**Important (invalidate on external changes):**

If storage can change externally (another tab, server-set cookies), invalidate cache:

```typescript
window.addEventListener("storage", (e) => {
  if (e.key) storageCache.delete(e.key);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    storageCache.clear();
  }
});
```

---

> Rule: `combine-iterations` — impact **LOW-MEDIUM**


## Combine Multiple Array Iterations

Multiple `.filter()` or `.map()` calls iterate the array multiple times. Combine into one loop.

**Incorrect (3 iterations):**

```typescript
let admins = users.filter((u) => u.isAdmin);
let testers = users.filter((u) => u.isTester);
let inactive = users.filter((u) => !u.isActive);
```

**Correct (1 iteration):**

```typescript
let admins: User[] = [];
let testers: User[] = [];
let inactive: User[] = [];

for (let user of users) {
  if (user.isAdmin) admins.push(user);
  if (user.isTester) testers.push(user);
  if (!user.isActive) inactive.push(user);
}
```

**Alternative using `Array#reduce`:**

```typescript
type UserGroup = "admins" | "testers" | "inactive";

let { admins, testers, inactive } = users.reduce(
  (acc, user) => {
    if (user.isAdmin) acc.admins.push(user);
    if (user.isTester) acc.testers.push(user);
    if (!user.isActive) acc.inactive.push(user);
    return acc;
  },
  { admins: [], testers: [], inactive: [] } as Record<UserGroup, User[]>,
);
```

---

> Rule: `comments-meaningful-only` — impact **MEDIUM**


## Meaningful Comments Only

Don't write comments that repeat what the code says. Only comment when adding information the code cannot express.

### Why

1. **Noise reduction** - Meaningless comments make important ones harder to find
2. **Maintenance burden** - Comments that restate code get outdated
3. **Code should be self-documenting** - Good names and structure reduce need for comments
4. **Comments are for "why", not "what"** - Code shows what, comments explain why

### Bad: Meaningless Comments

```typescript
// Bad: restates the code
// Set the user's name
let userName = user.name;

// Bad: obvious from the code
// Loop through the items
for (let item of items) {
  // Process the item
  processItem(item);
}

// Bad: describes the function name
// Calculate the total
function calculateTotal(items: Item[]) {
  // ...
}

// Bad: describes variable assignment
// Create an empty array
let results = [];
```

### Good: Meaningful Comments

#### Business Rules

```typescript
// Transactions under $250 don't require written acknowledgment per policy
if (transaction.amount < 250) {
  return { requiresAcknowledgment: false };
}
```

#### Non-Obvious Behavior

```typescript
// API returns amounts in cents, convert to dollars for display
let displayAmount = apiAmount / 100;
```

#### Edge Cases and Workarounds

```typescript
// Safari doesn't support smooth scrolling in iframes, use instant instead
let behavior = isSafari && isInIframe ? "instant" : "smooth";
```

#### Performance Decisions

```typescript
// Using Map for O(1) lookups instead of array.find() which is O(n)
// This matters because we check membership for every item in the list
let userById = new Map(users.map((u) => [u.id, u]));
```

#### External Dependencies

```typescript
// Copied from lodash/debounce to avoid adding the full dependency
// https://github.com/lodash/lodash/blob/main/debounce.js
function debounce(fn: Function, wait: number) {
  // ...
}
```

#### Intentional Behavior

```typescript
// Intentionally not awaiting - we want fire-and-forget analytics
analytics.track("page_view", { path });
```

#### TODO with Context

```typescript
// TODO(#1234): Remove after migration completes in Q2 2024
let useLegacyApi = featureFlags.useLegacyApi;
```

### JSDoc for Public APIs

Use JSDoc for exported functions, especially utilities:

```typescript
/**
 * Formats a number as USD currency
 * @param amount - The amount in dollars (not cents)
 * @param showDecimals - Whether to show cents (default: false)
 * @returns Formatted string like "$1,234" or "$1,234.56"
 */
export function formatCurrency(amount: number, showDecimals = false): string {
  // ...
}
```

### When to Comment

| Comment when...               | Example                                       |
| ----------------------------- | --------------------------------------------- |
| Business rule isn't obvious   | IRS requirements, legal constraints           |
| Working around a bug          | Browser quirks, API limitations               |
| Code is intentionally unusual | Performance optimization, deliberate no-await |
| External context needed       | Links to specs, ticket numbers                |
| Trade-off was made            | Why this approach over alternatives           |

### When NOT to Comment

| Don't comment...         | Why                              |
| ------------------------ | -------------------------------- |
| What the code does       | Code already says it             |
| Variable assignments     | Name should be clear             |
| Loop iterations          | Standard patterns are understood |
| Function purpose         | Name should convey it            |
| Obvious type conversions | TypeScript shows types           |

---

> Rule: `const-let-usage` — impact **MEDIUM**


## Const vs Let Usage

Use `const` at module level and `let` inside functions/blocks.

### Module Level: Always `const`

```typescript
// Single value constants - UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;
const API_BASE_URL = "/api/v1";

// Objects, arrays, Maps, Sets - camelCase
const userCache = new Map<string, User>();
const allowedRoles = new Set(["admin", "editor"]);
const defaultConfig = { timeout: 5000, retries: 3 };

// Regex patterns - UPPER_SNAKE_CASE
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9-]+$/;
```

### Inside Functions/Blocks: Always `let`

```typescript
function processUsers(users: User[]) {
  // Always use let inside functions, even for values that don't change
  let total = 0;
  let activeCount = 0;
  let result = [];

  for (let user of users) {
    let isActive = user.status === "active";
    if (isActive) {
      activeCount += 1;
      result.push(user);
    }
    total += 1;
  }

  let summary = { total, activeCount };
  return { result, summary };
}
```

### Why This Convention

1. **Clear scope distinction** - `const` signals module-level, `let` signals local
2. **Easier refactoring** - No need to change `const` to `let` when you need to reassign
3. **Consistent codebase** - One rule to follow, no debates about const vs let locally
4. **UPPER_SNAKE_CASE** - Instantly identifies true constants (primitives that never change)

### Never Use `var`

```typescript
// Bad
var count = 0;
var users = [];

// Good
let count = 0;
let users = [];
```

### Summary

| Scope                                 | Keyword                | Naming             |
| ------------------------------------- | ---------------------- | ------------------ |
| Module-level primitive constants      | `const`                | `UPPER_SNAKE_CASE` |
| Module-level objects/arrays/Maps/Sets | `const`                | `camelCase`        |
| Module-level functions                | `function` declaration | `camelCase`        |
| Inside functions/methods/blocks       | `let`                  | `camelCase`        |

---

> Rule: `early-exit` — impact **LOW-MEDIUM**


## Early Return from Functions

Return early when result is determined to skip unnecessary processing.

**Incorrect (processes all items even after finding answer):**

```typescript
function validateUsers(users: User[]) {
  let hasError = false;
  let errorMessage = "";

  for (const user of users) {
    if (!user.email) {
      hasError = true;
      errorMessage = "Email required";
    }
    if (!user.name) {
      hasError = true;
      errorMessage = "Name required";
    }
    // Continues checking all users even after error found
  }

  return hasError ? { valid: false, error: errorMessage } : { valid: true };
}
```

**Correct (returns immediately on first error):**

```typescript
function validateUsers(users: User[]) {
  for (const user of users) {
    if (!user.email) {
      return { valid: false, error: "Email required" };
    }
    if (!user.name) {
      return { valid: false, error: "Name required" };
    }
  }

  return { valid: true };
}
```

---

> Rule: `function-declarations` — impact **MEDIUM**


## Function Declarations vs Arrow Functions

Prefer function declarations for named functions. Use arrow functions for inline callbacks or when needed for type inference.

### Prefer Function Declarations

```typescript
// Good: function declaration
function calculateTotal(items: Item[]): number {
  let total = 0;
  for (let item of items) {
    total += item.price * item.quantity;
  }
  return total;
}

function formatUser(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

async function fetchUsers(): Promise<User[]> {
  let response = await fetch("/api/users");
  return response.json();
}

// Avoid: arrow function for named functions
const calculateTotal = (items: Item[]): number => {
  let total = 0;
  for (let item of items) {
    total += item.price * item.quantity;
  }
  return total;
};
```

### Use Arrow Functions For

#### 1. Inline Callbacks

```typescript
// Good: arrow for inline callbacks
let activeUsers = users.filter((user) => user.isActive);
let names = users.map((user) => user.name);
let sorted = items.toSorted((a, b) => a.price - b.price);

// Avoid: function expression for simple callbacks
let activeUsers = users.filter(function (user) {
  return user.isActive;
});
```

#### 2. When Types Require Arrow Syntax

```typescript
// Good: arrow needed for proper typing
const createHandler: ActionFunction = async ({ request }) => {
  let formData = await request.formData();
  // ...
};

// Good: arrow for typed event handlers
const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
  event.preventDefault();
  // ...
};

// Good: arrow for React component props
const renderItem: ListRenderItem<User> = ({ item }) => (
  <UserCard user={item} />
);
```

### Why Function Declarations

1. **Hoisting** - Can be called before definition (useful for organizing code)
2. **Better stack traces** - Named functions show up clearly in error stacks
3. **Clearer intent** - `function` keyword signals "this is a function"
4. **Consistency** - One style for all named functions

### Summary

| Use Case                                    | Syntax                           |
| ------------------------------------------- | -------------------------------- |
| Named functions (including short utilities) | `function name() {}`             |
| Inline callbacks                            | `(x) => x.value`                 |
| Typed handlers/callbacks                    | `const handler: Type = () => {}` |

---

> Rule: `hoist-regexp` — impact **LOW-MEDIUM**


## Hoist RegExp Creation

Don't create RegExp inside loops or frequently-called functions. Hoist to module scope or cache the result.

**Incorrect (new RegExp every call):**

```typescript
function highlightMatches(text: string, query: string) {
  let regex = new RegExp(`(${query})`, "gi"); // Created every call
  return text.split(regex);
}

// In a loop - creates regex 1000 times
items.forEach((item) => {
  let matches = highlightMatches(item.text, searchQuery);
});
```

**Correct (hoist static patterns):**

```typescript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /https?:\/\/[^\s]+/g;

function isValidEmail(email: string) {
  return EMAIL_REGEX.test(email);
}
```

**Correct (cache dynamic patterns):**

```typescript
const regexCache = new Map<string, RegExp>();

function getHighlightRegex(query: string): RegExp {
  if (!regexCache.has(query)) {
    regexCache.set(query, new RegExp(`(${escapeRegex(query)})`, "gi"));
  }
  return regexCache.get(query)!;
}

function highlightMatches(text: string, query: string) {
  let regex = getHighlightRegex(query);
  return text.split(regex);
}
```

**Warning (global regex has mutable state):**

Global regex (`/g`) has mutable `lastIndex` state:

```typescript
const regex = /foo/g;
regex.test("foo"); // true, lastIndex = 3
regex.test("foo"); // false, lastIndex = 0 (unexpected!)
```

Reset `lastIndex` before reuse, or create a new regex for each use when using `/g` flag.

---

> Rule: `index-maps` — impact **LOW-MEDIUM**


## Build Index Maps for Repeated Lookups

Multiple `.find()` calls by the same key should use a Map.

**Incorrect (O(n) per lookup):**

```typescript
function processOrders(orders: Order[], users: User[]) {
  return orders.map((order) => ({
    ...order,
    user: users.find((u) => u.id === order.userId),
  }));
}
```

**Correct (O(1) per lookup):**

```typescript
function processOrders(orders: Order[], users: User[]) {
  let userById = new Map(users.map((u) => [u.id, u]));

  return orders.map((order) => ({
    ...order,
    user: userById.get(order.userId),
  }));
}
```

Build map once (O(n)), then all lookups are O(1).
For 1000 orders x 1000 users: 1M ops -> 2K ops.

---

> Rule: `length-check-first` — impact **MEDIUM-HIGH**


## Early Length Check for Array Comparisons

When comparing arrays with expensive operations (sorting, deep equality, serialization), check lengths first. If lengths differ, the arrays cannot be equal.

In real-world applications, this optimization is especially valuable when the comparison runs in hot paths (event handlers, render loops).

**Incorrect (always runs expensive comparison):**

```typescript
function hasChanges(current: string[], original: string[]) {
  // Always sorts and joins, even when lengths differ
  return current.sort().join() !== original.sort().join();
}
```

Two O(n log n) sorts run even when `current.length` is 5 and `original.length` is 100. There is also overhead of joining the arrays and comparing the strings.

**Correct (O(1) length check first):**

```typescript
function hasChanges(current: string[], original: string[]) {
  // Early return if lengths differ
  if (current.length !== original.length) {
    return true;
  }
  // Only sort when lengths match
  let currentSorted = current.toSorted();
  let originalSorted = original.toSorted();
  for (let i = 0; i < currentSorted.length; i++) {
    if (currentSorted[i] !== originalSorted[i]) {
      return true;
    }
  }
  return false;
}
```

This new approach is more efficient because:

- It avoids the overhead of sorting and joining the arrays when lengths differ
- It avoids consuming memory for the joined strings (especially important for large arrays)
- It avoids mutating the original arrays
- It returns early when a difference is found

---

> Rule: `min-max-loop` — impact **LOW**


## Use Loop for Min/Max Instead of Sort

Finding the smallest or largest element only requires a single pass through the array. Sorting is wasteful and slower.

**Incorrect (O(n log n) - sort to find latest):**

```typescript
interface Project {
  id: string;
  name: string;
  updatedAt: number;
}

function getLatestProject(projects: Project[]) {
  let sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  return sorted[0];
}
```

Sorts the entire array just to find the maximum value.

**Incorrect (O(n log n) - sort for oldest and newest):**

```typescript
function getOldestAndNewest(projects: Project[]) {
  let sorted = [...projects].sort((a, b) => a.updatedAt - b.updatedAt);
  return { oldest: sorted[0], newest: sorted[sorted.length - 1] };
}
```

Still sorts unnecessarily when only min/max are needed.

**Correct (O(n) - single loop):**

```typescript
function getLatestProject(projects: Project[]) {
  if (projects.length === 0) return null;

  let latest = projects[0];

  for (let i = 1; i < projects.length; i++) {
    if (projects[i].updatedAt > latest.updatedAt) {
      latest = projects[i];
    }
  }

  return latest;
}

function getOldestAndNewest(projects: Project[]) {
  if (projects.length === 0) return { oldest: null, newest: null };

  let oldest = projects[0];
  let newest = projects[0];

  for (let i = 1; i < projects.length; i++) {
    if (projects[i].updatedAt < oldest.updatedAt) oldest = projects[i];
    if (projects[i].updatedAt > newest.updatedAt) newest = projects[i];
  }

  return { oldest, newest };
}
```

Single pass through the array, no copying, no sorting.

**Alternative (Math.min/Math.max for small arrays):**

```typescript
const numbers = [5, 2, 8, 1, 9];
const min = Math.min(...numbers);
const max = Math.max(...numbers);
```

This works for small arrays, but can be slower or just throw an error for very large arrays due to spread operator limitations. Maximal array length is approximately 124000 in Chrome 143 and 638000 in Safari 18; exact numbers may vary. Use the loop approach for reliability.

---

> Rule: `no-as-type-casts` — impact **HIGH**


## No Type Assertions (as Type)

Avoid `as Type` casts. Use type guards, validation, or proper typing instead.

### Why

1. **Bypasses type checking** - Tells TypeScript to trust you, even when wrong
2. **Hides bugs** - Runtime errors instead of compile-time errors
3. **False confidence** - Code looks type-safe but isn't
4. **Maintenance risk** - Types change, casts don't update

### Bad: Type Assertions

```typescript
// Bad: asserting unknown data
let user = response.data as User;

// Bad: asserting array type
let items = data as Item[];

// Bad: asserting element type
let button = document.querySelector(".btn") as HTMLButtonElement;

// Bad: forcing type compatibility
let config = rawConfig as Config;
```

### Good: Proper Alternatives

#### Use Type Guards

```typescript
function isUser(data: unknown): data is User {
  return (
    typeof data === "object" && data !== null && "id" in data && "name" in data
  );
}

// Good: validated at runtime
if (isUser(response.data)) {
  let user = response.data; // Typed as User
}
```

#### Use Zod Validation

```typescript
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

// Good: validated and typed
let user = UserSchema.parse(response.data);
```

#### Use Proper DOM Methods

```typescript
// Bad
let button = document.querySelector(".btn") as HTMLButtonElement;

// Good: check for null and instanceof
let element = document.querySelector(".btn");
if (element instanceof HTMLButtonElement) {
  element.disabled = true;
}
```

#### Use Generic Functions

```typescript
// Bad
function getData<T>(key: string): T {
  return localStorage.getItem(key) as T;
}

// Good: return unknown, let caller validate
function getData(key: string): unknown {
  let value = localStorage.getItem(key);
  return value ? JSON.parse(value) : null;
}

// Caller validates
let rawData = getData("user");
let user = UserSchema.parse(rawData);
```

#### Fix the Types

```typescript
// Bad: cast because types don't match
let result = processData(input) as ExpectedOutput;

// Good: fix the function's return type
function processData(input: Input): ExpectedOutput {
  // ...
}
```

### Acceptable Uses

#### Branded Types in Zod Transforms

```typescript
// Acceptable: branding IDs in deserializers
const Schema = z.object({
  id: z.string().transform((id) => id as UserId),
  name: z.string(),
});
```

#### Test Mocks (sparingly)

```typescript
// Acceptable in tests: partial mocks
let mockUser = { id: "1", name: "Test" } as User;
```

### Summary

| Instead of                     | Use                         |
| ------------------------------ | --------------------------- |
| `data as User`                 | Zod schema validation       |
| `element as HTMLButtonElement` | `instanceof` check          |
| `value as string`              | Type guard or proper typing |
| `response as T`                | Generic with validation     |

---

> Rule: `no-default-exports` — impact **MEDIUM**


## No Default Exports

Use named exports for all modules. Avoid default exports.

### Why

1. **Consistent imports** - Same name everywhere, easier to search/refactor
2. **Better IDE support** - Auto-imports work reliably
3. **Explicit naming** - Forces meaningful names at export site
4. **Easier refactoring** - Rename symbol, all imports update

### Pattern

```typescript
// Bad: default export
export default function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

// Bad: default export class
export default class UserService {
  // ...
}

// Good: named export
export function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

// Good: named export class
export class UserService {
  // ...
}
```

### Components

```tsx
// Bad: default export component
export default function UserCard({ user }: Props) {
  return <div>{user.name}</div>;
}

// Good: named export component
export function UserCard({ user }: Props) {
  return <div>{user.name}</div>;
}
```

### Importing

```typescript
// With named exports - consistent name everywhere
import { UserCard } from "~/components/user-card";
import { formatCurrency } from "~/lib/format";

// With default exports - name can vary (bad)
import UserCard from "~/components/user-card";
import Card from "~/components/user-card"; // Same component, different name!
```

### Exception: Remix Route Components

Remix requires a default export for the route component. Name it `Component`:

```tsx
// app/routes/_.users/route.tsx
export async function loader() {
  // ...
}

export async function action() {
  // ...
}

// Exception: Remix requires default export for route component
// Always name it "Component"
export default function Component() {
  let data = useLoaderData<typeof loader>();
  return <div>{/* ... */}</div>;
}
```

### Re-exporting

```typescript
// Bad: re-export as default
export { UserCard as default } from "./user-card";

// Good: named re-export
export { UserCard } from "./user-card";

// Good: barrel file with named exports
export { UserCard } from "./user-card";
export { UserList } from "./user-list";
export { UserAvatar } from "./user-avatar";
```

---

> Rule: `result-type` — impact **MEDIUM**


# Use a Result Type for Error Flow

Represent success/failure explicitly instead of throwing in normal control flow.

## Pattern

```ts
export interface Success<T> {
  status: "success";
  data: T;
}

export interface Failure<E extends Error> {
  status: "failure";
  error: E;
}

export type Result<T, E extends Error> = Success<T> | Failure<E>;

export function success<T>(data: T): Success<T> {
  return { status: "success", data };
}

export function failure<E extends Error>(error: E): Failure<E> {
  return { status: "failure", error };
}

export function isSuccess<T, E extends Error>(
  result: Result<T, E>,
): result is Success<T> {
  return result.status === "success";
}

export function isFailure<T, E extends Error>(
  result: Result<T, E>,
): result is Failure<E> {
  return result.status === "failure";
}

export function succeeded<T, E extends Error>(
  result: Result<T, E>,
  message = "Result is a failure",
): asserts result is Success<T> {
  if (isFailure(result)) throw new Error(message, { cause: result.error });
}

export function failed<T, E extends Error>(
  result: Result<T, E>,
  message = "Result is a success",
): asserts result is Failure<E> {
  if (isSuccess(result)) throw new Error(message, { cause: result.data });
}
```

## Rules

1. Use `Result` for expected failure cases
2. Prefer `isFailure`/`isSuccess` checks in normal flow
3. Use `succeeded`/`failed` as assertions at boundaries

---

> Rule: `set-map-lookups` — impact **LOW-MEDIUM**


## Use Set/Map for O(1) Lookups

Convert arrays to Set/Map for repeated membership checks.

**Incorrect (O(n) per check):**

```typescript
const allowedIds = ['a', 'b', 'c', ...]
items.filter(item => allowedIds.includes(item.id))
```

**Correct (O(1) per check):**

```typescript
const allowedIds = new Set(['a', 'b', 'c', ...])
items.filter(item => allowedIds.has(item.id))
```

---

> Rule: `tosorted-immutable` — impact **MEDIUM-HIGH**


## Use toSorted() Instead of sort() for Immutability

`.sort()` mutates the array in place, which can cause bugs with React state and props. Use `.toSorted()` to create a new sorted array without mutation.

**Incorrect (mutates original array):**

```typescript
function UserList({ users }: { users: User[] }) {
  // Mutates the users prop array!
  let sorted = useMemo(
    () => users.sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  )
  return <div>{sorted.map(renderUser)}</div>
}
```

**Correct (creates new array):**

```typescript
function UserList({ users }: { users: User[] }) {
  // Creates new sorted array, original unchanged
  let sorted = useMemo(
    () => users.toSorted((a, b) => a.name.localeCompare(b.name)),
    [users]
  )
  return <div>{sorted.map(renderUser)}</div>
}
```

**Why this matters in React:**

1. Props/state mutations break React's immutability model - React expects props and state to be treated as read-only
2. Causes stale closure bugs - Mutating arrays inside closures (callbacks, effects) can lead to unexpected behavior

**Browser support (fallback for older browsers):**

`.toSorted()` is available in all modern browsers (Chrome 110+, Safari 16+, Firefox 115+, Node.js 20+). For older environments, use spread operator:

```typescript
// Fallback for older browsers
const sorted = [...items].sort((a, b) => a.value - b.value);
```

**Other immutable array methods:**

- `.toSorted()` - immutable sort
- `.toReversed()` - immutable reverse
- `.toSpliced()` - immutable splice
- `.with()` - immutable element replacement
