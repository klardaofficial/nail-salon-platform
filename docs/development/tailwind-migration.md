# Tailwind CSS migration plan

> Status: implemented. This document is kept as the design record for the
> migration; see [admin UI conventions](admin-ui.md) for the current styling
> conventions this produced.

## Context

The repo has ~1,213 lines of hand-written CSS across six files plus 43 inline
`style={{...}}` props, split across two visually unrelated surfaces that share
nothing but a 34-line reset:

- **Marketing** (`src/app/(marketing)`, German landing page) — one 581-line CSS
  Module carrying its own design tokens, dark mode, and a single mobile
  breakpoint.
- **Admin** (`src/app/admin`, English Ant Design dashboard) — a 225-line global
  stylesheet plus three CSS Modules, all hard-coded hex, four inconsistent
  breakpoints.

The goal is to express this styling as Tailwind utilities over one shared token
layer, so colour/spacing/typography decisions stop being duplicated as literal
values in six places — and to **end with no dead CSS left behind**.

Verified starting state: Tailwind, PostCSS, and `tailwind.config` are **absent**
— from-scratch install. Next.js 16.3.5, React 19.3.0, antd 6.6.4, pnpm 12.4.1.
Tailwind's current release is 4.3.3 (published 2026-09-08; no `minimumReleaseAge`
gate applies).

## Decisions taken

| Decision      | Choice                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Scope         | Both surfaces in one pass (~1,179 lines rewritten)                                                             |
| Ant Design    | **Stays.** Themed via the existing `ConfigProvider` tokens; Tailwind only for elements the project controls    |
| Fidelity      | Faithful visual port + one shared `@theme` layer. Admin greys keep current values; no dark mode added to admin |
| Inline styles | The 43 `style={{...}}` props migrate too                                                                       |
| Cleanup       | Every migrated stylesheet is deleted, not left orphaned; dead tokens dropped                                   |

### The cascade constraint that shapes everything

`antd/dist/reset.css` (a Bootstrap-style reboot) and antd's runtime CSS-in-JS are
both **unlayered**. Tailwind v4 puts Preflight in `@layer base` and utilities in
`@layer utilities`. Unlayered styles beat _all_ layered styles regardless of
source order or specificity.

Two consequences:

1. A Tailwind utility on an antd component wins **only** for properties antd
   never sets. Selectors that reach into antd internals must stay in plain CSS.
   (`StyleProvider layer` was rejected: it re-ranks every antd style at once in a
   repo with no visual regression testing.)
2. antd's reset wins over Preflight on every property it declares — but Preflight
   still introduces properties antd's reset never sets, most notably
   `img, svg, video, canvas { display: block; max-width: 100%; height: auto }`.
   In a dashboard full of antd `Avatar`s and `@ant-design/icons` SVGs, that is a
   silent layout change. **So admin must not load Preflight.**

---

## Step 1 — Install and configure

```bash
pnpm add -D tailwindcss @tailwindcss/postcss
```

`postcss.config.mjs` (new, repo root):

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

Use Tailwind v4 **CSS-first** config (`@theme` in CSS). Do not create a v3-style
`tailwind.config.js`. `next.config.ts` needs no changes.

## Step 2 — Split the stylesheet entries per surface

The two surfaces are already **separate root layouts with their own `<html>`**
(`(marketing)/layout.tsx` is `lang="de"`, `admin/layout.tsx` is `lang="en"`), so
they can take different resets. This is the only arrangement that keeps admin
pixel-identical.

| New file                              | Contents                                                                                         | Imported by              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| `src/app/theme.css`                   | The single `@theme` block — shared tokens only, no rules                                         | both entries             |
| `src/app/globals.css` (rewritten)     | `@import "tailwindcss"` (**with** Preflight) + `@import "./theme.css"` + marketing base rules    | `(marketing)/layout.tsx` |
| `src/app/admin/admin.css` (rewritten) | Tailwind **without** Preflight + `@import "../theme.css"` + the residual antd-internal selectors | `admin/layout.tsx`       |

Admin's Preflight-free import, per Tailwind v4's layer-by-layer form:

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
```

Admin keeps `antd/dist/reset.css` as its reset, imported first as today. Verify
these three import paths against the installed `tailwindcss@4.3.3` package before
relying on them.

Add `@source` directives to each entry so the two Tailwind builds scan only their
own surface rather than each emitting utilities for the whole repo.

## Step 3 — The shared `@theme` block

Lift the duplicated literals into tokens. Marketing's `--accent` (`#a62f5c`),
admin's hard-coded `#a62f5c`, and antd's `colorPrimary` are currently three
coincidentally-equal strings; they become one token.

```css
@theme {
  --color-accent: #a62f5c;
  --color-accent-strong: #862047;
  --color-ink: #191a1e;
  --color-muted: #575b65;
  --color-line: #c7cad2;
  --color-surface: #f4f5f7;
  --color-surface-raised: #e7e9ed;
  --color-surface-soft: #dde0e6;
  /* marketing on-accent tints, previously untokenized literals */
  --color-on-accent: #fff8fb;
  --color-on-accent-soft: #ffe8f1;
  /* admin greys — kept at current values, deliberately NOT merged with above */
  --color-admin-bg: #f4f6f8;
  --color-admin-ink: #18202a;
  --color-admin-muted: #687383;
  --color-admin-line: #e5e9ee;
  --color-admin-line-strong: #dde3e8;

  --shadow-marketing: 0 30px 90px rgb(91 37 62 / 14%);
  --font-sans: var(--font-marketing), system-ui, sans-serif;

  --animate-enter: enter 700ms both cubic-bezier(0.16, 1, 0.3, 1);
  --animate-visual-enter: visual-enter 900ms both cubic-bezier(0.16, 1, 0.3, 1);
}
```

Also needed in `@theme`: `--font-weight-*` entries for the odd weights actually
in use (**680, 700, 720, 750, 760, 800**), and the two `@keyframes` blocks
(`enter`, `visual-enter`).

**Drop `--accent-soft` entirely** — it is defined in both light and dark and
referenced nowhere. First item of dead-code removal.

Dark mode stays a `prefers-color-scheme` concern of the marketing entry only,
overriding the token values — matching today's behaviour. `color-scheme: light dark`
moves **out** of the shared reset and into the marketing entry: admin has no dark
styles, so inheriting it today lets UA form controls and scrollbars render dark
against hard-coded light surfaces. Calling this out as a deliberate bug fix, not
a silent change.

## Step 4 — Marketing page rewrite

`src/app/(marketing)/page.module.css` → utilities in
`src/app/(marketing)/page.tsx`. 28 classes, zero dead ones, plus ~30 bare-element
descendant selectors (`.hero h1`, `.statement p`, `.processGrid article`, …) that
each need an explicit class on the JSX element.

Specific mechanisms for the hard cases:

- **Breakpoint inversion — the top bug risk.** The sheet has exactly one width
  query, `@media (max-width: 767px)`, wrapping ~25 rule blocks. Tailwind is
  mobile-first, so the current _mobile override_ becomes the unprefixed base and
  the current _desktop base_ becomes `md:` (768px). Invert deliberately, block by
  block; do not transcribe.
- **`grid-template-areas`** on `.benefits` (`"lead chat" "lead choice"` →
  `"lead" "chat" "choice"`): Tailwind has no area utilities. Either keep this one
  rule in a small `@utility` in the marketing entry, or restructure to
  explicit `col-start`/`row-span` utilities. Prefer `@utility` — faithful and
  smaller diff.
- **nth-child animation stagger** (`.heroCopy > *` with 80/150/220ms delays on
  children 2–4): arbitrary variants, `[&>*:nth-child(2)]:[animation-delay:80ms]`.
- **`clamp()` fluid type/spacing** (7 sites, e.g. `clamp(48px,5.9vw,82px)`):
  arbitrary values, `text-[clamp(48px,5.9vw,82px)]`.
- **`ch` / `dvh` sizing** (`max-w-[48ch]`, `min-h-[min(74dvh,760px)]`,
  `min-h-[calc(100dvh-72px)]`) and the container
  `w-[min(100%-32px,1280px)] md:w-[min(100%-48px,1280px)]`: arbitrary values.
- **`:not()` / structural selectors** (`.nav > a:not(.navCta)`,
  `.processGrid article:first-child`, `.footer p:last-child`): put the utility on
  the JSX element where the element is enumerable in the component; use an
  arbitrary variant only where it genuinely iterates.
- **Four shared groups** — pill button (`.navCta/.primaryButton/.secondaryButton`),
  card base (`.benefitLead/.benefitChat/.benefitChoice`), section heading (4 call
  sites), image cover. Extract as small React components or a shared class
  constant in `page.tsx`. Do **not** reach for `@apply`.

## Step 5 — Admin rewrite

- **Safe, pure Tailwind** (elements the project fully controls): `.admin-brand`,
  `.admin-brand-mark`, `.admin-page-heading` (+`h1`,`p`), `.admin-login-page`,
  `.admin-login-panel`, `.admin-login-form` (+`h1`,`> p`), `.admin-login-aside`
  (+`strong`,`p`), `.admin-org-link`, `.admin-org-name`, `.admin-org-arrow`,
  `.admin-table-toolbar`, `.admin-date-range-presets`.
- **antd component roots** (`.admin-shell`/`Layout`, `.admin-sider`/`Sider`,
  `.admin-header`/`Header`, `.admin-content`/`Content`,
  `.admin-chart-card`/`.admin-org-card`/`Card`, `.admin-org-avatar`/`Avatar`):
  Tailwind on the root `className` is fine for properties antd does not set.
  Check each property against the rendered antd styles rather than assuming.
- **Must remain plain CSS** (reach into antd internals, cannot be utilities):
  - `.admin-stat-card .ant-statistic-content { font-weight:700; letter-spacing:-0.04em }`
  - `.admin-org-card .ant-card-head { min-height:0; border-bottom:none; padding:8px 12px 0 20px }`
  - `.threadList > :global(.ant-skeleton)`, `.threadList > :global(.ant-empty)` (from `inbox.module.css`)
  - The `!important` fights: `.admin-sider { position: sticky !important; background:#fff !important }`
    and `chat-message.module.css` `.choice { height:auto !important; padding-block:6px !important; white-space:normal !important }`
    (on an antd `Button`). Tailwind's `!` modifier does **not** rescue these —
    a layered `!important` still loses to unlayered `!important`. Keep them in CSS.
- **Breakpoints.** Admin currently uses `900px` (admin.css), `1000px` and `700px`
  (inbox), `600px` (simulator), plus antd's JS `breakpoint="lg"` (992px) on
  `<Sider>`. Faithful port means preserving them exactly: declare
  `--breakpoint-*` custom screens in `@theme` rather than rounding to Tailwind's
  defaults. Leave the `<Sider breakpoint="lg">` prop alone — it is JS, not CSS.
- **Inline styles.** 43 occurrences across 13 files, concentrated in
  `platform-activity-client.tsx` (13), `dashboard-client.tsx` (7),
  `organization-settings-client.tsx` (5). Convert to utilities where the target is
  a plain element; where the target is an antd prop (e.g. `admin-shell.tsx`'s
  `style={{ minWidth: 220 }}` on a `<Select>`), keep it inline — antd's runtime
  CSS would out-rank a utility there.
- `ConfigProvider` in `admin-providers.tsx` is **unchanged**. Cross-reference its
  values in a comment so the duplication with `@theme` is at least visible.

## Step 6 — Delete the migrated CSS

Files removed once their rules are ported:

- `src/app/(marketing)/page.module.css` (581)
- `src/components/admin/inbox.module.css` (184)
- `src/components/admin/simulator.module.css` (115)
- `src/components/admin/chat-message.module.css` (74)

Rewritten in place: `src/app/globals.css`, `src/app/admin/admin.css` (shrinks to
the residual antd-internal selectors listed in Step 5).

Also drop the now-unused `import styles from "./…module.css"` lines in
`page.tsx`, `chat-message.tsx`, `inbox-client.tsx`, `simulator-client.tsx`.

### Verifying nothing dead is left

Because `pnpm lint`/`typecheck` will _not_ catch an orphaned stylesheet or an
unreferenced class, check explicitly:

- `git grep -n "module.css"` — expect zero hits under `src/`.
- `git grep -n "\.css\"" src/` — expect only the three intended entries
  (`antd/dist/reset.css`, `globals.css`, `admin.css`).
- For every class name that survives in `admin.css`, grep for it in `src/` and
  confirm a live JSX reference; delete any with none.
- Confirm `--accent-soft` and any other token with no `var()` consumer is gone.
- Diff the final `admin.css` against the original 225 lines and account for every
  removed rule as either ported or deliberately dropped.

## Step 7 — Tooling

Add `prettier-plugin-tailwindcss` as a devDependency and a `plugins` array to
`.prettierrc.json` (which currently has no `plugins` key). With `printWidth: 100`
and long utility strings, deterministic class ordering keeps `pnpm format:check`
— a `pnpm check` gate — from becoming a source of churn.

## Step 8 — Docs (required by AGENTS.md change rules)

- `docs/development/admin-ui.md` — primary. L3 ("Ant Design runtime styles…
  shared tokens") and L19 ("Keep the English dashboard separate from bot i18n and
  German marketing styles") need the Tailwind + antd division of responsibility,
  including why utilities must not target antd internals.
- `docs/architecture/overview.md:15` — `Admin[Ant Design admin + SWR]`.
- `docs/product/requirements.md:30` (ADMIN-01) — antd stays, so this needs at
  most a styling-mechanism note.
- No existing doc mentions Tailwind, PostCSS, or CSS Modules; the new token layer
  and the two-entry split are worth a short section in `admin-ui.md`.
- Keep `.env.example` / `docs/development/configuration.md` untouched (no new env).

## Verification

Automated gates — necessary but weak here:

```bash
pnpm install
pnpm check      # format:check && lint && typecheck && test:run
pnpm build      # catches Tailwind/PostCSS wiring and CSS ordering
```

Tests are **zero-signal for this change**: Vitest is `environment: "node"`, all 12
test files are `.ts` with no React rendering, and there are no snapshots or
`toHaveClass` assertions. `pnpm build` matters most, since CSS ordering can differ
between dev and production.

There is **no Storybook, Playwright, or visual regression tooling**, so fidelity
must be checked by eye. Before touching any CSS, capture reference screenshots
from `pnpm dev` at the widths that matter, then compare after:

- **`/` (marketing)** at **375, 767, 768, 1024, 1440px** — 767/768 straddle the
  inverted breakpoint and are where inversion bugs surface. Check **both light and
  dark** (`prefers-color-scheme`), plus `prefers-reduced-motion` and the hero
  entry-animation stagger.
- **Admin** at **599, 600, 699, 700, 899, 900, 999, 1000, 1440px** — each pair
  straddles one of the four preserved breakpoints. Routes: login, dashboard,
  organizations (card hover + arrow), inbox (thread list, selected-thread
  collapse, the `.back` button under 700px), simulator, platform activity, and one
  page with `Statistic` cards to confirm the `.ant-statistic-content` override
  survived.
- Confirm antd icons/avatars did not shift — the specific symptom of Preflight
  leaking into admin.

## Top risks

| Risk                                                                                                                                        | Mitigation                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Breakpoint inversion errors** — 25 blocks flip from `max-width` to mobile-first                                                           | Invert block by block; screenshot-compare at 767 _and_ 768px                                       |
| **Preflight leaking into admin** — `img/svg { display:block }` shifts antd icons/avatars                                                    | Admin entry omits Preflight (Step 2); verify icons explicitly                                      |
| **Preflight zeroing margins in marketing** — Preflight removes UA `h1..h6`/`p`/`ul` margins that unclassed marketing elements rely on today | The rewrite makes every element's spacing explicit; treat any unclassed text element as unfinished |
| **Silent utility loss on antd components**                                                                                                  | Never target antd internals with utilities; keep the enumerated residual CSS                       |
| **Losing the `!important` antd fights**                                                                                                     | Keep those rules in plain CSS; Tailwind's `!` cannot beat unlayered `!important`                   |
| **Two Tailwind entries double-emitting utilities**                                                                                          | Scope each with `@source`                                                                          |
| **Orphaned CSS surviving the migration**                                                                                                    | The explicit grep checklist in Step 6                                                              |
