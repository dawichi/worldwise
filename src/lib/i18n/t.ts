import en from "./dictionaries/en.json";
import es from "./dictionaries/es.json";

export type Locale = "en" | "es";

export function pageLocale(
    currentLocale: string | undefined,
    url: URL,
): Locale {
    if (url.searchParams.get("lang") === "es") {
        return "es";
    }
    return currentLocale === "es" ? "es" : "en";
}

type Dictionary = typeof en;

/**
 * Every locale's dictionary must structurally match `en`'s shape (the
 * source of truth) — a missing key in `es.json` fails to typecheck here,
 * turning an incomplete translation into a compile error rather than a
 * silent runtime gap.
 */
const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

/** Recursively unions every dot-notation path to a string leaf, e.g. "common.continue". */
type DotPath<T> = T extends string
    ? never
    : {
          [K in keyof T & string]: T[K] extends string
              ? K
              : `${K}.${DotPath<T[K]>}`;
      }[keyof T & string];

export type TranslationKey = DotPath<Dictionary>;

function resolvePath(dictionary: Dictionary, path: string): string {
    const segments = path.split(".");
    let node: unknown = dictionary;

    for (const segment of segments) {
        if (node !== null && typeof node === "object" && segment in node) {
            node = (node as Record<string, unknown>)[segment];
        } else {
            node = undefined;
            break;
        }
    }

    if (typeof node !== "string") {
        throw new Error(
            `t(): missing or non-string translation for key "${path}"`,
        );
    }
    return node;
}

/**
 * Translates `key` for `locale`, substituting any `{placeholder}` tokens
 * found in the template with `params`. `key` is checked against `en`'s
 * dictionary shape at compile time.
 */
export function t(
    locale: Locale,
    key: TranslationKey,
    params?: Record<string, string | number>,
): string {
    const template = resolvePath(DICTIONARIES[locale], key);

    if (!params) {
        return template;
    }

    return Object.entries(params).reduce(
        (result, [name, value]) =>
            result.replaceAll(`{${name}}`, String(value)),
        template,
    );
}
