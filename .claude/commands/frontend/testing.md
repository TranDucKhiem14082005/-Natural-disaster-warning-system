---
name: testing
description: Testing best practices for the frontend. Emphasizes E2E tests over unit tests, minimal mocking, and testing behavior over implementation details. Use when writing tests or reviewing test code.
---


# Testing Best Practices

Guidelines for writing effective, maintainable tests that provide real confidence. Contains 6 rules focused on preferring E2E tests, minimizing mocking, and testing behavior over implementation.

## Core Philosophy

1. **Prefer E2E tests over unit tests** - Test the whole system, not isolated pieces
2. **Minimize mocking** - If you need complex mocks, write an E2E test instead
3. **Test behavior, not implementation** - Test what users see and do
4. **Avoid testing React components directly** - Test them through E2E

## When to Apply

Reference these guidelines when:

- Deciding what type of test to write
- Writing new E2E or unit tests
- Reviewing test code
- Refactoring tests

## Rules Summary

### Testing Strategy (CRITICAL)

#### prefer-e2e-tests - @rules/prefer-e2e-tests.md

Default to E2E tests. Only write unit tests for pure functions.

```typescript
// E2E test (PREFERRED) - tests real user flow
test("user can place an order", async ({ page }) => {
  await createTestingAccount(page, { account_status: "active" });
  await page.goto("/catalog");
  await page.getByRole("heading", { name: "Example Item" }).click();
  await page.getByRole("link", { name: "Buy" }).click();
  // ... complete flow
  await expect(page.getByAltText("Thank you")).toBeVisible();
});

// Unit test - ONLY for pure functions
test("formatCurrency formats with two decimals", () => {
  expect(formatCurrency(1234.5)).toBe("$1,234.50");
});
```

#### avoid-component-tests - @rules/avoid-component-tests.md

Don't unit test React components. Test them through E2E or not at all.

```typescript
// BAD: Component unit test
describe("OrderCard", () => {
  test("renders amount", () => {
    render(<OrderCard amount={100} />);
    expect(screen.getByText("$100")).toBeInTheDocument();
  });
});

// GOOD: E2E test covers the component naturally
test("order history shows orders", async ({ page }) => {
  await page.goto("/orders");
  await expect(page.getByText("$100")).toBeVisible();
});
```

#### minimize-mocking - @rules/minimize-mocking.md

Keep mocks simple. If you need 3+ mocks, write an E2E test instead.

```typescript
// BAD: Too many mocks = write E2E test
vi.mock("~/lib/auth");
vi.mock("~/lib/transactions");
vi.mock("~/hooks/useAccount");

// GOOD: Simple MSW mock for loader test
mockServer.use(
  http.get("/api/user", () => HttpResponse.json({ name: "John" })),
);
```

### E2E Tests (HIGH)

#### e2e-test-structure - @rules/e2e-test-structure.md

E2E tests go in `e2e/tests/`, not `frontend/`.

```typescript
// e2e/tests/order.spec.ts
import { test, expect } from "@playwright/test";
import { addAccountBalance, createTestingAccount } from "./utils";

test.describe("Orders", () => {
  test.beforeEach(async ({ page, context }) => {
    await createTestingAccount(page, { account_status: "active" });
    let cookies = await context.cookies();
    let account_id = cookies.find((c) => c.name === "account_id").value;
    await addAccountBalance({ account_id, amount: 10000, replaceBalance: true });
  });

  test("place order with default values", async ({ page }) => {
    await page.goto("/catalog");
    // ... user flow
  });
});
```

#### e2e-selectors - @rules/e2e-selectors.md

Use accessible selectors: role > label > text > testid.

```typescript
// GOOD: Role-based (preferred)
await page.getByRole("button", { name: "Submit" }).click();
await page.getByRole("heading", { name: "Dashboard" });

// GOOD: Label-based
await page.getByLabel("Email").fill("test@example.com");

// OK: Test ID when no accessible selector exists
await expect(page.getByTestId("balance")).toHaveText("$1,234");

// BAD: CSS selectors
await page.locator(".btn-primary").click();
```

### Unit Tests (MEDIUM)

#### unit-test-structure - @rules/unit-test-structure.md

Unit tests for pure functions only. Co-locate with source files.

```typescript
// app/utils/format.test.ts
import { describe, test, expect } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  test("formats positive amounts", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  test("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
});
```

## Key Files

- `e2e/tests/` - E2E tests (Playwright)
- `e2e/tests/utils.ts` - E2E test utilities
- `vitest.config.ts` - Unit test configuration
- `vitest.setup.ts` - Global test setup with MSW
- `app/utils/test-utils.ts` - Unit test utilities

---

# Rules — chi tiết đầy đủ


# frontend-testing-best-practices — rules (6)

File con cua [`frontend-testing-best-practices.md`](./frontend-testing-best-practices.md). Moi rule mot muc, mo dau bang `> Rule:`.

---

> Rule: `avoid-component-tests` — impact **HIGH**


# Avoid Testing React Components in Isolation

Don't write unit tests for React components. Test them through E2E tests or not at all.

## Why

- Component tests often test implementation details
- They break when you refactor without changing behavior
- They require complex mocking (context, hooks, providers)
- They don't provide confidence that the feature actually works
- E2E tests cover components naturally as part of user flows

## Bad: Component Unit Tests

```typescript
// BAD: Testing component rendering
import { render, screen } from "@testing-library/react";
import { OrderCard } from "./order-card";

describe("OrderCard", () => {
  test("renders order amount", () => {
    render(<OrderCard amount={100} itemName="Example Item" />);
    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(screen.getByText("Red Cross")).toBeInTheDocument();
  });

  test("shows pending state", () => {
    render(<OrderCard amount={100} itemName="Example Item" status="pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});
```

Why this is bad:

- Tests that props render correctly - this is React's job
- Doesn't test that the component works in context
- Will break if you rename props or restructure JSX
- Mocking providers is tedious and error-prone

## Good: E2E Test That Covers the Component

```typescript
// GOOD: E2E test that naturally tests OrderCard
import { test, expect } from "@playwright/test";

test("order history shows pending orders", async ({ page }) => {
  // Create a pending order via API or test setup
  await createTestOrder({ status: "pending" });

  await page.goto("/orders");

  // The OrderCard component is tested implicitly
  await expect(page.getByText("$100")).toBeVisible();
  await expect(page.getByText("Example Item")).toBeVisible();
  await expect(page.getByText("Pending")).toBeVisible();
});
```

## When Component Tests Might Be Acceptable

Only consider component tests for:

1. **Highly reusable UI library components** (Button, Input, Modal)
   - But even then, prefer visual regression tests or Storybook

2. **Complex isolated logic** (but extract it to a hook and test that)

```typescript
// ACCEPTABLE: Testing a reusable Badge component variants
// But only if it's a shared UI component used everywhere
describe(Badge.name, () => {
  test('renders the "success" variant classes', () => {
    render(<Badge variant="success">Text</Badge>);
    expect(screen.getByText("Text")).toHaveClass("bg-success-100");
  });
});
```

## Extract Logic to Testable Hooks

If a component has complex logic, extract it:

```typescript
// BAD: Complex logic in component, tested via component test
function OrderForm() {
  let [amount, setAmount] = useState(0);
  let [fee, setFee] = useState(0);

  useEffect(() => {
    // Complex fee calculation
    let baseFee = amount * 0.029 + 0.3;
    let adjustedFee = amount > 1000 ? baseFee * 0.9 : baseFee;
    setFee(adjustedFee);
  }, [amount]);

  // ...
}

// GOOD: Extract logic to hook, test the hook
function useOrderFee(amount: number) {
  return useMemo(() => {
    let baseFee = amount * 0.029 + 0.3;
    return amount > 1000 ? baseFee * 0.9 : baseFee;
  }, [amount]);
}

// Or even better: pure function
function calculateOrderFee(amount: number): number {
  let baseFee = amount * 0.029 + 0.3;
  return amount > 1000 ? baseFee * 0.9 : baseFee;
}

// Test the pure function
describe("calculateOrderFee", () => {
  test("calculates standard fee", () => {
    expect(calculateOrderFee(100)).toBe(3.2);
  });

  test("applies discount for large orders", () => {
    expect(calculateOrderFee(2000)).toBe(52.47);
  });
});
```

## Rules

1. Don't write unit tests for React components
2. Test components through E2E tests as part of user flows
3. If component has complex logic, extract to a hook or pure function
4. UI library components can have minimal variant tests
5. Never test that props render correctly - that's React's job
6. If you need to mock providers/context, write an E2E test instead

---

> Rule: `e2e-selectors` — impact **MEDIUM**


# E2E Test Selectors

Use accessible queries and data-testid for reliable element selection.

## Selector Priority

Prefer selectors in this order (most to least preferred):

1. **Role-based** - `getByRole("button", { name: "Submit" })`
2. **Label-based** - `getByLabel("Email")`
3. **Text-based** - `getByText("Welcome")`
4. **Test ID** - `getByTestId("balance")`

## Role-Based Selectors (Preferred)

```typescript
// Buttons
await page.getByRole("button", { name: "Submit" }).click();
await page.getByRole("button", { name: /submit/i }).click(); // Case insensitive

// Links
await page.getByRole("link", { name: "Home" }).click();

// Headings
await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

// Form elements
await page.getByRole("textbox", { name: "Email" }).fill("test@example.com");
await page.getByRole("checkbox", { name: "Accept terms" }).check();
await page.getByRole("combobox", { name: "Country" }).selectOption("US");
```

## Label-Based Selectors

```typescript
// Form inputs by label
await page.getByLabel("Email").fill("test@example.com");
await page.getByLabel("Password").fill("secret123");

// Partial match
await page.getByLabel(/email/i).fill("test@example.com");
```

## Text-Based Selectors

```typescript
// Exact text
await page.getByText("Welcome back").click();

// Partial/regex
await page.getByText(/welcome/i).click();

// Within a container
await page.locator(".card").getByText("Details").click();
```

## Test ID Selectors (When Needed)

Use `data-testid` when:

- Element has no accessible name
- Multiple similar elements exist
- Testing specific values (like balance display)

```tsx
// In component
<span data-testid="balance">${balance}</span>;

// In test
await expect(page.getByTestId("balance")).toHaveText("$1,234.56");
```

## Bad Selectors

```typescript
// Bad: fragile CSS selectors
await page.locator(".btn-primary").click();
await page.locator("#submit-button").click();
await page.locator("form > div:nth-child(2) > button").click();

// Bad: implementation details
await page.locator("[class*='Button_primary']").click();
```

## Combining Selectors

```typescript
// Filter within results
await page
  .getByRole("listitem")
  .filter({ hasText: "Red Cross" })
  .getByRole("button", { name: "Donate" })
  .click();

// Within a specific region
await page
  .getByRole("region", { name: "Order history" })
  .getByRole("row")
  .first()
  .click();
```

## Waiting for Elements

```typescript
// Wait for element to be visible
await expect(page.getByRole("heading", { name: "Success" })).toBeVisible();

// Wait for element to disappear
await expect(page.getByText("Loading...")).not.toBeVisible();

// Wait for specific count
await expect(page.getByRole("listitem")).toHaveCount(5);
```

## Rules

1. Prefer role-based selectors - they test accessibility too
2. Use label selectors for form inputs
3. Use `data-testid` only when no accessible selector exists
4. Never use CSS class or generated ID selectors
5. Use `filter()` to narrow down multiple matches
6. Always use `await expect()` for assertions

---

> Rule: `e2e-test-structure` — impact **HIGH**


# E2E Test Structure

Structure E2E tests around user flows, not technical implementation.

## File Location

E2E tests live in the `e2e` package, NOT in `frontend`:

```
e2e/
└── tests/
    ├── utils.ts              # Test utilities, helpers
    ├── global.setup.ts       # Global setup
    ├── orders.spec.ts        # Order flows
    ├── account.spec.ts       # Account setup flow
    ├── login.spec.ts         # Authentication
    ├── home.spec.ts          # Home page
    └── profile.spec.ts       # Profile management
```

## Basic Test Structure

```typescript
import { test, expect } from "@playwright/test";
import { addAccountBalance, createTestingAccount } from "./utils";

test.describe("Orders", () => {
  test.beforeEach(async ({ page, context }) => {
    // Create test account with mock signin
    await createTestingAccount(page, { account_status: "active" });

    // Get account_id from cookies
    let cookies = await context.cookies();
    let account_id = cookies.find((cookie) => cookie.name === "account_id").value;

    // Set up test data
    await addAccountBalance({ account_id, amount: 10000, replaceBalance: true });
  });

  test("place order with default values", async ({ page }) => {
    await page.goto("/catalog");

    // Search for item
    await page
      .getByPlaceholder("Search by name or ID")
      .fill("example");

    await page.getByRole("heading", { name: "Example Item" }).click();
    await page.getByRole("link", { name: "Buy" }).first().click();

    // Step 1: Amount
    await expect(
      page.getByRole("heading", { name: "Enter the order details" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2: Share info
    await page.waitForURL((url) => url.searchParams.get("step") === "share");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 3: Notes
    await page.waitForURL((url) => url.searchParams.get("step") === "notes");
    await page.getByRole("button", { name: "Skip" }).click();

    // Step 4: Confirm
    await page.waitForURL((url) => url.searchParams.get("step") === "confirm");
    await page.getByRole("button", { name: "Submit" }).click();

    // Assert success
    await expect(page.getByAltText("Thank you")).toBeVisible();
  });
});
```

## Key Utilities

Import helpers from `./utils`:

```typescript
import {
  createTestingAccount, // Create test user via mock signin
  addAccountBalance, // Add balance to account
  addAccountBalanceToEmail, // Add balance by email
  getAccountIdByEmail, // Get account ID from email
  logout, // Log out user
  createMockResource, // Create test resource
  createRecordForUser, // Create test record
} from "./utils";
```

### createTestingAccount

Creates a test user via mock signin endpoint:

```typescript
let user = await createTestingAccount(page, {
  email: "test@example.com", // Optional, random if not provided
  name: "John Doe", // Optional
  slug: "john-doe", // Optional
  accountName: "Example Account", // Optional
  account_status: "active", // "active" | "pending" | null
  account_step: "profile", // Optional
  account_source: "web", // Optional
});

// Returns: { email, name, slug, accountName, account_status }
```

### addFundBalance

Adds balance to an account (requires account_id from cookies):

```typescript
let cookies = await context.cookies();
let account_id = cookies.find((c) => c.name === "account_id").value;

await addFundBalance({
  account_id,
  amount: 10000, // Amount in cents
  replaceBalance: true, // Clear existing balance first
});
```

## Waiting Patterns

### Wait for URL changes

```typescript
// Wait for specific URL
await page.waitForURL(/\/home/);

// Wait for query param
await page.waitForURL((url) => url.searchParams.get("step") === "confirm");

// Wait for URL with timeout
await expect(page).toHaveURL(/\/home/, { timeout: 30000 });
```

### Wait for elements

```typescript
// Wait for element to be visible
await page.getByRole("heading", { name: "Success" }).waitFor();

// Wait for element to appear then assert
await expect(page.getByAltText("Thank you")).toBeVisible();

// Wait for element to disappear
await expect(page.getByText("Loading")).not.toBeVisible();
```

## Test Isolation

Each test should be independent:

```typescript
test.describe("Feature", () => {
  // Set up fresh state before each test
  test.beforeEach(async ({ page, context }) => {
    await createTestingAccount(page, { account_status: "active" });
    // ... additional setup
  });

  test("scenario 1", async ({ page }) => {
    // Test runs with fresh state
  });

  test("scenario 2", async ({ page }) => {
    // Test runs with fresh state, independent of scenario 1
  });
});
```

## Rules

1. E2E tests go in `e2e/tests/`, not `frontend/`
2. Use `createTestingAccount` for test user setup
3. Use `addAccountBalance` for setting up test balances
4. Use descriptive test names that explain the user scenario
5. Each test should be independent - use `beforeEach` for setup
6. Wait for URL changes with `waitForURL` or `toHaveURL`
7. Use role-based selectors when possible

---

> Rule: `minimize-mocking` — impact **HIGH**


# Minimize Mocking

Keep mocks simple and minimal. If you need complex mocking, write an E2E test instead.

## Why

- Mocks can diverge from real implementations
- Complex mocks are hard to maintain
- Mocks test your mock, not your code
- Over-mocking leads to false confidence

## The Mock Smell Test

If your test setup looks like this, write an E2E test:

```typescript
// BAD: Too many mocks = write an E2E test
vi.mock("~/lib/auth");
vi.mock("~/lib/transactions");
vi.mock("~/hooks/useUser");
vi.mock("~/hooks/useCart");
vi.mock("@remix-run/react", () => ({
  useNavigate: () => vi.fn(),
  useLoaderData: () => mockLoaderData,
}));

describe("CheckoutPage", () => {
  // This test provides false confidence
});
```

## Acceptable Mocking

### 1. MSW for API Calls (Simple Cases)

```typescript
import { mockServer, http, HttpResponse } from "~/lib/test-utils";

beforeEach(() => {
  mockServer.use(
    http.get("/api/user", () => HttpResponse.json({ id: 1, name: "John" })),
  );
});

test("loader returns user data", async () => {
  let response = await loader({ request, params: {}, context: {} });
  let data = await response.json();
  expect(data.user.name).toBe("John");
});
```

### 2. Fake Timers for Time-Based Logic

```typescript
import { vi, beforeAll, afterAll } from "vitest";

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-15"));
});

afterAll(() => {
  vi.useRealTimers();
});

test("isExpired returns true for past dates", () => {
  expect(isExpired(new Date("2025-01-01"))).toBe(true);
});
```

### 3. Environment Variables

```typescript
test("uses production API in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const { apiUrl } = await import("./config");
  expect(apiUrl).toBe("https://api.example.com");
  vi.unstubAllEnvs();
});
```

## Unacceptable Mocking

### Mocking React Hooks

```typescript
// BAD: Mocking hooks
vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useState: vi.fn(),
  useEffect: vi.fn(),
}));
```

### Mocking Remix Functions

```typescript
// BAD: Mocking Remix internals
vi.mock("@remix-run/react", () => ({
  useLoaderData: () => ({ user: { name: "John" } }),
  useActionData: () => null,
  useNavigation: () => ({ state: "idle" }),
}));
```

### Mocking Multiple Services

```typescript
// BAD: If you need all these mocks, write an E2E test
vi.mock("~/lib/auth");
vi.mock("~/lib/transactions");
vi.mock("~/lib/notifications");
```

## Decision Tree

```
Can I test this with no mocks?
  → Yes: Do that
  → No: Continue...

Can I test this with just MSW (1-2 endpoints)?
  → Yes: Integration test with MSW
  → No: Continue...

Would I need to mock Remix, React, or 3+ services?
  → Yes: Write an E2E test instead
```

## Rules

1. Zero mocks is the ideal - test pure functions
2. MSW is acceptable for simple API mocking (1-2 endpoints)
3. Fake timers are acceptable for time-based logic
4. Never mock React, Remix, or third-party UI libraries
5. If you need 3+ mocks, write an E2E test
6. Complex mock setup is a code smell - refactor or use E2E
7. Mocks should be simple enough to verify correctness at a glance

---

> Rule: `prefer-e2e-tests` — impact **HIGH**


# Prefer E2E Tests Over Unit Tests

Write E2E tests as your default testing strategy. Only write unit tests for pure functions and utilities.

## Why

- E2E tests provide real confidence - they test what users actually do
- E2E tests catch integration issues that unit tests miss
- E2E tests don't require mocking, so they're more maintainable
- Refactoring doesn't break E2E tests (implementation changes, behavior stays)

## Decision Flow

```
Is it a pure function with no dependencies?
  → Yes: Unit test (Vitest)
  → No: Continue...

Is it a loader/action with simple API calls?
  → Yes: Integration test with MSW (Vitest)
  → No: Continue...

Does it involve user interaction, routing, or complex state?
  → Yes: E2E test (Playwright)

Would testing it require complex mocking?
  → Yes: E2E test (Playwright)
```

## Examples

### E2E Test (Preferred for User Flows)

```typescript
// e2e/orders.spec.ts
import { test, expect } from "@playwright/test";

test("user can place an order", async ({ page }) => {
  await page.goto("/catalog");

  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Item").selectOption("item-123");
  await page.getByRole("button", { name: "Buy" }).click();

  await expect(page.getByText("Thanks for your order")).toBeVisible();
});
```

### Unit Test (For Pure Functions Only)

```typescript
// app/utils/format.test.ts
import { describe, test, expect } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  test("formats dollars with two decimals", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  test("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
});
```

### Integration Test (For Loaders with Simple Mocking)

```typescript
// app/routes/profile/route.test.ts
import { describe, test, expect, beforeEach } from "vitest";
import { loader } from "./route";
import { mockServer, http, HttpResponse } from "~/lib/test-utils";

beforeEach(() => {
  mockServer.use(
    http.get("/api/user", () => HttpResponse.json({ name: "John" })),
  );
});

describe("profile loader", () => {
  test("returns user data", async () => {
    let response = await loader({
      request: new Request("http://test"),
      params: {},
      context: {},
    });
    let data = await response.json();
    expect(data.user.name).toBe("John");
  });
});
```

## What NOT to Unit Test

```typescript
// BAD: Don't unit test React components
describe("OrderForm", () => {
  test("renders form fields", () => {
    render(<OrderForm />);
    // This doesn't provide real confidence
  });
});

// BAD: Don't unit test with complex mocks
describe("CheckoutFlow", () => {
  test("processes checkout", async () => {
    vi.mock("~/lib/transactions");
    vi.mock("~/lib/analytics");
    vi.mock("~/hooks/useCart");
    // If you need this many mocks, write an E2E test
  });
});
```

## Rules

1. Default to E2E tests for anything involving user interaction
2. Use unit tests only for pure functions with no dependencies
3. If a unit test requires more than one mock, consider E2E instead
4. Don't unit test React components - test them via E2E
5. Integration tests (Vitest + MSW) are acceptable for loaders/actions
6. Measure confidence, not coverage

---

> Rule: `unit-test-structure` — impact **MEDIUM**


# Unit Test Structure

Structure unit tests for pure functions and utilities.

## When to Write Unit Tests

Only write unit tests for:

- Pure utility functions (`formatCurrency`, `parseDate`)
- Data transformations and validators
- Complex algorithms
- Custom hooks with non-trivial logic (rare)

## Basic Structure

```typescript
import { describe, test, expect } from "vitest";
import { formatCurrency, formatPercentage } from "./format";

describe("formatCurrency", () => {
  test("formats positive amounts with two decimals", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  test("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  test("formats negative amounts", () => {
    expect(formatCurrency(-100)).toBe("-$100.00");
  });
});

describe("formatPercentage", () => {
  test("formats decimal as percentage", () => {
    expect(formatPercentage(0.25)).toBe("25%");
  });
});
```

## Parameterized Tests

Use arrays for testing multiple inputs:

```typescript
import { describe, test, expect } from "vitest";
import { slugify } from "./string";

const testCases: [string, string][] = [
  ["Hello World", "hello-world"],
  ["Multiple   Spaces", "multiple-spaces"],
  ["Special @#$ Characters", "special-characters"],
  ["Already-slugified", "already-slugified"],
  ["", ""],
];

describe("slugify", () => {
  test.each(testCases)('slugify("%s") returns "%s"', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
```

## Testing Error Cases

```typescript
import { describe, test, expect } from "vitest";
import { parseAmount } from "./parse";

describe("parseAmount", () => {
  test("throws for invalid input", () => {
    expect(() => parseAmount("not-a-number")).toThrow("Invalid amount");
  });

  test("throws for negative amounts", () => {
    expect(() => parseAmount("-100")).toThrow("Amount must be positive");
  });
});
```

## Testing Async Functions

```typescript
import { describe, test, expect } from "vitest";
import { fetchUserData } from "./api";

describe("fetchUserData", () => {
  test("returns user data for valid ID", async () => {
    let user = await fetchUserData("user-123");
    expect(user).toEqual({
      id: "user-123",
      name: expect.any(String),
    });
  });

  test("throws for non-existent user", async () => {
    await expect(fetchUserData("invalid")).rejects.toThrow("User not found");
  });
});
```

## File Naming and Location

Tests are co-located with source files:

```
app/
├── utils/
│   ├── format.ts
│   ├── format.test.ts      # Unit test
│   ├── string.ts
│   └── string.test.ts
```

## Test Naming

Use descriptive names that explain the scenario:

```typescript
// Bad: vague names
test("works", () => {});
test("test 1", () => {});
test("formatCurrency", () => {});

// Good: describes behavior
test("formats amount with thousand separators", () => {});
test("returns empty string for null input", () => {});
test("throws when amount exceeds maximum", () => {});
```

## Rules

1. Test file goes next to source file: `foo.ts` → `foo.test.ts`
2. Use `describe` to group related tests
3. Use descriptive test names that explain the expected behavior
4. Test edge cases: null, undefined, empty, negative, max values
5. Use `test.each` for parameterized tests with multiple inputs
6. Keep tests focused - one assertion per behavior
