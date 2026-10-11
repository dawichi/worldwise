# Border Run rewards efficient land routes within a hop budget

Border Run should give a player a reason to plan a route instead of tapping through any valid sequence of neighbors. Each round's shortest land-border route is the optimal answer. A route at that length earns full credit. A longer valid route earns proportional partial credit while it stays within the tier's hop budget. A route that does not reach the destination through land borders, or exceeds the budget, earns no credit.

The hop budget is the shortest route plus a small tier-specific allowance. The shortest route remains hidden during the round; feedback reveals it on a map beside the player's submitted route. Elapsed time still has no effect on scoring.

This supersedes ADR-0004's Border Run-specific binary-scoring clause. Arrange's proportional scoring and Compass's angular scoring are unchanged.

## Rationale

The old rule made every valid path equally good, so a player could not lose after starting from a connected origin. Route length is a natural measure of route quality in this graph puzzle: it rewards efficient geographic reasoning, stays understandable without a timer, and makes a detour meaningful without making it an automatic failure.

The allowance keeps a round recoverable after a plausible detour. The map is shown only after submission so the player must still reason from the adjacency choices during play.
