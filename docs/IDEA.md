# Worldwise

## Document purpose

This document is the product and implementation source of truth for Worldwise. It should help contributors and AI agents understand what we are building, why particular decisions were made, and which decisions remain intentionally open.

The product definition should change deliberately. When an implementation decision materially changes the concept, scope, game rules, data model, or technical direction, update this document in the same change.

## One-sentence definition

Worldwise is a mobile-first geography arcade where players improve their mental map of the world through short daily challenges about direction, distance, order, borders, and other relationships between places.

## Product vision

Worldwise should feel like a small, refined daily ritual for people who enjoy geography. It borrows the accessibility and repeatability of daily games without copying Wordle's word-deduction mechanic or GeoGuessr's imagery and map-identification mechanic.

The game is primarily about geographic intuition:

> I know these places, but do I understand how they relate to one another?

Worldwise is not intended to become a huge quiz platform or to chase virality. It is a carefully finished side project that should be interesting to discuss in job interviews and enjoyable enough to play with friends and family. Mobile is the primary experience, although desktop must remain fully supported.

## Product principles

1. **Relationships over isolated trivia.** Prefer direction, proximity, adjacency, ordering, scale, and routes over questions that only test memorized facts.
2. **Learn in seconds.** A new player should understand a challenge after one short instruction and an example.
3. **Short but replayable.** The daily experience should take roughly three to five minutes, while practice should allow unlimited play.
4. **Compete with yourself.** Streaks, history, accuracy, and personal bests matter more than public rankings.
5. **Fair generation.** Generated challenges must be deterministic, valid, unambiguous, and appropriately difficult.
6. **Geographic breadth.** The system should support multiple collections, from the whole world to regions such as Europe or the autonomous communities of Spain.
7. **A polished small product.** A focused and dependable experience is more valuable than a long list of half-finished modes.
8. **Accessible by default.** The experience must not depend only on color, precise pointer input, or animation.

## Core experience

Worldwise has two complementary ways to play.

### Daily challenge

The daily challenge is the main ritual. Every player receives the same generated challenge for a given date and game-data version.

Initial target:

- One challenge per day.
- Approximately five rounds.
- A mixture of supported game modes.
- One recorded attempt per day.
- A final score and per-round feedback.
- A streak and personal history stored locally.
- A shareable spoiler-free result.

Refreshing the page, changing the device clock, or reopening the application must not accidentally create a different challenge for the same daily key. The exact policy for interrupted attempts and intentional resets must be defined before implementation.

### Practice

Practice lets players continue after the daily challenge or train a particular skill.

- Unlimited randomly generated challenges.
- Selection by geographic collection and game mode where supported.
- Practice results do not affect the daily streak or daily score.
- Practice may keep separate local statistics such as attempts and accuracy.
- Repeated challenges should be avoided within a reasonable recent-history window.

Practice randomness does not need to be shared between players, but challenge validation must use the same rules as the daily generator.

## Game modes

The architecture should treat modes as independent verticals with shared concepts for generation, validation, scoring, persistence, and presentation. We should launch with a small set and add modes only when they introduce a genuinely different geographic skill.

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

Special cases such as overseas territories, disputed borders, enclaves, and maritime borders must follow a documented dataset policy.

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

Generation should use a stable seed derived from at least:

- A date in `YYYY-MM-DD` format.
- A game/generator version.
- A data version.
- The collection or daily-program identifier.

Conceptual example:

```text
worldwise:daily:v1:data-v1:2026-07-31:default
```

The same key must generate the same complete challenge in every supported browser. Do not rely on `Math.random()` for daily content. Use a small, tested deterministic pseudo-random generator fed by a stable hash, or a carefully selected dependency with consistent cross-platform behavior.

The initial recommendation is to use the UTC calendar date so a future global comparison has one unambiguous challenge. This is an implementation direction, not yet a final product decision: using the player's local date may feel more natural at midnight. The choice must be finalized before daily streaks are implemented and then treated as a compatibility decision.

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
- Exclusion or special handling of disputed territories.
- A difficulty band appropriate for the current session.
- No duplicate place within a round unless the mechanic requires it.
- No accidental repetition across consecutive daily challenges when reasonably avoidable.

Property-based tests are particularly valuable for proving these invariants across many seeds and dates.

## Scoring and progression

The exact formula is intentionally undecided. It should be simple enough that players understand why they received a score.

Possible inputs are:

- Correctness.
- Degree of error where the mode has meaningful partial accuracy.
- Number of attempts.
- Time, used cautiously so accessibility and thoughtful play are not punished.

The MVP should prioritize correctness and understandable partial credit over speed. Daily results could use a normalized score such as 0–1,000, but this is not yet a requirement.

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

## Technical direction

### Core stack

- **Astro** as the application framework.
- **Tailwind CSS** for styling.
- **Lucide** via the Astro-compatible package for interface icons.
- **TypeScript** with the strictest practical compiler settings.
- **Biome** for formatting and linting, configured restrictively.

The site should use Astro's static output unless a future server feature gives us a concrete reason to change. Prefer Astro components and browser-native functionality. Add a client framework only if a particular interactive game becomes substantially clearer to implement and maintain with one; do not add React, Vue, Svelte, or another renderer preemptively.

### Styling rules

- Use Tailwind utilities for nearly all styling.
- Avoid custom CSS, Sass, CSS modules, CSS-in-JS, and additional styling systems.
- Custom CSS is acceptable only when Tailwind cannot reasonably express an animation or genuinely complex behavior.
- Keep exceptional custom CSS small, documented, and colocated predictably.
- Do not use inline SVG for common interface icons when Lucide provides an appropriate icon.
- Icons need accessible labels when they convey meaning and should be hidden from assistive technology when decorative.

### TypeScript rules

Use Astro's strictest supported TypeScript base configuration and enable additional safe compiler checks where compatible. Desired standards include:

- No implicit `any`.
- No unchecked indexed access.
- Exact optional property semantics.
- No unnecessary fallthrough in switch statements.
- No implicit returns.
- Explicit handling of unknown external data.
- Exhaustive handling of discriminated unions for game modes and persisted schema versions.

Avoid type assertions used merely to silence the compiler. Geographic data and `localStorage` content are runtime inputs and must be validated at their boundaries.

### Biome rules

Biome should be the single formatter and primary linter for supported files.

- Four spaces for indentation, using spaces rather than tabs.
- Import organization enabled.
- Recommended rules enabled, then strengthened where they improve correctness and consistency.
- Treat lint warnings as CI failures.
- Avoid broad ignore rules. Any suppression should be narrow and explain why the code is safe.
- Run formatting, linting, and type checking in CI.

The goal is a restrictive but useful configuration. Do not enable rules that fight Astro syntax, generated data, accessibility, or clarity solely to maximize the number of enabled rules.

### Candidate dependencies

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

### Testing priorities

The most important code is not the page markup; it is the content generator and geographic correctness.

Tests should cover:

- Identical output for identical seed, generator version, and data version.
- Expected changes when a version changes.
- Daily generation across a large range of dates without crashes or invalid rounds.
- Geographic calculations near the antimeridian, poles, and directional boundaries.
- Mode-specific ambiguity and difficulty rules.
- Border-graph connectivity and shortest-path behavior.
- Persistence validation, migrations, interrupted games, and corrupt storage.
- Keyboard and touch completion of every game mode.
- Key mobile viewport flows.

CI should run formatting checks, linting, Astro/TypeScript checks, unit tests, and the essential end-to-end suite.

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

## Accessibility, privacy, and internationalization

Accessibility is part of the game design:

- Every interaction must work with keyboard and touch.
- Dragging must have an equivalent non-drag interaction.
- Focus states and focus order must be deliberate.
- Feedback must not depend only on color or sound.
- Motion must respect `prefers-reduced-motion`.
- Controls must have meaningful accessible names.
- Game instructions and result announcements should work with screen readers.
- Touch targets should be comfortably sized for mobile use.

Privacy should remain simple: no account, no personal profile, and no analytics by default. If analytics are proposed later, they require an explicit product decision and should be privacy-preserving.

The initial language can be English, but content must not be embedded inside generation logic. Place names, mode instructions, and interface strings should be structured so Spanish and other languages can be added without redesigning the game engine. A full internationalization dependency is not required until a second language is actually implemented.

## MVP scope

The first complete version should aim for:

- World and Europe collections.
- Compass, Arrange, and Border Run.
- A deterministic five-round daily challenge.
- Unlimited practice by mode and collection.
- Local daily progress, streaks, and basic statistics.
- A spoiler-free result that can be copied or shared.
- How-to-play, settings/about, data attribution, and local-data controls.
- A responsive, accessible, mobile-first experience.
- No login, backend, public leaderboard, or manual daily authoring.

If this is too broad for the first playable milestone, build one collection and Compass end to end—including generation, validation, persistence, accessibility, feedback, and tests—before adding another mode. A complete vertical slice should precede breadth.

## Non-goals for the initial product

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

These questions should be answered through prototypes or explicit discussion rather than accidental implementation choices:

- Does the daily challenge reset at UTC midnight or the player's local midnight?
- Does one daily challenge mix collections, or does it have a single collection/theme?
- How many rounds provide the best three-to-five-minute session?
- How is partial credit calculated for each mode?
- Does time affect score at all?
- Can an interrupted daily attempt be resumed indefinitely?
- How much answer explanation is educational without slowing the loop?
- Which territory and border policy is clearest and fairest?
- What is the first supported language, and when should Spanish be added?
- What visual direction will be selected after the Claude Design exploration?

## Working name and positioning

**Name:** Worldwise  
**Repository:** `worldwise`  
**Deployment shape:** `worldwise.<master-domain>`

Working positioning:

> A daily game for people who think they know the world.

Alternative supporting line:

> Understand the world, one challenge at a time.

The name, tagline, and final copy may evolve, but the relationship-based geography concept is the product's anchor.
