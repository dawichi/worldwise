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

- `TYPE === "Sovereign country"`, **and**
- `UN_A3 !== "-099"`.

`UN_A3` (the UN's own numeric country code) is only populated for UN-recognized states.
Combined with the `TYPE` filter, this objectively excludes disputed/breakaway entities
that Natural Earth otherwise files under `TYPE === "Sovereign country"` — Taiwan,
Somaliland, and the Turkish Republic of Northern Cyprus all have `UN_A3 === "-099"` and
are excluded by this rule, without the project having to hand-pick a list of contested
territories. Non-sovereign dependencies and constituent countries (`TYPE === "Country"` or
`"Dependency"` — Hong Kong, Macau, Greenland, Jersey, Guernsey, Isle of Man, Åland, Aruba,
Curaçao, Sint Maarten, and similar) are excluded by the `TYPE` filter itself.

This yields **181 sovereign, UN-recognized countries**.

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
