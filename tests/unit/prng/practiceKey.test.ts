import { describe, expect, it } from "vitest";
import { buildPracticeSeed } from "../../../src/lib/prng/practiceKey";

describe("buildPracticeSeed", () => {
    it("is prefixed for namespacing", () => {
        expect(buildPracticeSeed()).toMatch(/^worldwise:practice:/);
    });

    it("is different on every call", () => {
        const a = buildPracticeSeed();
        const b = buildPracticeSeed();
        expect(a).not.toBe(b);
    });
});
