/** UTC calendar date as `YYYY-MM-DD`, per ADR-0001 (daily reset at UTC midnight). */
export function getUtcDateKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export interface DailyKeyParams {
    generatorVersion: string;
    dataVersion: string;
    date: string;
    collectionId: string;
    modeId: string;
    tierId: string;
}

/**
 * Builds the stable seed string a mode-challenge is generated from, per
 * IDEA.md's "Deterministic challenge generation" section, e.g.
 * `worldwise:daily:v1:data-v1:2026-07-31:world:compass:medium`.
 */
export function buildDailyKey(params: DailyKeyParams): string {
    const {
        generatorVersion,
        dataVersion,
        date,
        collectionId,
        modeId,
        tierId,
    } = params;
    return `worldwise:daily:${generatorVersion}:${dataVersion}:${date}:${collectionId}:${modeId}:${tierId}`;
}
