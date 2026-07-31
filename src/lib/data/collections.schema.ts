import { z } from "zod";
import { placeSchema } from "./places.schema";

export const collectionSchema = z.object({
    id: z.string().min(1),
    names: z.object({
        en: z.string().min(1),
        es: z.string().min(1),
    }),
    supportedModes: z.array(z.string()).min(1),
    places: z.array(placeSchema).min(1),
});

export type Collection = z.infer<typeof collectionSchema>;
