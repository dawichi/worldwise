import type { Tier } from "./tiers";

export type ArrangeVariant =
    | "north-to-south"
    | "west-to-east"
    | "closest-to-farthest";

export interface ArrangeRound {
    variant: ArrangeVariant;
    /** Presented (shuffled) order — guaranteed not to equal correctOrderIds. */
    itemIds: string[];
    /** The same ids as itemIds, in the correct order for this round's variant. */
    correctOrderIds: string[];
    /** Only set for "closest-to-farthest": the reference place's id. */
    referenceId?: string;
}

export interface ArrangeChallenge {
    id: string;
    generatorVersion: string;
    dataVersion: string;
    collectionId: string;
    tier: Tier;
    rounds: ArrangeRound[];
}
