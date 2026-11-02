---
name: async
description: Async/await and Promise optimization guidelines. Use when writing, reviewing, or refactoring asynchronous code to eliminate waterfalls and maximize parallelism. Triggers on tasks involving data fetching, loaders, actions, or Promise handling.
---


# Async Best Practices

Performance optimization patterns for asynchronous JavaScript code. Contains 5 rules focused on eliminating request waterfalls and maximizing parallelism.

**Impact: CRITICAL** - Waterfalls are the #1 performance killer. Each sequential await adds full network latency.

## When to Apply

Reference these guidelines when:

- Writing Remix loaders or actions
- Implementing data fetching logic
- Working with multiple async operations
- Reviewing code for waterfall patterns
- Optimizing response times

## Rules Summary

### parallel (CRITICAL) — @rules/parallel.md

Use `Promise.all()` for independent operations.

```typescript
// Bad: 3 sequential round trips
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();

// Good: 1 parallel round trip
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments(),
]);
```

### defer-await (HIGH) — @rules/defer-await.md

Move await into branches where actually used.

```typescript
// Bad: always waits even when skipping
async function handle(skip: boolean) {
  let data = await fetchData();
  if (skip) return { skipped: true };
  return process(data);
}

// Good: only waits when needed
async function handle(skip: boolean) {
  if (skip) return { skipped: true };
  let data = await fetchData();
  return process(data);
}
```

### dependencies (CRITICAL) — @rules/dependencies.md

Chain dependent operations, parallelize independent ones.

```typescript
// Bad: profile waits for config unnecessarily
const [user, config] = await Promise.all([fetchUser(), fetchConfig()]);
const profile = await fetchProfile(user.id);

// Good: profile starts as soon as user resolves
const userPromise = fetchUser();
const profilePromise = userPromise.then((user) => fetchProfile(user.id));

const [user, config, profile] = await Promise.all([
  userPromise,
  fetchConfig(),
  profilePromise,
]);
```

### api-routes (CRITICAL) — @rules/api-routes.md

Start promises early, await late in loaders.

```typescript
// Bad: sequential execution
export async function loader() {
  let session = await auth();
  let config = await fetchConfig();
  return { session, config };
}

// Good: parallel execution
export async function loader() {
  let sessionPromise = auth();
  let configPromise = fetchConfig();
  const [session, config] = await Promise.all([sessionPromise, configPromise]);
  return { session, config };
}
```

### suspense-boundaries (HIGH) — @rules/suspense-boundaries.md

Use Suspense to show UI immediately while data loads.

```tsx
// Bad: entire page blocked by data
async function Page() {
  let data = await fetchData();
  return (
    <Layout>
      <Content data={data} />
    </Layout>
  );
}

// Good: layout shows immediately, content streams in
function Page() {
  return (
    <Layout>
      <Suspense fallback={<Skeleton />}>
        <Content />
      </Suspense>
    </Layout>
  );
}
```

---

# Rules — chi tiết đầy đủ


# frontend-async-best-practices — rules (5)

File con cua [`frontend-async-best-practices.md`](./frontend-async-best-practices.md). Moi rule mot muc, mo dau bang `> Rule:`.

---

> Rule: `api-routes` — impact **CRITICAL**


## Prevent Waterfall Chains in API Routes

In API routes and loaders, start independent operations immediately, even if you don't await them yet.

**Incorrect (config waits for auth, data waits for both):**

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  let session = await auth();
  let config = await fetchConfig();
  let data = await fetchData(session.user.id);
  return json({ data, config });
}
```

**Correct (auth and config start immediately):**

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  let sessionPromise = auth();
  let configPromise = fetchConfig();
  let session = await sessionPromise;
  let [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id),
  ]);
  return json({ data, config });
}
```

For operations with more complex dependency chains, use `better-all` to automatically maximize parallelism (see Dependency-Based Parallelization).

---

> Rule: `defer-await` — impact **HIGH**


## Defer Await Until Needed

Move `await` operations into the branches where they're actually used to avoid blocking code paths that don't need them.

**Incorrect (blocks both branches):**

```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  let userData = await fetchUserData(userId);

  if (skipProcessing) {
    // Returns immediately but still waited for userData
    return { skipped: true };
  }

  // Only this branch uses userData
  return processUserData(userData);
}
```

**Correct (only blocks when needed):**

```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) {
    // Returns immediately without waiting
    return { skipped: true };
  }

  // Fetch only when needed
  let userData = await fetchUserData(userId);
  return processUserData(userData);
}
```

**Another example (early return optimization):**

```typescript
// Incorrect: always fetches permissions
async function updateResource(resourceId: string, userId: string) {
  let permissions = await fetchPermissions(userId);
  let resource = await getResource(resourceId);

  if (!resource) {
    return { error: "Not found" };
  }

  if (!permissions.canEdit) {
    return { error: "Forbidden" };
  }

  return await updateResourceData(resource, permissions);
}

// Correct: fetches only when needed
async function updateResource(resourceId: string, userId: string) {
  let resource = await getResource(resourceId);

  if (!resource) {
    return { error: "Not found" };
  }

  let permissions = await fetchPermissions(userId);

  if (!permissions.canEdit) {
    return { error: "Forbidden" };
  }

  return await updateResourceData(resource, permissions);
}
```

This optimization is especially valuable when the skipped branch is frequently taken, or when the deferred operation is expensive.

---

> Rule: `dependencies` — impact **CRITICAL**


## Dependency-Based Parallelization

When operations have partial dependencies, start independent work immediately and chain dependent work. This maximizes parallelism without waiting unnecessarily.

**Problem: profile waits for config unnecessarily**

```typescript
const [user, config] = await Promise.all([fetchUser(), fetchConfig()]);
const profile = await fetchProfile(user.id); // config already done, wasted time
```

Timeline: `[user + config] -> [profile]` (2 sequential steps)

**Solution: chain dependent operations, parallelize independent ones**

```typescript
const userPromise = fetchUser();
const profilePromise = userPromise.then((user) => fetchProfile(user.id));

const [user, config, profile] = await Promise.all([
  userPromise,
  fetchConfig(),
  profilePromise,
]);
```

Timeline: `[user + config]` and `[user -> profile]` run in parallel (profile starts as soon as user completes, doesn't wait for config)

**More complex example:**

```typescript
// user -> profile -> settings (chain)
// config (independent)
// permissions depends on user (parallel with profile)

const userPromise = fetchUser();
const profilePromise = userPromise.then((u) => fetchProfile(u.id));
const settingsPromise = profilePromise.then((p) => fetchSettings(p.id));
const permissionsPromise = userPromise.then((u) => fetchPermissions(u.id));

const [user, config, profile, settings, permissions] = await Promise.all([
  userPromise,
  fetchConfig(),
  profilePromise,
  settingsPromise,
  permissionsPromise,
]);
```

**Key insight:** Create all promises first, then `Promise.all()` at the end. Each promise starts executing immediately when created, and `.then()` chains execute as soon as their dependency resolves.

---

> Rule: `parallel` — impact **CRITICAL**


## Promise.all() for Independent Operations

When async operations have no interdependencies, execute them concurrently using `Promise.all()`.

**Incorrect (sequential execution, 3 round trips):**

```typescript
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();
```

**Correct (parallel execution, 1 round trip):**

```typescript
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments(),
]);
```

---

> Rule: `suspense-boundaries` — impact **HIGH**


## Strategic Suspense Boundaries

Instead of awaiting data in async components before returning JSX, use Suspense boundaries to show the wrapper UI faster while data loads.

**Incorrect (wrapper blocked by data fetching):**

```tsx
async function Page() {
  let data = await fetchData(); // Blocks entire page

  return (
    <div>
      <div>Sidebar</div>
      <div>Header</div>
      <div>
        <DataDisplay data={data} />
      </div>
      <div>Footer</div>
    </div>
  );
}
```

The entire layout waits for data even though only the middle section needs it.

**Correct (wrapper shows immediately, data streams in):**

```tsx
function Page() {
  return (
    <div>
      <div>Sidebar</div>
      <div>Header</div>
      <div>
        <Suspense fallback={<Skeleton />}>
          <DataDisplay />
        </Suspense>
      </div>
      <div>Footer</div>
    </div>
  );
}

async function DataDisplay() {
  let data = await fetchData(); // Only blocks this component
  return <div>{data.content}</div>;
}
```

Sidebar, Header, and Footer render immediately. Only DataDisplay waits for data.

**Alternative (share promise across components):**

```tsx
function Page() {
  // Start fetch immediately, but don't await
  let dataPromise = fetchData();

  return (
    <div>
      <div>Sidebar</div>
      <div>Header</div>
      <Suspense fallback={<Skeleton />}>
        <DataDisplay dataPromise={dataPromise} />
        <DataSummary dataPromise={dataPromise} />
      </Suspense>
      <div>Footer</div>
    </div>
  );
}

function DataDisplay({ dataPromise }: { dataPromise: Promise<Data> }) {
  let data = use(dataPromise); // Unwraps the promise
  return <div>{data.content}</div>;
}

function DataSummary({ dataPromise }: { dataPromise: Promise<Data> }) {
  let data = use(dataPromise); // Reuses the same promise
  return <div>{data.summary}</div>;
}
```

Both components share the same promise, so only one fetch occurs. Layout renders immediately while both components wait together.

**When NOT to use this pattern:**

- Critical data needed for layout decisions (affects positioning)
- SEO-critical content above the fold
- Small, fast queries where suspense overhead isn't worth it
- When you want to avoid layout shift (loading -> content jump)

**Trade-off:** Faster initial paint vs potential layout shift. Choose based on your UX priorities.
