import type { Collection } from "./collections.schema";
import type { Place } from "./places.schema";

export function getPlaceById(collection: Collection, id: string): Place {
    const place = collection.places.find((candidate) => candidate.id === id);
    if (!place) {
        throw new RangeError(
            `getPlaceById: no place with id "${id}" in collection "${collection.id}"`,
        );
    }
    return place;
}
