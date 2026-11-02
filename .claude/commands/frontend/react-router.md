---
name: react-router
description: React Router performance and architecture patterns. Use when writing loaders, actions, forms, routes, or working with React Router data fetching. Triggers on tasks involving React Router routes, data loading, form handling, or route organization.
---


> **Áp dụng khi:** dùng **React Router** framework mode / data APIs (loader, action). **Bỏ qua nếu:** dùng Next.js (→ frontend-nextjs) hoặc SPA không dùng data APIs của React Router.

# React Router Best Practices

Performance optimization and architecture patterns for React Router applications. Contains 55 rules across 11 categories focused on data loading, actions, forms, streaming, and route organization.

## When to Apply

Reference these guidelines when:

- Writing new React Router routes (loaders, actions)
- Handling forms and mutations
- Implementing streaming with Single Fetch
- Organizing route files and colocating queries
- Setting up authentication patterns
- Adding SEO/meta tags

## Rules Summary

### Data Loading (CRITICAL)

#### loader-avoid-waterfalls - @rules/loader-avoid-waterfalls.md

All data fetching happens in loaders. Never fetch in components with useEffect.

```tsx
// BAD: fetching in component
function Profile() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then(setUser);
  }, []);
  if (!user) return <Spinner />;
  return <div>{user.name}</div>;
}

// GOOD: fetch in loader
export async function loader({ request }: Route.LoaderArgs) {
  let user = await getUser(request);
  return data({ user });
}

export default function Component() {
  const { user } = useLoaderData<typeof loader>();
  return <div>{user.name}</div>;
}
```

#### loader-parallel-fetch - @rules/loader-parallel-fetch.md

Use Promise.all for parallel data fetching in loaders.

```tsx
import { data } from "react-router";

// Bad: sequential fetches (slow)
export async function loader({ request }: Route.LoaderArgs) {
  let user = await getUser(request);
  let posts = await getPosts(user.id);
  let comments = await getComments(user.id);
  return data({ user, posts, comments });
}

// Good: parallel fetches
export async function loader({ request }: Route.LoaderArgs) {
  let user = await getUser(request);
  let [posts, comments] = await Promise.all([
    getPosts(user.id),
    getComments(user.id),
  ]);
  return data({ user, posts, comments });
}
```

#### loader-request-caching - @rules/loader-request-caching.md

API clients dedupe calls within the same request via context. Fetch in each loader that needs data.

```tsx
// Both loaders can call getUser - cached per request
export async function loader({ request, context }: Route.LoaderArgs) {
  let client = await authenticate(request, context);
  let user = await getUser(client); // Uses cached result if already fetched
  return data({ user });
}
```

#### loader-revalidation-patterns - @rules/loader-revalidation-patterns.md

Use useRevalidator for polling, focus, and reconnect revalidation.

```tsx
const { revalidate } = useRevalidator();

useEffect(() => {
  if (visibilityState === "hidden") return; // Don't poll hidden tabs
  let id = setInterval(revalidate, 30000);
  return () => clearInterval(id);
}, [revalidate, visibilityState]);
```

#### loader-typing - @rules/loader-typing.md

Use proper TypeScript typing with Route.LoaderArgs.

```tsx
// Good: typed loader with useLoaderData
import { data } from "react-router";
import { useLoaderData } from "react-router";

export async function loader({ request, params }: Route.LoaderArgs) {
  return data({ user: await getUser(params.id) });
}

export default function Component() {
  const { user } = useLoaderData<typeof loader>();
  return <div>{user.name}</div>;
}
```

#### loader-url-validation - @rules/loader-url-validation.md

Validate URL params with zod or invariant.

```tsx
// Good: validate params early
import { data } from "react-router";
import { z } from "zod";

export async function loader({ params }: Route.LoaderArgs) {
  let itemId = z.string().parse(params.itemId);
  return data({ item: await getItem(itemId) });
}
```

#### loader-action-abort-signal - @rules/loader-action-abort-signal.md

Abort async work when the request is canceled.

```ts
export async function loader({ request }: Route.LoaderArgs) {
  let response = await fetch(url, { signal: request.signal });
  return data(await response.json());
}
```

#### loader-colocate-queries - @rules/loader-colocate-queries.md

Keep data queries in colocated `queries.server.ts` files.

```
routes/
  _.projects/
    queries.server.ts  # All data fetching functions
    route.tsx          # Loader calls query functions
    components/        # Route-specific components
```

#### route-auth-middleware - @rules/route-auth-middleware.md

Authenticate via middleware and authorize in each loader/action.

```ts
export const middleware: Route.MiddlewareFunction[] = [
  sessionMiddleware,
  authMiddleware,
];

export async function loader({ context }: Route.LoaderArgs) {
  authorize(context, { requireUser: true, onboardingComplete: true });
  return null;
}
```

### Middleware & Security (HIGH)

#### middleware-session - @rules/middleware-session.md

Keep a single session instance per request.

```ts
export const middleware: Route.MiddlewareFunction[] = [sessionMiddleware];
```

#### middleware-context-storage - @rules/middleware-context-storage.md

Store context/request in AsyncLocalStorage for arg-less helpers.

```ts
export const middleware: Route.MiddlewareFunction[] = [contextStorageMiddleware];
```

#### middleware-batcher - @rules/middleware-batcher.md

Deduplicate request-scoped API/DB calls.

```ts
let result = await getBatcher().batch("key", () => getData());
```

#### middleware-request-id - @rules/middleware-request-id.md

Add request IDs for logging/correlation.

```ts
let requestId = getRequestID();
```

#### middleware-logger - @rules/middleware-logger.md

Log requests consistently with built-in middleware.

```ts
export const middleware: Route.MiddlewareFunction[] = [loggerMiddleware];
```

#### middleware-server-timing - @rules/middleware-server-timing.md

Add Server-Timing measurements to responses.

```ts
return getTimingCollector().measure("load", "Load data", () => getData());
```

#### middleware-singleton - @rules/middleware-singleton.md

Create per-request singletons for caches.

```ts
let cache = getSingleton(context);
```

#### sec-fetch-guards - @rules/sec-fetch-guards.md

Reject cross-site mutation requests via Sec-Fetch headers.

```ts
if (fetchSite(request) === "cross-site") throw new Response(null, { status: 403 });
```

#### form-honeypot - @rules/form-honeypot.md

Add honeypot inputs for public forms.

```tsx
<Form method="post">
  <HoneypotInputs />
</Form>
```

#### cors-headers - @rules/cors-headers.md

Apply CORS headers to API routes.

```ts
return await cors(request, data(await getData()));
```

#### safe-redirects - @rules/safe-redirects.md

Sanitize user-driven redirects.

```ts
return redirect(safeRedirect(redirectTo, "/"));
```

#### typed-cookies - @rules/typed-cookies.md

Validate cookie payloads with schemas.

```ts
let typed = createTypedCookie({ cookie, schema });
```

#### client-ip-address - @rules/client-ip-address.md

Extract client IP from trusted proxy headers.

```ts
let ip = getClientIPAddress(request);
```

#### data-parent-route-data - @rules/data-parent-route-data.md

Use `useRouteLoaderData` for UI-only access to parent data. For loader logic, fetch in each loader (API clients cache per request).

```tsx
// UI-only access - use useRouteLoaderData
export default function ChildRoute() {
  const { user } = useRouteLoaderData<typeof profileLoader>("routes/_layout");
  return <div>Welcome, {user.name}</div>;
}

// Loader needs data - fetch again (cached, no extra request)
export async function loader({ request }: Route.LoaderArgs) {
  let client = await authenticate(request);
  let user = await getUser(client); // Uses cached result
  let settings = await getSettings(client, user.id);
  return data({ settings });
}
```

#### data-only-route-calls-hooks - @rules/data-only-route-calls-hooks.md

Only route components call `useLoaderData`/`useActionData`. Children receive props.

```tsx
// route.tsx - only place that calls useLoaderData
export default function ItemsRoute() {
  const { items } = useLoaderData<typeof loader>();
  return <ItemList items={items} />;
}

// components/item-list.tsx - receives data as props
export function ItemList({ items }: { items: Item[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

### Actions & Forms (CRITICAL)

#### action-validation - @rules/action-validation.md

Validate form data with zod schemas.

```tsx
// Good: schema validation with i18n error messages
export async function action({ request }: Route.ActionArgs) {
  let t = await i18n.getFixedT(request);
  let formData = await request.formData();

  try {
    const { amount } = z
      .object({
        amount: z.coerce
          .number()
          .min(
            minimumAmount,
            t("Amount must be at least {{min}}.", { min: minimumAmount }),
          ),
      })
      .parse({ amount: formData.get("amount") });

    await processAmount(amount);
    throw redirect("/success");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data(
        { errors: error.issues.map(({ message }) => message) },
        { status: 400 },
      );
    }
    throw error;
  }
}
```

#### action-error-handling - @rules/action-error-handling.md

Return validation errors, don't throw. Re-throw redirects and unknown errors.

```tsx
// Good: proper error handling
export async function action({ request }: Route.ActionArgs) {
  try {
    // ... validation and mutation
    throw redirect("/success");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data(
        { errors: error.issues.map(({ message }) => message) },
        { status: 400 },
      );
    }
    if (error instanceof Error) {
      return data({ errors: [error.message] }, { status: 400 });
    }
    throw error; // Re-throw redirects and unknown errors
  }
}
```

#### action-redirect-after - @rules/action-redirect-after.md

Redirect after successful mutations to prevent resubmission.

```tsx
// Good: redirect after mutation
export async function action({ request }: Route.ActionArgs) {
  await createItem(formData);
  throw redirect("/items"); // Use throw for redirect
}
```

#### action-zod-transform - @rules/action-zod-transform.md

Use Zod .transform() for input sanitization during validation.

```tsx
const schema = z.object({
  // Trim and lowercase email
  email: z.string().trim().toLowerCase().pipe(z.string().email()),

  // Parse currency string to number
  amount: z
    .string()
    .transform((val) => parseFloat(val.replace(/[,$]/g, "")))
    .pipe(z.number().positive()),

  // Convert checkbox to boolean
  subscribe: z
    .string()
    .optional()
    .transform((val) => val === "on"),
});
```

#### action-client-validation - @rules/action-client-validation.md

Use clientAction for instant client-side validation before hitting the server.

```tsx
export async function clientAction({
  request,
  serverAction,
}: Route.ClientActionArgs) {
  let formData = await request.formData();
  let result = schema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return data(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  return serverAction<typeof action>(); // Validation passed, call server
}
```

### Form Patterns (MEDIUM)

#### form-fetcher-vs-form - @rules/form-fetcher-vs-form.md

Use useFetcher for non-navigation mutations, Form for navigation.

```tsx
// Good: useFetcher for in-place updates (no navigation)
function LikeButton({ postId }: { postId: string }) {
  let fetcher = useFetcher();
  return (
    <fetcher.Form method="post" action="/api/like">
      <input type="hidden" name="postId" value={postId} />
      <button type="submit">Like</button>
    </fetcher.Form>
  );
}

// Good: Form for navigation after submit
function CreatePostForm() {
  return (
    <Form method="post" action="/posts/new">
      <input name="title" />
      <button type="submit">Create</button>
    </Form>
  );
}
```

#### form-pending-state - @rules/form-pending-state.md

Show loading states with useNavigation or fetcher.state.

```tsx
// Good: pending state with fetcher
function SubmitButton() {
  let fetcher = useFetcher();
  let isPending = fetcher.state !== "idle";

  return (
    <Button type="submit" isDisabled={isPending}>
      {isPending ? <Spinner /> : "Submit"}
    </Button>
  );
}

// Good: with useSpinDelay to avoid flicker
const isPending = useSpinDelay(fetcher.state !== "idle", { delay: 50 });
```

#### form-reset-on-success - @rules/form-reset-on-success.md

Reset uncontrolled form inputs after successful submission.

```tsx
const formRef = useRef<HTMLFormElement>(null);
const fetcher = useFetcher<typeof action>();

useEffect(
  function resetFormOnSuccess() {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      formRef.current?.reset();
    }
  },
  [fetcher.state, fetcher.data],
);

return (
  <fetcher.Form method="post" ref={formRef}>
    ...
  </fetcher.Form>
);
```

#### form-persist-on-error - @rules/form-persist-on-error.md

Return field values from actions on validation errors to repopulate inputs.

```tsx
// Action returns fields on error
export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();
  let fields = { email: formData.get("email")?.toString() ?? "" };
  let result = schema.safeParse(fields);

  if (!result.success) {
    return data(
      { errors: result.error.flatten().fieldErrors, fields },
      { status: 400 },
    );
  }
  // ...
}

// Component uses defaultValue
<input name="email" defaultValue={actionData?.fields?.email} />;
```

### Client Functions (MEDIUM)

#### clientloader-debounce - @rules/clientloader-debounce.md

Use clientLoader/clientAction to debounce at the route level.

```tsx
import { setTimeout } from "node:timers/promises";

export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  // Debounce by 500ms - request.signal aborts if called again
  return await setTimeout(500, serverLoader, { signal: request.signal });
}

clientLoader.hydrate = true;
```

### Migrations (HIGH)

#### migrate-defer-to-data - @rules/migrate-defer-to-data.md

Migrate from defer() to data() with promises for Single Fetch.

```tsx
// Bad: old defer pattern
import { defer } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  return defer({
    critical: await getCriticalData(),
    lazy: getLazyData(), // Promise
  });
}

// Good: Single Fetch with data() - promises auto-stream
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  return data({
    critical: await getCriticalData(),
    lazy: getLazyData(), // Promise automatically streamed
  });
}
```

### Streaming (CRITICAL)

#### streaming-await-suspense - @rules/streaming-await-suspense.md

Use Await with Suspense for streamed data.

```tsx
// Good: Await with Suspense fallback
import { Await, useLoaderData } from "react-router";
import { Suspense } from "react";

export default function Component() {
  const { critical, lazy } = useLoaderData<typeof loader>();

  return (
    <div>
      <div>{critical.name}</div>
      <Suspense fallback={<Skeleton />}>
        <Await resolve={lazy}>{(data) => <LazyContent data={data} />}</Await>
      </Suspense>
    </div>
  );
}
```

#### migrate-jsonhash-to-native - @rules/migrate-jsonhash-to-native.md

Stop using jsonHash, use native Promise.all or data() patterns.

```tsx
// Bad: jsonHash from remix-utils
import { jsonHash } from "remix-utils/json-hash";

export async function loader({ request }: Route.LoaderArgs) {
  return jsonHash({
    a: getDataA(),
    b: getDataB(),
  });
}

// Good: native Promise.all
export async function loader({ request }: Route.LoaderArgs) {
  const [a, b] = await Promise.all([getDataA(), getDataB()]);
  return data({ a, b });
}

// Good: data() with promises for streaming
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  return data({
    a: getDataA(), // Streams automatically
    b: getDataB(),
  });
}
```

#### migrate-json-to-data - @rules/migrate-json-to-data.md

Migrate from deprecated json() to data().

```tsx
// Bad: json() is deprecated
import { json } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let items = await getItems();
  return json({ items });
}

// Good: use data() for all responses
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let items = await getItems();
  return data({ items });
}

// With status codes
return data({ errors: ["Invalid"] }, { status: 400 });

// Throwing errors
throw data({ message: "Not found" }, { status: 404 });
```

#### migrate-namedaction-to-intent - @rules/migrate-namedaction-to-intent.md

Migrate from namedAction helper to z.discriminatedUnion pattern.

```tsx
// Bad: namedAction from remix-utils
import { namedAction } from "remix-utils/named-action";

export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();

  return namedAction(formData, {
    async create() {
      return data({ success: true });
    },
    async delete() {
      return data({ success: true });
    },
  });
}

// Good: z.discriminatedUnion for type-safe intent validation
export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();

  let body = z
    .discriminatedUnion("intent", [
      z.object({ intent: z.literal("create"), title: z.string() }),
      z.object({ intent: z.literal("delete"), id: z.string() }),
    ])
    .parse(Object.fromEntries(formData.entries()));

  if (body.intent === "create") {
    await createItem(client, body);
    throw redirect("/items");
  }

  if (body.intent === "delete") {
    await deleteItem(client, body.id);
    throw redirect("/items");
  }
}
```

### Error Handling (MEDIUM)

#### error-boundary-layout - @rules/error-boundary-layout.md

Implement layout-aware ErrorBoundary with useRouteError.

```tsx
import { useRouteError, isRouteErrorResponse } from "react-router";

export function ErrorBoundary() {
  let error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Error</h1>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
    </div>
  );
}
```

#### error-boundary-route - @rules/error-boundary-route.md

Add ErrorBoundary to routes with data fetching to catch loader/action errors.

```tsx
// Good: route with error boundary
export async function loader() {
  // May throw
}

export default function Component() {
  // Main component
}

export function ErrorBoundary() {
  // Catches loader errors
}
```

### Navigation & Linking (MEDIUM)

#### link-prefetch-intent - @rules/link-prefetch-intent.md

Use prefetch="intent" for faster navigation on hover/focus.

```tsx
// Good: prefetch on intent
import { Link } from "react-router";

<Link to="/dashboard" prefetch="intent">
  Dashboard
</Link>

// Also applies to LinkButton component
<LinkButton to="/settings" prefetch="intent">
  Settings
</LinkButton>
```

#### navigation-avoid-navigate-back - @rules/navigation-avoid-navigate-back.md

Avoid `navigate(-1)` for in-app back links.

```tsx
<Link to={`/items/${id}`} state={{ back: location.pathname }}>
  View
</Link>
```

#### prefetch-fetcher-data - @rules/prefetch-fetcher-data.md

Use PrefetchPageLinks to preload data for fetcher.load() calls.

```tsx
import { useFetcher, PrefetchPageLinks } from "react-router";

function ItemDetails({ itemId }: { itemId: string }) {
  let fetcher = useFetcher<typeof resourceLoader>();

  return (
    <>
      <PrefetchPageLinks page={`/api/items/${itemId}`} />
      <button onClick={() => fetcher.load(`/api/items/${itemId}`)}>
        View Details
      </button>
      {fetcher.data && <Modal data={fetcher.data} />}
    </>
  );
}
```

### Resource Routes & Responses (MEDIUM)

#### response-helpers - @rules/response-helpers.md

Use response helpers for resource routes.

```ts
return html("<h1>Hello</h1>");
```

#### sse-event-stream - @rules/sse-event-stream.md

Stream updates with `eventStream` and `useEventSource`.

```ts
return eventStream(request.signal, (send) => {
  send({ event: "time", data: new Date().toISOString() });
});
```

#### prefetch-cache - @rules/prefetch-cache.md

Use short caching for prefetch requests.

```ts
if (isPrefetch(request)) headers.set("Cache-Control", "private, max-age=5");
```

### Route Organization (MEDIUM)

#### route-organization - @rules/route-organization.md

Use folder routes with colocated files.

```
routes/
  _.projects/
    queries.server.ts    # Data fetching functions
    actions.server.ts    # Action handlers (optional)
    route.tsx            # Loader, action, component
    components/          # Route-specific components
      header.tsx
      project-card.tsx
```

#### route-resource-routes - @rules/route-resource-routes.md

Use resource routes for API-like endpoints without UI.

```tsx
// routes/api.search.tsx - resource route (no default export)
export async function loader({ request }: Route.LoaderArgs) {
  let url = new URL(request.url);
  let query = url.searchParams.get("q");
  let results = await search(query);
  return data({ results });
}

// No default export = resource route
```

#### route-action-routes - @rules/route-action-routes.md

Centralize reusable actions in dedicated resource routes using `actions.noun-verb.ts` naming.

```tsx
// routes/actions.post-create.ts
import { data, redirect } from "react-router";

export async function action({ request, context }: Route.ActionArgs) {
  let client = await authenticate(request, { context });
  // validation, create post...
  return data({ ok: true, post }, { status: 201 });
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  let result = await serverAction<typeof action>();
  if (result.ok) {
    toast.success("Post created");
    return redirect(`/posts/${result.post.id}`);
  }
  toast.error("Failed to create post");
  return result;
}

// Usage: <fetcher.Form method="post" action="/actions/post-create">
```

#### route-should-revalidate - @rules/route-should-revalidate.md

Optimize revalidation with shouldRevalidate.

```tsx
// Good: prevent unnecessary revalidation
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formAction,
  defaultShouldRevalidate,
}) {
  // Don't revalidate if only hash changed
  if (currentUrl.pathname === nextUrl.pathname) {
    return false;
  }
  return defaultShouldRevalidate;
}
```

#### route-handle-metadata - @rules/route-handle-metadata.md

Use handle export with app-defined handle types for route metadata.

```tsx
// Good: handle for hydration and layout control
export const handle: Handle = {
  hydrate: true,
};

// For layout routes with more options
export const handle: LayoutHandle = {
  hydrate: true,
  stickyHeader: true,
  footerType: "app",
};
```

### Meta & SEO (MEDIUM)

#### meta-function-v2 - @rules/meta-function-v2.md

Use meta function with loader data for dynamic SEO.

```tsx
export const meta: Route.MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  return [
    { title: data.title },
    { name: "description", content: data.description },
    { property: "og:title", content: data.title },
    { property: "og:description", content: data.description },
    { property: "og:image", content: data.image },
  ];
};

// Or return from loader for centralized SEO logic
export async function loader({ request }: Route.LoaderArgs) {
  let t = await i18n.getFixedT(request);
  return data({
    // ... data
    meta: seo(t, {
      title: t("Page Title"),
      description: t("Page description"),
      og: { title: t("OG Title"), image: "/og-image.png" },
    }),
  });
}

export const meta: Route.MetaFunction<typeof loader> = ({ data }) =>
  data?.meta ?? [];
```

### Route Conventions (MEDIUM)

#### route-component-naming - @rules/route-component-naming.md

Name the default export `Component` in route files.

```tsx
// app/routes/_.users/route.tsx
export async function loader() { ... }
export async function action() { ... }

// Always name "Component"
export default function Component() {
  let { users } = useLoaderData<typeof loader>();
  return <UserList users={users} />;
}
```

#### route-import-restrictions - @rules/route-import-restrictions.md

Avoid importing from other route files. Routes import shared modules, not each other.

```tsx
// Bad: importing from another route
import { UserCard } from "~/routes/users/components/user-card";

// Good: import from shared location
import { UserCard } from "~/components/user-card";

// Exception: import loader/action types for useFetcher inference
import type { action } from "~/routes/api.orders/route";
let fetcher = useFetcher<typeof action>();
```

---

# Rules — chi tiết đầy đủ


# frontend-react-router-best-practices — rules (55)

File con cua [`frontend-react-router-best-practices.md`](./frontend-react-router-best-practices.md). Moi rule mot muc, mo dau bang `> Rule:`.

---

> Rule: `action-client-validation` — impact **MEDIUM**


# Client-Side Validation with clientAction

Use `clientAction` to validate forms on the client before hitting the server. This provides instant feedback while maintaining server-side validation as the source of truth.

## Why

- Instant validation feedback without server roundtrip
- Progressive enhancement: works without JS (server validates)
- Same Zod schema can validate on both client and server
- Reduces unnecessary server requests for invalid data

## Progressive Enhancement Layers

Build validation in layers, each enhancing the previous:

1. **Server-side validation** (always required - never trust the client)
2. **HTML5 validation** (`required`, `type="email"`, `minLength`, etc.)
3. **clientAction validation** (instant Zod validation after JS loads)

## Implementation

### Server Action (Source of Truth)

```tsx
// schemas.server.ts
import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  content: z.string().min(1, "Content is required"),
});

// route.tsx
export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();

  let result = createPostSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return data(
      { ok: false, errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  await createPost(result.data);
  return data({ ok: true });
}
```

### Client Action (Fast Feedback)

```tsx
// route.tsx
export async function clientAction({
  request,
  serverAction,
}: Route.ClientActionArgs) {
  let formData = await request.clone().formData();

  // Validate on client first
  let result = createPostSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    // Return errors without hitting server
    return data(
      { ok: false, errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Validation passed, call server action
  return serverAction<typeof action>();
}
```

### Form Component

```tsx
export default function Component() {
  let actionData = useActionData<typeof action>();

  return (
    <Form method="post">
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          required              {/* HTML5 validation */}
          maxLength={100}       {/* HTML5 validation */}
          aria-invalid={actionData?.errors?.title ? true : undefined}
          aria-describedby={actionData?.errors?.title ? "title-error" : undefined}
        />
        {actionData?.errors?.title && (
          <p id="title-error" role="alert">{actionData.errors.title[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="content">Content</label>
        <textarea
          id="content"
          name="content"
          required
          aria-invalid={actionData?.errors?.content ? true : undefined}
        />
        {actionData?.errors?.content && (
          <p role="alert">{actionData.errors.content[0]}</p>
        )}
      </div>

      <button type="submit">Create Post</button>
    </Form>
  );
}
```

## How It Works

1. **Without JS**: Form submits to server, server validates, returns errors
2. **With JS + invalid data**: clientAction validates, returns errors instantly (no server call)
3. **With JS + valid data**: clientAction validates, passes, calls serverAction

## Sharing Schemas

Keep schemas in a shared location so both client and server use the same validation:

```
routes/
  _.posts.new/
    schemas.ts          # Shared schema (not .server.ts!)
    route.tsx           # Uses schema in action and clientAction
```

```tsx
// schemas.ts (no .server suffix - needs to run on client too)
import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
});
```

## With i18n

For translated error messages, you may need different approaches for client vs server:

```tsx
// Server action - has access to i18n
export async function action({ request }: Route.ActionArgs) {
  let t = await i18next.getFixedT(request);
  let schema = createPostSchema(t); // Schema factory with translations
  // ...
}

// Client action - simpler approach
export async function clientAction({
  request,
  serverAction,
}: Route.ClientActionArgs) {
  let result = createPostSchemaBasic.safeParse(/* ... */);
  if (!result.success) {
    // Return generic errors, server will return translated ones if needed
    return data(
      { ok: false, errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  return serverAction<typeof action>();
}
```

## Rules

1. Always validate on the server - clientAction is an enhancement, not a replacement
2. Use the same Zod schema for client and server when possible
3. Keep schemas in non-.server.ts files if clientAction needs them
4. Add HTML5 validation attributes for no-JS fallback
5. clientAction should call `serverAction()` after validation passes
6. Return the same error shape from both client and server validation

---

> Rule: `action-error-handling` — impact **HIGH**


# Action Error Handling

Return validation errors using data(). Re-throw redirects and unknown errors.

## Why

- Validation errors should be displayed to users, not crash the app
- Redirects must be re-thrown to work (they're thrown as Response objects)
- Unknown errors should bubble up to error boundaries

## Pattern

```tsx
import { data } from "react-router";

export async function action({ request }: Route.ActionArgs) {
  let client = await authenticate(request);
  await authorize(client, { accountStatus: "active" });

  let formData = await request.formData();

  try {
    // Validation
    let validated = schema.parse({ ... });

    // Mutation
    await performMutation(client, validated);

    // Success - redirect
    throw redirect("/success");
  } catch (error) {
    // Handle zod validation errors
    if (error instanceof z.ZodError) {
      return data({ errors: error.issues.map(({ message }) => message) }, { status: 400 });
    }

    // Handle known business errors
    if (error instanceof Error) {
      return data({ errors: [error.message] }, { status: 400 });
    }

    // Re-throw everything else (redirects, unknown errors)
    throw error;
  }
}
```

## Why `throw redirect()` Instead of `return redirect()`

React Router redirects are Response objects that get thrown. Using `throw` ensures:

1. Code after redirect doesn't execute
2. TypeScript knows the function exits
3. Consistent with React Router's internal behavior

```tsx
// Good
await performMutation();
throw redirect("/success");

// Also works but less clear
await performMutation();
return redirect("/success");
```

## Error Types to Handle

```tsx
try {
  // ... validation and mutation
} catch (error) {
  // 1. Zod validation errors -> return 400
  if (error instanceof z.ZodError) {
    return data(
      { errors: error.issues.map(({ message }) => message) },
      { status: 400 },
    );
  }

  // 2. Custom business errors -> return 400
  if (error instanceof BusinessError) {
    return data({ errors: [error.message] }, { status: 400 });
  }

  // 3. Generic errors -> return 400
  if (error instanceof Error) {
    return data({ errors: [error.message] }, { status: 400 });
  }

  // 4. Everything else (redirects, Response objects) -> re-throw
  throw error;
}
```

---

> Rule: `action-redirect-after` — impact **MEDIUM**


# Redirect After Mutation

Redirect after successful mutations to prevent form resubmission.

## Why

- Prevents duplicate submissions on page refresh
- Provides clear feedback that action completed
- Follows Post/Redirect/Get (PRG) pattern
- Browser back button works as expected

## Pattern

```tsx

export async function action({ request }: Route.ActionArgs) {
  let client = await authenticate(request);
  let formData = await request.formData();

  let data = schema.parse({ ... });
  await createItem(client, data);

  // Redirect after successful mutation
  throw redirect("/items");
}
```

## Use `throw redirect()` Not `return redirect()`

```tsx
// Good: throw ensures code stops executing
await createItem(client, data);
throw redirect("/success");

// Works but less explicit
await createItem(client, data);
return redirect("/success");
```

## Redirect with Flash Messages

Use session flash for success/error messages:

```tsx
import { commitSession, getSession } from "~/lib/session.server";

export async function action({ request }: Route.ActionArgs) {
  let session = await getSession(request);

  try {
    await createItem(client, data);

    session.flash("success", "Item created successfully");

    throw redirect("/items", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } catch (error) {
    // Let redirects bubble up - redirect() returns a Response
    if (error instanceof Response) throw error;

    // Handle actual errors...
    return data({ errors: ["Something went wrong"] }, { status: 500 });
  }
}
```

## Re-throw Redirects in Catch Blocks

When using `throw redirect()` inside a try block, the redirect is caught by the catch block since `redirect()` returns a `Response`. Always re-throw it:

```tsx
// Bad: redirect gets swallowed by catch
try {
  await createItem(client, data);
  throw redirect("/success");
} catch (error) {
  return data({ errors: ["Failed"] }, { status: 500 });
}

// Good: re-throw Response to let redirect bubble up
try {
  await createItem(client, data);
  throw redirect("/success");
} catch (error) {
  if (error instanceof Response) throw error;
  return data({ errors: ["Failed"] }, { status: 500 });
}
```

## When NOT to Redirect

Some actions return data instead of redirecting:

```tsx
import { data } from "react-router";

// In-place updates with fetcher - return data, no redirect
export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();
  let intent = formData.get("intent");

  if (intent === "like") {
    let postId = z.string().parse(formData.get("postId"));
    let likes = await toggleLike(postId);
    return data({ likes }); // Return updated count
  }

  throw new Error(`Unknown intent: ${intent}`);
}
```

## Redirect Patterns

```tsx
// Simple redirect
throw redirect("/items");

// Redirect with preserved search params
const url = new URL(request.url);
throw redirect(`/items${url.search}`);

// Redirect to dynamic path
throw redirect(`/items/${newItem.id}`);

// Redirect with object (React Router)
throw redirect({ pathname: "/home" });

// Redirect with returnTo param
const url = new URL(request.url);
const returnTo = url.searchParams.get("returnTo") || "/home";
throw redirect(returnTo);
```

---

> Rule: `action-validation` — impact **HIGH**


# Form Data Validation

Validate form data with Standard Schema in actions, using a shared `validate` helper.

## Why

- Type-safe validation with automatic parsing
- Consistent result handling across actions
- Consistent error handling pattern
- Catches invalid data before mutations

## Pattern

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { failure, success } from "~/lib/result";

export async function validate<Schema extends StandardSchemaV1>(
  input: FormData | Request,
  schema: Schema,
): Promise<
  ReturnType<typeof success<StandardSchemaV1.InferOutput<Schema>>> |
    ReturnType<typeof failure<ValidationError>>
> {
  if (input instanceof Request) input = await input.formData();
  let entries = Object.fromEntries(input.entries());
  let result = schema["~standard"].validate(entries);
  if (result instanceof Promise) result = await result;
  if (result.issues) return failure(new ValidationError(result.issues));
  return success(result.value);
}

export class ValidationError extends Error {
  issues: StandardSchemaV1.ValidationIssue[];

  constructor(issues: StandardSchemaV1.ValidationIssue[]) {
    super("Validation Error");
    this.issues = issues;
  }
}
```

```ts
import { data, redirect } from "react-router";
import { isFailure } from "~/lib/result";
import { validate } from "~/lib/validation";
import { currentUser } from "~/lib/authorize.server";

export async function action({ request }: Route.ActionArgs) {
  let user = currentUser();

  let result = await validate(request, schema);
  if (isFailure(result)) {
    return data(result.error.issues, { status: 422 });
  }

  await createRecord({ userId: user.id, ...result.data });
  throw redirect("/success");
}
```

## Common Validators

```ts
const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  amount: z.coerce.number().positive(),
  quantity: z.coerce.number().int().min(1).max(100),
  page: z.coerce.number().default(1),
  status: z.enum(["draft", "published", "archived"]),
  agreed: z.coerce.boolean(),
  tags: z.array(z.string()).min(1),
  notes: z.string().nullable(),
});
```

## Displaying Errors in Component

```tsx
export default function Component() {
  let fetcher = useFetcher<typeof action>();

  return (
    <fetcher.Form method="post">
      {/* Form fields */}

      {fetcher.data?.errors && (
        <ul className="text-failure-700 text-sm">
          {fetcher.data.errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}

      <Button type="submit">Submit</Button>
    </fetcher.Form>
  );
}
```

---

> Rule: `action-zod-transform` — impact **MEDIUM**


# Use Zod Transform for Input Sanitization

Use Zod's `.transform()` to sanitize and normalize form input during validation.

## Why

- Sanitization happens at the same place as validation
- Input is normalized before it reaches business logic
- Type-safe: transformed type is reflected in TypeScript
- No separate sanitization step needed

## Common Transforms

### Trim Whitespace

```typescript
const schema = z.object({
  name: z.string().trim(),
  email: z.string().email().trim().toLowerCase(),
});

// Input: { name: "  John  ", email: "  JOHN@Example.COM  " }
// Output: { name: "John", email: "john@example.com" }
```

### Convert Empty Strings to Undefined

```typescript
const schema = z.object({
  nickname: z
    .string()
    .transform((val) => (val === "" ? undefined : val))
    .pipe(z.string().optional()),
});

// Input: { nickname: "" }
// Output: { nickname: undefined }
```

### Parse Numbers from Strings

```typescript
const schema = z.object({
  amount: z
    .string()
    .transform((val) => parseFloat(val.replace(/[,$]/g, "")))
    .pipe(z.number().positive()),
});

// Input: { amount: "$1,234.56" }
// Output: { amount: 1234.56 }
```

### Normalize Phone Numbers

```typescript
const schema = z.object({
  phone: z
    .string()
    .transform((val) => val.replace(/\D/g, ""))
    .pipe(z.string().length(10)),
});

// Input: { phone: "(555) 123-4567" }
// Output: { phone: "5551234567" }
```

### Convert Checkbox to Boolean

```typescript
const schema = z.object({
  subscribe: z
    .string()
    .optional()
    .transform((val) => val === "on"),
});

// Input: { subscribe: "on" } or {}
// Output: { subscribe: true } or { subscribe: false }
```

## Full Example: Action with Transforms

```typescript
// schemas.server.ts
import { z } from "zod";
import type { TFunction } from "i18next";

export function orderSchema(t: TFunction) {
  return z.object({
    amount: z
      .string()
      .transform((val) => parseFloat(val.replace(/[,$]/g, "")))
      .pipe(
        z
          .number({ message: t("Amount is required") })
          .positive({ message: t("Amount must be positive") })
          .max(1000000, { message: t("Amount exceeds maximum") }),
      ),

    itemId: z
      .string()
      .trim()
      .pipe(z.string().uuid({ message: t("Invalid item") })),

    note: z
      .string()
      .trim()
      .transform((val) => (val === "" ? undefined : val))
      .pipe(z.string().max(500).optional()),

    isPrivate: z
      .string()
      .optional()
      .transform((val) => val === "on"),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.string().email({ message: t("Invalid email") })),
  });
}

// route.tsx
export async function action({ request }: Route.ActionArgs) {
  let t = await i18next.getFixedT(request);
  let formData = await request.formData();

  let result = orderSchema(t).safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return data(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // result.data is fully sanitized and typed
  const { amount, itemId, note, isPrivate, email } = result.data;

  await createOrder({ amount, itemId, note, isPrivate, email });
  return redirect("/orders");
}
```

## Chaining Transforms

Use `.pipe()` to validate after transforming:

```typescript
const schema = z.object({
  // Transform first, then validate the transformed value
  age: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(18).max(120)),
});
```

## Default Values with Transform

```typescript
const schema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive()),

  sort: z
    .string()
    .optional()
    .transform((val) => val || "date")
    .pipe(z.enum(["date", "amount", "name"])),
});
```

## Rules

1. Use `.trim()` on all string inputs
2. Use `.toLowerCase()` on emails and case-insensitive fields
3. Use `.transform()` to convert form strings to proper types (numbers, booleans)
4. Use `.pipe()` to validate after transforming
5. Handle empty strings explicitly (transform to undefined or use .optional())
6. Put transforms in schema factory functions for i18n support

---

> Rule: `client-ip-address` — impact **LOW**


# Use getClientIPAddress Safely

Extract client IP from trusted proxy headers when you need it.

## Pattern

```ts
import { getClientIPAddress } from "remix-utils/get-client-ip-address";

export async function loader({ request }: Route.LoaderArgs) {
  let ip = getClientIPAddress(request) ?? "unknown";
  return { ip };
}
```

## Rules

1. Expect `null` in local development
2. Only trust headers from known proxies

---

> Rule: `clientloader-debounce` — impact **MEDIUM**


# Debounce Loaders and Actions with clientLoader/clientAction

Use `clientLoader` and `clientAction` to debounce at the route level instead of in components.

## Why

- Centralizes debounce logic in the route, not scattered across components
- Automatically cancels pending requests when a new one starts
- Works with `<Form>` and `fetcher.Form` without custom `onSubmit` handlers
- Makes debounce timing easy to change or remove
- Route controls _when_ its logic runs, not just _what_ it does

## Pattern: Debounce a Loader

For search inputs that trigger on every keystroke:

```tsx
import { setTimeout } from "node:timers/promises";
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let url = new URL(request.url);
  let query = url.searchParams.get("query") ?? "";
  let results = await searchItems(query);
  return data({ results });
}

export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  // Debounce by 500ms - if user types again, request.signal aborts this
  return await setTimeout(500, serverLoader, { signal: request.signal });
}

// Required to enable clientLoader
clientLoader.hydrate = true;
```

The `clientLoader` is called on every keystroke, but `serverLoader` only runs after 500ms of inactivity. If the same fetcher calls `clientLoader` again before the delay completes, the previous request is aborted via `request.signal`.

## Pattern: Debounce an Action

For actions that fire frequently, like scroll position tracking:

```tsx
import { setTimeout } from "node:timers/promises";
import { data } from "react-router";

export async function action({ request, params }: Route.ActionArgs) {
  let formData = await request.formData();
  let scrollY = Number(formData.get("scrollY"));
  await updateReadProgress(params.postId, scrollY);
  return data({ ok: true });
}

export async function clientAction({
  request,
  serverAction,
}: Route.ClientActionArgs) {
  // Debounce by 50ms for scroll events
  return await setTimeout(50, serverAction, { signal: request.signal });
}
```

## How It Works

1. User triggers loader/action (typing, scrolling, etc.)
2. `clientLoader`/`clientAction` starts a `setTimeout`
3. If triggered again before timeout completes, `request.signal` aborts the pending request
4. Only the last request after the debounce period calls the server

## Component Usage

No special handling needed in components:

```tsx
export default function SearchPage() {
  let { results } = useLoaderData<typeof loader>();
  let [searchParams, setSearchParams] = useSearchParams();

  return (
    <div>
      <input
        type="search"
        defaultValue={searchParams.get("query") ?? ""}
        onChange={(e) => setSearchParams({ query: e.target.value })}
      />
      <ul>
        {results.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

The route handles debouncing - the component just updates search params normally.

## When to Use

| Scenario            | Debounce Time |
| ------------------- | ------------- |
| Search/autocomplete | 300-500ms     |
| Form auto-save      | 1000-2000ms   |
| Scroll tracking     | 50-100ms      |
| Resize handling     | 100-200ms     |

## Rules

1. Use `clientLoader`/`clientAction` for route-level debouncing
2. Pass `{ signal: request.signal }` to `setTimeout` for automatic cancellation
3. Import `setTimeout` from `node:timers/promises` (returns a Promise)
4. Set `clientLoader.hydrate = true` when using clientLoader
5. Prefer route-level debounce over component-level `useDebounce` hooks

---

> Rule: `cors-headers` — impact **MEDIUM**


# Use CORS Helper for API Routes

Apply CORS headers with `cors()` in loaders/actions that serve cross-origin clients.

## Pattern

```ts
import { cors } from "remix-utils/cors";
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let response = data(await getData());
  return await cors(request, response);
}
```

## Rules

1. Use `cors()` only on routes meant for cross-origin access
2. Keep CORS configuration explicit (origin/methods/headers)

---

> Rule: `data-only-route-calls-hooks` — impact **MEDIUM**


# Only Route Component Calls Data Hooks

Only the route's default export component should call `useLoaderData` and `useActionData`. Child components receive data via props.

## Why

- Clear data flow from route to children
- Components are reusable and testable
- Easier to understand where data comes from
- Avoids hidden dependencies in child components

## Pattern

```tsx
// route.tsx
export async function loader({ request }: Route.LoaderArgs) {
  let client = await authenticate(request);
  let items = await getItems(client);
  return data({ items });
}

export async function action({ request }: Route.ActionArgs) {
  // ... handle action
  return data({ errors: [] });
}

// Only the route component calls the hooks
export default function Component() {
  const { items } = useLoaderData<typeof loader>();
  let actionData = useActionData<typeof action>();

  return (
    <div>
      {actionData?.errors && <ErrorList errors={actionData.errors} />}
      <ItemList items={items} />
    </div>
  );
}
```

## Child Components Receive Props

```tsx
// components/item-list.tsx
interface ItemListProps {
  items: Item[];
}

// Component receives data as props, doesn't call useLoaderData
export function ItemList({ items }: ItemListProps) {
  return (
    <ul>
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </ul>
  );
}

// components/item-card.tsx
interface ItemCardProps {
  item: Item;
}

export function ItemCard({ item }: ItemCardProps) {
  return <li>{item.name}</li>;
}
```

## Exception: Deeply Nested Data

For deeply nested components that need parent route data, use `useRouteLoaderData`:

```tsx
// Deeply nested component needing user from parent layout
function UserAvatar() {
  // This is acceptable for layout-level data
  let data = useRouteLoaderData<typeof profileLoader>("routes/_._profile");
  return <Avatar src={data?.user.avatar} />;
}
```

## Benefits

```tsx
// Components are easily testable
import { render } from "@testing-library/react";
import { ItemList } from "./item-list";

test("renders items", () => {
  let items = [{ id: "1", name: "Test" }];
  render(<ItemList items={items} />);
  // No need to mock useLoaderData
});
```

---

> Rule: `data-parent-route-data` — impact **MEDIUM**


# Access Parent Route Data

Use `useRouteLoaderData` or `useMatches` to access data from parent routes.

## Why

- Avoids prop drilling through nested routes
- No need to refetch data already loaded by parent
- Type-safe access to parent loader data
- Works with React Router's nested routing model

## useRouteLoaderData

Access a specific parent route's data by route ID:

```tsx
import { useRouteLoaderData } from "react-router";
import type { loader as parentLoader } from "~/routes/_layout/route";

export default function ChildRoute() {
  // Route ID matches the file path without extension
  let parentData =
    useRouteLoaderData<typeof parentLoader>("routes/_layout");

  if (!parentData) return null;

  return <div>Welcome, {parentData.user.name}</div>;
}
```

## useMatches

Access all matched routes and their data:

```tsx
import { useMatches } from "react-router";

export default function Component() {
  let matches = useMatches();

  // Find a specific match by ID or pathname
  let layoutMatch = matches.find((m) => m.id === "routes/_layout");
  let layoutData = layoutMatch?.data as LayoutLoaderData | undefined;

  return <div>{layoutData?.user.name}</div>;
}
```

## When to Use Which

| Scenario                            | Use                      |
| ----------------------------------- | ------------------------ |
| Known parent route, need typed data | `useRouteLoaderData`     |
| Search through multiple routes      | `useMatches`             |
| Access route handle metadata        | `useMatches`             |
| Component used in multiple places   | `useMatches` with search |

## Don't Use Outlet Context

```tsx
// Bad: Outlet context
export default function Parent() {
  let data = useLoaderData<typeof loader>();
  return <Outlet context={data} />;
}

function Child() {
  let data = useOutletContext<ParentData>();
}

// Good: useRouteLoaderData
function Child() {
  let data = useRouteLoaderData<typeof parentLoader>("routes/parent");
}
```

## Common Parent Routes

```tsx
// Access root loader data
const rootData = useRouteLoaderData<typeof rootLoader>("root");

// Access authenticated layout data
const layoutData =
  useRouteLoaderData<typeof layoutLoader>("routes/_layout");

// Access settings layout data
const settingsData =
  useRouteLoaderData<typeof settingsLoader>("routes/_.settings");
```

---

> Rule: `error-boundary-layout` — impact **MEDIUM**


# Layout-Aware Error Boundary

Implement ErrorBoundary with useRouteError and handle different error types.

## Why

- Catches errors from loader, action, and component
- Provides user-friendly error messages
- Maintains layout context when possible
- Handles both Response errors and JavaScript errors

## Basic Pattern

```tsx
import { useRouteError, isRouteErrorResponse } from "react-router";

export function ErrorBoundary() {
  let error = useRouteError();

  // Handle HTTP Response errors (404, 500, etc.)
  if (isRouteErrorResponse(error)) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold">
          {error.status} {error.statusText}
        </h1>
        <p className="mt-2 text-neutral-600">{error.data}</p>
      </div>
    );
  }

  // Handle JavaScript errors
  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-neutral-600">
        {error instanceof Error ? error.message : "Unknown error occurred"}
      </p>
    </div>
  );
}
```

## With Layout Preservation

For nested routes, the error boundary replaces only the errored route's content, preserving parent layouts:

```tsx
// routes/_._profile/route.tsx - Layout route
export default function ProfileLayout() {
  return (
    <div className="flex">
      <Sidebar />
      <main>
        <Outlet /> {/* Child errors render here */}
      </main>
    </div>
  );
}

// routes/_._profile.settings/route.tsx - Child route
export async function loader() {
  throw new Error("Failed to load settings");
}

export function ErrorBoundary() {
  let error = useRouteError();

  // This renders INSIDE the ProfileLayout
  return (
    <div className="p-8">
      <h1>Settings Error</h1>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
      <Link to="/profile">Back to Profile</Link>
    </div>
  );
}
```

## Typed Error Responses

```tsx
import { data } from "react-router";

// In loader/action - throw typed errors
export async function loader({ params }: Route.LoaderArgs) {
  let item = await getItem(params.id);

  if (!item) {
    throw data({ message: "Item not found", id: params.id }, { status: 404 });
  }

  return data({ item });
}

// In ErrorBoundary - handle typed data
export function ErrorBoundary() {
  let error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div>
          <h1>Not Found</h1>
          <p>{error.data.message}</p>
          <p>Looking for ID: {error.data.id}</p>
        </div>
      );
    }
  }

  // ... handle other errors
}
```

## Common Error Status Handling

```tsx
export function ErrorBoundary() {
  let error = useRouteError();

  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 400:
        return <BadRequestError message={error.data} />;
      case 401:
        return <UnauthorizedError />;
      case 403:
        return <ForbiddenError />;
      case 404:
        return <NotFoundError />;
      case 500:
        return <ServerError />;
      default:
        return <GenericError status={error.status} />;
    }
  }

  // Log unexpected errors
  console.error(error);

  return (
    <div>
      <h1>Unexpected Error</h1>
      <p>Please try again later.</p>
    </div>
  );
}
```

## Development vs Production

```tsx
export function ErrorBoundary() {
  let error = useRouteError();

  return (
    <div className="p-8">
      <h1>Error</h1>

      {process.env.NODE_ENV === "development" && error instanceof Error && (
        <pre className="mt-4 p-4 bg-red-50 text-red-900 overflow-auto">
          {error.stack}
        </pre>
      )}

      {process.env.NODE_ENV === "production" && (
        <p>Something went wrong. Please try again.</p>
      )}
    </div>
  );
}
```

---

> Rule: `error-boundary-route` — impact **MEDIUM**


# Route Error Boundaries

Add ErrorBoundary to routes with data fetching to catch loader/action errors gracefully.

## Why

- Prevents entire app from crashing on route errors
- Provides route-specific error UI
- Maintains parent layouts during child errors
- Better UX than generic error page

## Which Routes Need Error Boundaries

Add ErrorBoundary to:

1. Routes with loaders that fetch external data
2. Routes with actions that can fail
3. Routes with required params that might be invalid
4. Parent layout routes (catches child errors)

## Pattern

```tsx
import { data } from "react-router";

export async function loader({ params }: Route.LoaderArgs) {
  let item = await getItem(params.itemId);
  if (!item) {
    throw data({ message: "Item not found" }, { status: 404 });
  }
  return data({ item });
}

export async function action({ request }: Route.ActionArgs) {
  // Action that might fail
}

export default function ItemPage() {
  const { item } = useLoaderData<typeof loader>();
  return <ItemDetails item={item} />;
}

// Catches errors from loader, action, and component
export function ErrorBoundary() {
  let error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold">Item Not Found</h1>
        <p className="mt-2 text-neutral-600">
          The item you're looking for doesn't exist.
        </p>
        <Link to="/items" className="mt-4 inline-block text-accent-600">
          Browse all items
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 text-center">
      <h1 className="text-xl font-semibold">Error Loading Item</h1>
      <p className="mt-2 text-neutral-600">
        Something went wrong. Please try again.
      </p>
    </div>
  );
}
```

## Error Boundary Hierarchy

```
root.tsx (ErrorBoundary)           <- Catches app-level errors
└── routes/_/route.tsx (ErrorBoundary) <- Catches layout errors
    └── routes/_._profile/route.tsx (ErrorBoundary) <- Catches profile errors
        └── routes/_._profile.settings/route.tsx (ErrorBoundary) <- Catches settings errors
```

Each level catches errors from its children. If a child doesn't have an ErrorBoundary, the error bubbles up.

## Root Error Boundary

The root route should always have an ErrorBoundary as the last line of defense:

```tsx
// root.tsx
export function ErrorBoundary() {
  let error = useRouteError();

  return (
    <html>
      <head>
        <title>Error</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            {isRouteErrorResponse(error) ? (
              <p>
                {error.status}: {error.statusText}
              </p>
            ) : (
              <p>An unexpected error occurred</p>
            )}
            <a href="/" className="mt-4 inline-block text-accent-600">
              Go home
            </a>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
```

## Testing Error Boundaries

```tsx
import { data } from "react-router";

// Trigger 404
throw data({ message: "Not found" }, { status: 404 });

// Trigger 500
throw new Error("Database connection failed");

// Trigger from action
if (!isValid) {
  throw data({ errors: ["Invalid data"] }, { status: 400 });
}
```

---

> Rule: `form-fetcher-vs-form` — impact **MEDIUM**


# Fetcher vs Form

Use useFetcher for in-place updates (no navigation). Use Form for navigation after submit.

## Why

- `Form`: Triggers navigation, shows loading states, updates URL
- `useFetcher`: No navigation, updates in place, can have multiple pending
- Choosing wrong one creates confusing UX

## When to Use Each

| Use Case                       | Component    |
| ------------------------------ | ------------ |
| Create item and navigate to it | `Form`       |
| Delete item from list          | `useFetcher` |
| Like/favorite toggle           | `useFetcher` |
| Search with URL update         | `Form`       |
| Inline edit                    | `useFetcher` |
| Multi-step wizard              | `Form`       |
| Modal form that closes         | `useFetcher` |

## useFetcher: In-Place Updates

```tsx
// Like button - no navigation needed
function LikeButton({ postId, liked }: { postId: string; liked: boolean }) {
  let fetcher = useFetcher();

  // Optimistic UI
  let isLiked = fetcher.formData
    ? fetcher.formData.get("liked") === "true"
    : liked;

  return (
    <fetcher.Form method="post" action="/api/like">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="liked" value={String(!isLiked)} />
      <button type="submit">{isLiked ? "Unlike" : "Like"}</button>
    </fetcher.Form>
  );
}
```

## Form: Navigation After Submit

```tsx
// Create form - navigates to new item
function CreatePostForm() {
  let navigation = useNavigation();
  let isSubmitting = navigation.state === "submitting";

  return (
    <Form method="post" action="/posts/new">
      <input name="title" required />
      <textarea name="content" required />
      <Button type="submit" isDisabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Post"}
      </Button>
    </Form>
  );
}
```

## Multiple Fetchers on Same Page

```tsx
// Each item has its own fetcher - they work independently
function ItemList({ items }) {
  return (
    <ul>
      {items.map((item) => (
        <ItemRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function ItemRow({ item }) {
  let fetcher = useFetcher();
  let isDeleting = fetcher.state !== "idle";

  // Hide item immediately when deleting (optimistic)
  if (fetcher.formData?.get("intent") === "delete") {
    return null;
  }

  return (
    <li className={isDeleting ? "opacity-50" : ""}>
      {item.name}
      <fetcher.Form method="post">
        <input type="hidden" name="id" value={item.id} />
        <button type="submit" name="intent" value="delete">
          Delete
        </button>
      </fetcher.Form>
    </li>
  );
}
```

## Fetcher with Custom Action

```tsx
// Submit to different route's action
function QuickOrder({ itemId }: { itemId: string }) {
  let fetcher = useFetcher();

  return (
    <fetcher.Form method="post" action="/api/quick-order">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="number" name="amount" placeholder="Amount" />
      <button type="submit">Buy</button>
    </fetcher.Form>
  );
}
```

## Form with GET (Search)

```tsx
// Search form - updates URL with query
function SearchForm() {
  return (
    <Form method="get" action="/search">
      <input type="search" name="q" placeholder="Search..." />
      <button type="submit">Search</button>
    </Form>
  );
}
// Submitting navigates to /search?q=query
```

---

> Rule: `form-honeypot` — impact **MEDIUM**


# Protect Public Forms with Honeypot

Use `remix-utils` honeypot to block basic spam bots on public forms.

## Pattern

```ts
// app/middleware/honeypot.server.ts
import { createHoneypotMiddleware } from "remix-utils/middleware/honeypot";

export const [honeypotMiddleware, getHoneypotInputProps] =
  createHoneypotMiddleware();
```

```tsx
// app/root.tsx
import { HoneypotProvider } from "remix-utils/honeypot/react";

export const middleware: Route.MiddlewareFunction[] = [honeypotMiddleware];

export async function loader() {
  let honeypotInputProps = await getHoneypotInputProps();
  return data({ honeypotInputProps });
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <HoneypotProvider {...loaderData.honeypotInputProps}>
      <Outlet />
    </HoneypotProvider>
  );
}
```

```tsx
// Any public form
import { HoneypotInputs } from "remix-utils/honeypot/react";

<Form method="post">
  <HoneypotInputs />
  {/* form fields */}
</Form>;
```

## Rules

1. Add honeypot inputs to public forms
2. Run honeypot middleware on routes that accept public posts
3. Combine with rate limiting for stronger protection

---

> Rule: `form-pending-state` — impact **MEDIUM**


# Form Pending States

Show loading states with useNavigation or fetcher.state. Use useSpinDelay to avoid flicker.

## Why

- Users need feedback that action is processing
- Prevents double-submission
- Quick actions shouldn't flash loading state (flicker)

## Basic Fetcher Pending State

```tsx
function SubmitButton() {
  let fetcher = useFetcher();
  let isPending = fetcher.state !== "idle";

  return (
    <Button type="submit" isDisabled={isPending}>
      {isPending ? "Submitting..." : "Submit"}
    </Button>
  );
}
```

## With Spinner and useSpinDelay

Avoid flicker for fast operations:

```tsx
import { useSpinDelay } from "spin-delay";

function SubmitButton() {
  let fetcher = useFetcher();

  // Only show spinner if pending for >50ms
  let isPending = useSpinDelay(fetcher.state !== "idle", { delay: 50 });

  return (
    <Button type="submit" isDisabled={isPending} className="relative">
      {isPending && (
        <div className="absolute inset-0 center">
          <Spinner />
        </div>
      )}
      <span className={isPending ? "invisible" : ""}>Submit</span>
    </Button>
  );
}
```

## useNavigation for Form Component

```tsx
import { Form, useNavigation } from "react-router";

function CreateForm() {
  let navigation = useNavigation();

  // Check if THIS form is submitting
  let isSubmitting =
    navigation.state === "submitting" && navigation.formAction === "/items/new";

  return (
    <Form method="post" action="/items/new">
      <input name="title" disabled={isSubmitting} />
      <Button type="submit" isDisabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create"}
      </Button>
    </Form>
  );
}
```

## Disable Form During Submission

```tsx
function EditForm() {
  let fetcher = useFetcher();
  let isPending = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post">
      <fieldset disabled={isPending}>
        <input name="name" />
        <input name="email" />
        <Button type="submit">{isPending ? "Saving..." : "Save"}</Button>
      </fieldset>
    </fetcher.Form>
  );
}
```

## Prevent Modal Close During Submission

```tsx
function EditModal({ isOpen, onClose }) {
  let fetcher = useFetcher();
  let isPending = fetcher.state !== "idle";

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        // Don't allow close while submitting
        if (!open && isPending) return;
        if (!open) onClose();
      }}
    >
      <fetcher.Form method="post">{/* Form content */}</fetcher.Form>
    </Modal>
  );
}
```

---

> Rule: `form-persist-on-error` — impact **MEDIUM**


# Persist Form Inputs on Validation Error

Return field values from the action when validation fails, then use `defaultValue` to repopulate inputs.

## Why

- Users shouldn't have to re-enter all data when only one field is wrong
- Required for progressive enhancement (no-JS form submissions)
- With JS enabled, `<Form>` preserves inputs naturally, but returning fields ensures consistency
- Better UX than showing errors with empty fields

## The Problem

When a form submission fails validation, the page reloads (in no-JS) or re-renders. Without preserving field values, users lose their input:

```tsx

// Action only returns errors - fields are lost on no-JS
export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();
  let result = schema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return data({ errors: result.error.flatten() }, { status: 400 });
  }

  // ...
}
```

## Solution: Return Fields with Errors

```tsx
import { data, redirect } from "react-router";

export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();

  let fields = {
    email: formData.get("email")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
  };

  let result = schema.safeParse(fields);

  if (!result.success) {
    return data(
      {
        errors: result.error.flatten().fieldErrors,
        fields, // Return the submitted values
      },
      { status: 400 },
    );
  }

  await createUser(result.data);
  throw redirect("/success");
}
```

## Component: Use defaultValue

```tsx
import { Form, useActionData } from "react-router";

export default function SignupForm() {
  let actionData = useActionData<typeof action>();

  return (
    <Form method="post">
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={actionData?.fields?.name} />
        {actionData?.errors?.name && (
          <p className="text-failure-600">{actionData.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={actionData?.fields?.email}
        />
        {actionData?.errors?.email && (
          <p className="text-failure-600">{actionData.errors.email[0]}</p>
        )}
      </div>

      <button type="submit">Sign Up</button>
    </Form>
  );
}
```

## With useFetcher

Same pattern works with fetcher forms:

```tsx
function InlineForm() {
  let fetcher = useFetcher<typeof action>();

  return (
    <fetcher.Form method="post">
      <input name="email" defaultValue={fetcher.data?.fields?.email} />
      {fetcher.data?.errors?.email && <p>{fetcher.data.errors.email[0]}</p>}
      <button type="submit">Submit</button>
    </fetcher.Form>
  );
}
```

## Combined with Reset on Success

This pattern complements `form-reset-on-success.md`:

- **On error**: Persist fields so user can correct mistakes
- **On success**: Reset form to clear all fields

```tsx

export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();
  let fields = { title: formData.get("title")?.toString() ?? "" };

  let result = schema.safeParse(fields);

  if (!result.success) {
    // Error: return fields for persistence
    return data(
      { ok: false, errors: result.error.flatten().fieldErrors, fields },
      { status: 400 },
    );
  }

  await createItem(result.data);
  // Success: return ok for reset trigger (no fields needed)
  return data({ ok: true });
}
```

## Handling Sensitive Fields

Don't return sensitive fields like passwords:

```tsx
let fields = {
  email: formData.get("email")?.toString() ?? "",
  // Don't include password in returned fields
};

// Validate including password, but don't return it
let result = schema.safeParse({
  ...fields,
  password: formData.get("password")?.toString() ?? "",
});
```

## Rules

1. Always return submitted field values when returning validation errors
2. Use `defaultValue` (not `value`) to allow user editing
3. Don't return sensitive fields (passwords, tokens)
4. Return `{ errors, fields }` on error, `{ ok: true }` on success
5. Works with both `<Form>` and `fetcher.Form`
6. Essential for progressive enhancement (no-JS support)

---

> Rule: `form-reset-on-success` — impact **MEDIUM**


# Reset Form on Success

Reset uncontrolled form inputs after a successful action submission using a ref and effect.

## Why

- Uncontrolled inputs don't clear automatically after submission
- React doesn't re-mount inputs when staying on the same route
- Users expect forms to clear after successful submission
- Prevents accidental re-submission of the same data

## The Problem

When using uncontrolled inputs (no `value` prop), the input values persist after submission:

```tsx
// Form stays filled after submission - bad UX
export default function Component() {
  return (
    <Form method="post">
      <input name="title" />
      <button type="submit">Create</button>
    </Form>
  );
}
```

## Solution: Reset with Ref and Effect

### With Form

```tsx
import { Form, useActionData, useNavigation } from "react-router";
import { useEffect, useRef } from "react";

export default function Component() {
  let formRef = useRef<HTMLFormElement>(null);
  let navigation = useNavigation();
  let actionData = useActionData<typeof action>();

  useEffect(
    function resetFormOnSuccess() {
      if (navigation.state === "idle" && actionData?.ok) {
        formRef.current?.reset();
      }
    },
    [navigation.state, actionData],
  );

  return (
    <Form method="post" ref={formRef}>
      <input name="title" />
      <button type="submit">Create</button>
    </Form>
  );
}
```

### With useFetcher

```tsx
import { useFetcher } from "react-router";
import { useEffect, useRef } from "react";

function CreateItemForm() {
  let formRef = useRef<HTMLFormElement>(null);
  let fetcher = useFetcher<typeof action>();

  useEffect(
    function resetFormOnSuccess() {
      if (fetcher.state === "idle" && fetcher.data?.ok) {
        formRef.current?.reset();
      }
    },
    [fetcher.state, fetcher.data],
  );

  return (
    <fetcher.Form method="post" ref={formRef}>
      <input name="title" />
      <button type="submit">Create</button>
    </fetcher.Form>
  );
}
```

## Action Response Pattern

Return a success indicator from your action:

```tsx
export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();

  try {
    await createItem(formData);
    return data({ ok: true });
  } catch (error) {
    return data({ ok: false, error: "Failed to create" }, { status: 400 });
  }
}
```

Or use a status literal:

```tsx
return data({ status: "success" as const });

// In component
if (fetcher.state === "idle" && fetcher.data?.status === "success") {
  formRef.current?.reset();
}
```

## Alternative: Key-Based Reset

For simpler cases, use a key to force React to remount the form:

```tsx
function CreateItemForm() {
  let [key, setKey] = useState(0);
  let fetcher = useFetcher<typeof action>();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      setKey((k) => k + 1); // Remounts entire form
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <fetcher.Form method="post" key={key}>
      <input name="title" />
      <button type="submit">Create</button>
    </fetcher.Form>
  );
}
```

Note: This remounts the entire form, which may reset focus. Use the ref approach for better UX.

## Rules

1. Use `formRef.current?.reset()` to clear uncontrolled inputs
2. Check both `state === "idle"` and success indicator before resetting
3. Return a success indicator (`ok: true` or `status: "success"`) from actions
4. Prefer ref-based reset over key-based remounting
5. Don't reset on error - user may want to correct their input

---

> Rule: `link-prefetch-intent` — impact **MEDIUM**


# Link Prefetch Intent

Use `prefetch="intent"` on links for faster perceived navigation.

## Why

- Prefetches route data on hover/focus (before click)
- Makes navigation feel instant
- Only loads data when user shows intent
- Better than `prefetch="render"` (loads immediately) for large pages

## Pattern

```tsx
import { Link } from "react-router";

<Link to="/dashboard" prefetch="intent">
  Dashboard
</Link>;
```

## Prefetch Options

| Value        | When Prefetches | Use Case              |
| ------------ | --------------- | --------------------- |
| `"none"`     | Never           | Rarely visited links  |
| `"intent"`   | Hover/focus     | Most navigation links |
| `"render"`   | On render       | Critical next steps   |
| `"viewport"` | When visible    | Link lists            |

## Examples from Codebase

```tsx
// Navigation links
<Link to="/dashboard" prefetch="intent">
  Dashboard
</Link>

// Login/auth links
<Link to="/login" className="font-medium" prefetch="intent">
  Log in
</Link>

// Notification items
<Link
  to={notification.link}
  prefetch="intent"
  className="block p-3 hover:bg-neutral-50"
>
  {notification.title}
</Link>

// Pagination
<Link
  to={`?page=${page + 1}`}
  prefetch="intent"
  className="px-3 py-2"
>
  Next
</Link>
```

## With LinkButton Component

The LinkButton component should also support prefetch:

```tsx
<LinkButton to="/settings" prefetch="intent">
  Settings
</LinkButton>
```

## When NOT to Use prefetch="intent"

```tsx
// External links - can't prefetch
<a href="https://example.com">External</a>

// Very heavy pages - might waste bandwidth
<Link to="/huge-report" prefetch="none">
  Generate Report
</Link>

// User might not navigate (e.g., in long lists)
<Link to={`/items/${item.id}`} prefetch="viewport">
  {item.name}
</Link>
```

## With NavLink for Active States

```tsx
import { NavLink } from "react-router";

<NavLink
  to="/dashboard"
  prefetch="intent"
  className={({ isActive }) =>
    isActive ? "text-accent-600 font-medium" : "text-neutral-600"
  }
>
  Dashboard
</NavLink>;
```

## Prefetch with State

```tsx
<Link to="/checkout" prefetch="intent" state={{ from: "cart" }}>
  Proceed to Checkout
</Link>
```

---

> Rule: `loader-action-abort-signal` — impact **HIGH**


# Abort Async Work in Loaders and Actions

Use `request.signal` to abort in-flight async work when the client cancels a navigation.

## Why

- Prevent wasted work when the user navigates away
- Reduce backend load for requests that will never be used
- Keep loaders responsive under rapid navigation

## Fetch Calls

```ts
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let response = await fetch("https://example.com/api", {
    signal: request.signal,
  });

  return data(await response.json());
}
```

## Parallel Requests

```ts
export async function loader({ request }: Route.LoaderArgs) {
  let [a, b] = await Promise.all([
    fetch(urlA, { signal: request.signal }),
    fetch(urlB, { signal: request.signal }),
  ]);

  return data({ a: await a.json(), b: await b.json() });
}
```

## AbortError Handling

```ts
export async function loader({ request }: Route.LoaderArgs) {
  try {
    let response = await fetch(url, { signal: request.signal });
    return data(await response.json());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 204 });
    }
    throw error;
  }
}
```

## Non-Fetch Async Work

If an API doesn't accept an `AbortSignal`, check manually between steps:

```ts
export async function action({ request }: Route.ActionArgs) {
  let first = await doStepOne();
  if (request.signal.aborted) throw new Error("AbortError");

  let second = await doStepTwo();
  if (request.signal.aborted) throw new Error("AbortError");

  return data({ first, second });
}
```

## Database Transactions

If the action touches your database, wrap the steps in a transaction so an abort can roll back partial work:

```ts
export async function action({ request }: Route.ActionArgs) {
  return db.transaction(async (trx) => {
    let a = await createA(trx);
    if (request.signal.aborted) throw new Error("AbortError");

    let b = await createB(trx, a.id);
    if (request.signal.aborted) throw new Error("AbortError");

    return data({ a, b });
  });
}
```

If the action triggers external side effects (fetching other APIs), rolling back may be difficult or impossible — design with idempotency or compensating actions in mind.

## Rules

1. Always pass `request.signal` to fetch calls in loaders/actions
2. Handle `AbortError` explicitly when you catch errors
3. For non-fetch async work, check `request.signal.aborted` between steps
4. Use DB transactions to roll back partial work in actions
5. Be cautious in actions that trigger side effects on external services

---

> Rule: `loader-avoid-waterfalls` — impact **HIGH**


# Avoid Data Fetching Waterfalls

Fetch all data in loaders. Never fetch data in components with useEffect or useFetcher on mount.

## Why

- Waterfalls add latency: each fetch waits for the previous one
- Component-level fetching causes loading spinners inside already-loaded pages
- Loaders run in parallel at the route level, components run sequentially
- Server-side fetching is faster (closer to data sources, no round trip)

## The Golden Rule

**All data fetching happens in loaders. Components only render data.**

## Bad: Fetching in Components

```tsx
// BAD: Component fetches its own data
function UserProfile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then(setUser);
  }, []);

  if (!user) return <Spinner />;
  return <div>{user.name}</div>;
}

// BAD: useFetcher on mount
function UserProfile() {
  let fetcher = useFetcher();

  useEffect(() => {
    fetcher.load("/api/user");
  }, []);

  if (!fetcher.data) return <Spinner />;
  return <div>{fetcher.data.name}</div>;
}
```

## Good: Fetching in Loaders

```tsx
// route.tsx
export async function loader({ request }: Route.LoaderArgs) {
  let user = await getUser(request);
  return data({ user });
}

export default function Component() {
  const { user } = useLoaderData<typeof loader>();
  return <div>{user.name}</div>;
}
```

## Parent-Child Route Data Sharing

Fetch data in each loader that needs it. API clients share data between loaders via request-level caching, so there's no duplicate network request.

```tsx
// routes/dashboard.tsx (parent)
export async function loader({ request }: Route.LoaderArgs) {
  let client = await authenticate(request);
  let user = await getUser(client); // Cached per request
  return data({ user });
}

// routes/dashboard.settings.tsx (child)
export async function loader({ request }: Route.LoaderArgs) {
  let client = await authenticate(request);
  // Same getUser call - uses cached result, no extra network request
  let user = await getUser(client);
  let settings = await getSettings(client, user.id);
  return data({ user, settings });
}

export default function Component() {
  const { user, settings } = useLoaderData<typeof loader>();
  return <SettingsForm user={user} settings={settings} />;
}
```

For UI-only access to parent data (no loader logic needed), use `useRouteLoaderData`:

```tsx
// routes/dashboard.notifications.tsx (child) - only needs user for display
export default function Component() {
  const { user } =
    useRouteLoaderData<typeof dashboardLoader>("routes/dashboard");
  return <NotificationPrefs userName={user.name} />;
}
```

## Parallel Fetching in Loaders

When you need multiple pieces of data, fetch them in parallel:

```tsx
export async function loader({ request }: Route.LoaderArgs) {
  let user = await requireUser(request);

  // Parallel fetches - total time = slowest query
  let [orders, accountBalance, recommendations] = await Promise.all([
    getOrders(user.id),
    getAccountBalance(user.accountId),
    getRecommendations(user.id),
  ]);

  return data({ user, orders, accountBalance, recommendations });
}
```

## Streaming Non-Critical Data

For slow, non-critical data, use streaming:

```tsx
export async function loader({ request }: Route.LoaderArgs) {
  let user = await requireUser(request);

  // Critical data - awaited
  let accountBalance = await getAccountBalance(user.accountId);

  // Non-critical data - streamed (don't await)
  let recommendations = getRecommendations(user.id);

  return data({ user, accountBalance, recommendations });
}

export default function Component() {
  const { balance, recommendations } = useLoaderData<typeof loader>();

  return (
    <div>
      <BalanceCard balance={balance} />

      <Suspense fallback={<RecommendationsSkeleton />}>
        <Await resolve={recommendations}>
          {(data) => <Recommendations data={data} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

## When useFetcher is Appropriate

useFetcher is for **user-initiated actions**, not initial data loading:

```tsx
// GOOD: User clicks to load more
function LoadMoreButton({ page }) {
  let fetcher = useFetcher();

  return (
    <fetcher.Form method="get" action="/api/orders">
      <input type="hidden" name="page" value={page + 1} />
      <Button type="submit">
        {fetcher.state === "loading" ? "Loading..." : "Load More"}
      </Button>
    </fetcher.Form>
  );
}

// GOOD: User submits form
function CheckoutForm() {
  let fetcher = useFetcher();

  return (
    <fetcher.Form method="post" action="/checkout">
      {/* form fields */}
    </fetcher.Form>
  );
}
```

## Rules

1. All initial data fetching happens in loaders
2. Never use useEffect + fetch for data loading
3. Never use useFetcher.load() on component mount
4. Fetch data in each loader that needs it (API clients cache per request)
5. Use `useRouteLoaderData` only for UI-only access to parent data
6. Use `Promise.all` for parallel independent fetches
7. Use streaming (Suspense + Await) for slow, non-critical data
8. useFetcher is only for user-initiated actions (forms, load more, etc.)

---

> Rule: `loader-colocate-queries` — impact **MEDIUM**


# Colocate Data Queries

Keep data fetching functions in colocated `queries.server.ts` files next to route files.

## Why

- Keeps loaders clean and focused on orchestration
- Makes queries reusable across loader and action
- Server-only code stays separate from client code
- Easier to test queries in isolation

## File Structure

```
routes/
  my-feature/
    queries.server.ts    # Data fetching functions
    actions.server.ts    # Mutation functions (optional)
    route.tsx            # Loader, action, component
    components/          # Route-specific components
      header.tsx
      item-card.tsx
```

## queries.server.ts

```tsx
// queries.server.ts
import type { APIClient } from "~/lib/api.server";

export async function queryItems(client: APIClient) {
  let items = await client.items.list();
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
  }));
}

export async function queryFeaturedItems(client: APIClient) {
  return client.items.featured();
}

export async function querySuggestedItems(
  client: APIClient,
  existingItems: { id: string }[],
) {
  let suggestions = await client.items.suggested();
  let existingIds = new Set(existingItems.map((i) => i.id));
  return suggestions.filter((s) => !existingIds.has(s.id));
}
```

## route.tsx

```tsx
// route.tsx
import { data } from "react-router";
import {
  queryItems,
  queryFeaturedItems,
  querySuggestedItems,
} from "./queries.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  let client = await authenticate(request);

  const [featuredItems, items] = await Promise.all([
    queryFeaturedItems(client),
    queryItems(client),
  ]);

  let suggestedItems = await querySuggestedItems(client, items);

  return data({ featuredItems, items, suggestedItems });
}
```

## Benefits

1. **Loader stays focused**: Orchestrates auth, parallel fetching, response
2. **Queries are testable**: Can unit test query functions directly
3. **Reusable**: Same query can be used in loader and action
4. **Clear separation**: `.server.ts` suffix ensures server-only bundling

---

> Rule: `loader-parallel-fetch` — impact **HIGH**


# Parallel Data Fetching in Loaders

Use Promise.all for parallel data fetching when queries don't depend on each other.

## Why

Sequential fetches add up latency. If you have 3 queries each taking 100ms, sequential = 300ms, parallel = 100ms.

## Bad

```tsx
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let user = await getUser(request);
  let posts = await getPosts(user.id);
  let comments = await getComments(user.id);
  let notifications = await getNotifications(user.id);
  return data({ user, posts, comments, notifications });
}
```

Each await blocks the next query. Total time = sum of all query times.

## Good

```tsx
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let user = await getUser(request); // Need user.id first

  const [posts, comments, notifications] = await Promise.all([
    getPosts(user.id),
    getComments(user.id),
    getNotifications(user.id),
  ]);

  return data({ user, posts, comments, notifications });
}
```

Authenticate first (required), then run independent queries in parallel.

## When to Use Sequential

Only use sequential when one query depends on another's result:

```tsx
// Sequential is correct here - need user.id for posts
const user = await getUser(request);
const posts = await getPosts(user.id);

// But these can be parallel since they both just need user.id
const [comments, likes] = await Promise.all([
  getComments(user.id),
  getLikes(user.id),
]);
```

---

> Rule: `loader-request-caching` — impact **HIGH**


# Request-Level Caching in Loaders

API clients automatically deduplicate calls within the same request. Fetch the same data in multiple loaders without worrying about duplicate network requests.

## Why

- Nested routes often need the same data (user, permissions, etc.)
- React Router runs all loaders in parallel for a single request
- API clients use request-scoped caching to dedupe identical calls
- No manual coordination needed between loaders

## How It Works

When you call the same API function with the same parameters in multiple loaders during the same request, the API client:

1. Makes the network request on the first call
2. Caches the result for the duration of the request
3. Returns the cached result for subsequent identical calls
4. Clears the cache after the request completes

```tsx
// routes/dashboard.tsx (parent)
export async function loader({ request, context }: Route.LoaderArgs) {
  let client = await authenticate(request, { context });
  let user = await getUser(client); // First call - makes network request
  return data({ user });
}

// routes/dashboard.settings.tsx (child)
export async function loader({ request, context }: Route.LoaderArgs) {
  let client = await authenticate(request, { context });
  let user = await getUser(client); // Same call - returns cached result
  let settings = await getSettings(client, user.id);
  return data({ user, settings });
}
```

Both loaders run in parallel. The `context` contains the batcher (`context.batcher`), so `authenticate` and subsequent API calls share the same request-scoped cache. The second `getUser(client)` call returns instantly from the cache.

## When to Fetch vs Use useRouteLoaderData

**Fetch in loader when:**

- The loader needs the data for its own logic (not just UI)
- You need to transform or combine the data with other data
- The child route can be accessed directly (not always through parent)

```tsx
// Child loader needs user.id to fetch settings
export async function loader({ request, context }: Route.LoaderArgs) {
  let client = await authenticate(request, { context });
  let user = await getUser(client); // Need user.id for next call
  let settings = await getSettings(client, user.id);
  return data({ settings });
}
```

**Use useRouteLoaderData when:**

- You only need the data for rendering (no loader logic)
- The parent route always loads before this route
- You're certain the data exists in the parent

```tsx
// Child only needs user for display
export default function Component() {
  const { user } =
    useRouteLoaderData<typeof dashboardLoader>("routes/dashboard");
  return <WelcomeMessage name={user.name} />;
}
```

## How It Works Internally

Use the `remix-utils` batcher middleware to get a request-scoped batcher:

```ts
// app/middleware/batcher.server.ts
import { createBatcherMiddleware } from "remix-utils/middleware/batcher";

export const [batcherMiddleware, getBatcher] = createBatcherMiddleware();
```

```ts
// app/routes/dashboard/route.tsx
import { batcherMiddleware, getBatcher } from "~/middleware/batcher.server";

export const middleware: Route.MiddlewareFunction[] = [batcherMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
  let batcher = getBatcher(context);
  let result = await batcher.batch("key", async () => {
    return await getData();
  });
  return data({ result });
}
```

Your API client can use the batcher for GET requests automatically:

```typescript
// clients/api.ts
override async get<Type>(path: string, body?: ParamsInput, init?: RequestInit) {
  let url = new URL(path, this.baseURL);
  url.search = snakeCaseSearchParams(body).toString();

  // Batch by [pathname, search] - same URL = same cached result
  return this.batch([url.pathname, url.search], () =>
    this.collectTiming("api", `${url.pathname}${url.search}`, async () => {
      let response = await super.get(url.href, { ...init });
      return await response.text().then(parse<Type>);
    })
  );
}
```

The batcher deduplicates based on the key array `[pathname, search]`:

- Same pathname + search params = returns cached result
- Different pathname or params = makes new request
- Only GET requests are batched (POST/PUT/DELETE always execute)

## Rules

1. Always pass `context` to `api()` or `authenticate()` - enables request-level caching
2. Don't avoid fetching data in nested loaders for "performance" - caching handles it
3. Fetch data in each loader that needs it for logic, not just rendering
4. Use `useRouteLoaderData` only for UI-only access to parent data
5. Trust the API client's request-level caching - identical GET requests are deduped automatically

---

> Rule: `loader-revalidation-patterns` — impact **LOW**


# Revalidation Patterns

Use `useRevalidator` to refresh loader data based on user activity or time intervals.

## Why

- Keep dashboard data fresh without full page refresh
- Update data when user returns to the tab
- Provide near-real-time updates without WebSockets
- React Router automatically revalidates after actions, but not on focus/interval

## Basic Revalidation

```tsx
import { useRevalidator } from "react-router";
import { useEffect } from "react";

export default function Component() {
  let { revalidate } = useRevalidator();

  useEffect(() => {
    let id = setInterval(revalidate, 30000); // Every 30 seconds
    return () => clearInterval(id);
  }, [revalidate]);

  // ... render with loader data
}
```

## Smart Revalidation

Only revalidate when it makes sense - don't waste bandwidth or server resources.

### Pause When Tab is Hidden

```tsx
import { useSyncExternalStore } from "react";

function useVisibilityState() {
  return useSyncExternalStore(
    (callback) => {
      document.addEventListener("visibilitychange", callback);
      return () => document.removeEventListener("visibilitychange", callback);
    },
    () => document.visibilityState,
    () => "visible" as const,
  );
}

export default function Component() {
  let { revalidate } = useRevalidator();
  let visibilityState = useVisibilityState();

  useEffect(() => {
    if (visibilityState === "hidden") return; // Don't poll hidden tabs
    let id = setInterval(revalidate, 30000);
    return () => clearInterval(id);
  }, [revalidate, visibilityState]);
}
```

### Pause When Offline

```tsx
function useOnlineStatus() {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener("online", callback);
      window.addEventListener("offline", callback);
      return () => {
        window.removeEventListener("online", callback);
        window.removeEventListener("offline", callback);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

export default function Component() {
  let { revalidate } = useRevalidator();
  let isOnline = useOnlineStatus();
  let visibilityState = useVisibilityState();

  useEffect(() => {
    if (!isOnline) return; // Offline
    if (visibilityState === "hidden") return; // Hidden tab

    let id = setInterval(revalidate, 30000);
    return () => clearInterval(id);
  }, [revalidate, isOnline, visibilityState]);
}
```

### Revalidate on Focus

Refresh data when user returns to the tab:

```tsx
export default function Component() {
  const { revalidate } = useRevalidator();

  useEffect(() => {
    function onFocus() {
      revalidate();
    }

    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onFocus);
    };
  }, [revalidate]);
}
```

### Revalidate on Reconnect

Refresh when internet connection is restored:

```tsx
export default function Component() {
  const { revalidate } = useRevalidator();

  useEffect(() => {
    window.addEventListener("online", revalidate);
    return () => window.removeEventListener("online", revalidate);
  }, [revalidate]);
}
```

## Combined Hook

Create a reusable hook for common patterns:

```tsx
interface UseSmartRevalidationOptions {
  interval?: number; // Polling interval in ms (0 = disabled)
  onFocus?: boolean; // Revalidate when tab gains focus
  onReconnect?: boolean; // Revalidate when coming back online
}

function useSmartRevalidation({
  interval = 0,
  onFocus = false,
  onReconnect = false,
}: UseSmartRevalidationOptions = {}) {
  let { revalidate } = useRevalidator();
  let isOnline = useOnlineStatus();
  let visibilityState = useVisibilityState();

  // Interval polling
  useEffect(() => {
    if (interval <= 0) return;
    if (!isOnline) return;
    if (visibilityState === "hidden") return;

    let id = setInterval(revalidate, interval);
    return () => clearInterval(id);
  }, [revalidate, interval, isOnline, visibilityState]);

  // On focus
  useEffect(() => {
    if (!onFocus) return;
    window.addEventListener("focus", revalidate);
    return () => window.removeEventListener("focus", revalidate);
  }, [revalidate, onFocus]);

  // On reconnect
  useEffect(() => {
    if (!onReconnect) return;
    window.addEventListener("online", revalidate);
    return () => window.removeEventListener("online", revalidate);
  }, [revalidate, onReconnect]);
}

// Usage
export default function Dashboard() {
  useSmartRevalidation({
    interval: 30000, // Poll every 30s
    onFocus: true, // Refresh on tab focus
    onReconnect: true, // Refresh when back online
  });

  const { data } = useLoaderData<typeof loader>();
  // ...
}
```

## Caveats

### Scroll Position Issues

For feed-like UIs, revalidation can disrupt scroll position if new items are added. Consider:

- Showing "New items available" button instead of auto-updating
- Only revalidating when scrolled to top

### Server Load

Short intervals with many users can create high server load. Consider:

- Longer intervals (30s+ instead of 1s)
- WebSockets for truly real-time needs
- Server-Sent Events for push updates

### Save-Data Mode

Respect users who have enabled data-saving:

```tsx
const saveData = navigator.connection?.saveData ?? false;

useEffect(() => {
  if (saveData) return; // Don't poll on save-data mode
  // ... polling logic
}, [saveData /* ... */]);
```

## Rules

1. Don't revalidate hidden tabs - wastes resources
2. Don't revalidate when offline - will fail
3. Use longer intervals (30s+) to avoid server overload
4. Consider on-focus revalidation instead of polling for most cases
5. Respect save-data mode preferences
6. For truly real-time needs, consider WebSockets or SSE instead

---

> Rule: `loader-typing` — impact **MEDIUM**


# Proper TypeScript Typing for Loaders

Use Route.LoaderArgs and `typeof loader` with useLoaderData for type safety.

## Why

Proper typing catches errors at compile time and provides autocomplete for loader data in components.

## Bad

```tsx
// No types - no autocomplete, no compile-time checks
export async function loader({ request, params }) {
  return data({ user: await getUser(params.id) });
}

export default function Component() {
  let loaderData = useLoaderData(); // any type
  return <div>{loaderData.user.name}</div>; // No type safety
}
```

## Good

```tsx
import { data } from "react-router";
import { useLoaderData } from "react-router";

export async function loader({ request, params }: Route.LoaderArgs) {
  return data({ user: await getUser(params.id) });
}

export default function Component() {
  const { user } = useLoaderData<typeof loader>();
  return <div>{user.name}</div>; // Type-safe
}
```

## With Status Codes

```tsx
import { data } from "react-router";

export async function loader({ request, params }: Route.LoaderArgs) {
  let user = await getUser(params.id);
  if (!user) {
    throw data({ message: "User not found" }, { status: 404 });
  }
  return data({ user });
}

export default function Component() {
  const { user } = useLoaderData<typeof loader>();
  // user is properly typed from the return type
}
```

Note: Always use `data()` for loader returns. `json()` is deprecated with Single Fetch.

## With SerializeFrom for Shared Types

When passing loader data to other components:

```tsx
import type { SerializeFrom } from "react-router";

type LoaderData = SerializeFrom<typeof loader>;

function UserCard({ user }: { user: LoaderData["user"] }) {
  return <div>{user.name}</div>;
}
```

---

> Rule: `loader-url-validation` — impact **MEDIUM**


# URL Parameter Validation

Validate URL params with zod at the start of loaders.

## Why

URL params are user input. Validate early to fail fast with clear errors and ensure type safety.

## Bad

```tsx
import { data } from "react-router";

export async function loader({ params }: Route.LoaderArgs) {
  // params.id is string | undefined - could be missing or invalid
  let item = await getItem(params.id);
  return data({ item });
}
```

## Good

```tsx
import { data } from "react-router";
import { z } from "zod";

export async function loader({ params }: Route.LoaderArgs) {
  let itemId = z.string().parse(params.itemId);
  let item = await getItem(itemId);
  return data({ item });
}
```

## With Multiple Params

```tsx
import { data } from "react-router";
import { z } from "zod";

export async function loader({ params }: Route.LoaderArgs) {
  const { userId, postId } = z
    .object({
      userId: z.string(),
      postId: z.string().uuid(),
    })
    .parse(params);

  let post = await getPost(userId, postId);
  return data({ post });
}
```

## With Search Params

```tsx
import { data } from "react-router";
import { z } from "zod";

export async function loader({ request }: Route.LoaderArgs) {
  let url = new URL(request.url);

  const { page, limit, sort } = z
    .object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
    })
    .parse(Object.fromEntries(url.searchParams));

  let items = await getItems({ page, limit, sort });
  return data({ items, page, limit, sort });
}
```

---

> Rule: `meta-function-v2` — impact **MEDIUM**


# Meta Function V2

Use meta function with loader data for dynamic SEO and OpenGraph tags.

## Why

- Dynamic titles and descriptions based on page content
- Proper OpenGraph tags for social sharing
- Type-safe access to loader data
- Centralized SEO logic in loader or meta function

## Basic Pattern

```tsx
import { data } from "react-router";

export async function loader({ params }: Route.LoaderArgs) {
  let item = await getItem(params.itemId);
  return data({
    item,
    title: item.name,
    description: item.summary,
  });
}

export const meta: Route.MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  return [
    { title: data.title },
    { name: "description", content: data.description },
    { property: "og:title", content: data.title },
    { property: "og:description", content: data.description },
  ];
};
```

## With Centralized SEO Helper

Use a helper function to generate consistent meta tags:

```tsx
import { data } from "react-router";
import { seo } from "~/lib/seo.server";

export async function loader({ request }: Route.LoaderArgs) {
  let t = await i18n.getFixedT(request);
  let item = await getItem();

  return data({
    item,
    meta: seo(t, {
      title: t("Page Title - {{name}}", { name: item.name }),
      description: t("Description for {{name}}", { name: item.name }),
      og: {
        title: item.name,
        description: item.summary,
        image: item.imageUrl,
      },
    }),
  });
}

export const meta: Route.MetaFunction<typeof loader> = ({ data }) => data?.meta ?? [];
```

## OpenGraph Tags

```tsx
export const meta: Route.MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  return [
    { title: data.title },
    { name: "description", content: data.description },

    // OpenGraph
    { property: "og:type", content: "website" },
    { property: "og:title", content: data.title },
    { property: "og:description", content: data.description },
    { property: "og:image", content: data.imageUrl },
    { property: "og:url", content: data.canonicalUrl },

    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: data.title },
    { name: "twitter:description", content: data.description },
    { name: "twitter:image", content: data.imageUrl },
  ];
};
```

## With Parent Data

Access parent route loader data:

```tsx
import type { loader as parentLoader } from "../_layout/route";

export const meta: Route.MetaFunction<
  typeof loader,
  { "routes/_layout": typeof parentLoader }
> = ({ data, matches }) => {
  let parentData = matches.find((m) => m.id === "routes/_layout")?.data;

  return [{ title: `${data?.item.name} | ${parentData?.siteName}` }];
};
```

## Handling Missing Data

Always handle the case where data might be undefined (error states):

```tsx
export const meta: Route.MetaFunction<typeof loader> = ({ data }) => {
  // Return empty array or default meta when data is missing
  if (!data) {
    return [{ title: "Error" }];
  }

  return [
    { title: data.title },
    { name: "description", content: data.description },
  ];
};
```

## Static Meta

For routes with static meta, you can return a simple array:

```tsx
export const meta: Route.MetaFunction = () => [
  { title: "About Us" },
  { name: "description", content: "Learn more about our company" },
];
```

---

> Rule: `middleware-batcher` — impact **HIGH**


# Batcher Middleware

Use `createBatcherMiddleware` for request-scoped deduping of expensive calls.

## Why

- Avoids duplicate DB/API calls within one request
- Keeps code composable across loaders/actions
- Simplifies request-level caching

## Pattern

```ts
// app/middleware/batcher.server.ts
import { createBatcherMiddleware } from "remix-utils/middleware/batcher";
import { getContext } from "~/middleware/context-storage.server";

export const [batcherMiddleware, getBatcherFromContext] =
  createBatcherMiddleware();

export function getBatcher() {
  return getBatcherFromContext(getContext());
}
```

```ts
export const middleware: Route.MiddlewareFunction[] = [batcherMiddleware];

export async function loader() {
  let batcher = getBatcher();
  let result = await batcher.batch("key", async () => getData());
  return data({ result });
}
```

## Rules

1. Use a stable batch key per request
2. Prefer batching to ad-hoc in-memory caches

---

> Rule: `middleware-context-storage` — impact **HIGH**


# Context Storage Middleware

Store `context` and `request` in AsyncLocalStorage so helpers can access them without args.

## Why

- Avoids passing `context` through many layers
- Enables helper functions outside loaders/actions
- Composes well with other middleware getters

## Pattern

```ts
// app/middleware/context-storage.server.ts
import { createContextStorageMiddleware } from "remix-utils/middleware/context-storage";

export const [contextStorageMiddleware, getContext, getRequest] =
  createContextStorageMiddleware();
```

```ts
export const middleware: Route.MiddlewareFunction[] = [contextStorageMiddleware];

export function getUserFromContext() {
  let context = getContext();
  return context.get(userContext);
}
```

## Rules

1. Use context storage when you need helpers without args
2. Always include it before middleware that relies on it

---

> Rule: `middleware-logger` — impact **LOW**


# Logger Middleware

Log request/response details consistently with `createLoggerMiddleware`.

## Why

- Standardizes request logs
- Measures response time
- Reduces ad-hoc logging

## Pattern

```ts
// app/middleware/logger.server.ts
import { createLoggerMiddleware } from "remix-utils/middleware/logger";

export const [loggerMiddleware] = createLoggerMiddleware({
  precision: 2,
});
```

```ts
export const middleware: Route.MiddlewareFunction[] = [loggerMiddleware];
```

## Rules

1. Use logger middleware for consistent request logs
2. Customize format if you need structured logs

---

> Rule: `middleware-request-id` — impact **MEDIUM**


# Request ID Middleware

Generate a request ID and store it in context for logging/correlation.

## Why

- Correlates logs across loaders/actions
- Supports upstream request IDs
- Makes debugging distributed systems easier

## Pattern

```ts
// app/middleware/request-id.server.ts
import { createRequestIDMiddleware } from "remix-utils/middleware/request-id";

export const [requestIDMiddleware, getRequestID] =
  createRequestIDMiddleware();
```

```ts
export const middleware: Route.MiddlewareFunction[] = [requestIDMiddleware];

export async function loader() {
  let requestId = getRequestID();
  log.info({ requestId }, "request");
  return data({ ok: true });
}
```

## Rules

1. Add request IDs at the root middleware
2. Reuse upstream IDs when available

---

> Rule: `middleware-server-timing` — impact **LOW**


# Server Timing Middleware

Add `Server-Timing` headers to measure loader/action performance.

## Why

- Inspect server timings in browser devtools
- Identify slow loaders/actions
- Track performance regressions

## Pattern

```ts
// app/middleware/server-timing.server.ts
import { createServerTimingMiddleware } from "remix-utils/middleware/server-timing";

export const [serverTimingMiddleware, getTimingCollector] =
  createServerTimingMiddleware();
```

```ts
export const middleware: Route.MiddlewareFunction[] = [serverTimingMiddleware];

export async function loader() {
  let timing = getTimingCollector();
  return timing.measure("load-data", "Load data", async () => {
    return data(await getData());
  });
}
```

## Rules

1. Add server timing middleware in root
2. Wrap expensive calls in `measure`

---

> Rule: `middleware-session` — impact **HIGH**


# Session Middleware

Use `createSessionMiddleware` to keep a single session instance per request.

## Why

- Avoids multiple session reads/writes in one request
- Centralizes commit logic
- Keeps loaders/actions consistent

## Pattern

```ts
// app/middleware/session.server.ts
import { createCookieSessionStorage } from "react-router";
import { createSessionMiddleware } from "remix-utils/middleware/session";

let sessionStorage = createCookieSessionStorage({
  cookie: { name: "session", path: "/", sameSite: "lax" },
});

export const [sessionMiddleware, getSession] =
  createSessionMiddleware(sessionStorage);
```

### Optimize Commits

Customize commit behavior so you only write when session data changes:

```ts
import { dequal } from "dequal";

export const [sessionMiddleware, getSession] = createSessionMiddleware(
  sessionStorage,
  (previous, next) => !dequal(previous, next),
);
```

You can also commit only when specific fields change:

```ts
export const [sessionMiddleware, getSession] = createSessionMiddleware(
  sessionStorage,
  (previous, next) => previous.user?.id !== next.user?.id,
);
```

```ts
export const middleware: Route.MiddlewareFunction[] = [sessionMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
  let session = await getSession(context);
  session.set("user", { id: "123" });
  return data({ ok: true });
}
```

## Rules

1. Use session middleware on routes that read/write session
2. Use `getSession(context)` inside loaders/actions
3. Customize commit logic to avoid unnecessary cookie writes

---

> Rule: `middleware-singleton` — impact **MEDIUM**


# Singleton Middleware

Create a per-request singleton for caches or shared services.

## Why

- Ensures one instance per request
- Avoids global singletons leaking across users
- Simplifies per-request caches

## Pattern

```ts
// app/middleware/singleton.server.ts
import { createSingletonMiddleware } from "remix-utils/middleware/singleton";

export const [singletonMiddleware, getSingleton] =
  createSingletonMiddleware({
    instantiator: () => new RequestCache(),
  });
```

```ts
export const middleware: Route.MiddlewareFunction[] = [singletonMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
  let cache = getSingleton(context);
  let value = await cache.get("key");
  return data({ value });
}
```

## Rules

1. Use singleton middleware for request-scoped caches
2. Avoid global singletons for per-request data

---

> Rule: `migrate-defer-to-data` — impact **HIGH**


# Single Fetch Migration

Migrate from defer() to data() pattern for Single Fetch. Promises automatically stream.

## Why

- Single Fetch is enabled (`v3_singleFetch: true` in remix.config)
- `data()` is the new standard, `defer()` is deprecated
- Promises in `data()` response automatically stream
- Cleaner API, no special handling needed

## Migration Pattern

### Before (defer)

```tsx
import { defer } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let criticalData = await getCriticalData();

  return defer({
    critical: criticalData,
    lazy: getLazyData(), // Promise - must use defer for streaming
  });
}
```

### After (data with Single Fetch)

```tsx
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let criticalData = await getCriticalData();

  return data({
    critical: criticalData,
    lazy: getLazyData(), // Promise - automatically streams with Single Fetch
  });
}
```

## Example: Mixing Awaited and Streamed Data

```tsx
import { data } from "react-router";

export async function loader({ request, context }: Route.LoaderArgs) {
  let client = await authenticate(request);

  // Critical data - await before returning
  const [profile, settings] = await Promise.all([
    queryProfile(client),
    querySettings(client),
  ]);

  return data({
    profile,
    settings,
    // Non-critical data - streams automatically
    activities: queryActivities(client),
    notifications: queryNotifications(client),
    recommendations: queryRecommendations(client),
  });
}
```

## Component Usage

The component usage with `<Await>` and `<Suspense>` stays the same:

```tsx
import { Await, useLoaderData } from "react-router";
import { Suspense } from "react";

export default function Component() {
  const { profile, activities } = useLoaderData<typeof loader>();

  return (
    <div>
      {/* Critical data renders immediately */}
      <h1>{profile.name}</h1>

      {/* Streamed data with Suspense */}
      <Suspense fallback={<ActivitySkeleton />}>
        <Await resolve={activities}>
          {(data) => <ActivityFeed activities={data} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

## When to Await vs Stream

```tsx
return data({
  // AWAIT: Critical for initial render, SEO, or needed by other data
  user: await getUser(request), // Await - needed for auth
  title: await getPageTitle(), // Await - needed for SEO

  // STREAM: Non-critical, below fold, or slow queries
  comments: getComments(postId), // Stream - below fold
  recommendations: getRecommendations(), // Stream - non-critical
  analytics: getAnalytics(), // Stream - slow query
});
```

## Non-Streaming (All Data Awaited)

When all data is critical and needs to be sent at once:

```tsx
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const [a, b, c] = await Promise.all([getA(), getB(), getC()]);
  return data({ a, b, c }); // All data sent at once, no streaming
}
```

Note: Always use `data()` - `json()` is deprecated with Single Fetch.

---

> Rule: `migrate-json-to-data` — impact **HIGH**


# Migrate from json() to data()

Replace `json()` with `data()` from `react-router`. The `json()` helper is deprecated with Single Fetch.

## Why

- `json()` is deprecated with Single Fetch enabled
- `data()` is the new standard for all loader and action responses
- `data()` supports automatic promise streaming
- Consistent API for responses with or without status codes/headers

## Migration Pattern

### Loaders

```tsx
// Before
import { json } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let items = await getItems();
  return json({ items });
}

// After
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let items = await getItems();
  return data({ items });
}
```

### Actions

```tsx
// Before
import { json } from "react-router";

export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();
  let result = await processForm(formData);
  return json({ success: true, result });
}

// After
import { data } from "react-router";

export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData();
  let result = await processForm(formData);
  return data({ success: true, result });
}
```

### With Status Codes

```tsx
// Before
import { json } from "react-router";

export async function action({ request }: Route.ActionArgs) {
  try {
    // ... validation
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ errors: error.issues }, { status: 400 });
    }
    throw error;
  }
}

// After
import { data } from "react-router";

export async function action({ request }: Route.ActionArgs) {
  try {
    // ... validation
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data({ errors: error.issues }, { status: 400 });
    }
    throw error;
  }
}
```

### With Headers

```tsx
// Before
import { json } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let items = await getItems();
  return json(
    { items },
    {
      headers: {
        "Cache-Control": "max-age=300",
      },
    },
  );
}

// After
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let items = await getItems();
  return data(
    { items },
    {
      headers: {
        "Cache-Control": "max-age=300",
      },
    },
  );
}
```

### Throwing Errors

```tsx
// Before
import { json } from "react-router";

export async function loader({ params }: Route.LoaderArgs) {
  let item = await getItem(params.id);
  if (!item) {
    throw json({ message: "Not found" }, { status: 404 });
  }
  return json({ item });
}

// After
import { data } from "react-router";

export async function loader({ params }: Route.LoaderArgs) {
  let item = await getItem(params.id);
  if (!item) {
    throw data({ message: "Not found" }, { status: 404 });
  }
  return data({ item });
}
```

## Important: Always Use data()

Do NOT return raw objects from loaders or actions:

```tsx
// Bad: raw object return
export async function loader({ request }: Route.LoaderArgs) {
  let items = await getItems();
  return { items }; // Don't do this
}

// Good: always use data()
export async function loader({ request }: Route.LoaderArgs) {
  let items = await getItems();
  return data({ items });
}
```

---

> Rule: `migrate-jsonhash-to-native` — impact **HIGH**


# Stop Using jsonHash

Replace jsonHash from remix-utils with native Promise.all or data() patterns.

## Why

- `jsonHash` is a workaround for parallel async in loaders
- Native `Promise.all` is clearer and doesn't need a dependency
- `data()` with Single Fetch handles promises natively

## Bad: jsonHash Pattern

```tsx
import { jsonHash } from "remix-utils/json-hash";

export async function loader({ request }: Route.LoaderArgs) {
  let client = await authenticate(request);

  return jsonHash({
    items: client.items.list(),
    categories: client.categories.list(),
    user: client.users.current(),
  });
}
```

## Good: Promise.all (Non-Streaming)

When all data is needed before render:

```tsx
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let client = await authenticate(request);

  let [items, categories, user] = await Promise.all([
    client.items.list(),
    client.categories.list(),
    client.users.current(),
  ]);

  return data({ items, categories, user });
}
```

## Good: data() with Promises (Streaming)

When some data can stream in later:

```tsx
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let client = await authenticate(request);

  // Critical data - await immediately
  let items = await client.items.list();

  return data({
    items,
    // Non-critical data - streams automatically with Single Fetch
    categories: client.categories.list(),
    recommendations: client.recommendations.list(),
  });
}
```

## Migration Examples

### Simple Object Return

```tsx
import { data } from "react-router";

// Before
return jsonHash({
  a: getA(),
  b: getB(),
});

// After
const [a, b] = await Promise.all([getA(), getB()]);
return data({ a, b });
```

### Async Functions in jsonHash

```tsx
import { data } from "react-router";

// Before
return jsonHash({
  async items() {
    let raw = await fetchItems();
    return transformItems(raw);
  },
  async metadata() {
    return fetchMetadata();
  },
});

// After
const [items, metadata] = await Promise.all([
  fetchItems().then(transformItems),
  fetchMetadata(),
]);
return data({ items, metadata });
```

### Mixed Sync and Async

```tsx
import { data } from "react-router";

// Before
return jsonHash({
  asyncData: fetchData(),
  syncData() {
    return computeSync();
  },
});

// After
const asyncData = await fetchData();
const syncData = computeSync();
return data({ asyncData, syncData });
```

## When to Use Which Pattern

| Scenario                        | Pattern                  |
| ------------------------------- | ------------------------ |
| All data critical, fast queries | `Promise.all` + `data()` |
| Some data can load later        | `data()` with promises   |
| Complex async transformations   | `Promise.all` + `data()` |
| Need to show partial UI fast    | `data()` with promises   |

---

> Rule: `migrate-namedaction-to-intent` — impact **MEDIUM**


# Migrate from namedAction to Intent Pattern

Replace `namedAction` from remix-utils with `z.discriminatedUnion` for type-safe intent validation.

## Why

- No external dependency needed
- Type-safe validation of intent and its associated fields
- Better TypeScript inference after parsing
- Single validation step for all form data

## Migration Pattern

### Before (namedAction)

```tsx
import { data } from "react-router";
import { namedAction } from "remix-utils/named-action";

export async function action({ request }: Route.ActionArgs) {
  let client = await authenticate(request);
  let formData = await request.formData();

  return namedAction(formData, {
    async create() {
      let validated = createSchema.parse({ ... });
      await createItem(client, validated);
      return data({ success: true });
    },

    async update() {
      let validated = updateSchema.parse({ ... });
      await updateItem(client, validated);
      return data({ success: true });
    },

    async delete() {
      let id = z.string().parse(formData.get("id"));
      await deleteItem(client, id);
      return data({ success: true });
    },
  });
}
```

### After (z.discriminatedUnion)

```tsx
import { data, redirect } from "react-router";
import { z } from "zod";

export async function action({ request }: Route.ActionArgs) {
  let client = await authenticate(request);
  let formData = await request.formData();

  let body = z
    .discriminatedUnion("intent", [
      z.object({
        intent: z.literal("create"),
        title: z.string().min(1),
        amount: z.coerce.number().positive(),
      }),
      z.object({
        intent: z.literal("update"),
        id: z.string(),
        title: z.string().min(1),
      }),
      z.object({
        intent: z.literal("delete"),
        id: z.string(),
      }),
    ])
    .parse(Object.fromEntries(formData.entries()));

  if (body.intent === "create") {
    await createItem(client, body); // body is typed with title, amount
    throw redirect("/items");
  }

  if (body.intent === "update") {
    await updateItem(client, body); // body is typed with id, title
    throw redirect("/items");
  }

  if (body.intent === "delete") {
    await deleteItem(client, body.id); // body is typed with id
    throw redirect("/items");
  }
}
```

## Forms Stay the Same

No changes needed to form markup - both patterns use the same `intent` field:

```tsx
<fetcher.Form method="post">
  <input type="hidden" name="intent" value="create" />
  <input name="title" />
  <button type="submit">Create</button>
</fetcher.Form>
```

## Button with Intent

Use button's name/value attributes for intent instead of hidden input:

```tsx
<fetcher.Form method="post">
  <input type="hidden" name="id" value={item.id} />
  <Button type="submit" name="intent" value="archive">
    Archive
  </Button>
  <Button type="submit" name="intent" value="delete" color="danger">
    Delete
  </Button>
</fetcher.Form>
```

## With Extracted Handlers

### Before

```tsx
// actions.server.ts
import { namedAction } from "remix-utils/named-action";

export function handleActions(formData: FormData, client: ApiClient) {
  return namedAction(formData, {
    async create() { ... },
    async update() { ... },
    async delete() { ... },
  });
}

// route.tsx
export async function action({ request }: Route.ActionArgs) {
  let client = await authenticate(request);
  let formData = await request.formData();
  return handleActions(formData, client);
}
```

### After

```tsx
// actions.server.ts
import type { APIClient } from "~/lib/api.server";
import { Logger } from "~/lib/logger.server";

const logger = Logger.getLogger("routes/items/actions.server");

export async function createItem(
  client: APIClient,
  data: { title: string; amount: number },
) {
  try {
    return await client.items.create(data);
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

export async function deleteItem(client: APIClient, id: string) {
  try {
    await client.items.delete(id);
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

// route.tsx
import { createItem, deleteItem } from "./actions.server";

export async function action({ request }: Route.ActionArgs) {
  let client = await authenticate(request);
  let formData = await request.formData();

  let body = z
    .discriminatedUnion("intent", [
      z.object({
        intent: z.literal("create"),
        title: z.string().min(1),
        amount: z.coerce.number().positive(),
      }),
      z.object({
        intent: z.literal("delete"),
        id: z.string(),
      }),
    ])
    .parse(Object.fromEntries(formData.entries()));

  if (body.intent === "create") {
    await createItem(client, body);
    throw redirect("/items");
  }

  if (body.intent === "delete") {
    await deleteItem(client, body.id);
    throw redirect("/items");
  }
}
```

## Error Handling

Re-throw `Response` objects (redirects), return validation errors:

```tsx
export async function action({ request }: Route.ActionArgs) {
  let client = await authenticate(request);
  let formData = await request.formData();

  try {
    let body = z
      .discriminatedUnion("intent", [
        z.object({
          intent: z.literal("create"),
          title: z.string().min(1),
        }),
      ])
      .parse(Object.fromEntries(formData.entries()));

    if (body.intent === "create") {
      await createItem(client, body);
      throw redirect("/items");
    }
  } catch (error) {
    // Let redirects bubble up
    if (error instanceof Response) throw error;

    if (error instanceof z.ZodError) {
      return data(
        { errors: error.issues.map(({ message }) => message) },
        { status: 400 },
      );
    }

    throw error; // Re-throw unknown errors
  }
}
```

---

> Rule: `navigation-avoid-navigate-back` — impact **MEDIUM**


# Avoid navigate(-1) for In-App Back Links

Prefer explicit back targets stored in navigation state instead of `navigate(-1)`.

## Why

- Browser history isn’t scoped to your app
- `navigate(-1)` can send users out of your app
- Back links should stay within known routes

## Pattern

Pass an explicit back target when you link to a detail route:

```tsx
import { Link, useLocation, useNavigate } from "react-router";

function useCurrentURL() {
  let location = useLocation();
  return location.pathname + location.search;
}

function useBackNavigation() {
  let navigate = useNavigate();
  let location = useLocation();

  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    let back = location.state?.back;
    if (back) {
      event.preventDefault();
      navigate(back);
    }
  };
}

export function ListItemLink({ id }: { id: string }) {
  let back = useCurrentURL();

  return (
    <Link to={`/items/${id}`} state={{ back }}>
      View
    </Link>
  );
}

export function BackLink() {
  let onClick = useBackNavigation();

  return (
    <Link to="/items" onClick={onClick}>
      Back
    </Link>
  );
}
```

## Rules

1. Avoid `navigate(-1)` for in-app back links
2. Pass explicit `state.back` when linking into detail views
3. Use a fallback `to` for cases without back state

---

> Rule: `prefetch-cache` — impact **LOW**


# Short Cache for Prefetch Requests

Detect prefetch requests and return a short-lived cache header.

## Pattern

```ts
import { isPrefetch } from "remix-utils/is-prefetch";
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  let headers = new Headers();
  if (isPrefetch(request)) {
    headers.set("Cache-Control", "private, max-age=5, smax-age=0");
  }
  return data(await getData(), { headers });
}
```

## Rules

1. Use short caches only for prefetch requests
2. Avoid long cache on data that changes per user

---

> Rule: `prefetch-fetcher-data` — impact **LOW**


# Prefetch Data for Fetcher Usage

Use `<PrefetchPageLinks>` to preload data for routes that will be loaded via `fetcher.load()`.

## Why

- `<Link prefetch="intent">` only works for navigation, not fetcher calls
- Modals, drawers, and expandable sections often load data on demand
- Preloading this data improves perceived performance
- Data is ready when the user clicks, making the UI feel instant

## The Problem

When using `fetcher.load()` to load data (e.g., for a modal), the data fetch only starts when the user triggers the action:

```tsx
function ItemDetails({ itemId }: { itemId: string }) {
  let fetcher = useFetcher<typeof resourceLoader>();

  return (
    <>
      <button onClick={() => fetcher.load(`/api/items/${itemId}`)}>
        View Details
      </button>
      {fetcher.data && <Modal data={fetcher.data} />}
    </>
  );
}
```

The user clicks, waits for data to load, then sees the modal.

## Solution: PrefetchPageLinks

Render `<PrefetchPageLinks>` to start preloading the data immediately:

```tsx
import { useFetcher, PrefetchPageLinks } from "react-router";

function ItemDetails({ itemId }: { itemId: string }) {
  let fetcher = useFetcher<typeof resourceLoader>();

  return (
    <>
      {/* Preload data for this resource route */}
      <PrefetchPageLinks page={`/api/items/${itemId}`} />

      <button onClick={() => fetcher.load(`/api/items/${itemId}`)}>
        View Details
      </button>
      {fetcher.data && <Modal data={fetcher.data} />}
    </>
  );
}
```

When the component renders, it starts prefetching. By the time the user clicks, data may already be cached.

## How It Works

`<PrefetchPageLinks>` renders `<link rel="prefetch">` tags in the document head:

```html
<link
  rel="prefetch"
  as="fetch"
  href="/api/items/123?_data=routes/api.items.$itemId"
/>
```

The browser prefetches the data in the background. When `fetcher.load()` is called, it uses the cached response.

## Use Cases

### Modal Data Preloading

```tsx
function UserRow({ user }: { user: User }) {
  let [isOpen, setIsOpen] = useState(false);
  let fetcher = useFetcher<typeof userDetailsLoader>();

  return (
    <tr>
      <PrefetchPageLinks page={`/api/users/${user.id}/details`} />
      <td>{user.name}</td>
      <td>
        <button
          onClick={() => {
            fetcher.load(`/api/users/${user.id}/details`);
            setIsOpen(true);
          }}
        >
          View Profile
        </button>
      </td>
      {isOpen && fetcher.data && (
        <UserProfileModal
          user={fetcher.data}
          onClose={() => setIsOpen(false)}
        />
      )}
    </tr>
  );
}
```

### Expandable Sections

```tsx
function AccordionItem({ sectionId, title }: Props) {
  let [isExpanded, setIsExpanded] = useState(false);
  let fetcher = useFetcher<typeof sectionLoader>();

  return (
    <div>
      <PrefetchPageLinks page={`/api/sections/${sectionId}`} />
      <button
        onClick={() => {
          if (!fetcher.data) fetcher.load(`/api/sections/${sectionId}`);
          setIsExpanded((isExpanded) => !isExpanded);
        }}
      >
        {title}
      </button>
      {isExpanded && fetcher.data && <div>{fetcher.data.content}</div>}
    </div>
  );
}
```

## Conditional Prefetching

Only prefetch when likely to be used:

```tsx
function ItemCard({ item, isHovered }: Props) {
  let fetcher = useFetcher<typeof detailsLoader>();

  return (
    <div>
      {/* Only prefetch when user hovers */}
      {isHovered && <PrefetchPageLinks page={`/api/items/${item.id}`} />}
      <button onClick={() => fetcher.load(`/api/items/${item.id}`)}>
        Details
      </button>
    </div>
  );
}
```

## When to Use

| Scenario                    | Use                        |
| --------------------------- | -------------------------- |
| Navigation to another page  | `<Link prefetch="intent">` |
| Modal/drawer data loading   | `<PrefetchPageLinks>`      |
| Expandable section content  | `<PrefetchPageLinks>`      |
| Data loaded on button click | `<PrefetchPageLinks>`      |

## Rules

1. Use `<PrefetchPageLinks page="/path">` for `fetcher.load()` prefetching
2. Use `<Link prefetch="intent">` for navigation prefetching
3. Consider conditional rendering to avoid prefetching data that won't be used
4. The `page` prop should match the URL passed to `fetcher.load()`
5. Works with resource routes that export a `loader`

---

> Rule: `response-helpers` — impact **LOW**


# Use Response Helpers for Resource Routes

Use `remix-utils/responses` to return typed resource responses.

## Pattern

```ts
import { html, javascript, stylesheet, xml, txt, notModified } from "remix-utils/responses";

export async function loader() {
  if (shouldUseCache) return notModified();
  return html("<h1>Hello</h1>");
}
```

## Rules

1. Use helpers to set proper content types
2. Return `notModified()` for 304 cache hits

---

> Rule: `route-action-routes` — impact **HIGH**


# Action Routes Pattern

Centralize reusable actions in dedicated resource routes under `routes/actions/`. This pattern is for actions triggered from multiple UI routes that need shared authentication, validation, responses, and client-side effects.

## Why

- Actions triggered from multiple places (e.g., "like" button on feed, detail page, modal)
- Consistent authentication, validation, and error handling across all usages
- Client-side effects (toasts, redirects) handled once, not duplicated
- Single source of truth for action logic

## When to Use

Use action routes when:

- The same action is triggered from **multiple UI routes**
- You need **consistent client-side effects** (toasts, redirects) across all usages
- The action has **complex logic** worth centralizing (auth, validation, permissions)

**Don't use** for simple, single-use actions—keep those in the route that renders the form.

## File Structure

```
routes/
├── actions.post-create.ts       # /actions/post-create
├── actions.post-delete.ts       # /actions/post-delete
├── actions.favorite-toggle.ts   # /actions/favorite-toggle
├── actions.subscription-cancel.ts
├── _index.tsx
├── feed.tsx
└── posts.$postId.tsx
```

Naming convention: `actions.noun-verb.ts` using flat routes with dot notation. The `actions.` prefix groups them and creates the `/actions/` URL prefix.

## Server Action with Validation

```tsx
// routes/actions.post-create.ts
import { data, redirect } from "react-router";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

export async function action({ request, context }: Route.ActionArgs) {
  let client = await authenticate(request, { context });

  let formData = await request.formData();
  let result = schema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return data({ ok: false, errors: result.error.flatten() }, { status: 400 });
  }

  let post = await createPost(client, result.data);

  return data({ ok: true, post }, { status: 201 });
}

// No default export = resource route
```

## Client-Side Effects with clientAction

Handle toasts and redirects in `clientAction`:

```tsx
// routes/actions.post-create.ts
import { redirect } from "react-router";

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  let result = await serverAction<typeof action>();

  if (result.ok) {
    toast.success("Post created successfully");
    return redirect(`/posts/${result.post.id}`);
  }

  toast.error("Failed to create post");
  return result;
}
```

This pattern:

1. Calls the server action
2. Shows success toast and redirects on success
3. Shows error toast on failure
4. Returns result for UI to handle (e.g., show field errors)

## Using Action Routes with useFetcher

```tsx
// routes/feed.tsx
import { useFetcher } from "react-router";
import type { action } from "~/routes/actions.post-create";

function CreatePostButton() {
  let fetcher = useFetcher<typeof action>();
  let isPending = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post" action="/actions/post-create">
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Post"}
      </button>
      {fetcher.data?.errors && <FieldErrors errors={fetcher.data.errors} />}
    </fetcher.Form>
  );
}
```

## Authorization in Action Routes

```tsx
import { data } from "react-router";

export async function action({ request, context }: Route.ActionArgs) {
  let client = await authenticate(request, { context });

  // Check permissions
  if (!(await hasActiveSubscription(client))) {
    return data(
      { ok: false, error: "Upgrade to create posts." },
      { status: 403 },
    );
  }

  // ... rest of action
}
```

## Rules

1. Use `actions.noun-verb.ts` naming with flat routes (creates `/actions/` URL prefix)
2. No default export—these are resource routes (no UI)
3. Return `{ ok: true, ...data }` or `{ ok: false, errors }` for consistent response shape
4. Handle client-side effects (toasts, redirects) in `clientAction`
5. Keep single-use actions in the route that renders the form
6. Use this pattern only when actions are reused across multiple UI routes

---

> Rule: `route-auth-middleware` — impact **HIGH**


# Auth Middleware + Route Authorization

Authenticate in middleware and authorize inside each loader/action.

## Why

- Authentication is a cross-cutting concern (session → user) and belongs in middleware
- Authorization is per-route/per-action and should be explicit at the call site
- Centralizes checks while keeping route intent clear

## Pattern

### Contexts

```ts
// app/context.ts
import { createContext } from "react-router";
import type { User } from "~/lib/users.server";

export const userContext = createContext<User | null>(null);
```

### Context storage middleware

Use `remix-utils` to store the router context and request in AsyncLocalStorage so authorization helpers don't need `context` or `request` arguments.

```ts
// app/middleware/context-storage.server.ts
import { createContextStorageMiddleware } from "remix-utils/middleware/context-storage";

export const [contextStorageMiddleware, getContext, getRequest] =
  createContextStorageMiddleware();
```

### Session middleware (remix-utils)

```ts
// app/middleware/session.server.ts
import { createCookie, createCookieSessionStorage } from "react-router";
import { createSessionMiddleware } from "remix-utils/middleware/session";

let sessionStorage = createCookieSessionStorage({
  cookie: createCookie("session", { path: "/", sameSite: "lax" }),
});

export const [sessionMiddleware, getSession] =
  createSessionMiddleware(sessionStorage);
```

### Auth middleware (loads user into context)

```ts
// app/middleware/auth.server.ts
import { getSession } from "~/middleware/session.server";
import { getUserById } from "~/lib/users.server";
import { userContext } from "~/context";

export function authenticate({ context }: MiddlewareFunctionArgs<Response>) {
  let session = getSession(context);
  let userId = session?.get("userId");
  if (userId) context.set(userContext, await getUserById(userId));
}
```

### Authorization helpers (per loader/action)

```ts
// app/lib/authorize.server.ts
import { redirect } from "react-router";
import { userContext } from "~/context";
import { getContext, getRequest } from "~/middleware/context-storage.server";
import { getSession } from "~/middleware/session.server";

function getUser() {
  return getContext().get(userContext);
}

export function anonymous() {
  let user = getUser();
  if (user) throw redirect("/");
}

export function currentUser() {
  let user = getUser();
  if (user) return user;
  let request = getRequest();
  let returnTo = new URL(request.url).pathname;
  throw redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}

export function onboarded() {
  let user = currentUser();
  return Boolean(user.onboardingComplete);
}

export function role(name: string) {
  let user = currentUser();
  return Boolean(user.role === name);
}

export function permission(name: string) {
  let user = currentUser();
  return Boolean(user && user.permissions?.includes(name));
}

export function feature(flag: string) {
  let user = currentUser();
  return Boolean(user && user.featureFlags?.includes(flag));
}

export function mfa(maxAgeMs = 60 * 60 * 1000) {
  let session = getSession(getContext());
  if (!session) return false;

  let verifiedAt = session.get("mfaVerifiedAt");
  if (!verifiedAt) return false;

  let verifiedAtMs =
    typeof verifiedAt === "number"
      ? verifiedAt
      : Date.parse(String(verifiedAt));
  if (Number.isNaN(verifiedAtMs)) return false;

  return Date.now() - verifiedAtMs <= maxAgeMs;
}
```

### Use in routes

```ts
// app/routes/settings/route.tsx
import { contextStorageMiddleware } from "~/middleware/context-storage.server";
import { sessionMiddleware } from "~/middleware/session.server";
import { authenticate } from "~/middleware/auth.server";
import {
  anonymous,
  currentUser,
  feature,
  mfa,
  onboarded,
  permission,
  role,
} from "~/lib/authorize.server";

export const middleware: Route.MiddlewareFunction[] = [
  contextStorageMiddleware,
  sessionMiddleware,
  authenticate,
];

export async function loader() {
  let user = currentUser();
  if (onboarded()) return data({ user });
  throw redirect("/onboarding");
}

export async function action() {
  let user = currentUser();

  if (!permission("account:delete")) {
    throw redirect("/forbidden");
  }

  if (!mfa(5 * 60 * 1000)) {
    throw redirect("/confirm-2fa");
  }

  // ... handle mutation
  return null;
}
```

## Rules

1. Always load session/user in middleware, not inside loaders/actions
2. Use context storage middleware so helpers don't need args
3. Use `currentUser()` for gated pages and `anonymous()` for auth pages
4. Use `role()`/`permission()` for privileged actions
5. Enforce `feature()`, `onboarded()`, and `mfa()` when required

---

> Rule: `route-component-naming` — impact **MEDIUM**


# Route Component Naming

Name the default export `Component` in React Router route files.

## Why

- Consistent naming across all routes
- Easy to identify as route component vs regular component
- Matches React Router documentation conventions
- Clear distinction from named exports (loader, action)

## Pattern

```tsx
// app/routes/_.users/route.tsx
import { data } from "react-router";
import { useLoaderData } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  // ...
  return data({ users });
}

export async function action({ request }: Route.ActionArgs) {
  // ...
}

// Always name the default export "Component"
export default function Component() {
  let { users } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Users</h1>
      <UserList users={users} />
    </div>
  );
}
```

## Don't Use Route-Specific Names

```tsx
// Bad: route-specific name
export default function UsersPage() {
  // ...
}

// Bad: generic name
export default function Page() {
  // ...
}

// Bad: index name
export default function Index() {
  // ...
}

// Good: always "Component"
export default function Component() {
  // ...
}
```

## With ErrorBoundary

```tsx
// app/routes/_.users/route.tsx
export async function loader() {
  // ...
}

export default function Component() {
  // Main route component
}

// ErrorBoundary is a named export, not default
export function ErrorBoundary() {
  let error = useRouteError();
  // ...
}
```

## Why "Component"?

1. **React Router convention** - Matches the React Router docs
2. **Searchable** - Easy to find all route components
3. **Refactor-safe** - Renaming route folder doesn't require renaming function
4. **Clear purpose** - Instantly identifies the route's UI export

---

> Rule: `route-handle-metadata` — impact **MEDIUM**


# Route Handle Metadata

Use handle export with app-defined handle types for route metadata.

## Why

- Control client-side hydration behavior
- Add external scripts per route
- Configure layout features (banners, CTAs, aside panels)
- Type-safe handle configuration

## Handle Types

Define typed handle interfaces in your app (for example, `Handle`, `LayoutHandle`, `AppHandle`) and use them consistently across routes.

### Handle (Base)

The basic handle for all routes:

```tsx
export const handle: Handle = {
  // Enable client-side JavaScript for this route
  hydrate: true,
};

// Or conditionally based on loader data
export const handle: Handle<typeof loader> = {
  hydrate: (data) => data.needsInteractivity,
};
```

### LayoutHandle

For routes within the main layout:

```tsx
export const handle: LayoutHandle<typeof loader> = {
  hydrate: true,
  stickyHeader: true,
  footerType: "app", // "app" | "public"
  canvasColor: "white", // "white" | "neutral"

  // Dynamic banner above header
  banner: (data) =>
    data.showBanner
      ? {
          title: "Special offer",
          link: "/offer",
        }
      : null,

  // CTA buttons in header
  mainCTA: (data) => ({
    label: "Upgrade",
    to: "/upgrade",
  }),
  secondaryCTA: (data) => ({
    label: "Contact Sales",
    to: "/contact",
  }),
};
```

### AppHandle

For authenticated app routes (extends LayoutHandle):

```tsx
export const handle: AppHandle<typeof loader> = {
  hydrate: true,
  footerType: "app",

  // Render a component in the right aside column
  Aside: (data) => <SidebarWidget data={data} />,
};
```

## Common Patterns

### Hydration Control

```tsx
// Always hydrate (needs JS)
export const handle: Handle = {
  hydrate: true,
};

// Never hydrate (static page)
export const handle: Handle = {
  hydrate: false,
};

// Conditional hydration
export const handle: Handle<typeof loader> = {
  hydrate: (data) => data.hasInteractiveFeatures,
};
```

### External Scripts

```tsx
export const handle: Handle<typeof loader> = {
  hydrate: true,
  scripts: (data) => [
    {
      src: "https://example.com/widget.js",
      async: true,
    },
  ],
};
```

### Layout Configuration

```tsx
export const handle: LayoutHandle = {
  hydrate: true,
  stickyHeader: true,
  canvasColor: "neutral",
  footerType: "public",
};
```

### App Route with Aside

```tsx
export const handle: AppHandle<typeof loader> = {
  hydrate: true,
  Aside: (data) => (
    <aside className="p-4">
      <h2>Related Items</h2>
      {data.relatedItems.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </aside>
  ),
};
```

---

> Rule: `route-import-restrictions` — impact **HIGH**


# Route Import Restrictions

Avoid importing from route files. Routes can import their own modules or non-route modules, but other code should not import from routes.

## Why

- Routes are entry points, not shared modules
- Prevents circular dependencies
- Keeps route code isolated and refactorable
- Clear dependency direction: shared code → routes, not routes → routes

## Rules

### Routes Can Import

```tsx
// app/routes/_.users/route.tsx

// Good: import from own route folder
import { queryUsers } from "./queries.server";
import { actionSchema } from "./schemas.server";
import { UserCard } from "./components/user-card";

// Good: import from shared modules
import { Button } from "~/components/ui/button";
import { formatCurrency } from "~/lib/format";
import { authenticate } from "~/lib/auth.server";

// Good: import from components (non-route)
import { PageHeader } from "~/components/page-header";
```

### Routes Should NOT Import From Other Routes

```tsx
// app/routes/_.orders/route.tsx

// Bad: importing from another route
import { UserCard } from "~/routes/users/components/user-card";

// Bad: importing queries from another route
import { queryUser } from "~/routes/users/queries.server";

// Good: move shared code to a shared location
import { UserCard } from "~/components/user-card";
import { queryUser } from "~/lib/users.server";
```

### Exception: Loader/Action Types for Type Inference

Components may import `loader` or `action` types for `useFetcher` type inference:

```tsx
// app/components/order-form.tsx
import type { action } from "~/routes/api.orders/route";

type Props = {
  itemId: string;
};

export function OrderForm({ itemId }: Props) {
  // Type inference for fetcher data
  let fetcher = useFetcher<typeof action>();

  return (
    <fetcher.Form method="post" action="/api/orders">
      {/* ... */}
    </fetcher.Form>
  );
}
```

```tsx
// app/components/search-results.tsx
import type { loader } from "~/routes/api.search/route";

export function SearchResults() {
  let fetcher = useFetcher<typeof loader>();

  // fetcher.data is typed based on loader return
  return (
    <div>
      {fetcher.data?.results.map((result) => (
        <SearchResultItem key={result.id} result={result} />
      ))}
    </div>
  );
}
```

### What to Move to Shared Locations

| If you need to share... | Move to...                     |
| ----------------------- | ------------------------------ |
| Components              | `app/components/`              |
| Hooks                   | `app/hooks/`                   |
| Utilities               | `app/utils/`                   |
| Data fetching           | `app/services/`                |
| Types                   | `app/types.ts` or `app/types/` |
| Zod schemas             | `app/deserializers/`           |

## Architecture

```
app/
├── components/      # Shared components (can be imported anywhere)
├── hooks/           # Shared hooks
├── services/        # Shared server logic
├── utils/           # Shared utilities
├── ui/              # UI primitives
└── routes/
    ├── _.users/
    │   ├── route.tsx         # Can import from above folders
    │   ├── queries.server.ts # Route-specific, not shared
    │   └── components/       # Route-specific components
    └── _.orders/
        ├── route.tsx         # Cannot import from _.users/
        └── ...
```

---

> Rule: `route-organization` — impact **MEDIUM**


# Route Organization

Use folder routes with colocated files for complex routes.

## Why

- Keeps related code together
- Easier to navigate large codebases
- Clear separation of concerns
- Server-only code stays separate

## File Structure

```
routes/
  # Simple routes - single file
  login.tsx
  logout.tsx

  # Complex routes - folder with colocated files
  _.my-feature/
    route.tsx            # Loader, action, default export
    schemas.server.ts    # Zod schemas for validation
    queries.server.ts    # Data fetching functions
    actions.server.ts    # Action handlers (optional)
    components/          # Route-specific components
      header.tsx
      item-card.tsx
    assets/              # Route-specific assets
      banner.png

  # Layout routes
  _._app/
    route.tsx            # Layout with Outlet
    components/
      sidebar.tsx

  # Nested routes under layout
  _._app.dashboard/
    route.tsx
    queries.server.ts
    components/
      header.tsx
      activity-feed.tsx
```

## Naming Conventions

| Pattern                     | Meaning                | URL                      |
| --------------------------- | ---------------------- | ------------------------ |
| `_.projects/route.tsx`      | Nested under \_ layout | `/projects`              |
| `_._profile/route.tsx`      | Layout route           | (no URL)                 |
| `_._profile.home/route.tsx` | Child of layout        | `/home`                  |
| `_.projects_.$projectId/`   | Dynamic segment        | `/projects/:projectId`   |
| `api.search.items.tsx`      | Resource route (no UI) | `/api/search/items`      |

## File Naming

```
route.tsx           # Required - loader, action, component
queries.server.ts   # Data fetching (server-only)
actions.server.ts   # Mutation handlers (server-only)
schemas.server.ts   # Zod schemas for params, search, form data
*.server.ts         # Any server-only code
components/         # Route-specific components
hooks/              # Route-specific hooks
assets/             # Images, etc.
```

## Example: Complex Route

```
routes/_.items_.$itemId_.edit/
  route.tsx
  schemas.server.ts
  queries.server.ts
  actions.server.ts
  components/
    toolbar.tsx
    image-gallery.tsx
```

### route.tsx

```tsx
import { data } from "react-router";
import { queryItem, queryToolbar } from "./queries.server";
import { Toolbar } from "./components/toolbar";
import { ImageGallery } from "./components/image-gallery";
import { currentUser } from "~/lib/authorize.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  let user = currentUser();
  let itemId = z.string().parse(params.itemId);

  let [item, toolbar] = await Promise.all([
    queryItem(user.id, itemId),
    queryToolbar(user.id, itemId),
  ]);

  return data({ item, toolbar });
}

export async function action({ request, params }: Route.ActionArgs) {
  // ... uses actions.server.ts
}

export default function Component() {
  const { item, toolbar } = useLoaderData<typeof loader>();

  return (
    <div>
      <Toolbar {...toolbar} />
      <ImageGallery images={item.images} />
      {/* ... */}
    </div>
  );
}
```

### schemas.server.ts

Keep all Zod schemas for the route in one place. Use factory functions that receive `TFunction` for translatable error messages:

```tsx
import type { TFunction } from "i18next";
import { z } from "zod";

// URL params validation (no i18n needed - internal errors)
export const paramsSchema = z.object({
  itemId: z.string(),
});

// Search params validation (no i18n needed - internal errors)
export const searchParamsSchema = z.object({
  page: z.coerce.number().optional().default(1),
  sort: z.enum(["newest", "oldest"]).optional().default("newest"),
  query: z.string().nullish(),
});

// Form data validation - factory function for i18n error messages
export function actionSchema(t: TFunction) {
  return z.discriminatedUnion("intent", [
    z.object({
      intent: z.literal("update"),
      title: z.string().min(1, t("Title is required")),
      amount: z.coerce
        .number({ message: t("Amount must be a number") })
        .positive(t("Amount must be positive"))
        .max(10000, t("Amount cannot exceed {{max}}", { max: 10000 })),
      description: z.string().optional(),
    }),
    z.object({
      intent: z.literal("delete"),
    }),
  ]);
}
```

### queries.server.ts

```tsx
export async function queryItem(userId: string, itemId: string) {
  let item = await fetchItem(userId, itemId);
  return {
    id: item.id,
    title: item.title,
    images: item.images,
  };
}
```

### route.tsx using schemas

```tsx
import {
  paramsSchema,
  searchParamsSchema,
  actionSchema,
} from "./schemas.server";
import { queryItem } from "./queries.server";
import { getInstance } from "~/middleware/i18next";
import { currentUser } from "~/lib/authorize.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  let user = currentUser();
  let { itemId } = paramsSchema.parse(params);

  let url = new URL(request.url);
  let { page, sort } = searchParamsSchema.parse(
    Object.fromEntries(url.searchParams),
  );

  let item = await queryItem(user, itemId);
  return data({ item, page, sort });
}

export async function action({ request, params }: Route.ActionArgs) {
  let user = currentUser();
  let t = getInstance(context).t;
  let { itemId } = paramsSchema.parse(params);
  let formData = await request.formData();

  // Pass t to schema factory for translated error messages
  let body = actionSchema(t).parse(Object.fromEntries(formData.entries()));

  if (body.intent === "update") {
    await updateItem(user, itemId, body);
    throw redirect(`/items/${itemId}`);
  }

  if (body.intent === "delete") {
    await deleteItem(user, itemId);
    throw redirect("/items");
  }
}
```

---

> Rule: `route-resource-routes` — impact **MEDIUM**


# Resource Routes

Use resource routes for API-like endpoints without UI.

## Why

- Clean API endpoints within React Router
- No component rendering overhead
- Can return any response type (JSON, files, redirects)
- Reusable across the app with fetcher

## What Makes a Resource Route

A resource route has **no default export** (no component):

```tsx
import { data } from "react-router";

// routes/api.search.tsx - RESOURCE ROUTE
export async function loader({ request }: Route.LoaderArgs) {
  let url = new URL(request.url);
  let query = url.searchParams.get("q");
  let results = await search(query);
  return data({ results });
}

// No default export = resource route
```

## Common Use Cases

### 1. Search Endpoints

```tsx
import { data } from "react-router";

// routes/api.search.tsx
export async function loader({ request }: Route.LoaderArgs) {
  let url = new URL(request.url);
  let query = url.searchParams.get("q") || "";
  let limit = Number(url.searchParams.get("limit")) || 10;

  let results = await search(query, limit);

  return data({ results });
}
```

Usage with fetcher:

```tsx
function SearchWidget() {
  let fetcher = useFetcher<typeof searchLoader>();

  return (
    <fetcher.Form action="/api/search" method="get">
      <input name="q" onChange={(e) => fetcher.submit(e.currentTarget.form)} />
      {fetcher.data?.results.map((item) => (
        <SearchItem key={item.id} item={item} />
      ))}
    </fetcher.Form>
  );
}
```

### 2. File Downloads

```tsx
// routes/api.reports.$reportId.download.tsx
export async function loader({ params }: Route.LoaderArgs) {
  let report = await getReport(params.reportId);
  let pdf = await generatePDF(report);

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.name}.pdf"`,
    },
  });
}
```

### 3. Image Generation

```tsx
// routes/api.og-image.tsx
export async function loader({ request }: Route.LoaderArgs) {
  let url = new URL(request.url);
  let title = url.searchParams.get("title") || "Default Title";

  let image = await generateOGImage({ title });

  return new Response(image, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000",
    },
  });
}
```

### 4. Webhooks

```tsx
import { data } from "react-router";

// routes/api.webhooks.provider.tsx
export async function action({ request }: Route.ActionArgs) {
  let payload = await request.text();
  let signature = request.headers.get("x-signature");

  let event = verifyWebhook(payload, signature);

  switch (event.type) {
    case "order.completed":
      await handleOrderComplete(event.data);
      break;
    // ... other events
  }

  return data({ received: true });
}
```

### 5. Form Actions Without Navigation

```tsx
import { data } from "react-router";

// routes/api.toggle-favorite.tsx
export async function action({ request }: Route.ActionArgs) {
  let client = await authenticate(request);
  let formData = await request.formData();

  let itemId = z.string().parse(formData.get("itemId"));
  let favorited = formData.get("favorited") === "true";

  let count = await toggleFavorite(client, itemId, favorited);

  return data({ count });
}
```

## Naming Convention

```
api.search.tsx               -> /api/search
api.webhooks.provider.tsx    -> /api/webhooks/provider
api.reports.$id.download.tsx -> /api/reports/:id/download
```

## Type-Safe Fetcher

```tsx
import type { loader as searchLoader } from "~/routes/api.search";

function SearchComponent() {
  let fetcher = useFetcher<typeof searchLoader>();

  // fetcher.data is typed from loader return type
  let results = fetcher.data?.results ?? [];
}
```

---

> Rule: `route-should-revalidate` — impact **MEDIUM**


# Optimize Revalidation

Use shouldRevalidate to prevent unnecessary data fetching.

## Why

- By default, React Router revalidates all loaders after actions
- Some routes don't need revalidation on every action
- Reduces server load and improves performance
- Prevents unnecessary loading states

## Basic Pattern

```tsx

export const shouldRevalidate: Route.ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formAction,
  formMethod,
  defaultShouldRevalidate,
}) => {
  // Your logic here
  return defaultShouldRevalidate;
};
```

## Common Patterns

### 1. Skip Revalidation for Same Path

```tsx
export const shouldRevalidate: Route.ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  // Don't revalidate if only hash changed
  if (currentUrl.pathname === nextUrl.pathname) {
    return false;
  }
  return defaultShouldRevalidate;
};
```

### 2. Skip for Specific Actions

```tsx
export const shouldRevalidate: Route.ShouldRevalidateFunction = ({
  formAction,
  defaultShouldRevalidate,
}) => {
  // Don't revalidate for "like" actions
  if (formAction?.includes("/api/like")) {
    return false;
  }
  return defaultShouldRevalidate;
};
```

### 3. Only Revalidate for Related Actions

```tsx
export const shouldRevalidate: Route.ShouldRevalidateFunction = ({
  formAction,
  defaultShouldRevalidate,
}) => {
  // Only revalidate for actions related to this route's data
  let relatedActions = ["/dashboard", "/items", "/settings"];
  if (formAction && !relatedActions.some((a) => formAction.startsWith(a))) {
    return false;
  }
  return defaultShouldRevalidate;
};
```

### 4. Skip for Search Params Changes

```tsx
export const shouldRevalidate: Route.ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  // Don't revalidate if only search params changed
  // (loader reads params, so this might vary by use case)
  if (
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search
  ) {
    return false;
  }
  return defaultShouldRevalidate;
};
```

### 5. Never Revalidate Static Data

```tsx
// For static marketing pages
export const shouldRevalidate: Route.ShouldRevalidateFunction = () => {
  // Static page data never changes, no need to revalidate
  return false;
};
```

## Function Parameters

```tsx
export const shouldRevalidate: Route.ShouldRevalidateFunction = ({
  currentUrl, // URL before navigation
  nextUrl, // URL after navigation
  currentParams, // Route params before
  nextParams, // Route params after
  formAction, // Action URL if form submitted
  formMethod, // GET, POST, etc.
  formData, // Form data if available
  actionResult, // Result from action
  defaultShouldRevalidate, // What React Router would do
}) => {
  // ...
};
```

## When NOT to Use

Don't skip revalidation when:

- Data depends on user actions
- Data is frequently updated by others
- Stale data would cause bugs
- You're not sure (use default)

```tsx
// When in doubt, use default
export const shouldRevalidate: Route.ShouldRevalidateFunction = ({
  defaultShouldRevalidate,
}) => {
  return defaultShouldRevalidate;
};
```

---

> Rule: `safe-redirects` — impact **MEDIUM**


# Use Safe Redirect Helpers

Protect user-driven redirects with `safeRedirect` and prefer `redirectBack` for post actions.

## Pattern

```ts
import { redirect } from "react-router";
import { safeRedirect } from "remix-utils/safe-redirect";

export async function loader({ request }: Route.LoaderArgs) {
  let url = new URL(request.url);
  let redirectTo = url.searchParams.get("redirectTo");
  return redirect(safeRedirect(redirectTo, "/"));
}
```

```ts
import { redirectBack } from "remix-utils/redirect-back";

export async function action({ request }: Route.ActionArgs) {
  throw redirectBack(request, { fallback: "/" });
}
```

## Rules

1. Never redirect to raw user input
2. Use `safeRedirect` for query-based redirects
3. Use `redirectBack` for post/put/delete actions

---

> Rule: `sec-fetch-guards` — impact **HIGH**


# Use Sec-Fetch Headers to Guard Mutations

Use `Sec-Fetch-*` headers to reject cross-site mutation requests in middleware.

## Why

- Browsers send `Sec-Fetch-*` headers for navigations and form submissions
- You can block cross-site requests before actions run
- Complements CSRF defenses without extra tokens

## Pattern

```ts
// app/middleware/sec-fetch.server.ts
import { fetchSite } from "remix-utils/sec-fetch";

export const secFetchMiddleware: Route.MiddlewareFunction = async ({ request }) => {
  let method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return;

  let site = fetchSite(request);
  if (site === "cross-site" || site === "none") {
    throw new Response("Forbidden", { status: 403 });
  }
};
```

## Rules

1. Use Sec-Fetch checks only for state-changing methods
2. Reject `cross-site` and `none` for mutations
3. Apply as middleware so actions never run on bad requests

---

> Rule: `sse-event-stream` — impact **MEDIUM**


# Stream Updates with SSE

Use `eventStream` in a resource route and `useEventSource` in the UI for live updates.

## Pattern

```ts
// app/routes/sse.time.ts
import { eventStream } from "remix-utils/sse/server";

export async function loader({ request }: Route.LoaderArgs) {
  return eventStream(request.signal, (send) => {
    let intervalId = setInterval(() => {
      send({ event: "time", data: new Date().toISOString() });
    }, 1000);
    return () => clearInterval(intervalId);
  });
}
```

```tsx
import { useEventSource } from "remix-utils/sse/react";

export function Clock() {
  let time = useEventSource("/sse/time", { event: "time" });
  if (!time) return null;
  return <time dateTime={time}>{time}</time>;
}
```

## Rules

1. Put SSE in a resource route
2. Clean up intervals on disconnect
3. Reuse one connection per URL/event

---

> Rule: `streaming-await-suspense` — impact **MEDIUM**


# Await with Suspense

Use Await component with Suspense fallback for streamed data.

## Why

- Await handles promise resolution from loader
- Suspense provides loading UI while promise resolves
- Enables streaming without blocking initial render
- Error boundaries catch rejected promises

## Basic Pattern

```tsx
import { Await, useLoaderData } from "react-router";
import { Suspense } from "react";

export default function Component() {
  const { criticalData, streamedData } = useLoaderData<typeof loader>();

  return (
    <div>
      {/* Critical data renders immediately */}
      <h1>{criticalData.title}</h1>

      {/* Streamed data with loading state */}
      <Suspense fallback={<LoadingSkeleton />}>
        <Await resolve={streamedData}>
          {(data) => <DataDisplay data={data} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

## With Error Handling

```tsx
<Suspense fallback={<Skeleton />}>
  <Await resolve={streamedData} errorElement={<ErrorMessage />}>
    {(data) => <DataDisplay data={data} />}
  </Await>
</Suspense>
```

## Multiple Streamed Values

```tsx
export default function Component() {
  const { profile, activities, recommendations } =
    useLoaderData<typeof loader>();

  return (
    <div>
      <ProfileHeader profile={profile} />

      {/* Each streamed value gets its own Suspense boundary */}
      <Suspense fallback={<ActivitySkeleton />}>
        <Await resolve={activities}>
          {(data) => <ActivityFeed activities={data} />}
        </Await>
      </Suspense>

      <Suspense fallback={<RecommendationSkeleton />}>
        <Await resolve={recommendations}>
          {(data) => <Recommendations items={data} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

## Nested Suspense for Prioritization

```tsx
// Outer content loads first, inner content streams in
<Suspense fallback={<PageSkeleton />}>
  <Await resolve={mainContent}>
    {(content) => (
      <MainContent data={content}>
        {/* Nested streaming for secondary content */}
        <Suspense fallback={<SidebarSkeleton />}>
          <Await resolve={sidebarData}>
            {(sidebar) => <Sidebar data={sidebar} />}
          </Await>
        </Suspense>
      </MainContent>
    )}
  </Await>
</Suspense>
```

## With Promise.all for Combined Data

When multiple promises should resolve together:

```tsx
// Loader
return data({
  // Combine related promises
  widgetData: Promise.all([badges, privateStocks]),
});

// Component
<Suspense fallback={<WidgetSkeleton />}>
  <Await resolve={widgetData}>
    {([badges, privateStocks]) => (
      <Widgets badges={badges} stocks={privateStocks} />
    )}
  </Await>
</Suspense>;
```

## Skeleton Components

Create skeleton components that match the final UI layout:

```tsx
function ActivitySkeleton() {
  return (
    <div className="v-stack gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-stack gap-3 animate-pulse">
          <div className="w-10 h-10 bg-neutral-200 rounded-full" />
          <div className="v-stack gap-2 flex-1">
            <div className="h-4 bg-neutral-200 rounded w-3/4" />
            <div className="h-3 bg-neutral-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

> Rule: `typed-cookies` — impact **MEDIUM**


# Use Typed Cookies for Safety

Use `createTypedCookie` to validate cookie values with a schema.

## Pattern

```ts
import { createCookie } from "react-router";
import { createTypedCookie } from "remix-utils/typed-cookie";
import { z } from "zod";

let cookie = createCookie("returnTo", { path: "/" });
let schema = z.string().url().nullable();

export let returnToCookie = createTypedCookie({ cookie, schema });
```

## Rules

1. Always validate cookie payloads with a schema
2. Use `.nullable()` when you need to clear cookies
