---
name: accessibility
description: Accessibility (a11y) best practices for React components. Use when creating UI components, forms, interactive elements, or reviewing code for accessibility compliance.
---


# Accessibility Best Practices

Accessibility patterns for building inclusive React applications following WCAG standards. Contains 7 rules across 4 categories focused on semantic HTML, screen reader support, keyboard navigation, and user preferences.

## When to Apply

Reference these guidelines when:

- Creating new UI components
- Building forms and interactive elements
- Adding dynamic content or notifications
- Implementing navigation patterns
- Reviewing code for accessibility

## Rules Summary

### Semantic HTML & Structure (HIGH)

#### semantic-html-landmarks - @rules/semantic-html-landmarks.md

Use semantic HTML elements for page structure.

```tsx
// Bad: divs with class names
<div className="header">...</div>
<div className="nav">...</div>
<div className="content">...</div>

// Good: semantic elements
<header>...</header>
<nav aria-label={t("Primary")}>...</nav>
<main>...</main>
<footer>...</footer>
```

### Screen Readers (MEDIUM)

#### screen-reader-sr-only - @rules/screen-reader-sr-only.md

Use sr-only class for visually hidden text.

```tsx
// Icon-only buttons need accessible labels
<Button variant="icon" onPress={onClose}>
  <XMarkIcon aria-hidden="true" />
  <span className="sr-only">{t("Close")}</span>
</Button>

// Visually hidden section headings
<section>
  <h2 className="sr-only">{t("Search results")}</h2>
  <SearchResultsList />
</section>
```

#### aria-live-regions - @rules/aria-live-regions.md

Announce dynamic content changes to screen readers.

```tsx
// Error messages - announced immediately
{
  error && (
    <p role="alert" className="text-failure-600">
      {error}
    </p>
  );
}

// Status updates - announced politely
<div role="status" aria-live="polite">
  {t("{{count}} results found", { count })}
</div>;
```

### Keyboard & Focus (HIGH)

#### keyboard-navigation - @rules/keyboard-navigation.md

Use semantic elements for built-in keyboard support.

```tsx
// Bad: div with onClick not keyboard accessible
<div onClick={handleClick}>Click me</div>

// Good: button has Enter/Space support
<button onClick={handleClick}>Click me</button>

// Good: react-aria Button handles everything
import { Button } from "react-aria-components";
<Button onPress={handlePress}>Click me</Button>
```

#### focus-management - @rules/focus-management.md

Show visible focus indicators and trap focus in modals.

```tsx
// Always use focus-visible for focus styles
<button className="focus-visible:ring-2 focus-visible:ring-teal-600">
  Click me
</button>;

// react-aria Modal handles focus trapping automatically
import { Modal, Dialog } from "react-aria-components";
<Modal isOpen={isOpen}>
  <Dialog>{/* Focus automatically trapped here */}</Dialog>
</Modal>;
```

### User Preferences (MEDIUM)

#### reduced-motion - @rules/reduced-motion.md

Respect prefers-reduced-motion setting.

```tsx
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";

// CSS approach
<div className="animate-bounce motion-reduce:animate-none">
  Bouncing content
</div>;

// JS approach
function AnimatedCounter({ value }) {
  let prefersReducedMotion = usePrefersReducedMotion();
  if (prefersReducedMotion) return <span>{value}</span>;
  return <CountUp target={value} />;
}
```

#### touch-targets - @rules/touch-targets.md

Ensure 44x44px minimum touch targets.

```tsx
// Icon buttons need explicit sizing
<Button variant="icon" className="h-11 w-11">
  <XMarkIcon className="h-5 w-5" />
  <span className="sr-only">{t("Close")}</span>
</Button>

// Links need padding for tappable area
<Link to={href} className="block py-3 px-4">
  {label}
</Link>
```

## Key Files

- `app/components/heading.tsx` - Region, Heading, Main components
- `app/hooks/use-prefers-reduced-motion.ts` - Reduced motion hook
- `app/components/field/field.tsx` - Accessible form field component

---

# Rules — chi tiết đầy đủ


# frontend-accessibility-best-practices — rules (7)

File con cua [`frontend-accessibility-best-practices.md`](./frontend-accessibility-best-practices.md). Moi rule mot muc, mo dau bang `> Rule:`.

---

> Rule: `aria-live-regions` — impact **HIGH**


# ARIA Live Regions

Use ARIA live regions to announce dynamic content changes to screen readers.

## Why

Screen readers don't automatically announce content that changes after page load. Live regions tell assistive technology to announce updates.

## Live Region Types

| Attribute               | When to Use                                              |
| ----------------------- | -------------------------------------------------------- |
| `aria-live="polite"`    | Non-urgent updates, wait for user to finish current task |
| `aria-live="assertive"` | Urgent updates that interrupt the user (use sparingly)   |
| `role="status"`         | Status messages (implicitly `aria-live="polite"`)        |
| `role="alert"`          | Error messages (implicitly `aria-live="assertive"`)      |

## Common Use Cases

### Form Validation Errors

```tsx
// Error container - announced immediately
{
  error && (
    <p role="alert" className="text-failure-600">
      {error}
    </p>
  );
}
```

### Loading States

```tsx
// Status updates - announced politely
<div role="status" aria-live="polite">
  {isLoading ? t("Loading...") : t("Loaded {{count}} results", { count })}
</div>
```

### Toast Notifications

```tsx
function Toast({ message, variant }: ToastProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      {message}
    </div>
  );
}
```

### Search Results Count

```tsx
<Region>
  <Heading className="sr-only">{t("Search results")}</Heading>
  <p role="status" aria-live="polite">
    {t("{{count}} results found", { count: results.length })}
  </p>
  <ResultsList results={results} />
</Region>
```

### Form Submission Status

```tsx
function SubmitButton({ isSubmitting, isSuccess }: Props) {
  return (
    <>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t("Saving...") : t("Save")}
      </Button>
      <div role="status" aria-live="polite" className="sr-only">
        {isSubmitting && t("Saving your changes...")}
        {isSuccess && t("Changes saved successfully")}
      </div>
    </>
  );
}
```

## Bad Patterns

### Missing Live Region for Dynamic Content

```tsx
// Bad - screen reader won't announce this
function SearchResults({ results }) {
  return (
    <div>
      <p>{results.length} results</p>
      {results.map((r) => (
        <Result key={r.id} {...r} />
      ))}
    </div>
  );
}

// Good - announced to screen readers
function SearchResults({ results }) {
  return (
    <div>
      <p role="status" aria-live="polite">
        {t("{{count}} results", { count: results.length })}
      </p>
      {results.map((r) => (
        <Result key={r.id} {...r} />
      ))}
    </div>
  );
}
```

### Overusing assertive

```tsx
// Bad - every update interrupts the user
<div aria-live="assertive">
  {t("{{count}} items in cart", { count })}
</div>

// Good - polite for non-urgent updates
<div aria-live="polite">
  {t("{{count}} items in cart", { count })}
</div>
```

## Rules

1. Use `role="alert"` for error messages that need immediate attention
2. Use `role="status"` or `aria-live="polite"` for non-urgent updates
3. Keep announcements concise - don't announce entire paragraphs
4. The live region must exist in the DOM before content changes
5. Use `assertive` sparingly - only for critical, time-sensitive information
6. Consider combining with `sr-only` for announcements that don't need visual display

---

> Rule: `focus-management` — impact **HIGH**


# Focus Management

Manage focus visibility and trapping for keyboard users.

## Focus Visibility

Always show a visible focus indicator for keyboard users.

### Use focus-visible

The `focus-visible` pseudo-class shows focus only for keyboard navigation, not mouse clicks:

```tsx
// Good - focus ring only shows for keyboard users
<button className="focus-visible:ring-2 focus-visible:ring-teal-600">
  Click me
</button>

// With react-aria data attributes
<Button className="data-[focus-visible]:ring-2 data-[focus-visible]:ring-teal-600">
  Click me
</Button>
```

### Bad - Removing Focus Outlines

```tsx
// Bad - removes focus indicator entirely
<button className="focus:outline-none">Click me</button>

// Bad - outline:none without replacement
button:focus {
  outline: none;
}
```

### Good - Custom Focus Styles

```tsx
// Good - custom focus style that's still visible
<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">
  Click me
</button>
```

## Focus Trapping

Trap focus within modals and dialogs so keyboard users can't Tab out.

### React Aria Handles This

Modal and Dialog from react-aria-components automatically trap focus:

```tsx
import { Modal, Dialog } from "react-aria-components";

function MyModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Dialog>
        {/* Focus is automatically trapped here */}
        <Heading slot="title">Modal Title</Heading>
        <p>Modal content...</p>
        <Button onPress={onClose}>Close</Button>
      </Dialog>
    </Modal>
  );
}
```

### Manual Focus Trapping

If not using react-aria, implement focus trapping:

```tsx
import { useFocusTrap } from "@mantine/hooks"; // or similar

function Modal({ children, onClose }) {
  let focusTrapRef = useFocusTrap();

  return (
    <div ref={focusTrapRef} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}
```

## Focus Restoration

Return focus to the trigger element when a modal closes:

```tsx
// react-aria handles this automatically
<DialogTrigger>
  <Button>Open Dialog</Button>
  <Modal>
    <Dialog>{/* When closed, focus returns to the trigger button */}</Dialog>
  </Modal>
</DialogTrigger>
```

## Programmatic Focus

Move focus to important content:

```tsx
function SearchResults({ results, error }) {
  let errorRef = useRef<HTMLDivElement>(null);
  let resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    } else if (results.length > 0) {
      resultsRef.current?.focus();
    }
  }, [error, results]);

  return (
    <>
      {error && (
        <div ref={errorRef} tabIndex={-1} role="alert">
          {error}
        </div>
      )}
      <div ref={resultsRef} tabIndex={-1}>
        {/* Results */}
      </div>
    </>
  );
}
```

## Skip Links

Add skip links for keyboard users to bypass navigation:

```tsx
function Layout({ children }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:p-4"
      >
        {t("Skip to main content")}
      </a>
      <Header />
      <Main id="main-content">{children}</Main>
    </>
  );
}
```

## Rules

1. Never remove focus outlines without providing an alternative
2. Use `focus-visible:` for focus styles (not `focus:`)
3. Use react-aria-components for modals/dialogs - they handle focus trapping
4. Return focus to trigger element when closing modals
5. Use `tabIndex={-1}` for elements that receive programmatic focus
6. Consider adding skip links for pages with significant navigation
7. Test focus management by navigating with Tab and Shift+Tab

---

> Rule: `keyboard-navigation` — impact **HIGH**


# Keyboard Navigation

All interactive elements must be accessible via keyboard.

## Why

- Users with motor disabilities may use keyboard only
- Screen reader users navigate with keyboard
- Power users prefer keyboard shortcuts

## Native Keyboard Support

Use semantic HTML elements that have built-in keyboard support:

| Element    | Keyboard Behavior              |
| ---------- | ------------------------------ |
| `<button>` | Enter/Space to activate        |
| `<a href>` | Enter to follow link           |
| `<input>`  | Tab to focus, type to input    |
| `<select>` | Arrow keys to navigate options |

## Bad - Non-interactive Elements as Buttons

```tsx
// Bad - div is not keyboard accessible
<div onClick={handleClick} className="cursor-pointer">
  Click me
</div>

// Bad - span with click handler
<span onClick={handleClick}>Action</span>
```

## Good - Semantic Elements

```tsx
// Good - button is keyboard accessible
<button onClick={handleClick}>Click me</button>;

// Good - Button component from react-aria
import { Button } from "react-aria-components";
<Button onPress={handlePress}>Click me</Button>;
```

## When You Must Use Non-Semantic Elements

If you absolutely must use a non-semantic element, add keyboard support:

```tsx
// Only when semantic elements aren't possible
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Click me
</div>
```

But prefer using react-aria-components which handles this:

```tsx
import { Button } from "react-aria-components";

// Renders as <div> but with full keyboard support
<Button onPress={handlePress}>Click me</Button>;
```

## Tab Order

### Natural Tab Order

Elements are focused in DOM order. Structure your HTML logically:

```tsx
// Good - logical order matches visual order
<form>
  <input name="firstName" />
  <input name="lastName" />
  <input name="email" />
  <button type="submit">Submit</button>
</form>
```

### Avoid Positive tabIndex

```tsx
// Bad - arbitrary tab order is confusing
<input tabIndex={2} />
<input tabIndex={1} />
<input tabIndex={3} />

// Good - let DOM order determine tab order
<input />
<input />
<input />
```

### Remove from Tab Order

Use `tabIndex={-1}` for elements that should be focusable programmatically but not via Tab:

```tsx
// Programmatically focusable, not in tab order
<div tabIndex={-1} ref={errorRef}>
  {error}
</div>

// Later: errorRef.current?.focus()
```

## Keyboard Shortcuts

For custom shortcuts, use react-aria hooks:

```tsx
import { useKeyboard } from "react-aria";

function SearchInput() {
  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      if (e.key === "Escape") {
        clearSearch();
      }
    },
  });

  return <input {...keyboardProps} />;
}
```

## Rules

1. Use `<button>` for actions, `<a>` for navigation
2. Never use `div` or `span` with `onClick` without keyboard support
3. Prefer react-aria-components for complex interactive widgets
4. Don't use positive `tabIndex` values
5. Use `tabIndex={-1}` for programmatic focus targets
6. Ensure all interactive elements are reachable via Tab key
7. Test keyboard navigation by unplugging your mouse

---

> Rule: `reduced-motion` — impact **MEDIUM**


# Respect Reduced Motion Preference

Honor the user's `prefers-reduced-motion` setting to avoid triggering vestibular disorders.

## Why

- Some users experience motion sickness, dizziness, or seizures from animations
- Users explicitly request reduced motion in system preferences
- Respecting this preference is a WCAG 2.1 requirement (2.3.3)

## CSS Approach

Use the `motion-reduce` Tailwind variant:

```tsx
// Animation only plays if user hasn't requested reduced motion
<div className="animate-bounce motion-reduce:animate-none">
  Bouncing content
</div>

// Reduce transition duration
<div className="transition-all duration-300 motion-reduce:duration-0">
  Transitioning content
</div>
```

Or use CSS media query directly:

```css
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    animation: none;
    transition: none;
  }
}
```

## JavaScript Approach

Use the `usePrefersReducedMotion` hook:

```tsx
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";

function AnimatedCounter({ value }) {
  let prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    // Show static value immediately
    return <span>{value}</span>;
  }

  // Show animated count-up
  return <CountUp target={value} duration={1000} />;
}
```

### Hook Usage

```tsx
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";

function CarouselControls() {
  let prefersReducedMotion = usePrefersReducedMotion();

  // Disable auto-play for reduced motion users
  let [isAutoPlaying, setIsAutoPlaying] = useState(!prefersReducedMotion);

  return (
    <Carousel autoPlay={isAutoPlaying && !prefersReducedMotion}>
      {/* slides */}
    </Carousel>
  );
}
```

## What to Reduce

### Should Respect Reduced Motion

- Decorative animations (floating elements, parallax)
- Auto-playing carousels and slideshows
- Animated backgrounds
- Page transition animations
- Count-up number animations
- Infinite scrolling marquees

### Can Keep (Essential Motion)

- Loading spinners (but keep them simple)
- Progress indicators
- Button hover states (if subtle)
- Form validation feedback
- Focus ring transitions (keep very short)

## Bad

```tsx
// Bad - no reduced motion consideration
function Banner() {
  return (
    <div className="animate-pulse">
      <FloatingParticles />
      <ParallaxBackground />
    </div>
  );
}
```

## Good

```tsx
function Banner() {
  let prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="motion-reduce:animate-none animate-pulse">
      {!prefersReducedMotion && <FloatingParticles />}
      <StaticBackground />
    </div>
  );
}
```

## Rules

1. Use `motion-reduce:` Tailwind variant for CSS animations
2. Use `usePrefersReducedMotion` hook for JS-controlled animations
3. Disable auto-playing content for reduced motion users
4. Keep essential motion (loading indicators) but simplify them
5. Never use animations that flash or strobe rapidly
6. Provide static alternatives for decorative animations

---

> Rule: `screen-reader-sr-only` — impact **MEDIUM**


# Screen Reader Only Text (sr-only)

Use the `sr-only` class to provide text for screen readers that is visually hidden.

## Why

- Icon-only buttons need text labels for screen readers
- Visual context (like icons, colors) needs text alternatives
- Some content is clear visually but needs explanation for screen readers

## The sr-only Class

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

## Common Use Cases

### Icon-Only Buttons

```tsx
// Bad - no accessible name
<Button variant="icon" onPress={onClose}>
  <XMarkIcon />
</Button>

// Good - sr-only provides the name
<Button variant="icon" onPress={onClose}>
  <XMarkIcon aria-hidden="true" />
  <span className="sr-only">{t("Close")}</span>
</Button>

// Also good - aria-label
<Button variant="icon" onPress={onClose} aria-label={t("Close")}>
  <XMarkIcon aria-hidden="true" />
</Button>
```

### Visual-Only Table Headers

```tsx
<table>
  <thead className="sr-only">
    <tr>
      <th>{t("Item name")}</th>
      <th>{t("Amount")}</th>
      <th>{t("Date")}</th>
    </tr>
  </thead>
  <tbody>{/* Visual rows with no visible headers */}</tbody>
</table>
```

### Section Headings for Screen Reader Navigation

```tsx
import { Region, Heading } from "~/components/heading";

<Region>
  <Heading className="sr-only">{t("Search results")}</Heading>
  <SearchResultsList />
</Region>;
```

### Currency/Unit Indicators

```tsx
<span className="sr-only" id="currency">{t("Currency USD")}</span>
<input type="number" aria-describedby="currency" />
```

### Contextual Information

```tsx
// Badge that's visually clear but needs context
<Badge variant="success">
  <CheckIcon aria-hidden="true" />
  <span className="sr-only">{t("Status:")}</span>
  {t("Approved")}
</Badge>
```

## When NOT to Use sr-only

### Don't Hide Important Content

```tsx
// Bad - hiding content that should be visible
<Button>
  <span className="sr-only">{t("Submit form")}</span>
</Button>

// Good - visible text
<Button>{t("Submit")}</Button>
```

### Don't Duplicate Visible Text

```tsx
// Bad - redundant
<Button>
  {t("Submit")}
  <span className="sr-only">{t("Submit")}</span>
</Button>

// Good - just the visible text
<Button>{t("Submit")}</Button>
```

## Rules

1. Use `sr-only` for text that provides context missing from visual presentation
2. Always add `aria-hidden="true"` to decorative icons
3. Every interactive element must have an accessible name (visible text, sr-only, or aria-label)
4. Don't use sr-only to hide content that should be visible to all users
5. Don't duplicate visible text with sr-only text

---

> Rule: `semantic-html-landmarks` — impact **HIGH**


# Use Semantic HTML Landmarks

Use semantic HTML elements to create page landmarks that screen readers can navigate.

## Why

- Screen reader users can jump between landmarks (main, nav, header, footer)
- Provides document outline without relying on visual layout
- Better SEO and machine readability

## Landmark Elements

| Element     | Purpose                      | ARIA Role                      |
| ----------- | ---------------------------- | ------------------------------ |
| `<main>`    | Primary page content         | `main`                         |
| `<nav>`     | Navigation links             | `navigation`                   |
| `<header>`  | Introductory content         | `banner` (when top-level)      |
| `<footer>`  | Footer content               | `contentinfo` (when top-level) |
| `<aside>`   | Tangentially related content | `complementary`                |
| `<section>` | Thematic grouping            | `region` (when labeled)        |
| `<article>` | Self-contained content       | `article`                      |

## Bad

```tsx
// Generic divs provide no semantic meaning
function Page() {
  return (
    <div className="page">
      <div className="header">...</div>
      <div className="sidebar">...</div>
      <div className="content">...</div>
      <div className="footer">...</div>
    </div>
  );
}
```

## Good

```tsx
import { Main } from "~/components/heading";

function Page() {
  return (
    <>
      <header>
        <nav aria-label={t("Primary")}>...</nav>
      </header>

      <Main>
        <article>...</article>
        <aside>...</aside>
      </Main>

      <footer>...</footer>
    </>
  );
}
```

## Multiple Navigation Regions

When you have multiple `<nav>` elements, label them:

```tsx
<header>
  <nav aria-label={t("Primary site")}>
    {/* Main navigation */}
  </nav>
</header>

<aside>
  <nav aria-label={t("Table of contents")}>
    {/* Page navigation */}
  </nav>
</aside>

<footer>
  <nav aria-label={t("Footer")}>
    {/* Footer links */}
  </nav>
</footer>
```

## Rules

1. Every page should have exactly one `<main>` element (use `Main` component)
2. Use `<header>` for page/section headers, not just `<div className="header">`
3. Use `<nav>` for navigation, always with `aria-label` when multiple exist
4. Use `<footer>` for page/section footers
5. Use `<article>` for self-contained content (blog posts, cards, comments)
6. Use `<aside>` for sidebars, related content, or call-outs
7. Use `<section>` with Region component for labeled content sections

---

> Rule: `touch-targets` — impact **MEDIUM**


# Touch Target Sizes

Ensure interactive elements have sufficient target size and spacing across input types.

## Why

- Users with motor impairments need larger tap targets
- Fat finger problem on mobile devices
- WCAG 2.5.5 recommends 44x44px for AAA; WCAG 2.5.8 allows 24x24px minimum if spaced
- Touch targets need spacing to avoid accidental taps

## Minimum Sizes

| Level    | Minimum Size | Use Case                          |
| -------- | ------------ | --------------------------------- |
| WCAG AA  | 24x24px      | Minimum if targets don't overlap  |
| WCAG AAA | 44x44px      | Recommended for all touch targets |
| iOS HIG  | 44x44pt      | Apple's recommendation            |
| Material | 48x48dp      | Google's recommendation           |

## Implementation

### Buttons

```tsx
// Good - explicit minimum size
<Button className="min-h-11 min-w-11 px-4 py-2">
  {t("Submit")}
</Button>

// Icon buttons need explicit sizing
<Button variant="icon" className="h-11 w-11">
  <XMarkIcon className="h-5 w-5" />
  <span className="sr-only">{t("Close")}</span>
</Button>
```

### Links in Lists

```tsx
// Good - padding on the link (target) itself
<nav>
  {links.map((link) => (
    <Link key={link.href} to={link.href} className="block px-4 py-3">
      {link.label}
    </Link>
  ))}
</nav>
```

### Checkboxes and Radios

```tsx
// Good - label wraps input for larger tap area
<label className="flex items-center gap-3 py-2 cursor-pointer">
  <input type="checkbox" className="h-5 w-5" />
  <span>{t("Accept terms")}</span>
</label>
```

## Common Issues

### Too Small or Too Close

```tsx
// Bad - icon button too small
<button className="h-6 w-6">
  <XIcon className="h-4 w-4" />
</button>

// Bad - links too close together
<div className="flex gap-1">
  <a href="/a">A</a>
  <a href="/b">B</a>
  <a href="/c">C</a>
</div>
```

### Adequate Spacing

```tsx
// Good - adequate spacing between targets
<div className="flex gap-4">
  <Button>Option A</Button>
  <Button>Option B</Button>
  <Button>Option C</Button>
</div>
```

## Expanding Target Area

Make the clickable area larger than the visible element:

```tsx
// Technique 1: Padding on the target
<button className="p-3">
  <SmallIcon />
</button>

// Technique 2: Pseudo-element (in CSS)
.small-button {
  position: relative;
}
.small-button::before {
  content: "";
  position: absolute;
  inset: -8px; /* Expands clickable area */
}
```

## Spacing and Context

- Small targets need more spacing between them
- Large targets can sit closer without overlap
- Inline links rely on line height; increase `leading` for readability

## Rules

1. Aim for 44x44px targets; allow 24x24px only with sufficient spacing
2. Increase spacing when targets are small or dense
3. Apply padding to the clickable element itself
4. Icon-only buttons need explicit size (min 44x44)
5. Avoid dead zones between related targets
6. Test on real touch devices, not just DevTools
