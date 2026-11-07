/**
 * Markdown from ChurchTools as data, never as HTML (Plan.md, Punkt 97 und 116, Befunde.md G62, G77): the
 * editor stores GitHub Markdown in posts, group descriptions and appointment descriptions. It is read
 * with micromark (CommonMark plus GFM tables and strikethrough) into a syntax tree; only what a screen
 * can show is kept – bold, italic, strikethrough, code, headings, lists, quotes, tables. A link or a
 * mention `[Title](address?ctmd_layout=…)` keeps its title; images and HTML fall away.
 */

import type { List, PhrasingContent, RootContent, Table } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';

export type MdInline = { text: string; strong?: true; em?: true; del?: true; code?: true };

export type MdBlock =
    | { kind: 'paragraph'; inlines: MdInline[] }
    | { kind: 'heading'; inlines: MdInline[] }
    | { kind: 'list'; ordered: boolean; start: number; items: MdInline[][] }
    | { kind: 'quote'; inlines: MdInline[] }
    | { kind: 'table'; align: ('left' | 'center' | 'right' | null)[]; head: MdInline[][]; rows: MdInline[][][] };

type Format = Pick<MdInline, 'strong' | 'em' | 'del'>;

/** Splits text into blocks, read from the syntax tree; nested lists stay flat. */
export function markdownBlocks(text: string): MdBlock[] {
    const source = text.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '');
    const tree = fromMarkdown(source, {
        extensions: [gfmTable(), gfmStrikethrough()],
        mdastExtensions: [gfmTableFromMarkdown(), gfmStrikethroughFromMarkdown()],
    });
    const blocks: MdBlock[] = [];
    for (const node of tree.children) {
        const block = toBlock(node);
        if (block && !isEmpty(block)) blocks.push(block);
    }
    return blocks;
}

function isEmpty(block: MdBlock): boolean {
    if (block.kind === 'list') return block.items.length === 0;
    if (block.kind === 'table') return [...block.head, ...block.rows.flat()].every((cell) => cell.length === 0);
    return block.inlines.length === 0;
}

function toBlock(node: RootContent): MdBlock | null {
    switch (node.type) {
        case 'paragraph':
            return { kind: 'paragraph', inlines: phrasing(node.children) };
        case 'heading':
            return { kind: 'heading', inlines: phrasing(node.children) };
        case 'code':
            return { kind: 'paragraph', inlines: plain(node.value) };
        case 'list': {
            const items: MdInline[][] = [];
            listItems(node, items);
            return { kind: 'list', ordered: !!node.ordered, start: node.ordered ? (node.start ?? 1) : 1, items };
        }
        case 'blockquote': {
            const lines = quoteLines(node.children);
            const inlines: MdInline[] = [];
            lines.forEach((line, i) => inlines.push(...(i > 0 ? [{ text: '\n' }] : []), ...line));
            return { kind: 'quote', inlines: mergeInlines(inlines) };
        }
        case 'table':
            return tableBlock(node);
        default:
            // thematicBreak, html, definition, footnotes …
            return null;
    }
}

function plain(value: string): MdInline[] {
    const trimmed = value.trim();
    return trimmed ? [{ text: trimmed }] : [];
}

/** The items of a list in document order; a nested list's items follow the item they belong to. */
function listItems(list: List, out: MdInline[][]): void {
    for (const item of list.children) {
        let own: MdInline[] = [];
        const nested: List[] = [];
        for (const child of item.children) {
            if (child.type === 'list') {
                nested.push(child);
                continue;
            }
            for (const line of quoteLines([child])) own = mergeInlines([...own, ...(own.length ? [{ text: ' ' }] : []), ...line]);
        }
        if (own.length) out.push(own);
        for (const sub of nested) listItems(sub, out);
    }
}

/** A block level node as lines of inlines: a paragraph is one, a list item one each, a table row one each. */
function quoteLines(nodes: RootContent[]): MdInline[][] {
    const lines: MdInline[][] = [];
    for (const node of nodes) {
        if (node.type === 'list') {
            const items: MdInline[][] = [];
            listItems(node, items);
            lines.push(...items);
        } else if (node.type === 'blockquote') {
            lines.push(...quoteLines(node.children));
        } else if (node.type === 'table') {
            const block = tableBlock(node);
            if (block.kind === 'table') lines.push(...tableLines(block).map((l) => l.map((part) => ({ ...part }))));
        } else {
            const block = toBlock(node);
            if (block && 'inlines' in block && block.inlines.length) lines.push(block.inlines);
        }
    }
    return lines;
}

function tableBlock(node: Table): MdBlock {
    const [head, ...rows] = node.children.map((row) => row.children.map((cell) => phrasing(cell.children)));
    return {
        kind: 'table',
        align: node.align?.map((a) => a ?? null) ?? [],
        head: head ?? [],
        rows,
    };
}

/** A table as lines for text and cards: a line per row, cells joined by " · ", the head bold. */
function tableLines(table: Extract<MdBlock, { kind: 'table' }>): MdInline[][] {
    const rowLine = (cells: MdInline[][], strong: boolean): MdInline[] => {
        const parts: MdInline[] = [];
        cells
            .filter((cell) => cell.length > 0)
            .forEach((cell, i) => parts.push(...(i > 0 ? [{ text: ' · ' }] : []), ...cell.map((part) => (strong ? { ...part, strong: true as const } : part))));
        return parts;
    };
    return [rowLine(table.head, true), ...table.rows.map((row) => rowLine(row, false))].filter((line) => line.length > 0);
}

/**
 * All of it on one line, without markers; blocks are separated by a space, list items by ", ", table
 * cells by " · " and table rows by a space. `firstBlockOnly` stops after the first block – the summary
 * of a post in the list.
 */
export function markdownText(text: string, firstBlockOnly = false): string {
    const blocks = markdownBlocks(text);
    const parts = (firstBlockOnly ? blocks.slice(0, 1) : blocks).map((block) => {
        if (block.kind === 'list') return block.items.map(flat).join(', ');
        if (block.kind === 'table') return tableLines(block).map(flat).join(' ');
        return flat(block.inlines);
    });
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * The same as lines for a card that measures its room: a heading is a bold line, a list item a line
 * with "• " or "1. ", a quote and a paragraph one line per line break, a table row one line.
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
        } else if (block.kind === 'table') {
            lines.push(...tableLines(block));
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

/** Inline nodes as formatted pieces; images and HTML give nothing, links only their words. */
function phrasing(nodes: PhrasingContent[]): MdInline[] {
    const merged = mergeInlines(walk(nodes, {}));
    const first = merged[0];
    const end = merged[merged.length - 1];
    if (first && !first.code) first.text = first.text.trimStart();
    if (end && !end.code) end.text = end.text.trimEnd();
    return merged.filter((part) => part.text !== '');
}

function walk(nodes: PhrasingContent[], fmt: Format): MdInline[] {
    const result: MdInline[] = [];
    for (const node of nodes) {
        switch (node.type) {
            case 'text':
                result.push({ ...fmt, text: node.value });
                break;
            case 'inlineCode':
                result.push({ ...fmt, text: node.value, code: true });
                break;
            case 'break':
                result.push({ ...fmt, text: '\n' });
                break;
            case 'strong':
                result.push(...walk(node.children, { ...fmt, strong: true }));
                break;
            case 'emphasis':
                result.push(...walk(node.children, { ...fmt, em: true }));
                break;
            case 'delete':
                result.push(...walk(node.children, { ...fmt, del: true }));
                break;
            case 'link':
            case 'linkReference':
                result.push(...walk(node.children, fmt));
                break;
            default:
                // image, imageReference, html, footnoteReference
                break;
        }
    }
    return result;
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
