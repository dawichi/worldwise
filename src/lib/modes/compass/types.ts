import type { Tier } from "./tiers";

export interface CompassRound {
    originId: string;
    destinationId: string;
    /** Initial great-circle bearing from origin to destination, degrees [0, 360). */
    bearingDeg: number;
    distanceKm: number;
}

export interface CompassChallenge {
    id: string;
    generatorVersion: string;
    dataVersion: string;
    collectionId: string;
    tier: Tier;
    rounds: CompassRound[];
}
