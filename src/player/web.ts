/**
 * The website block's frame (schema 1.9, Plan.md, Nächste Schritte 28).
 * ChurchTools lets foreign pages into frames (`child-src *`, G15); what the
 * frame may do is decided here, not by the author of the slide.
 */

export interface WebFrame {
    src: string;
    sandbox: string;
}

/** Why an address is not shown: no https address, or a page of the own ChurchTools. */
export type WebRefusal = 'not-https' | 'own-instance';

/**
 * Null for an address the block shows, else why not. Only https, and never a
 * page of our own origin: the browser would load it with the cookies of
 * whoever looks at the slide – the device or a designer –, and an address
 * that does something when merely opened would do it in their name.
 */
export function webRefusal(url: string, ownOrigin: string): WebRefusal | null {
    let parsed: URL;
    try {
        parsed = new URL(url.trim());
    } catch {
        return 'not-https';
    }
    if (parsed.protocol !== 'https:') return 'not-https';
    return parsed.origin === ownOrigin ? 'own-instance' : null;
}

/**
 * The frame for an address, or null for one that is not shown (`webRefusal`).
 * The foreign page keeps its own origin – without it most widgets fail – and
 * cannot reach ChurchTools across origins.
 */
export function webFrame(url: string, ownOrigin: string): WebFrame | null {
    if (webRefusal(url, ownOrigin)) return null;
    return { src: new URL(url.trim()).href, sandbox: 'allow-scripts allow-same-origin' };
}

/** "gemeinde.de/seite" → "https://gemeinde.de/seite": an address typed without a scheme is taken as https. */
export function withScheme(input: string): string {
    const text = input.trim();
    if (!text || /^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;
    return `https://${text.replace(/^\/+/, '')}`;
}

/**
 * The address in what was pasted into the website block: for an embed code (`<iframe src="…">`) the `src` of its
 * first frame – `//host/…` as https –, an empty string when it has none; anything else comes back unchanged.
 * Read with the parser, never put into the page, so the code's scripts do not run.
 */
export function embedAddress(input: string): string {
    if (!/<iframe/i.test(input)) return input;
    const src = new DOMParser().parseFromString(input, 'text/html').querySelector('iframe')?.getAttribute('src')?.trim() ?? '';
    return src.startsWith('//') ? `https:${src}` : src;
}
