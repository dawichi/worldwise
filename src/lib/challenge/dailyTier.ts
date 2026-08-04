/** The tier every Daily mode-challenge resolves to unless a bonus tier is requested (ADR-0003). */
export const DAILY_REQUIRED_TIER = "medium" as const;

/** Optional same-day tiers a player may additionally complete; never gate the streak. */
export const DAILY_BONUS_TIER_IDS = ["easy", "hard"] as const;

export type DailyBonusTier = (typeof DAILY_BONUS_TIER_IDS)[number];
export type DailyTier = DailyBonusTier | typeof DAILY_REQUIRED_TIER;

/** Reads `?tier=easy|hard` from a URL's search params; anything else resolves to the required tier. */
export function parseDailyTierParam(searchParams: URLSearchParams): DailyTier {
    const raw = searchParams.get("tier");
    return raw === "easy" || raw === "hard" ? raw : DAILY_REQUIRED_TIER;
}

/** Key for a mode's `dailyBonus` map — the required tier never uses this, it stays keyed by `dateKey` alone. */
export function dailyBonusEntryKey(
    dateKey: string,
    tier: DailyBonusTier,
): string {
    return `${dateKey}:${tier}`;
}

/** Appends `?tier=` for a bonus tier; leaves the required tier's URL unchanged. */
export function withTierQuery(path: string, tier: DailyTier): string {
    return tier === DAILY_REQUIRED_TIER ? path : `${path}?tier=${tier}`;
}
