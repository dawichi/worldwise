import type { Tier } from "./tiers";

export interface BorderRunRound {
    originId: string;
    destinationId: string;
}

export interface BorderRunChallenge {
    id: string;
    generatorVersion: string;
    dataVersion: string;
    collectionId: string;
    tier: Tier;
    rounds: BorderRunRound[];
}
