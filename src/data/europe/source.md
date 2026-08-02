# Europe collection — data source

Europe is a derived Practice collection: it reuses the normalized, committed
Natural Earth country records in `src/data/generated/world.ts`, including their
capital-point semantics, licenses, and land-border computation. No new raw data
is downloaded or redistributed.

## Inclusion rule

The collection contains 45 sovereign states conventionally treated as European:
the European UN-member set, plus Cyprus and the Holy See; transcontinental Russia
is included. Turkey, the South Caucasus, and Kazakhstan remain available in World
Practice but are deliberately outside this first bounded Europe collection.

Each included place retains only borders to other included places. This makes
Border Run routes valid within Europe and prevents an answer from passing through
a World-only country.
