# Worldwise

## Document purpose

This document is a **temporary implementation roadmap**, not the permanent source of truth. Permanent context — what the product is, its principles, non-goals, tech stack, and key architectural decisions — lives in [`AGENTS.md`](./AGENTS.md); read that first.

This file exists to guide implementation of what hasn't been built yet. As a section is implemented, remove it from this document — the code, its tests, and any resulting ADR in [`docs/adr/`](./adr/) become the source of truth instead. This file is expected to shrink over time and eventually disappear entirely.

## Core experience

Worldwise has two complementary ways to play.

### Daily challenge

The daily challenge is the main ritual. Every player receives the same generated set of challenges for a given UTC date and game-data version ([ADR-0001](./adr/0001-daily-reset-utc-midnight.md)).

The daily ritual is composed **per game mode**, not as one mixed-mode session: each day the player receives one required mode-challenge for every enabled game mode (for example, one Compass mode-challenge, one Arrange mode-challenge, one Border Run mode-challenge), each built from several rounds. Completing every enabled mode's required mode-challenge for the day completes the daily ritual and advances the streak; partial completion does not ([ADR-0002](./adr/0002-per-mode-daily-challenges.md)).

Initial target:

- One required mode-challenge per enabled game mode, per day.
- Approximately three rounds per mode-challenge (around nine rounds total for the daily ritual).
- All mode-challenges draw from a single default collection — World — for the MVP ([ADR-0007](./adr/0007-daily-uses-single-default-collection.md)).
- One recorded attempt per mode-challenge per day.
- A final score and per-round feedback for each mode-challenge, plus an overall daily result.
- A streak and personal history stored locally.
- A shareable spoiler-free result.

Difficulty tiers (easy, medium, hard) exist per mode-challenge. Exactly one tier is the required tier for the streak and the three-to-five minute time budget; the other tiers are optional bonus mode-challenges a player may additionally complete the same day, and do not affect the streak or count against the time budget ([ADR-0003](./adr/0003-difficulty-tiers-optional-bonus.md)).

Refreshing the page, changing the device clock, or reopening the application must not accidentally create a different challenge for the same daily key. An interrupted mode-challenge can be resumed at any point before the next UTC reset; after that reset it is no longer resumable and counts as not completed for that day.

### Practice

Practice lets players continue after the daily challenge or train a particular skill.

- Unlimited randomly generated challenges.
- Selection by geographic collection, game mode, and tier where supported.
- Collections beyond the Daily default (World) — such as Europe, and later the Autonomous Communities of Spain — are primarily accessed through Practice for the MVP ([ADR-0007](./adr/0007-daily-uses-single-default-collection.md)).
- Practice results do not affect the daily streak or daily score.
- Practice may keep separate local statistics such as attempts and accuracy.
- Repeated challenges should be avoided within a reasonable recent-history window.

Practice randomness does not need to be shared between players, but challenge validation must use the same rules as the daily generator.

## Game modes

The architecture should treat game modes as independent units with shared concepts for generation, validation, scoring, persistence, and presentation. We should launch with a small set and add modes only when they introduce a genuinely different geographic skill. Each mode may offer difficulty tiers (easy, medium, hard); see Core experience for how tiers interact with the daily ritual ([ADR-0003](./adr/0003-difficulty-tiers-optional-bonus.md)).

### Recommended MVP modes

#### Compass

Given an origin and a destination, choose the destination's direction from the origin using an eight-direction compass.

Example: "From Madrid, in which direction is Rome?"

Both places are generated from the active collection. The answer is calculated from geographic coordinates; it is not manually authored.

Generation must reject pairs whose bearing lies too close to a direction boundary. The acceptable margin should be a configurable rule, not a UI workaround. Places that are extremely close together should also be rejected.

#### Arrange

Drag or otherwise reorder several places according to a geographic property.

Initial variants:

- North to south.
- West to east.
- Closest to farthest from a reference place.
- Smallest to largest by area, if the source data is trustworthy and comparable.

The keyboard and screen-reader interaction must provide an alternative to drag-and-drop. Generated values must be separated enough to avoid questions whose ordering feels arbitrary.

#### Border Run

Connect an origin and destination through adjacent territories.

Example: build a valid land-border route from France to Poland.

The underlying data is an adjacency graph. Early versions should make the expected rule explicit: any valid route, a route with an exact number of steps, or the shortest route. The generator must verify that a route exists and that the puzzle has the intended difficulty before presenting it.

Special cases such as overseas territories, disputed borders, enclaves, and maritime borders are excluded from the adjacency graph by default ([ADR-0005](./adr/0005-border-run-excludes-disputed-territories.md)).

### Possible later modes

These are ideas, not committed scope:

- **Which is closer?** Choose which of two places is closer to a reference place.
- **Odd place out.** Identify the place that does not share a specified geographic property.
- **Coordinate Hunt.** Estimate latitude or longitude using an accessible slider or segmented control.
- **Scale Check.** Compare the areas or populations of places when reliable data is available.
- **Route Builder.** Order destinations to create an efficient route.
- **Shape Fragments.** Recognize a partial border or coastline rather than a complete country silhouette.

Modes based mainly on flags, capitals, facts, complete silhouettes, street imagery, or clicking named countries on a map are not the defining experience. They should only be added if they complement the relationship-based core rather than turning Worldwise into a conventional geography quiz.

## Geographic collections

A collection is a coherent set of playable places and associated relationships. Potential collections include:

- Countries of the world.
- Countries of Europe.
- Autonomous communities of Spain.
- Provinces of Spain.
- US states or other national subdivisions.
- Capitals, islands, rivers, or mountain ranges if later modes can use them meaningfully.

The MVP should begin with **World** and **Europe**. A smaller collection such as the autonomous communities of Spain is a valuable early test because it proves that the data and game architecture are not hard-coded around sovereign countries.

Each collection must declare which modes it supports. Not every dataset needs to support every mode.

## Deterministic challenge generation

Daily challenges are generated from data and rules rather than manually authored.

### Daily key

Each mode-challenge is generated from a stable seed derived from at least:

- A date in `YYYY-MM-DD` format, using the UTC calendar date ([ADR-0001](./adr/0001-daily-reset-utc-midnight.md)).
- A game/generator version.
- A data version.
- The collection identifier (the fixed default collection for Daily; see Core experience).
- The game mode identifier.
- The tier identifier (required tier, or a bonus tier).

Conceptual example:

```text
worldwise:daily:v1:data-v1:2026-07-31:world:compass:medium
```

The same key must generate the same complete mode-challenge in every supported browser. Do not rely on `Math.random()` for daily content. Use a small, tested deterministic pseudo-random generator fed by a stable hash, or a carefully selected dependency with consistent cross-platform behavior.

Daily resets at UTC midnight, chosen so a global comparison has one unambiguous challenge and generation/testing stay free of timezone-dependent logic; players outside UTC see the new daily ritual at a non-midnight local hour, a deliberately accepted cost ([ADR-0001](./adr/0001-daily-reset-utc-midnight.md)).

### Generation pipeline

The generator should:

1. Resolve the daily key and deterministic random source.
2. Select a mode according to the daily program and enabled collections.
3. Select candidate places.
4. Calculate the correct answer from normalized geographic data.
5. Validate ambiguity, difficulty, duplicates, and mode-specific constraints.
6. Retry deterministically when a candidate is invalid.
7. Produce a serializable challenge with a stable identifier.

Avoid rejection loops with no upper bound. Every generator needs an attempt limit and a tested fallback strategy.

### Versioning

Generator and data versions are essential. Fixing a coordinate, border, or algorithm must not silently change a historical challenge while keeping its old identity. Persist the relevant versions with every recorded result.

The daily program should also be versioned so the mixture and ordering of modes can evolve without making generation unpredictable.

### Fairness and ambiguity

Generated does not mean arbitrary. Every mode needs explicit eligibility rules. Examples include:

- A safe angular margin around Compass answer boundaries.
- Minimum coordinate or distance separation for Arrange.
- Verified connectivity and route length for Border Run.
- Disputed territories, enclaves, and maritime-only borders excluded by default ([ADR-0005](./adr/0005-border-run-excludes-disputed-territories.md)).
- A difficulty band appropriate for the current tier.
- No duplicate place within a round unless the mechanic requires it.
- No accidental repetition across consecutive daily challenges when reasonably avoidable.

Property-based tests are particularly valuable for proving these invariants across many seeds and dates.

## Scoring and progression

Each mode-challenge is scored per the model in [ADR-0004](./adr/0004-scoring-correctness-partial-credit-no-time.md) (correctness plus per-mode partial credit; time recorded but never scored). Each mode-challenge produces its own score using this model; the daily result aggregates the required mode-challenges for that day. Daily results could use a normalized score such as 0–1,000, but this is not yet a requirement.

Useful personal statistics include:

- Current and longest daily streak.
- Daily completion history.
- Average score.
- Accuracy per mode and collection.
- Practice attempts and mastery trends.

Worldwise must remain enjoyable without signing in. Losing browser storage is an accepted MVP limitation, but future export/import of local progress would be a useful privacy-friendly feature.

## Information architecture

We will define content and navigation before choosing a visual direction. The initial product structure is:

### Home / Today

- Product identity and today's status.
- Start or resume the daily challenge.
- Daily completion result when finished.
- Clear path to practice.

### Game session

- Round progress.
- Short mode instruction.
- Interactive challenge.
- Submit/confirm action when appropriate.
- Answer feedback and a brief geographic explanation.
- Continue to the next round.

### Daily result

- Total result.
- Per-round summary.
- Streak update.
- Spoiler-free sharing.
- Continue into practice.

### Practice

- Quick-start randomized practice.
- Optional collection selector.
- Optional mode selector.
- Practice session and lightweight result.

### Statistics

- Daily history and streaks.
- Performance by mode and collection.
- Clear explanation that data is stored on this device.

### How to play

- Concise overview.
- Explanation and example for each enabled mode.
- Daily versus practice rules.

### Settings / About

- Language and accessibility preferences if implemented.
- Motion, sound, and theme preferences if implemented.
- Data/storage controls.
- Data sources, licenses, project information, and acknowledgements.

These may be pages, dialogs, tabs, or a smaller combined structure. The content needs are stable; the final navigation pattern is not.

## Visual and interaction direction

No strong visual style should be established yet.

The first UI task is to confirm the screens, content hierarchy, states, and interactions listed above. We will then use Claude Design to propose multiple visual directions and choose one deliberately. Until that process is complete:

- Do not introduce a definitive brand palette, typography system, decorative illustration style, or map aesthetic.
- Do not build a large custom component theme based on assumptions about the future design.
- Prefer semantically correct, accessible, minimally styled structures when prototyping behavior.
- Keep content and game logic independent from presentation so the chosen design can be applied without rewrites.

Regardless of visual direction, the final product must be mobile-first, responsive, touch-friendly, readable, and accessible. Respect reduced-motion preferences and do not use color as the sole carrier of meaning.

## Candidate dependencies

Permanent stack choices and coding conventions live in [`AGENTS.md`](./AGENTS.md#tech-stack). This section tracks dependency decisions still to be made as implementation begins.

Keep the dependency graph intentionally small. Dependencies should solve a demonstrated problem, not anticipated convenience.

Recommended when implementation begins:

- **`lucide-astro`** for Lucide icons in Astro components.
- **`zod`** for validating geographic datasets, generated challenge payloads where appropriate, and versioned data read from `localStorage`. Astro already uses Zod in parts of its ecosystem, but Worldwise should declare it directly if application code imports it.
- **`vitest`** for unit tests covering calculations, deterministic generation, scoring, and persistence migrations.
- **`@playwright/test`** for a small set of mobile-first end-to-end flows and accessibility-sensitive interaction tests.
- **`fast-check`** if generator invariants become difficult to cover with ordinary table-driven tests. It is especially suitable for deterministic and geographic property testing, but it need not be installed on day one.

Consider only if needed:

- **A lightweight accessible interaction primitive** for complex sortable controls. First evaluate native controls and a small purpose-built implementation. Any library must support keyboard, touch, and screen readers.
- **`@turf/*` modules** for geometry operations that go beyond point distance and bearing. Do not install the full Turf bundle for calculations that can be implemented clearly and tested in a few functions.
- **A deterministic PRNG package** if a reviewed local implementation would be less reliable. Cross-browser repeatability and maintenance matter more than saving a tiny dependency.

Avoid initially:

- A client-side UI framework without a proven need.
- A global state-management library.
- A date library for daily-key operations that the platform can handle safely.
- A general animation library before the visual direction is selected.
- Redis, a database, authentication, analytics, advertising, or a server runtime.

## Geographic data

Data quality is a product concern, not merely an implementation detail.

Each place should have a stable internal identifier and only the fields supported by reliable sources. A normalized country or subdivision record may eventually include:

- Stable ID.
- Display names and optional localized names.
- Place type and collection membership.
- Representative latitude and longitude.
- Area when comparable.
- Border/adjacency IDs.
- Optional geometry or simplified outline.
- Source and source version metadata.

Coordinates require an explicit semantic choice. A capital coordinate, geographic centroid, population-weighted center, and representative label point can produce different answers. Direction and distance questions should normally use a documented representative geographic point, not silently mix coordinate types.

Before importing a dataset:

- Verify its license permits redistribution in this repository and deployed application.
- Record attribution and source version.
- Normalize it at build time rather than shipping unnecessary raw fields.
- Review disputed and dependent territories explicitly.
- Add validation for missing references, duplicate IDs, invalid coordinates, and asymmetric adjacency.

Natural Earth is a likely starting point for country-level geometry and metadata, but the exact source set is an open research decision. Do not copy geographic content from an arbitrary quiz website.

## Local persistence

All player progress is stored in `localStorage` for the MVP. UI preferences that need to apply before hydration may use an appropriate browser-native mechanism, but there is no user account.

Persisted data must:

- Use a namespaced key such as `worldwise:state`.
- Include an explicit schema version.
- Be validated when read.
- Have tested migrations between supported versions.
- Recover gracefully from corrupt or partial content.
- Store the challenge ID, relevant generator/data versions, answers needed to resume, completion state, and result summary.
- Avoid collecting personal information.

Application logic should access storage through a small repository/service boundary rather than scattering direct `localStorage` calls throughout components.

## Optional future backend

Worldwise does not need a backend for the MVP. A small service or Redis-backed endpoint may be considered later for anonymous aggregate results such as:

> You scored better than 72% of today's players.

This is not authorization to add one during initial development. Before adding a backend, define abuse prevention, privacy, data retention, challenge/version validation, offline behavior, deployment cost, and whether the feature creates enough value.

A traditional public leaderboard is not a current goal. It would shift the product away from self-improvement and introduce cheating and moderation concerns.

## MVP scope

The first complete version should aim for:

- World as the default Daily collection; Europe available in Practice ([ADR-0007](./adr/0007-daily-uses-single-default-collection.md)).
- Compass, Arrange, and Border Run, each with easy/medium/hard tiers; medium is the required tier for Daily ([ADR-0003](./adr/0003-difficulty-tiers-optional-bonus.md)).
- A deterministic daily ritual: one required mode-challenge per enabled game mode (about three rounds each), plus optional bonus-tier mode-challenges the same day ([ADR-0002](./adr/0002-per-mode-daily-challenges.md)).
- Unlimited practice by mode, collection, and tier.
- Local daily progress, streaks, and basic statistics.
- A spoiler-free result that can be copied or shared.
- How-to-play, settings/about, data attribution, and local-data controls.
- A responsive, accessible, mobile-first experience.
- English and Spanish interface and content at launch, with real i18n infrastructure (string extraction, place-name localization) from day one rather than generation logic with embedded content ([ADR-0006](./adr/0006-bilingual-launch-english-spanish.md)).
- No login, backend, public leaderboard, or manual daily authoring.

If this is too broad for the first playable milestone, build the World collection and Compass end to end—including generation, validation, persistence, accessibility, feedback, and tests—before adding another mode. A complete vertical slice should precede breadth. Non-goals for the initial product are listed in [`AGENTS.md`](./AGENTS.md#non-goals).

## Suggested implementation order

1. Confirm the information architecture and complete state diagrams for the daily and practice flows.
2. Research and document geographic sources, licenses, coordinate semantics, and territory policy.
3. Scaffold Astro, Tailwind CSS, Lucide, strict TypeScript, Biome, and the test setup.
4. Define normalized place, collection, challenge, result, and persistence schemas.
5. Build and test deterministic seed/version infrastructure.
6. Implement one end-to-end Compass vertical slice with deliberately minimal presentation.
7. Use Claude Design to explore several visual directions from the confirmed screens and states, then record the selected design system.
8. Apply the chosen design and complete the daily flow.
9. Add Arrange, Border Run, practice, statistics, and sharing incrementally.
10. Perform mobile, accessibility, data-quality, and deterministic-regression testing before release.

## Open product decisions

Most of the questions that used to appear here have been resolved and recorded as ADRs in `docs/adr/`. The decisions that remain genuinely open:

- What visual direction will be selected after the Claude Design exploration?
- If a rotating daily program (multiple default collections over time) is introduced later, how should it be scheduled and versioned?
- Should the roughly three rounds per mode-challenge be tuned once a playable vertical slice exists?
