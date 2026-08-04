export interface ShareResultCopy {
    appName: string;
    modeName: string;
    tierName: string;
    dateKey: string;
    scoreLabel: string;
    score: string;
    total: number;
    credits: number[];
    url: string;
}

export function buildSpoilerFreeResultText(copy: ShareResultCopy): string {
    const pattern = copy.credits
        .map((credit) => {
            if (credit === 1) {
                return "🟩";
            }
            return credit > 0 ? "🟨" : "🟧";
        })
        .join("");

    return [
        `${copy.appName} · ${copy.modeName} · ${copy.tierName}`,
        copy.dateKey,
        pattern,
        `${copy.scoreLabel}: ${copy.score} / ${copy.total}`,
        copy.url,
    ].join("\n");
}

async function copyText(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Report failure for restricted clipboard contexts, including
            // some installed web views.
        }
    }

    return false;
}

export interface ShareButtonCopy {
    shareResult: string;
    shared: string;
    copied: string;
    failed: string;
}

export function mountShareButton(
    button: HTMLButtonElement,
    status: HTMLElement,
    text: string,
    copy: ShareButtonCopy,
): void {
    button.addEventListener("click", async () => {
        button.disabled = true;
        status.textContent = "";
        try {
            if (navigator.share) {
                await navigator.share({ title: copy.shareResult, text });
                status.textContent = copy.shared;
                return;
            }

            status.textContent = (await copyText(text))
                ? copy.copied
                : copy.failed;
        } catch (error) {
            // A user-cancelled native share is not an error to announce.
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }
            status.textContent = copy.failed;
        } finally {
            button.disabled = false;
        }
    });
}
