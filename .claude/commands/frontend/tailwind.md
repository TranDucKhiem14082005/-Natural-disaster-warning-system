---
name: tailwind
description: Tailwind CSS patterns and conventions for frontend apps. Use when writing component styles, layouts, or working with CSS classes.
---


> **Áp dụng khi:** dự án dùng **Tailwind CSS**. **Bỏ qua nếu:** dùng CSS Modules / styled-components / vanilla CSS → báo "không dùng Tailwind, bỏ qua skill này".

# Tailwind CSS Best Practices

Styling patterns and conventions for frontend applications. Contains 10 rules covering layout utilities, affordances, color schemes, responsive design, and className handling.

## When to Apply

Reference these guidelines when:

- Writing component styles with Tailwind
- Creating layouts (stacks, grids, centering)
- Handling responsive design
- Working with color schemes
- Merging className props

## Rules Summary

### Layout Utilities (CRITICAL)

#### layout-stack-utilities - @rules/layout-stack-utilities.md

Use custom stack utilities instead of flex classes.

```tsx
// Bad
<div className="flex flex-col gap-4">
<div className="flex flex-row gap-4">

// Good
<div className="v-stack gap-4">
<div className="h-stack gap-4">
```

Available utilities:

- `v-stack` - Vertical stack (flex column)
- `h-stack` - Horizontal stack (flex row)
- `v-stack-reverse` - Reversed vertical stack
- `h-stack-reverse` - Reversed horizontal stack
- `z-stack` - Overlapping stack (grid-based, centers children on top of each other)
- `center` - Center content both horizontally and vertically
- `spacer` - Flexible spacer that fills available space
- `circle` - Perfect circle with aspect-ratio 1/1

#### layout-prefer-gaps - @rules/layout-prefer-gaps.md

Use `gap-*` on parents instead of child margins.

```tsx
// Bad
<div>
  <Item className="mb-4" />
  <Item className="mb-4" />
</div>

// Good
<div className="flex flex-col gap-4">
  <Item />
  <Item />
</div>
```

#### layout-responsive-stacks - @rules/layout-responsive-stacks.md

Switch layout direction at breakpoints.

```tsx
// Mobile: vertical, Desktop: horizontal
<div className="v-stack lg:h-stack gap-4">
  <main className="grow">...</main>
  <aside className="shrink-0 lg:w-80">...</aside>
</div>

// Mobile: horizontal, Desktop: vertical
<div className="h-stack md:v-stack">
```

### Color Schemes (CRITICAL)

#### color-schemes - @rules/color-schemes.md

Use class-based color schemes with a custom `dark` variant.

```tsx
<button className="rounded-full bg-gray-900 px-4 py-2 text-white dark:bg-gray-100 dark:text-gray-900">
  Toggle
</button>
```

### className Handling (CRITICAL)

#### classname-cn-utility - @rules/classname-cn-utility.md

Always use `cn()` to merge classNames in components.

```tsx
import { cn } from "~/lib/cn";

function Button({ className, variant }: Props) {
  return (
    <button
      className={cn(
        "base-classes",
        {
          "variant-primary": variant === "primary",
          "variant-secondary": variant === "secondary",
        },
        className, // external className always last
      )}
    />
  );
}
```

#### classname-prop-types - @rules/classname-prop-types.md

Use proper types for className props.

```tsx
import type { ClassName, ClassNameRecord } from "~/lib/cn";

// Single element
type Props = {
  className?: ClassName;
};

// Multiple elements
type Props = {
  className?: ClassNameRecord<"root" | "label" | "input">;
};

// Usage
<Input className={{ root: "w-full", label: "font-bold" }} />;
```

### Affordances (HIGH)

#### affordance-classes - @rules/affordance-classes.md

Define element-agnostic visual patterns that compose with utilities.

```tsx
<label className="ui-button" htmlFor="document-upload">
  Choose file
</label>
```

### Responsive Design (MEDIUM)

#### responsive-breakpoints - @rules/responsive-breakpoints.md

Use responsive prefixes with Tailwind defaults.

```tsx
// Standard breakpoints (min-width)
<div className="px-4 md:px-8 lg:px-12">

// Show/hide with standard breakpoints
<div className="hidden md:block">Desktop only</div>
<div className="md:hidden">Mobile only</div>
```

#### responsive-text - @rules/responsive-text.md

Scale text responsively.

```tsx
// Responsive font size
<h1 className="text-2xl md:text-3xl lg:text-4xl">

// Responsive line height with text
<p className="text-sm leading-5 md:text-base md:leading-6">
```

#### responsive-capabilities - @rules/responsive-capabilities.md

Design for input capabilities (pointer/hover) instead of device labels.

```tsx
<button className="h-10 w-10 pointer-coarse:h-12 pointer-coarse:w-12">
  <Icon />
</button>
```

## Anti-Patterns

| Don't                              | Do                     |
| ---------------------------------- | ---------------------- |
| `flex flex-col`                    | `v-stack`              |
| `flex flex-row`                    | `h-stack`              |
| `flex items-center justify-center` | `center`               |
| `bg-gray-100`                      | `bg-neutral-100`       |
| `bg-[#hex]`                        | Use design tokens      |
| `className="..."` without `cn()`   | `cn("...", className)` |
| Inline `style` for responsive      | Tailwind prefixes      |

## Key Files

| File                      | Purpose                          |
| ------------------------- | -------------------------------- |
| `tailwind.config.js`      | Config, custom utilities, colors |
| `app/styles/global.css`   | Color scheme CSS variables       |
| `app/styles/tailwind.css` | Additional utilities             |
| `app/utils/cn.ts`         | className merge utility          |

---

# Rules — chi tiết đầy đủ


# frontend-tailwind-best-practices — rules (10)

File con cua [`frontend-tailwind-best-practices.md`](./frontend-tailwind-best-practices.md). Moi rule mot muc, mo dau bang `> Rule:`.

---

> Rule: `affordance-classes` — impact **HIGH**


# Affordance Classes

Create element-agnostic visual patterns (affordances) with Tailwind `@utility`, `@apply`, and `@variant`.

## Why

- Decouple appearance from element choice (`button`, `label`, `a`, `summary`)
- Keep a single source of truth for interactive styles
- Preserve Tailwind tree-shaking and IntelliSense
- Let utilities override affordances without specificity fights

## Pattern

Define affordances with `@utility` so they are tree-shakeable and show up in IntelliSense. Use `:where()` for zero specificity and `@variant` for readable states:

```css
@utility ui-button {
  :where(&) {
    @apply inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold;
    @apply bg-primary text-primary-foreground shadow-sm;

    @variant hover {
      @apply bg-primary/90;
    }

    @variant focus-visible {
      @apply outline-2 outline-offset-2 outline-primary;
    }
  }
}

@utility ui-input {
  :where(&) {
    @apply block w-full rounded-md border border-neutral-300 bg-white px-3 py-2;
    @apply text-neutral-900;

    @variant focus-visible {
      @apply border-primary outline-2 outline-offset-2 outline-primary;
    }
  }
}
```

## Usage

```tsx
// Label styled like a button
<label className="ui-button" htmlFor="document-upload">
  Choose file
</label>

// Utilities can still override
<button className="ui-button bg-red-600 hover:bg-red-500">Delete</button>

// Input affordance on any element that needs to look typeable
<input className="ui-input" />
<textarea className="ui-input" />
```

## Rules

1. Use a `ui-` (or similar) prefix to signal affordance classes
2. Use `@utility` so affordances are tree-shakeable and discoverable
3. Wrap styles in `:where()` to keep specificity at zero
4. Use `@variant` blocks for readable state styles

---

> Rule: `classname-cn-utility` — impact **CRITICAL**


# Use cn() for className Merging

Always use the `cn()` utility to merge classNames in components.

## Why

- Properly merges Tailwind classes (handles conflicts)
- Supports conditional classes with objects
- Accepts arrays, strings, undefined
- External className always wins (applied last)

## Import

```tsx
import { cn } from "~/lib/cn";
```

## Definition

```ts
import type { ClassValue } from "clsx";
import type { CSSProperties } from "react";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type ClassName = ClassValue;
export type ClassNameRecord<Key extends string> = { [K in Key]?: ClassName };

type Style = CSSProperties & { [key: `--${string}`]: string };
export type StyleRecord<Key extends string> = { [K in Key]?: Style };

export function cn(...classes: ClassName[]): string {
  return twMerge(clsx(...classes));
}
```

## Pattern

```tsx
function Button({ className, variant, size, disabled }: Props) {
  return (
    <button
      className={cn(
        // Base classes always applied
        "inline-flex items-center justify-center rounded-lg font-medium",
        // Variant classes (conditional object)
        {
          "bg-teal-500 text-white": variant === "primary",
          "bg-neutral-100 text-neutral-900": variant === "secondary",
          "bg-transparent text-teal-600": variant === "ghost",
        },
        // Size classes
        {
          "px-3 py-1.5 text-sm": size === "sm",
          "px-4 py-2 text-base": size === "md",
          "px-6 py-3 text-lg": size === "lg",
        },
        // State classes
        disabled && "opacity-50 cursor-not-allowed",
        // External className ALWAYS LAST
        className,
      )}
    />
  );
}
```

## Conditional Classes

### Object Syntax (Preferred)

```tsx
className={cn(
  "base",
  {
    "active-class": isActive,
    "disabled-class": isDisabled,
    "error-class": hasError,
  }
)}
```

### Logical AND

```tsx
className={cn(
  "base",
  isActive && "active-class",
  isDisabled && "disabled-class"
)}
```

### Ternary

```tsx
className={cn(
  "base",
  isActive ? "bg-teal-500" : "bg-neutral-100"
)}
```

## External className Last

Always put the `className` prop last so consumers can override:

```tsx
// Component
function Card({ className }: { className?: ClassName }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white p-4",
        className, // Can override padding, background, etc.
      )}
    />
  );
}

// Usage - override works
<Card className="p-8 bg-neutral-50" />;
```

## Arrays

```tsx
const baseClasses = ["rounded-lg", "font-medium"];
const sizeClasses = size === "lg" ? ["px-6", "py-3"] : ["px-4", "py-2"];

className={cn(baseClasses, sizeClasses, className)}
```

## Handling Undefined

`cn()` safely ignores undefined/null/false values:

```tsx
className={cn(
  "base",
  maybeUndefined,             // Ignored if undefined
  condition && "conditional", // Ignored if false
  className                   // Ignored if not passed
)}
```

## Anti-Patterns

```tsx
// Bad - string concatenation
className={`base ${isActive ? "active" : ""} ${className}`}

// Bad - template literal without cn
className={`base ${className || ""}`}

// Bad - className not last
className={cn(className, "base-classes")}

// Bad - not using cn at all
className="static-classes-only"
```

---

> Rule: `classname-prop-types` — impact **MEDIUM**


# className Prop Types

Use proper TypeScript types for className props from `~/lib/cn`.

## Why

- Type safety for className props
- Support for multi-element className records
- Consistent API across components
- IDE autocomplete for className keys

## Types

```tsx
import type { ClassName, ClassNameRecord } from "~/lib/cn";
```

### ClassName

For components with a single styleable element:

```tsx
type Props = {
  className?: ClassName;
};

function Button({ className }: Props) {
  return <button className={cn("base", className)} />;
}

// Usage
<Button className="mt-4" />
<Button className={["mt-4", isLarge && "text-lg"]} />
```

### ClassNameRecord

For components with multiple styleable elements:

```tsx
type Props = {
  className?: ClassNameRecord<"root" | "label" | "input" | "error">;
};

function TextField({ className }: Props) {
  return (
    <div className={cn("v-stack gap-1", className?.root)}>
      <label className={cn("text-sm font-medium", className?.label)}>
        {label}
      </label>
      <input className={cn("rounded-lg border px-3 py-2", className?.input)} />
      {error && (
        <p className={cn("text-sm text-failure-600", className?.error)}>
          {error}
        </p>
      )}
    </div>
  );
}

// Usage
<TextField
  className={{
    root: "w-full",
    label: "text-neutral-600",
    input: "border-failure-500",
  }}
/>;
```

## Common Patterns

### Modal with Multiple Parts

```tsx
type Props = {
  className?: ClassNameRecord<
    "overlay" | "container" | "header" | "body" | "footer"
  >;
};

function Modal({ className, children }: Props) {
  return (
    <div className={cn("fixed inset-0 bg-neutral-900/50", className?.overlay)}>
      <div className={cn("bg-white rounded-xl", className?.container)}>
        <header className={cn("p-4 border-b", className?.header)}>
          {title}
        </header>
        <div className={cn("p-4", className?.body)}>{children}</div>
        <footer className={cn("p-4 border-t", className?.footer)}>
          {actions}
        </footer>
      </div>
    </div>
  );
}
```

### Card Component

```tsx
type Props = {
  className?: ClassNameRecord<"root" | "header" | "body">;
};

function Card({ className, title, children }: Props) {
  return (
    <div className={cn("rounded-xl bg-white shadow", className?.root)}>
      {title && (
        <div className={cn("px-4 py-3 border-b", className?.header)}>
          <h3 className="font-semibold">{title}</h3>
        </div>
      )}
      <div className={cn("p-4", className?.body)}>{children}</div>
    </div>
  );
}
```

### List Item

```tsx
type Props = {
  className?: ClassNameRecord<"root" | "icon" | "content" | "action">;
};

function ListItem({ className, icon, children, onAction }: Props) {
  return (
    <div className={cn("h-stack items-center gap-3 p-3", className?.root)}>
      {icon && <div className={cn("shrink-0", className?.icon)}>{icon}</div>}
      <div className={cn("grow min-w-0", className?.content)}>{children}</div>
      {onAction && (
        <button
          className={cn("shrink-0", className?.action)}
          onClick={onAction}
        >
          Action
        </button>
      )}
    </div>
  );
}
```

## When to Use Which

| Scenario                          | Type                   |
| --------------------------------- | ---------------------- |
| Single wrapper element            | `ClassName`            |
| Component with internal structure | `ClassNameRecord<...>` |
| Forwarding to child component     | Match child's type     |

---

> Rule: `color-schemes` — impact **MEDIUM**


# Working with Color Schemes

Use class-based color schemes (`light`, `dark`, `system`) with a custom Tailwind `dark` variant.

## Why

- No flash of incorrect scheme on first paint
- Works with system preference and explicit user choice
- Keeps styles consistent with `dark:` utilities

## Tailwind Setup

Override the `dark` variant to support `.dark` and `.system` classes:

## Pattern

```css
@custom-variant dark {
  &:where(.dark *, .dark) {
    @slot;
  }

  &:where(.system *, .system) {
    @media (prefers-color-scheme: dark) {
      @slot;
    }
  }
}
```

## Usage

```tsx
// Base styles
<button className="rounded-full bg-gray-900 px-4 py-2 text-white dark:bg-gray-100 dark:text-gray-900">
  Toggle
</button>
```

Apply `light`, `dark`, or `system` on the root element and Tailwind will resolve `dark:` based on the class.

---

> Rule: `layout-prefer-gaps` — impact **HIGH**


# Prefer Gaps Over Margins

Use `gap-*` on the parent container instead of `m-*`/`mt-*` on children when spacing siblings.

## Why

- Parent controls layout; children stay reusable
- Avoids margins inside components that break encapsulation
- No “last item” exceptions or conditional class logic
- Easier to switch layout direction at breakpoints
- Avoids margin-collapsing surprises

## Pattern

```tsx
// Bad: child margins, special-case last item
<div>
  {items.map((item, index) => (
    <Item
      key={item.id}
      className={index === items.length - 1 ? "" : "mb-4"}
    />
  ))}
</div>

// Good: parent gap controls spacing
<div className="flex flex-col gap-4">
  {items.map((item) => (
    <Item key={item.id} />
  ))}
</div>
```

## Component Encapsulation

Avoid margins inside components. Instead, let parents decide spacing:

```tsx
// Bad: component defines its own spacing
function Card() {
  return <div className="mb-4 rounded-lg border p-4" />;
}

// Good: parent controls spacing
function Card() {
  return <div className="rounded-lg border p-4" />;
}

<div className="v-stack gap-4">
  <Card />
  <Card />
</div>
```

## Responsive Layouts

```tsx
// Switch direction without touching children
<div className="flex flex-col gap-4 md:flex-row">
  <Item />
  <Item />
  <Item />
</div>
```

## Rules

1. Use `gap-*` for spacing between siblings in flex/grid
2. Avoid margins inside components; let parents control spacing
3. Keep margins for one-off external offsets only
4. Prefer `gap-*` for lists, stacks, and repeating content

---

> Rule: `layout-responsive-stacks` — impact **MEDIUM**


# Responsive Stack Layouts

Switch layout direction at breakpoints using stack utilities with responsive prefixes.

## Why

- Common pattern for mobile-first layouts
- Sidebar layouts that stack on mobile
- Card grids that become lists on mobile

## Pattern

```tsx
// Mobile: vertical, Desktop: horizontal
<div className="v-stack lg:h-stack gap-4">
  <main className="grow">Main content</main>
  <aside className="shrink-0 lg:w-80">Sidebar</aside>
</div>
```

## Common Layouts

### Page with Sidebar

```tsx
<div className="v-stack lg:h-stack gap-6">
  <main className="grow v-stack gap-4">{/* Main content */}</main>
  <aside className="shrink-0 w-full lg:max-w-xs v-stack gap-4">
    {/* Sidebar content */}
  </aside>
</div>
```

### Card Grid to List

```tsx
// Grid on desktop, stack on mobile
<div className="v-stack md:h-stack md:flex-wrap gap-4">
  {items.map(item => (
    <Card key={item.id} className="md:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)]" />
  ))}
</div>

// Or use CSS grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Header Navigation

```tsx
<header className="h-stack items-center justify-between">
  <Logo />

  {/* Desktop nav */}
  <nav className="h-stack gap-4 max-md:hidden">
    <Link to="/about">About</Link>
    <Link to="/contact">Contact</Link>
  </nav>

  {/* Mobile menu button */}
  <button className="md:hidden">
    <MenuIcon />
  </button>
</header>
```

### Form Layout

```tsx
// Side-by-side on desktop, stacked on mobile
<div className="v-stack md:h-stack gap-4">
  <Input label="First Name" className="md:w-1/2" />
  <Input label="Last Name" className="md:w-1/2" />
</div>
```

## Reverse on Breakpoint

```tsx
// Normal order on mobile, reversed on desktop
<div className="v-stack lg:h-stack-reverse">
  <Content /> {/* First on mobile, second on desktop */}
  <Sidebar /> {/* Second on mobile, first on desktop */}
</div>
```

## With Grow and Shrink

```tsx
<div className="v-stack lg:h-stack gap-4">
  {/* Takes remaining space */}
  <div className="grow min-w-0">
    <Content />
  </div>

  {/* Fixed width, doesn't shrink */}
  <div className="shrink-0 lg:w-64">
    <Sidebar />
  </div>
</div>
```

---

> Rule: `layout-stack-utilities` — impact **CRITICAL**


# Stack Layout Utilities

Use custom stack utilities instead of raw flex classes.

## Why

- More semantic and readable
- Consistent across codebase
- Shorter class names
- Defined in tailwind.config.js

## Stack Classes

| Class             | Equivalent                            | Description                |
| ----------------- | ------------------------------------- | -------------------------- |
| `v-stack`         | `flex flex-col`                       | Vertical stack             |
| `h-stack`         | `flex flex-row`                       | Horizontal stack           |
| `v-stack-reverse` | `flex flex-col-reverse`               | Reversed vertical          |
| `h-stack-reverse` | `flex flex-row-reverse`               | Reversed horizontal        |
| `z-stack`         | Grid overlay                          | Overlapping centered stack |
| `center`          | `flex items-center justify-center`    | Center both axes           |
| `spacer`          | `flex-1`                              | Flexible space filler      |
| `circle`          | `aspect-square rounded-full shrink-0` | Perfect circle             |

## Utility Definitions

```css
@utility v-stack {
  display: flex;
  flex-direction: column;
}

@utility v-stack-reverse {
  display: flex;
  flex-direction: column-reverse;
}

@utility h-stack {
  display: flex;
  flex-direction: row;
}

@utility h-stack-reverse {
  display: flex;
  flex-direction: row-reverse;
}

@utility z-stack {
  display: grid;
  align-items: center;
  justify-items: center;

  & > * {
    grid-area: 1 / 1 / 1 / 2;
  }
}

@utility center {
  display: flex;
  justify-content: center;
  align-items: center;
}

@utility spacer {
  flex: 1 1 auto;
}

@utility circle {
  aspect-ratio: 1 / 1;
  border-radius: 9999px;
  flex-shrink: 0;
}
```

## Pattern

```tsx
// Bad
<div className="flex flex-col gap-4">
  <header className="flex flex-row items-center justify-between">
  <main className="flex-1">
  <footer>
</div>

// Good
<div className="v-stack gap-4">
  <header className="h-stack items-center justify-between">
  <main className="spacer">
  <footer>
</div>
```

## z-stack for Overlays

Stack elements on top of each other, centered:

```tsx
// Avatar with status indicator
<div className="z-stack">
  <img src={avatar} className="size-12 circle" />
  <div className="size-3 circle bg-success-500 self-end justify-self-end" />
</div>

// Image with overlay text
<div className="z-stack">
  <img src={background} />
  <h2 className="text-white text-2xl">Overlay Title</h2>
</div>
```

## Combining with Gap

```tsx
<div className="v-stack gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

<div className="h-stack gap-2 items-center">
  <Icon />
  <span>Label</span>
</div>
```

## Combining with Alignment

```tsx
// Vertical stack, horizontally centered
<div className="v-stack items-center gap-4">

// Horizontal stack, vertically centered
<div className="h-stack items-center gap-2">

// Horizontal stack, space between
<div className="h-stack items-center justify-between">
```

## Center Utility

```tsx
// Center content in container
<div className="center h-screen">
  <div>Centered content</div>
</div>

// Center icon in button
<button className="center size-10 rounded-full bg-teal-500">
  <Icon />
</button>
```

## Spacer Utility

Push elements apart:

```tsx
<header className="h-stack items-center px-4">
  <Logo />
  <spacer className="spacer" />
  <UserMenu />
</header>

// Or use a div
<div className="h-stack">
  <div>Left</div>
  <div className="spacer" />
  <div>Right</div>
</div>
```

---

> Rule: `responsive-breakpoints` — impact **MEDIUM**


# Responsive Breakpoints

Use responsive prefixes for mobile-first design with Tailwind defaults.

## Available Breakpoints

### Standard (min-width)

| Prefix | Min Width | Description                  |
| ------ | --------- | ---------------------------- |
| `sm:`  | 640px     | Large phones / small tablets |
| `md:`  | 768px     | Tablets                      |
| `lg:`  | 1024px    | Small laptops                |
| `xl:`  | 1280px    | Desktops                     |
| `2xl:` | 1536px    | Extra large screens          |

## Pattern

```tsx
// Mobile-first: base is mobile, add for larger
<div className="px-4 md:px-8 lg:px-15">

// Hide/show with standard breakpoints
<div className="hidden md:block">Desktop only</div>
<div className="md:hidden">Mobile only</div>
```

## Common Responsive Patterns

### Show/Hide Elements

```tsx
// Desktop navigation (hidden on mobile)
<nav className="hidden lg:flex h-stack gap-4">

// Mobile menu button (hidden on desktop)
<button className="lg:hidden">
  <MenuIcon />
</button>

// Show different content per breakpoint
<span className="md:hidden">Mobile text</span>
<span className="hidden md:inline">Desktop text</span>
```

### Responsive Spacing

```tsx
// Padding that increases at breakpoints
<div className="p-4 md:p-6 lg:p-8 xl:p-12">

// Gap that increases
<div className="v-stack gap-4 md:gap-6 lg:gap-8">

// Margin that changes
<section className="mt-8 md:mt-12 lg:mt-16">
```

### Responsive Sizing

```tsx
// Width changes at breakpoints
<aside className="w-full md:w-64 lg:w-80">

// Max-width increases
<div className="max-w-sm md:max-w-md lg:max-w-lg">

// Container width
<div className="w-full px-4 md:px-8 lg:max-w-6xl lg:mx-auto">
```

### Responsive Grid

```tsx
// 1 column mobile, 2 tablet, 3 desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Different gap per breakpoint
<div className="grid grid-cols-2 gap-2 md:gap-4 lg:gap-6">
```

### Responsive Typography

```tsx
// Font size increases
<h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl">

// Line height changes with size
<p className="text-sm leading-5 md:text-base md:leading-6 lg:text-lg lg:leading-7">
```

## Combining Breakpoints

```tsx
// Complex responsive behavior
<div className={cn(
  "v-stack gap-4",           // Base: vertical stack
  "md:h-stack md:gap-6",     // Medium+: horizontal
  "lg:gap-8",                // Large+: bigger gap
  "sm:p-4",                  // Small+: padding
)}>
```

## Testing Breakpoints

When testing responsive designs:

- sm: 640px
- md: 768px (iPad portrait)
- lg: 1024px (iPad landscape, small laptops)
- xl: 1280px (standard desktop)

---

> Rule: `responsive-capabilities` — impact **MEDIUM**


# Design for Capabilities, Not Device Labels

Target input capabilities (pointer, hover) and viewport ranges instead of assuming “mobile” or “desktop.”

## Why

- Many devices support both touch and mouse
- Screen size doesn’t equal input capability
- Capability-based styles age better than device lists

## Pattern

Use pointer/hover variants to adjust targets and affordances:

```tsx
// Larger targets on coarse pointers (touch)
<button className="h-10 w-10 pointer-coarse:h-12 pointer-coarse:w-12">
  <Icon />
</button>

// Hover effects only when hover is supported
<button className="bg-gray-900 text-white hover:bg-gray-800">
  Primary
</button>
```

Use breakpoints for layout clusters, not specific devices:

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {items.map((item) => (
    <Card key={item.id} />
  ))}
</div>
```

## Rules

1. Avoid “mobile vs desktop” assumptions in UI behavior
2. Use `pointer-coarse`/`pointer-fine` for target sizes
3. Keep hover-only affordances behind hover-capable variants
4. Place breakpoints in layout clusters, not exact device widths

---

> Rule: `responsive-text` — impact **MEDIUM**


# Responsive Typography

Scale text sizes responsively across breakpoints.

## Why

- Larger screens can accommodate larger text
- Improves readability at different distances
- Maintains visual hierarchy across devices

## Pattern

```tsx
// Heading that scales
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">

// Body text that scales
<p className="text-sm md:text-base lg:text-lg">
```

## Font Scale Reference

| Class       | Size | Usage                       |
| ----------- | ---- | --------------------------- |
| `text-xs`   | 12px | Captions, labels            |
| `text-sm`   | 14px | Secondary text, mobile body |
| `text-base` | 16px | Body text                   |
| `text-lg`   | 18px | Large body, subheadings     |
| `text-xl`   | 20px | Small headings              |
| `text-2xl`  | 24px | Section headings            |
| `text-3xl`  | 30px | Page headings               |
| `text-4xl`  | 36px | Hero headings               |

## Common Patterns

### Page Title

```tsx
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-neutral-900">
  Page Title
</h1>
```

### Section Heading

```tsx
<h2 className="text-xl md:text-2xl font-semibold text-neutral-900">
  Section Title
</h2>
```

### Card Title

```tsx
<h3 className="text-lg md:text-xl font-medium text-neutral-900">Card Title</h3>
```

### Body Text

```tsx
<p className="text-sm md:text-base text-neutral-600 leading-relaxed">
  Body content that's readable on all devices.
</p>
```

### Small Text / Captions

```tsx
<span className="text-xs md:text-sm text-neutral-500">Updated 2 hours ago</span>
```

## Line Height with Text Size

When text size changes, line height often needs adjustment:

```tsx
// Explicit line height per breakpoint
<p className="text-sm leading-5 md:text-base md:leading-6 lg:text-lg lg:leading-7">

// Or use relative line heights
<p className="text-sm md:text-base lg:text-lg leading-relaxed">
```

## Font Weight with Size

Larger text often needs different weight:

```tsx
// Hero text: larger = lighter weight acceptable
<h1 className="text-3xl font-bold md:text-4xl md:font-semibold">

// Keep it simple when possible
<h1 className="text-2xl md:text-4xl font-bold">
```

## Truncation

```tsx
// Single line truncation
<p className="truncate">Long text that will be truncated...</p>

// Multi-line clamp
<p className="line-clamp-2 md:line-clamp-3">
  Text clamped to 2 lines on mobile, 3 on tablet+
</p>
```

## Anti-Patterns

```tsx
// Bad: hardcoded pixels
<p style={{ fontSize: "14px" }}>

// Bad: too many breakpoint changes
<p className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">

// Good: 2-3 breakpoints max
<p className="text-sm md:text-base lg:text-lg">
```
