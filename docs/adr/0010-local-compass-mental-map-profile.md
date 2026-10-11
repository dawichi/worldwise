# Compass builds a personal mental-map profile from local answers

After each answered Compass round, Worldwise records the origin and destination ids, the chosen bearing, the true great-circle and flat-map bearings, the true distance, and the answer time. The bounded rolling history lives in the existing local persistence store and is never sent to a server.

The Statistics page uses those records to show average angular error, how often a guess followed the flat-map bearing when the two bearings clearly differed, accuracy by route distance, and repeated destination-position bias. For the map, it projects the player's chosen bearing along the real origin-to-destination distance and compares that estimated position with the destination's actual position.

This profile does not change challenge generation or scoring. Existing saved progress is migrated with an empty answer history; the profile begins collecting answers after the migration.

## Rationale

Worldwise is about improving a player's mental map, so the game should reflect patterns across rounds instead of treating every answer as an isolated score. Keeping the data local preserves the no-account, no-server privacy model. Storing the bearings and distance makes the profile reproducible without regenerating old daily challenges.
