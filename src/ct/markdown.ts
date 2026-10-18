/**
 * Markdown from ChurchTools as data, never as HTML (Plan.md, Punkt 97, Befunde.md G62): the editor
 * stores GitHub Markdown in posts, group descriptions and appointment descriptions. Only what a
 * screen can show is read – bold, italic, strikethrough, code, headings, lists, quotes. A link or a
 * mention `[Title](address?ctmd_layout=…)` keeps its title; images, tables and HTML fall away.
 */

export type MdInline = { text: string; strong?: true; em?: true; del?: true; code?: true };

export type MdBlock =
    | { kind: 'paragraph'; inlines: MdInline[] }
    | { kind: 'heading'; inlines: MdInline[] }
    | { kind: 'list'; ordered: boolean; start: number; items: MdInline[][] }
    | { kind: 'quote'; inlines: MdInline[] };

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/;
const LIST_ITEM = /^\s*(?:([-*+])|(\d{1,9})[.)])\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

/** Splits text into blocks at blank lines, headings, list items and quotes. */
export function markdownBlocks(text: string): MdBlock[] {
    const source = text
        .replace(/\r\n?/g, '\n')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '');
    const lines = source.split('\n');
    const blocks: MdBlock[] = [];
    let paragraph: string[] = [];
    let quote: string[] = [];
    let list: Extract<MdBlock, { kind: 'list' }> | null = null;

    const flushParagraph = () => {
        if (paragraph.length) add({ kind: 'paragraph', inlines: inlines(paragraph.map((l) => l.trim()).join('\n')) });
        paragraph = [];
    };
    const flushQuote = () => {
        if (quote.length) add({ kind: 'quote', inlines: inlines(quote.map((l) => l.trim()).join('\n')) });
        quote = [];
    };
    const flushAll = () => {
        flushParagraph();
        flushQuote();
        list = null;
    };
    const add = (block: MdBlock) => {
        const empty =
            block.kind === 'list' ? block.items.length === 0 : block.inlines.length === 0;
        if (!empty) blocks.push(block);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (line.trim() === '') {
            flushAll();
            continue;
        }
        if (FENCE.test(line)) {
            flushAll();
            const code: string[] = [];
            for (i++; i < lines.length && !FENCE.test(lines[i] ?? ''); i++) code.push(lines[i] ?? '');
            const joined = code.join('\n').trim();
            if (joined) add({ kind: 'paragraph', inlines: [{ text: joined }] });
            continue;
        }
        if (line.includes('|') && TABLE_SEPARATOR.test(lines[i + 1] ?? '') && (lines[i + 1] ?? '').includes('-')) {
            flushAll();
            for (i += 2; i < lines.length && (lines[i] ?? '').trim() !== '' && (lines[i] ?? '').includes('|'); i++);
            i--;
            continue;
        }
        if (RULE.test(line)) {
            flushAll();
            continue;
        }
        const heading = HEADING.exec(line);
        if (heading) {
            flushAll();
            add({ kind: 'heading', inlines: inlines(heading[1] ?? '') });
            continue;
        }
        const quoted = QUOTE.exec(line);
        if (quoted) {
            flushParagraph();
            list = null;
            quote.push(quoted[1] ?? '');
            continue;
        }
        const item = LIST_ITEM.exec(line);
        if (item) {
            flushParagraph();
            flushQuote();
            const ordered = item[2] !== undefined;
            // A nested item or one of the other kind of list is just one more item – lists stay flat.
            if (!list) {
                list = { kind: 'list', ordered, start: ordered ? Number(item[2]) : 1, items: [] };
                blocks.push(list);
            }
            const content = inlines(item[3] ?? '');
            if (content.length) list.items.push(content);
            continue;
        }
        if (list && /^\s/.test(line)) {
            // Continuation of the last item.
            const last = list.items.pop();
            list.items.push(mergeInlines([...(last ?? []), { text: ' ' }, ...inlines(line.trim())]));
            continue;
        }
        if (!paragraph.length && /^(?: {4}|\t)/.test(line)) {
            // Indented code: plain text.
            flushAll();
            add({ kind: 'paragraph', inlines: [{ text: line.trim() }] });
            continue;
        }
        flushQuote();
        list = null;
        paragraph.push(line);
    }
    flushAll();
    return blocks.filter((block) => block.kind !== 'list' || block.items.length > 0);
}

/**
 * All of it on one line, without markers; blocks are separated by a space, list items by ", ".
 * `firstBlockOnly` stops after the first block – the summary of a post in the list.
 */
export function markdownText(text: string, firstBlockOnly = false): string {
    const blocks = markdownBlocks(text);
    const parts = (firstBlockOnly ? blocks.slice(0, 1) : blocks).map((block) =>
        block.kind === 'list' ? block.items.map(flat).join(', ') : flat(block.inlines),
    );
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * The same as lines for a card that measures its room: a heading is a bold line, a list item a line
 * with "• " or "1. ", a quote and a paragraph one line per line break.
 */
export function markdownLines(text: string): MdInline[][] {
    const lines: MdInline[][] = [];
    for (const block of markdownBlocks(text)) {
        if (block.kind === 'heading') {
            lines.push(block.inlines.map((inline) => ({ ...inline, strong: true as const })));
        } else if (block.kind === 'list') {
            block.items.forEach((item, i) =>
                lines.push([{ text: block.ordered ? `${block.start + i}. ` : '• ' }, ...item]),
            );
        } else {
            lines.push(...splitLines(block.inlines));
        }
    }
    return lines;
}

function splitLines(parts: MdInline[]): MdInline[][] {
    const lines: MdInline[][] = [[]];
    for (const part of parts) {
        const pieces = part.text.split('\n');
        pieces.forEach((piece, i) => {
            if (i > 0) lines.push([]);
            if (piece !== '') lines[lines.length - 1]?.push({ ...part, text: piece });
        });
    }
    return lines.filter((line) => line.length > 0);
}

function flat(parts: MdInline[]): string {
    return parts.map((part) => part.text).join('');
}

// ---- Inline text ------------------------------------------------------------------------------

/** Backslash escapes travel through the parser as private-use characters. */
const ESCAPABLE = /\\([!-/:-@[-`{-~])/g;
const ESCAPE_BASE = 0xe000;

const EMPHASIS: { re: RegExp; fmt: Pick<MdInline, 'strong' | 'em' | 'del'> }[] = [
    { re: /\*\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*\*/g, fmt: { strong: true, em: true } },
    { re: /(?<!\w)___(?=\S)([\s\S]+?)(?<=\S)___(?!\w)/g, fmt: { strong: true, em: true } },
    { re: /\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/g, fmt: { strong: true } },
    { re: /(?<!\w)__(?=\S)([\s\S]+?)(?<=\S)__(?!\w)/g, fmt: { strong: true } },
    { re: /~~(?=\S)([\s\S]+?)(?<=\S)~~/g, fmt: { del: true } },
    { re: /\*(?=[^\s*])([\s\S]*?)(?<=\S)\*/g, fmt: { em: true } },
    { re: /(?<!\w)_(?=[^\s_])([\s\S]*?)(?<=\S)_(?!\w)/g, fmt: { em: true } },
];

function inlines(raw: string): MdInline[] {
    const escaped = raw.replace(ESCAPABLE, (_, char: string) => String.fromCharCode(ESCAPE_BASE + char.charCodeAt(0)));
    const result: MdInline[] = [];
    const code = /`([^`]+)`/g;
    let last = 0;
    for (let m = code.exec(escaped); m; m = code.exec(escaped)) {
        result.push(...emphasis(clean(escaped.slice(last, m.index)), {}));
        result.push({ text: m[1] ?? '', code: true });
        last = m.index + m[0].length;
    }
    result.push(...emphasis(clean(escaped.slice(last)), {}));
    const merged = mergeInlines(result.map((part) => ({ ...part, text: unescape(part.text) })));
    const first = merged[0];
    const end = merged[merged.length - 1];
    if (first && !first.code) first.text = first.text.trimStart();
    if (end && !end.code) end.text = end.text.trimEnd();
    return merged.filter((part) => part.text !== '');
}

/** Images, links, autolinks and HTML tags: only the visible words stay. */
function clean(text: string): string {
    return text
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/<(https?:\/\/[^>\s]+)>/g, '$1')
        .replace(/<\/?[a-zA-Z][^>]*>/g, '');
}

function emphasis(text: string, fmt: Pick<MdInline, 'strong' | 'em' | 'del'>): MdInline[] {
    let best: { index: number; length: number; inner: string; fmt: Pick<MdInline, 'strong' | 'em' | 'del'> } | null = null;
    for (const rule of EMPHASIS) {
        rule.re.lastIndex = 0;
        const m = rule.re.exec(text);
        if (m && (!best || m.index < best.index)) {
            best = { index: m.index, length: m[0].length, inner: m[1] ?? '', fmt: rule.fmt };
        }
    }
    if (!best) return text ? [{ ...fmt, text }] : [];
    return [
        ...(best.index > 0 ? [{ ...fmt, text: text.slice(0, best.index) }] : []),
        ...emphasis(best.inner, { ...fmt, ...best.fmt }),
        ...emphasis(text.slice(best.index + best.length), fmt),
    ];
}

function unescape(text: string): string {
    return text.replace(/[-]/g, (c) => String.fromCharCode(c.charCodeAt(0) - ESCAPE_BASE));
}

function mergeInlines(parts: MdInline[]): MdInline[] {
    const merged: MdInline[] = [];
    for (const part of parts) {
        if (part.text === '') continue;
        const prev = merged[merged.length - 1];
        if (prev && !prev.code && !part.code && !prev.strong === !part.strong && !prev.em === !part.em && !prev.del === !part.del) {
            prev.text += part.text;
        } else {
            merged.push({ ...part });
        }
    }
    return merged;
}
