# Worldwise — Agent Context

This is the permanent operating context for any AI agent working in this repository. Unlike [`docs/IDEA.md`](./IDEA.md) — a temporary implementation roadmap that is deliberately trimmed and eventually deleted as its contents get built — this file does not shrink. Read it first.

## Where things live

- **This file** — what the product is, its non-negotiable principles, the tech stack and conventions, and the key architectural decisions.
- **[`GLOSSARY.md`](./GLOSSARY.md)** — the project glossary. Canonical terminology (game mode, collection, round, mode-challenge, daily ritual, tier) and terms to avoid. Consult it before introducing new domain vocabulary.
- **[`docs/adr/`](./adr/)** — Architecture Decision Records. Each documents a single decision, its context, and why it was made. They are the source of truth for "why is it built this way" and are never rewritten, only superseded by a later ADR.
- **[`docs/IDEA.md`](./IDEA.md)** — the current implementation roadmap for whatever hasn't been built yet. As a section gets implemented, it should be trimmed from that document; the code, its tests, and any resulting ADR become the source of truth instead.

## What Worldwise is

Worldwise is a mobile-first geography arcade where players improve their mental map of the world through short daily challenges about direction, distance, order, borders, and other relationships between places.

It's meant to feel like a small, refined daily ritual for people who enjoy geography — not a quiz platform, and not chasing virality. It borrows the accessibility and repeatability of daily games without copying Wordle's word-deduction mechanic or GeoGuessr's imagery/map-identification mechanic. Mobile is the primary experience; desktop must remain fully supported.

## Product principles

1. **Relationships over isolated trivia.** Prefer direction, proximity, adjacency, ordering, scale, and routes over questions that only test memorized facts.
2. **Learn in seconds.** A new player should understand a challenge after one short instruction and an example.
3. **Short but replayable.** The daily ritual should take roughly three to five minutes; practice allows unlimited play.
4. **Compete with yourself.** Streaks, history, accuracy, and personal bests matter more than public rankings.
5. **Fair generation.** Generated challenges must be deterministic, valid, unambiguous, and appropriately difficult.
6. **Geographic breadth.** Support multiple collections, from the whole world to regions such as Europe or the autonomous communities of Spain.
7. **A polished small product.** A focused, dependable experience beats a long list of half-finished modes.
8. **Accessible by default.** Never depend only on color, precise pointer input, or animation.

## Non-goals

- Recreating Wordle with country names.
- Recreating GeoGuessr or a click-the-country map quiz.
- Street-view or photograph licensing/integration.
- User accounts and cross-device synchronization.
- Real-time multiplayer.
- Public competitive leaderboards.
- Manually authored daily content.
- A content-management system.
- Native mobile applications.
- Premature optimization for viral growth or monetization.

## Key architectural decisions

Permanent unless superseded by a later ADR — read the linked ADR for full context before working on anything that touches it.

- Daily resets at UTC midnight. — [ADR-0001](./adr/0001-daily-reset-utc-midnight.md)
- The daily ritual is one required mode-challenge per enabled game mode, not a single mixed-mode session; the streak requires completing all of them. — [ADR-0002](./adr/0002-per-mode-daily-challenges.md)
- Difficulty tiers ship in the MVP; one tier is required daily, the others are optional bonus content that don't gate the streak. — [ADR-0003](./adr/0003-difficulty-tiers-optional-bonus.md)
- Scoring is correctness-based with per-mode partial credit; elapsed time is recorded but never affects score. — [ADR-0004](./adr/0004-scoring-correctness-partial-credit-no-time.md)
- Border Run excludes disputed territories, enclaves, and maritime-only borders by default. — [ADR-0005](./adr/0005-border-run-excludes-disputed-territories.md)
- English and Spanish ship together at MVP launch; i18n infrastructure is required from day one, not deferred. — [ADR-0006](./adr/0006-bilingual-launch-english-spanish.md)
- Daily always draws from a single fixed default collection (World); other collections live in Practice. — [ADR-0007](./adr/0007-daily-uses-single-default-collection.md)
- Compass answers are a continuous angle on a dial, scored by angular error, not a discrete 8-direction choice; supersedes ADR-0004's Compass-specific clause only. — [ADR-0008](./adr/0008-compass-continuous-angle-scoring.md)
- Border Run rewards efficient land routes: a shortest route earns full credit, valid detours within a tier's hop budget earn proportional credit, and invalid or over-budget routes earn none. — [ADR-0009](./adr/0009-border-run-route-efficiency-scoring.md)
- Compass keeps a bounded local history of answers to build a personal mental-map profile; it is never sent to a server. — [ADR-0010](./adr/0010-local-compass-mental-map-profile.md)

## Tech stack

- **Astro** (static output by default) as the application framework. Add a client framework (React/Vue/Svelte/etc.) only if a specific game becomes substantially clearer to build with one — never preemptively.
- **Tailwind CSS** for nearly all styling. Custom CSS only when Tailwind genuinely can't express something (e.g. a complex animation); keep it small, documented, and colocated predictably.
- **Lucide** (`lucide-astro`) for interface icons; no inline SVG for icons Lucide already covers. Icons need accessible labels when they convey meaning, and must be hidden from assistive technology when decorative.
- **TypeScript**, strictest practical settings: no implicit `any`, no unchecked indexed access, exact optional property semantics, no implicit returns, no unnecessary switch fallthrough, exhaustive discriminated-union handling for game modes and persisted schema versions. No type assertions used merely to silence the compiler — validate runtime inputs (geographic data, `localStorage` content) at their boundaries.
- **Biome** as the sole formatter and primary linter: four-space indentation (spaces, not tabs), import organization on, recommended rules enabled and strengthened where they improve correctness. Lint warnings are CI failures. Suppressions must be narrow and explain why the code is safe.
- No global state-management library, no date library for daily-key math, no backend/database/auth/analytics/advertising unless a concrete, agreed need arises later.

## Testing priorities

The generator and geographic correctness matter more than page markup. Always cover: identical output for identical seed/generator-version/data-version; expected changes when a version changes; generation across a wide range of dates without crashes or invalid rounds; geographic edge cases (antimeridian, poles, directional boundaries); mode-specific ambiguity/difficulty rules; border-graph connectivity and shortest-path behavior; persistence validation, migrations, interrupted games, and corrupt-storage recovery; keyboard and touch completion of every game mode. CI runs formatting checks, linting, type checks, unit tests, and the essential end-to-end suite.

## Accessibility & privacy baseline

- Every interaction must work with keyboard and touch; dragging must have an equivalent non-drag interaction.
- Focus states and focus order must be deliberate; controls need meaningful accessible names.
- Feedback must not depend only on color or sound; motion must respect `prefers-reduced-motion`.
- Game instructions and result announcements should work with screen readers; touch targets must be comfortably sized for mobile.
- No account, no personal profile, no analytics by default. Analytics, if ever proposed, require an explicit product decision and must be privacy-preserving.

## Working name and positioning

**Name:** Worldwise · **Repository:** `worldwise` · **Deployment shape:** `worldwise.<master-domain>`

> A daily game for people who think they know the world.
