/**
 * The website block's frame (schema 1.9, Plan.md, Nächste Schritte 28).
 * ChurchTools lets foreign pages into frames (`child-src *`, G15); what the
 * frame may do is decided here, not by the author of the slide.
 */

export interface WebFrame {
    src: string;
    sandbox: string;
}

/**
 * The frame for an address, or null for one that is not shown: only https.
 * A foreign page keeps its own origin – without it most widgets fail – and
 * cannot reach ChurchTools across origins. A page of our own origin gets no
 * `allow-same-origin`: it would run with the session of the device or of the
 * designer.
 */
export function webFrame(url: string, ownOrigin: string): WebFrame | null {
    let parsed: URL;
    try {
        parsed = new URL(url.trim());
    } catch {
        return null;
    }
    if (parsed.protocol !== 'https:') return null;
    const foreign = parsed.origin !== ownOrigin;
    return { src: parsed.href, sandbox: foreign ? 'allow-scripts allow-same-origin' : 'allow-scripts' };
}
