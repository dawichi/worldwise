# Daily challenges reset at UTC midnight

The daily key must resolve to exactly one challenge per calendar day across all players, and the doc's own daily-key example (`...:2026-07-31:default`) assumes a single global date. We decided the daily challenge resets at UTC midnight rather than the player's local midnight, because it gives one unambiguous global challenge per day and keeps deterministic generation and testing free of timezone-dependent logic. The trade-off is that players outside UTC see the new challenge at a non-midnight local hour, which is a deliberately accepted cost.
