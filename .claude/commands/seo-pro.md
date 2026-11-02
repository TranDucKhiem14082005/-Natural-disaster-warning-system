---
name: seo-pro
description: Universal SEO engine for ANY website or web app — audit, content, and AI-search (GEO/AEO) optimization in one skill. Use when the user asks to audit SEO, improve rankings, write SEO-optimized content or meta/schema, fix crawlability/indexability/Core Web Vitals, optimize to be cited by AI search (Google AI Overviews, ChatGPT, Perplexity, Claude), or set up local/e-commerce/international SEO. Auto-detects site type (SaaS, e-commerce, local business, publisher/blog, docs, portfolio, marketplace) and adapts every check. Backend/stack agnostic (Next.js, React, Vue, WordPress, Astro, static HTML, Go/Rails/Django templates). Produces a prioritized, falsifiable action plan grounded in primary-source guidance, every finding carrying an explicit failure-mode check.
---

# SEO Pro — Universal SEO Engine

> One skill for the whole SEO lifecycle: **AUDIT** (find what's broken) → **FIX**
> (content, meta, schema, structure) → **GEO/AEO** (be cited by AI search).
> Works on any site type, any stack. Every recommendation is falsifiable: it
> states the expected effect *and* how to prove it wrong.

Inspired by the open-source `claude-seo` philosophy (falsifiability + primary-source
grounding) but self-contained — no external tool, no per-domain cost.

---

## 0. Operating principles (read first)

1. **Primary source wins.** Cite Google Search Central, Schema.org, W3C, MDN,
   web.dev — never SEO folklore. If a claim has no primary source, mark it
   `[unverified]`.
2. **Falsifiable findings only.** Each finding = *Claim → Evidence → Fix →
   Failure-mode check* ("this is wrong if …"). No vague "improve your content".
3. **Adapt to site type.** A local plumber and a SaaS docs site need opposite
   priorities. Detect type (§1) before checking anything.
4. **Priority = Impact × Confidence ÷ Effort.** Rank every finding P0–P3. Ship
   the P0/P1 list first; don't drown the user in P3 nitpicks.
5. **Measure, don't guess.** Where a number matters (CWV, word count, response
   time), fetch the real value. Unknown → say "unknown", never invent.
6. **One system.** Technical, content, and AI-search are the same funnel:
   crawlable → indexable → relevant → trustworthy → citable.

---

## 1. Detect site type FIRST (drives every priority)

Before auditing, classify the site — priorities differ sharply per type.

| Signal to check | Likely type |
|---|---|
| Pricing page, `/signup`, app subdomain, feature pages | **SaaS / web app** |
| Product pages, cart, `/checkout`, product schema | **E-commerce** |
| Address, phone, hours, "near me", service area | **Local business** |
| Article dates, author bylines, categories, high page count | **Publisher / blog** |
| `/docs`, versioned URLs, code blocks, sidebar nav | **Documentation** |
| Few pages, personal name, projects gallery | **Portfolio / brochure** |
| User-generated listings, seller profiles, search filters | **Marketplace** |

**Priority weighting by type:**

| Type | Top priority | Also critical | Often irrelevant |
|---|---|---|---|
| SaaS | Content depth + GEO/AEO, page speed | Feature/comparison pages, schema `SoftwareApplication` | Local pack |
| E-commerce | Product schema, faceted-nav crawl control, CWV, dup content | `Product`/`Offer`/`AggregateRating`, image SEO | Author E-E-A-T |
| Local | Google Business Profile, `LocalBusiness` schema, NAP consistency | Reviews, location pages, maps | International hreflang |
| Publisher | E-E-A-T (author/dates), `Article` schema, internal linking | Freshness, topical clusters | Product schema |
| Docs | IA/structure, crawlability, `FAQPage`/`HowTo` schema | Search-intent match, freshness | Backlinks (usually) |
| Portfolio | Basics + speed + clean meta | `Person`/`Organization` schema | Faceted nav |
| Marketplace | Crawl budget, dup/thin pages, canonical | `Product`/`Offer`, pagination | Author E-E-A-T |

State the detected type and chosen priorities before running checks.

---

## 2. The audit pipeline (5 layers, in order)

Run top-down. A page that isn't crawlable can't rank, so fix upstream first.

```
CRAWLABLE ─► INDEXABLE ─► RELEVANT ─► TRUSTWORTHY ─► CITABLE (AI)
(robots,     (canonical,  (intent,    (E-E-A-T,      (GEO/AEO,
 sitemap,     meta,        content,    schema,        extractable
 links, JS)   status)      keywords)   authority)     answers)
```

### Layer A — Crawlability
- `robots.txt`: not blocking important paths; `Sitemap:` line present.
- XML sitemap: exists, valid, only 200-status canonical URLs, `<lastmod>` real,
  submitted in Search Console.
- Internal linking: no orphan pages; important pages ≤3 clicks from home;
  descriptive anchor text (not "click here").
- JS rendering: content present in raw HTML or reliably server-rendered. SPA that
  ships an empty `<div id="root">` with no SSR/prerender = **P0** for most types.
- Crawl budget (large/e-com/marketplace): block faceted/filter/sort URLs and
  infinite calendars via `robots.txt` + `rel=canonical`; avoid `?param` explosions.
- Status codes: no important page returning 4xx/5xx; redirect chains ≤1 hop; no
  redirect loops.

### Layer B — Indexability
- One canonical per page (`rel=canonical` self-referencing or pointing correctly).
- No accidental `noindex` on money pages (check meta robots AND `X-Robots-Tag`).
- No duplicate content across www/non-www, http/https, trailing-slash, params —
  pick one, 301 the rest.
- Pagination: `rel=next/prev` deprecated by Google, but ensure paginated pages
  are crawlable and canonicalize sensibly; don't canonicalize page 2 → page 1.
- HTTPS everywhere; HSTS ideally; no mixed content.

### Layer C — Relevance (content & intent)
- **Search intent match**: informational / navigational / commercial /
  transactional — does the page format match? (guide vs product vs comparison).
- Title tag: unique, ≤~60 chars, primary keyword near front, brand at end.
- Meta description: unique, ~150–160 chars, compels the click (not a ranking
  factor, but drives CTR).
- One `<h1>` per page; logical `h2/h3` outline that mirrors subtopics.
- Content depth vs. competitors (don't pad — match what the SERP rewards).
- Keyword/entity coverage: primary + semantically related terms + questions
  people ask. Avoid stuffing; write for humans first.
- Internal links from relevant anchor text to related pages (topical clusters).
- Image SEO: descriptive `alt`, compressed, correct dimensions, lazy-loaded,
  modern format (WebP/AVIF), meaningful filenames.
- URL: short, lowercase, hyphenated, keyword-relevant, stable.

### Layer D — Trustworthiness (E-E-A-T + technical health)
- **E-E-A-T**: visible author with credentials, `datePublished`/`dateModified`,
  citations to sources, an About page, contact info. Critical for
  YMYL (health/finance/legal) and publishers.
- **Core Web Vitals** (measure, don't guess):
  - LCP < 2.5s · INP < 200ms · CLS < 0.1 (field data preferred).
  - Common fixes: preload LCP image, defer non-critical JS, reserve image
    dimensions to kill CLS, avoid layout-shifting web fonts (`font-display:swap`
    + size-adjust), cut main-thread work / long tasks.
- Mobile-first: responsive, no horizontal scroll, tap targets ≥48px, readable
  font size, no intrusive interstitials.
- Security & correctness: valid TLS, no console errors on critical paths.

### Layer E — Citability (AI search / GEO / AEO) — see §4.

---

## 3. Structured data (Schema.org) — pick by type

Add JSON-LD in `<head>` or end of `<body>`. Validate with Google Rich Results
Test + Schema.org validator. Only mark up content **visible on the page**.

Baseline for every site:
- `Organization` (or `Person` for solo) + `WebSite` with `SearchAction` (sitelinks
  search box) on the homepage.
- `BreadcrumbList` on deep pages.

By type (most impactful first):
- **SaaS**: `SoftwareApplication` / `WebApplication`, `Offer` (pricing), `FAQPage`,
  `Organization` with `sameAs` socials.
- **E-commerce**: `Product` + `Offer` (price, availability, currency) +
  `AggregateRating` + `Review`. Follow Google merchant structured-data rules
  (return policy, shipping) for eligibility.
- **Local**: `LocalBusiness` (subtype: `Restaurant`, `Plumber`, …) with `address`,
  `geo`, `openingHoursSpecification`, `telephone`, `priceRange`, `sameAs`.
- **Publisher/blog**: `Article` / `NewsArticle` / `BlogPosting` with `author`
  (linked `Person`), `datePublished`, `dateModified`, `image`, `publisher`.
- **Docs / how-to**: `FAQPage`, `HowTo`, `TechArticle`.
- **Events / courses / recipes**: `Event`, `Course`, `Recipe` as applicable.

Deprecation watch: Google drops rich-result support periodically (e.g. `HowTo`,
`FAQ` visibility limited to authoritative sites). Verify current eligibility in
Google's structured-data docs before promising a rich result — mark `[verify]`
if unsure.

---

## 4. GEO / AEO — get cited by AI search

Optimizing to appear in **Google AI Overviews, ChatGPT, Perplexity, Claude,
Gemini**. These pull from crawlable, well-structured, quotable content.

**Make content extractable:**
- Answer the question in the **first 1–2 sentences**, then expand (inverted
  pyramid). AI engines lift concise answer blocks.
- Use clear `h2/h3` phrased as the **questions users ask**; put a direct answer
  right under each.
- Short, self-contained paragraphs and **lists/tables** for facts, steps, specs,
  comparisons — highly liftable formats.
- Add a genuine **FAQ** section with `FAQPage` schema.
- State facts with **specific numbers, dates, named entities** — vague prose is
  rarely quoted.

**Build citability (trust):**
- Strong **E-E-A-T**: named expert authors, credentials, `dateModified` kept fresh.
- Cite primary sources; be the primary source others cite (original data,
  research, definitions).
- Consistent entity identity: `Organization`/`Person` schema + `sameAs` to
  Wikipedia/Wikidata/LinkedIn/Crunchbase where legitimate.
- Get mentioned on sites the models trust (Wikipedia, reputable press, industry
  authorities) — off-page brand presence feeds AI answers.

**Technical enablement:**
- Don't block AI crawlers you *want* citations from (know each bot's user-agent;
  decide per business whether to allow `GPTBot`, `PerplexityBot`, `ClaudeBot`,
  `Google-Extended`). Blocking them forfeits citations — an explicit business call.
- Consider an `/llms.txt` (emerging convention) summarizing the site for LLMs.
- Ship content in **raw/SSR HTML** — client-only JS content is often invisible to
  these crawlers.

**Failure-mode check for GEO:** if the answer to a target question isn't stated in
one liftable sentence within the first screenful, it likely won't be cited.

---

## 5. Content writing mode (when asked to write/optimize copy)

1. **Intent first**: identify the query's intent + the winning SERP format. Match it.
2. **Outline** from real subtopics + People-Also-Ask questions, not from a keyword list.
3. **Title + meta**: unique, keyword-forward title; meta that earns the click.
4. **Structure**: one `h1`; `h2/h3` as questions; short intro that answers fast;
   scannable sections; a FAQ block.
5. **Depth to match SERP**, not word-count targets. Cover the topic completely,
   cut filler.
6. **E-E-A-T signals**: cite sources, add author + dates, be specific and accurate.
7. **Internal links** to/from related pages with descriptive anchors.
8. **Schema** appropriate to the piece (§3).
9. **Human voice**: vary sentences, avoid AI-tell padding ("In today's fast-paced
   world…", "It's important to note that…"). Write like the expert would.
10. **Never fabricate** stats, quotes, or citations. Unknown → research or omit.

---

## 6. Output format (the deliverable)

Always produce a **prioritized action plan**, not a wall of observations.

```
# SEO Audit — <domain>
Site type: <detected type>   |   Health: <0–100, if measured>
Top priorities set by type: <one line>

## P0 — Critical (blocks ranking/indexing)
- [Finding] <what> — <where: url/file:line or selector>
  Evidence: <measured value / quote / status code>
  Fix: <specific, actionable>
  Failure-mode: this is wrong if <condition>

## P1 — High impact
...

## P2 — Moderate
...

## P3 — Nice to have
...

## Quick wins (do these first, <1h each)
- ...

## Not applicable for this site type
- <skipped checks + why>
```

Rules for the report:
- Anchor every technical finding to a real location (`url`, `file:line`, selector,
  or HTTP header). No location → mark `[needs verification]`.
- Give **numbers** where measured (LCP 4.1s, 34 orphan pages, title 78 chars).
- Rank by Impact×Confidence÷Effort. Lead with the 3–5 things that matter.
- Keep P3 short. The user wants leverage, not a 200-item checklist.

---

## 7. Tools & how to gather evidence

Use whatever is available; degrade gracefully.

- **Fetch pages**: WebFetch / curl the raw HTML — check title, meta, canonical,
  robots meta, JSON-LD, whether content is in the HTML (SSR) or JS-injected.
- **robots.txt / sitemap.xml**: fetch directly at `/{robots.txt,sitemap.xml}`.
- **Rendered DOM / CWV / console**: if Playwright or Chrome DevTools MCP is
  available, load the page to measure real LCP/CLS/INP, catch console errors, and
  see JS-rendered content. (See the browser-testing skill.)
- **Live web facts / competitor SERP / current Google guidance**: use web search.
  If a Perplexity/router key is configured in the session, prefer it for
  primary-source lookups (returns citations).
- **Structured-data validation**: Google Rich Results Test / Schema.org validator
  (state the tool; don't claim a rich result without checking current eligibility).
- **Local code audit**: if the repo is present, grep templates for `<title>`,
  meta tags, `next/head`, `<Head>`, `robots`, `sitemap`, `canonical`, JSON-LD to
  find where to fix.

When a value can't be measured, label it `unknown` and say what tool would get it.

---

## 8. Anti-patterns (never do)

- ❌ Keyword stuffing, hidden text, doorway pages, cloaking — modern algorithms
  penalize these.
- ❌ Promising exact ranking positions or timelines. SEO is probabilistic.
- ❌ Marking up content not visible on the page (structured-data spam → manual action).
- ❌ Fabricating metrics, backlink counts, or "we found 47 issues" without evidence.
- ❌ Buying links / PBNs / link schemes.
- ❌ Generic advice ("write quality content") with no specific, located fix.
- ❌ Blocking every AI crawler by reflex, then wondering why AI search never cites
  the site — make it a deliberate business decision.
- ❌ One-size checklist. A portfolio site doesn't need faceted-nav crawl rules.
- ❌ Treating deprecated tactics (`rel=next/prev` for ranking, meta keywords,
  exact-match domains) as current.

---

## 9. Quick reference — thresholds

| Item | Target |
|---|---|
| Title length | ≤ ~60 chars (≤ ~580px) |
| Meta description | ~150–160 chars |
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |
| Important page click-depth | ≤ 3 from home |
| Redirect chain | ≤ 1 hop |
| `<h1>` per page | exactly 1 |
| Image alt | present + descriptive on content images |
| Sitemap URLs | 200-status canonicals only |

---

## 10. Primary sources (cite these, verify currency)

- Google Search Central docs & SEO Starter Guide — developers.google.com/search
- Google Search Essentials (formerly Webmaster Guidelines)
- Google Search Quality Rater Guidelines (E-E-A-T)
- web.dev — Core Web Vitals, performance, PWA
- Schema.org — vocabulary + Google's structured-data feature docs
- Google Rich Results Test / PageSpeed Insights / Search Console
- MDN / W3C — HTML semantics, accessibility

Guidance changes. Before stating a "Google says" fact or promising a rich result,
confirm it's current (web search / primary source) or mark it `[verify]`.
