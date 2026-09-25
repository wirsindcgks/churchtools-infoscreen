/**
 * CHANGELOG.md for the "Über & Neuigkeiten" page: the one list of changes,
 * written once for the release notes and shown in the module as it is. Only
 * the subset "Keep a Changelog" uses is read – versions, groups, bullets with
 * bold, code and links – and turned into data, never into HTML.
 */

export type Inline =
    | { kind: 'text'; text: string }
    | { kind: 'strong'; text: string }
    | { kind: 'code'; text: string }
    | { kind: 'link'; text: string; href: string };

export interface ChangelogGroup {
    /** "Neu", "Geändert", "Behoben" … */
    heading: string;
    items: Inline[][];
}

export interface ChangelogVersion {
    /** "0.1.0", or null for the changes not yet released. */
    version: string | null;
    /** ISO date of the release, e.g. "2026-09-25". */
    date: string | null;
    /** Paragraphs between the version heading and its first group or bullet, e.g. a sentence introducing a release. */
    intro: Inline[][];
    groups: ChangelogGroup[];
}

/** Links relative to the repository open on GitHub; the module has no copy of the documents. */
export const REPOSITORY_URL = 'https://github.com/wirsindcgks/churchtools-infoscreen';

const VERSION_LINE = /^## \[([^\]]+)\](?:\s+[–-]\s+(\d{4}-\d{2}-\d{2}))?\s*$/;

/** A reference-style link definition, e.g. `[0.1.0]: https://…` at the file's end – never running text. */
const LINK_DEFINITION = /^\[[^\]]+\]:\s*\S/;

export function parseChangelog(text: string): ChangelogVersion[] {
    const versions: ChangelogVersion[] = [];
    let group: ChangelogGroup | null = null;
    let item: string | null = null;
    let intro: string | null = null;

    const finishItem = () => {
        if (item !== null && group) group.items.push(parseInline(item));
        item = null;
    };
    const finishIntro = () => {
        if (intro !== null) versions.at(-1)!.intro.push(parseInline(intro));
        intro = null;
    };

    for (const line of text.split('\n')) {
        const version = VERSION_LINE.exec(line);
        if (version) {
            finishItem();
            finishIntro();
            const name = version[1]!;
            versions.push({
                version: /^unreleased$/i.test(name) ? null : name,
                date: version[2] ?? null,
                intro: [],
                groups: [],
            });
            group = null;
            continue;
        }
        const current = versions.at(-1);
        if (!current) continue; // the introduction above the first version
        if (LINK_DEFINITION.test(line)) continue;
        if (line.startsWith('### ')) {
            finishItem();
            finishIntro();
            group = { heading: line.slice(4).trim(), items: [] };
            current.groups.push(group);
        } else if (line.startsWith('- ')) {
            finishItem();
            finishIntro();
            group ??= pushGroup(current, '');
            item = line.slice(2).trim();
        } else if (item !== null && /^\s+\S/.test(line)) {
            item += ` ${line.trim()}`; // a bullet continued on the next line
        } else if (!line.trim()) {
            finishItem();
            finishIntro();
        } else if (group === null) {
            // free text before the first group or bullet: a paragraph introducing the version
            intro = intro === null ? line.trim() : `${intro} ${line.trim()}`;
        }
    }
    finishItem();
    finishIntro();
    return versions.filter((v) => v.groups.some((g) => g.items.length));
}

function pushGroup(version: ChangelogVersion, heading: string): ChangelogGroup {
    const group = { heading, items: [] };
    version.groups.push(group);
    return group;
}

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): Inline[] {
    const parts: Inline[] = [];
    let last = 0;
    for (const match of text.matchAll(INLINE)) {
        if (match.index > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
        if (match[1] !== undefined) parts.push({ kind: 'strong', text: match[1] });
        else if (match[2] !== undefined) parts.push({ kind: 'code', text: match[2] });
        else parts.push({ kind: 'link', text: match[3]!, href: absolute(match[4]!) });
        last = match.index + match[0].length;
    }
    if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
    return parts;
}

/** Only web addresses leave the module; a document of the repository opens on GitHub. */
function absolute(href: string): string {
    if (/^https:\/\//i.test(href)) return href;
    return `${REPOSITORY_URL}/blob/main/${href.replace(/^\.?\//, '')}`;
}

/** "0.1.0+abc1234" → "0.1.0": builds between two releases count as the release before. */
export function releaseOf(appVersion: string): string {
    return appVersion.split('+')[0]!;
}

/** "2026-09-25" → "25. September 2026". */
export function formatReleaseDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(Date.UTC(year!, month! - 1, day!)),
    );
}
