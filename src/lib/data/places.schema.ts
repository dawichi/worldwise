import { z } from "zod";

export const geoPointSchema = z.object({
    lat: z.number().gt(-90).lt(90),
    lon: z.number().gte(-180).lte(180),
});

export const placeSchema = z.object({
    id: z.string().min(1),
    kind: z.literal("country"),
    names: z.object({
        en: z.string().min(1),
        es: z.string().min(1),
    }),
    /** Representative point: the national capital coordinate (documented in
     * `src/data/world/source.md`), not a centroid. */
    point: geoPointSchema,
    iso2: z.string().length(2),
    iso3: z.string().length(3),
    sourceVersion: z.string().min(1),
});

export type Place = z.infer<typeof placeSchema>;
