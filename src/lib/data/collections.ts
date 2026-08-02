import { europeCollection } from "../../data/generated/europe";
import { worldCollection } from "../../data/generated/world";
import type { Collection } from "./collections.schema";

export const PRACTICE_COLLECTION_IDS = ["world", "europe"] as const;
export type PracticeCollectionId = (typeof PRACTICE_COLLECTION_IDS)[number];

const collections: Record<PracticeCollectionId, Collection> = {
    world: worldCollection,
    europe: europeCollection,
};

export function getPracticeCollection(id: string | null): Collection {
    return id === "europe" ? collections.europe : collections.world;
}
