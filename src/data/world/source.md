# World collection — data source

## Source

[Natural Earth](https://www.naturalearthdata.com/) 1:50m cultural vectors, public domain,
via the `nvkelso/natural-earth-vector` GitHub mirror:

- `ne_50m_admin_0_countries.geojson` — country identity, names, ISO codes.
- `ne_50m_populated_places.geojson` — capital-city coordinates.

Fetched and normalized by `scripts/build-world-data.ts` (`bun run data:build`) into the
committed `src/data/generated/world.ts`. Raw downloads are cached under gitignored
`.data/raw/` and re-fetched automatically if missing; the build never touches the network
during `bun install` or `astro build`.

**Source version recorded on each place**: `sourceVersion: "natural-earth-50m"`.

## Coordinate semantic

Each country's representative point is its **national capital coordinate**, not a
centroid or label point. This is a deliberate choice (IDEA.md requires picking one and
documenting it): direction/distance answers from a capital are intuitive to check by hand,
and a geographic centroid would silently produce different, less legible answers for
large or irregularly-shaped countries (e.g. Russia, Chile, Indonesia).

## Country filter

A country is included only if, in `ne_50m_admin_0_countries.geojson`:

- `SOVEREIGNT === ADMIN`, **and**
- `UN_A3 !== "-099"`, **and**
- `TYPE !== "Indeterminate"`.

This yields **193 sovereign, UN-recognized countries** (plus the Holy See/Vatican City,
a UN observer rather than a full member — an accepted, pre-existing imprecision in
"UN-recognized" here, not something this filter tries to special-case out).

### `SOVEREIGNT === ADMIN` is the real discriminator, not `TYPE`

An earlier version of this filter used `TYPE === "Sovereign country" && UN_A3 !==
"-099"`. That was a bug, found while building Border Run's land-adjacency graph (a
smoke test tried to look up France and it didn't exist): **`TYPE` alone silently
excluded twelve real countries** — France, the United Kingdom, the United States,
China, Australia, New Zealand, the Netherlands, Denmark, Finland, Kazakhstan, Cuba,
and Israel.

The reason is how Natural Earth models a country that also administers overseas or
otherwise-separate territories (`ADM0_DIF === 1`): it splits that country into one row
for the metropolitan/mainland territory plus one `"Dependency"`-typed row per overseas
territory — and the metropolitan row is typed `"Country"` or `"Sovereignty"`, **not**
`"Sovereign country"`, with no separate "whole sovereign entity" row filed under
`"Sovereign country"` at all. `TYPE === "Sovereign country"` alone can't tell a real
country's metropolitan row apart from an actual dependency, because plenty of real
dependencies (Jersey, Guernsey, Isle of Man, Aruba, Curaçao, Sint Maarten, Hong Kong,
Macau, Greenland, Åland) are *also* typed `"Country"`.

The reliable signal already present on every row is `SOVEREIGNT` (name of the state with
sovereignty over this territory) vs. `ADMIN` (name of this specific administrative
unit): equal only when a row represents itself — true for every real country regardless
of which `TYPE` label its metropolitan row happens to carry, false for every dependency
(e.g. Jersey has `SOVEREIGNT === "United Kingdom"` but `ADMIN === "Jersey"`).

The other two clauses catch what `SOVEREIGNT === ADMIN` alone doesn't:

- `UN_A3 !== "-099"` excludes contested entities with no UN M49 area code at all —
  Taiwan, Somaliland, and Kosovo all pass `SOVEREIGNT === ADMIN` (they self-administer)
  but have `UN_A3 === "-099"`.
- `TYPE !== "Indeterminate"` excludes Western Sahara and Antarctica, the only two
  remaining rows that pass both of the above checks but aren't countries.

(Palestine, the Falkland Islands, British Indian Ocean Territory, and Siachen Glacier
are already excluded by `SOVEREIGNT === ADMIN` alone, since each names a different
sovereign administrator. Israel is legitimately included despite being Natural-Earth-typed
`"Disputed"` — that label reflects territorial/border disputes, not a dispute over
Israel's own statehood, and it passes every other check.)

## Land-border adjacency (`landBorders`, for Border Run)

Natural Earth's admin-0 countries layer has no adjacency field, and per
[ADR-0005](../../../docs/adr/0005-border-run-excludes-disputed-territories.md) the graph
should only include land borders with broad consensus among *already-included* places —
so it's computed at build time from the same polygon geometry, rather than sourced or
hand-curated separately, via `scripts/lib/computeAdjacency.ts`:

1. Each included country's polygon/multipolygon geometry is flattened into a flat list of
   boundary points, across **every** ring — exterior *and* interior (holes). Holes matter:
   an enclave borders the country around it along the boundary of a hole in that
   country's polygon, not along its own exterior ring (Lesotho only touches the hole South
   Africa's polygon has cut for it; San Marino only touches the hole in Italy's).
2. Two countries are marked land-adjacent if the minimum distance between any pair of
   their boundary points is **≤ 3 km**. A small positive threshold (rather than requiring
   exact point coincidence) bridges gaps introduced by 1:50m simplification, while
   staying far below every real strait separating two non-adjacent included countries
   (Gibraltar ~13 km, the English Channel ~33 km) — so it doesn't invent a border across
   open water.
3. A centroid/radius bound (triangle inequality: two countries' boundary points can't be
   within `thresholdKm` of each other if their centroids are farther apart than the sum of
   both radii plus the threshold) prefilters pairs that couldn't possibly be adjacent, so
   the expensive full point-to-point scan only runs for genuinely nearby candidates.

Validated by an integration test (`tests/unit/data/worldCollection.test.ts`) checking
well-known real borders are present, well-known near-misses across water are absent, both
enclave cases resolve correctly, island nations get an empty list, and the graph is
symmetric with no self-loops — this is the correctness gate for the whole Border Run
mode, since a wrong adjacency graph would silently produce wrong puzzles.

## Known data gaps and quirks (Natural Earth, not this project's invention)

- **Norway**: `ISO_A2`/`ISO_A3` are recorded as `"-99"` in the countries file; the `_EH`
  ("enhanced") columns carry the real codes (`NO` / `NOR`) and are used as a fallback.
- **Multiple capitals**: South Africa (Pretoria/Cape Town/Bloemfontein), Bolivia (La
  Paz/Sucre), and Ivory Coast (Yamoussoukro/Abidjan) each have more than one row flagged
  as a national capital in the source. The build script takes the **first occurrence in
  source file order**, which is stable and reproducible — a specific, defensible choice,
  not the "correct" seat of government in a political sense.
- **South Sudan**: its capital, Juba, is present in the source file with
  `FEATURECLA === "Admin-0 capital"` but not flagged `ADM0CAP === 1` (a Natural Earth
  tagging gap for this relatively new country). The build script treats either signal as
  "this is a capital," which resolves this without a manual override.
- **Nauru**: has no capital-flagged entry anywhere in Natural Earth's 1:50m *or* 1:10m
  populated-places layers. Rather than hand-inject an externally sourced coordinate not
  traceable to the declared source, **Nauru is excluded from the World collection** for
  now. This is logged by the build script (`Skipped 1 entries: Nauru (NR): no capital
  point in source data`) rather than silently dropped.

## Regenerating

```
bun run data:build
```

Re-fetches (if `.data/raw/` is empty) and rewrites `src/data/generated/world.ts` from
scratch. The script aborts loudly if the resulting place count drops below 150, as a
sanity check against a broken filter or a source-schema change.
