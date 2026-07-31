# Worldwise

Worldwise is a mobile-first geography arcade about relationships between places (direction, distance, order, adjacency) rather than isolated trivia.

## Language

**Game mode**:
A specific challenge mechanic and interaction pattern, such as Compass, Arrange, or Border Run. Each mode defines its own generation, validation, and scoring rules.
_Avoid_: category, vertical, challenge type

**Collection**:
A coherent set of playable places and their relationships, such as World, Europe, or Autonomous Communities of Spain. A collection declares which game modes it supports.
_Avoid_: category, vertical, dataset, region

**Round**:
A single question or interaction instance within a mode-challenge.
_Avoid_: challenge, question (when precision matters)

**Mode-challenge**:
One game mode's challenge for a given day, collection, and tier, composed of several rounds. A day's daily ritual is one required-tier mode-challenge per enabled game mode.
_Avoid_: challenge (on its own, when the daily ritual as a whole is meant), vertical

**Daily ritual**:
The complete set of required-tier mode-challenges a player completes for a given day, one per enabled game mode. Completing it advances the streak; it is distinct from any optional bonus-tier mode-challenges played that day.
_Avoid_: daily challenge (ambiguous between this and a single mode-challenge)

**Tier**:
A difficulty level for a mode-challenge, such as easy, medium, or hard. Exactly one tier is required per mode per day and counts toward the streak; other tiers are optional bonus content.
_Avoid_: difficulty (on its own), level, category
