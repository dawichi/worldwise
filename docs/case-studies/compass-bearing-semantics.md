# Why Compass separates flat-map direction from the shortest route

Compass originally asked which direction one place was from another and scored the initial great-circle bearing. That is mathematically correct, but it conflicts with the picture many players form from a flat map.

On a Mercator map, the straight segment between two points has a constant compass heading. That is a rhumb-line bearing. The shortest path over a sphere is a great circle; its initial bearing can point in a different direction because the route curves as it crosses the globe. A long trip from Washington toward Tokyo is a useful example: the line on a familiar flat map suggests west, while the shortest route starts toward the northwest and bends over the North Pacific.

Changing the answer to match the flat map would hide the geography lesson. Instead, Compass keeps the great-circle bearing as the scored answer, changes the prompt to ask where the shortest route sets off, and explains the difference after submission. The reveal puts the great-circle route, the straight Mercator line, and the player's arrow together on a map.

The game also records the chosen and reference bearings locally. Statistics can show whether a player often follows the flat-map direction and how their estimated destination positions differ from reality. That history is bounded, version-migrated, and never uploaded.

## Relevant code and decisions

- `src/lib/geo/bearing.ts` calculates the initial great-circle bearing.
- `src/lib/geo/route.ts` calculates rhumb bearings and sampled great-circle routes.
- `src/client/compassPlay.ts` explains and draws each answer.
- `src/lib/insights/mentalMap.ts` summarizes a player's local answer history.
- [ADR-0008](../adr/0008-compass-continuous-angle-scoring.md) defines continuous-angle scoring.
- [ADR-0010](../adr/0010-local-compass-mental-map-profile.md) defines the local mental-map profile.
