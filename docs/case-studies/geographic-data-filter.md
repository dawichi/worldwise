# How a country filter silently removed twelve countries

Worldwise builds its World collection from Natural Earth's 1:50m country layer. An early filter accepted records only when `TYPE === "Sovereign country"`. It seemed precise, but the generated collection did not contain France. A Border Run smoke check tried to resolve France and exposed the problem.

Natural Earth does not use one `TYPE` label for every country's metropolitan record. A state that administers overseas territories may have one row for the mainland country and separate rows for dependencies. The mainland row can be typed `"Country"` or `"Sovereignty"`, while dependencies can also use `"Country"`. The type field could not safely distinguish the sovereign state from its dependent territories.

The reliable discriminator was the relationship between two source fields: `SOVEREIGNT === ADMIN` identifies a row administered as the sovereign entity itself. The build also excludes records with `UN_A3 === "-099"` and records typed `"Indeterminate"`, which filters self-administered contested entities and non-country records.

That change recovered twelve real countries: France, the United Kingdom, the United States, China, Australia, New Zealand, the Netherlands, Denmark, Finland, Kazakhstan, Cuba, and Israel. The source and exact filter are recorded in [`src/data/world/source.md`](../../src/data/world/source.md); the build validates the resulting collection so a future source change fails visibly.

## Why this matters

The bug was not a missing UI label. It changed which places could appear in every generated mode and which land-border routes existed. Geographic filtering is part of game correctness, so the source rule, country count, and representative edge cases belong in the build and documentation.
