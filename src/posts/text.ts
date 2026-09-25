/**
 * Post content as data, never as HTML (Plan.md, Nächste Schritte 33): the API
 * hands back the text as written – plain text with `\n\n` paragraphs (G37).
 * `**bold**` and Markdown links are read in case an author uses them; whether
 * the ChurchTools editor offers them is open.
 */

export type PostInline = { kind: 'text' | 'strong'; text: string };

/**
 * Splits content into paragraphs at blank lines. A single line break inside a
 * paragraph stays as `\n` in the text – shown with `white-space: pre-line` –
 * and `**bold**` becomes its own inline; a link `[text](url)` keeps only its
 * text.
 */
export function postParagraphs(content: string): PostInline[][] {
    return content
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph !== '')
        .map(paragraphInlines);
}

function paragraphInlines(paragraph: string): PostInline[] {
    const withoutLinks = paragraph.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    return withoutLinks
        .split(/(\*\*[^*]+\*\*)/g)
        .filter((part) => part !== '')
        .map((part) =>
            part.startsWith('**') && part.endsWith('**')
                ? { kind: 'strong' as const, text: part.slice(2, -2) }
                : { kind: 'text' as const, text: part },
        );
}

/** The first paragraph as plain text on one line, markers removed – for the list. */
export function postSummary(content: string): string {
    const [first] = postParagraphs(content);
    if (!first) return '';
    return first
        .map((inline) => inline.text)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
}
