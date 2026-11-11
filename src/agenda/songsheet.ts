/**
 * The text of a song for the block "Liedblatt" (Plan.md 121 B, G82): three readers – ChordPro with chords, and the lyrics only
 * from `.sng` and `.txt` – that make one `SongSheet` of it, the transposing of the chords, and what the block shows at a given
 * moment of the agenda. Pure functions – what is fetched lives in `src/player/data.ts`.
 */
import type { ControlDoc } from './control';
import { POLL_AFTER_MS, POLL_BEFORE_MS, type AgendaPick, type LiveItem } from './live';

/** A chord (or a bar line "|", "‖:", ":‖") that stands above the character `at` of the text of its line. */
export interface SheetChord {
    at: number;
    chord: string;
}

export interface SheetLine {
    chords: SheetChord[];
    text: string;
}

export interface SheetSection {
    /** "Strophe 1", "Refrain"; empty where the file names none. */
    label: string;
    lines: SheetLine[];
}

export interface SongSheet {
    /** The key the chords are written in, as the file names it (ChordPro `{key}`). */
    key?: string;
    sections: SheetSection[];
    /** Copyright and CCLI numbers, one line. */
    footer?: string;
}

export type SheetKind = 'chordpro' | 'sng' | 'txt';

/** Preferred first: ChordPro has the chords. */
const KINDS: [SheetKind, string[]][] = [
    ['chordpro', ['chordpro', 'cho', 'chopro', 'crd']],
    ['sng', ['sng']],
    ['txt', ['txt']],
];

/** The kind of a file by its name's ending, case-insensitive; `null` for anything else (`.pro` is also ProPresenter – not read). */
export function sheetKind(filename: string): SheetKind | null {
    const ending = /\.([^./\\]+)$/.exec(filename.trim())?.[1]?.toLowerCase();
    return KINDS.find(([, endings]) => ending !== undefined && endings.includes(ending))?.[0] ?? null;
}

/** The file to read among those of an arrangement: ChordPro before `.sng` before `.txt`. */
export function pickSheetFile<T extends { name?: string | null }>(files: readonly T[]): { file: T; kind: SheetKind } | null {
    for (const [kind] of KINDS) {
        const file = files.find((f) => sheetKind(f.name ?? '') === kind);
        if (file) return { file, kind };
    }
    return null;
}

/** What the files of an arrangement give the block: chords, only the lyrics, a PDF the block cannot read, or nothing (Plan.md 121). */
export type SongFileStatus = 'chords' | 'lyrics' | 'pdf' | 'none';

export function songFileStatus(files: readonly { name?: string | null }[]): SongFileStatus {
    const pick = pickSheetFile(files);
    if (pick) return pick.kind === 'chordpro' ? 'chords' : 'lyrics';
    return files.some((f) => /\.pdf$/i.test((f.name ?? '').trim())) ? 'pdf' : 'none';
}

/** The text of a file without byte order mark and with `\n` as the only line break. */
function lines(text: string): string[] {
    return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
}

// --- headings ---

const HEADINGS: [RegExp, (number: string) => string][] = [
    [/^verse|^strophe/i, (n) => `Strophe${n}`],
    [/^pre-?\s?chorus/i, (n) => `Pre-Chorus${n}`],
    [/^chorus|^refrain/i, (n) => `Refrain${n}`],
    [/^bridge/i, (n) => `Bridge${n}`],
    [/^intro/i, (n) => `Intro${n}`],
    [/^interlude/i, (n) => `Zwischenspiel${n}`],
    [/^(ending|outro)/i, (n) => `Schluss${n}`],
    [/^tag/i, (n) => `Tag${n}`],
    [/^instrumental/i, (n) => `Instrumental${n}`],
];
const HEADING = /^(verse|strophe|pre-?\s?chorus|chorus|refrain|bridge|intro|interlude|ending|outro|tag|instrumental|misc)\s*(\d+[a-z]?)?$/i;

/** Whether the line is the heading of a section in the files of SongSelect ("Verse 1", "Chorus 2", "Misc 1"). */
function isHeading(line: string): boolean {
    return HEADING.test(line.trim());
}

/** "Verse 1" → "Strophe 1", "Chorus" → "Refrain"; what is not known stays as written. */
export function translateHeading(raw: string): string {
    const heading = raw.trim();
    const match = HEADING.exec(heading);
    if (!match) return heading;
    const number = match[2] ? ` ${match[2]}` : '';
    const found = HEADINGS.find(([pattern]) => pattern.test(match[1]!));
    return found ? found[1](number) : heading;
}

// --- ChordPro ---

/** Text and chords of one line: `[C]Hal[G]le` → text "Halle", chords C at 0 and G at 3. Bar lines in brackets are kept as they are. */
function chordLine(raw: string): SheetLine {
    const chords: SheetChord[] = [];
    let text = '';
    const pattern = /\[([^\]]*)\]/g;
    let last = 0;
    for (let match = pattern.exec(raw); match; match = pattern.exec(raw)) {
        text += raw.slice(last, match.index);
        last = match.index + match[0].length;
        const chord = match[1]!.trim();
        if (chord) chords.push({ at: text.length, chord: bar(chord) });
    }
    text += raw.slice(last);
    return { chords, text };
}

/** The bar lines SongSelect writes in brackets, as they are drawn: `|`, `||:` → `‖:`, `:||` → `:‖`; a chord stays. */
function bar(chord: string): string {
    if (chord === '||:') return '‖:';
    if (chord === ':||') return ':‖';
    return chord;
}

const DIRECTIVE = /^\{\s*([A-Za-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/;
const KIND_LABELS: Record<string, string> = { verse: 'Strophe', chorus: 'Refrain', bridge: 'Bridge', v: 'Strophe', c: 'Refrain', b: 'Bridge' };
const SHORT_START: Record<string, string> = { soc: 'chorus', sov: 'verse', sob: 'bridge', sot: 'tab', sog: 'grid' };

/** Copyright and the CCLI numbers as the one line under the song. */
function footerLine(copyright: string | undefined, song: string | undefined, license: string | undefined): string | undefined {
    const text = (copyright ?? '').trim();
    const parts = [
        text && !/^(©|\(c\))/i.test(text) ? `© ${text}` : text,
        song?.trim() ? `CCLI-Liednummer ${song.trim()}` : '',
        license?.trim() ? `CCLI-Lizenznummer ${license.trim()}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : undefined;
}

/**
 * "Misc 1" with "(Bridge)" as its first line is a bridge: the heading is taken from the brackets and the line is dropped.
 * Sections without a line are left out.
 */
function finish(sections: SheetSection[]): SheetSection[] {
    return sections
        .map((section) => {
            const first = section.lines[0];
            const hint = /^misc/i.test(section.label) && first && !first.chords.length ? /^\((.+)\)$/.exec(first.text.trim())?.[1] : undefined;
            return hint ? { label: translateHeading(hint), lines: section.lines.slice(1) } : section;
        })
        .filter((section) => section.lines.length > 0);
}

/**
 * ChordPro as SongSelect writes it: sections stand as `{comment: Verse 1}` (also `{start_of_verse: …}`, `{soc}`), a blank line
 * ends one; `{key}` is read, `{copyright}`, `{ccli}`, `{ccli_license}` make the footer; every other directive is left out.
 */
export function readChordPro(text: string): SongSheet {
    const sections: SheetSection[] = [];
    let current = null as SheetSection | null;
    let key: string | undefined;
    const meta: Record<string, string> = {};
    const open = (label: string): void => {
        current = { label, lines: [] };
        sections.push(current);
    };
    for (const raw of lines(text)) {
        const line = raw.trimEnd();
        if (/^\s*#/.test(line)) continue;
        if (!line.trim()) {
            current = null;
            continue;
        }
        const directive = DIRECTIVE.exec(line.trim());
        if (directive) {
            const name = directive[1]!.toLowerCase();
            const value = (directive[2] ?? '').trim();
            if (name === 'key') key = value || undefined;
            else if (name === 'copyright' || name === 'ccli' || name === 'ccli_license') meta[name] = value;
            else if (name === 'comment' || name === 'c') open(translateHeading(value));
            else if (name.startsWith('start_of_') || name in SHORT_START) {
                const kind = name in SHORT_START ? SHORT_START[name]! : name.slice('start_of_'.length);
                open(value ? translateHeading(value) : (KIND_LABELS[kind] ?? ''));
            } else if (name.startsWith('end_of_') || ['eoc', 'eov', 'eob', 'eot', 'eog'].includes(name)) current = null;
            continue;
        }
        if (!current) open('');
        current!.lines.push(chordLine(line));
    }
    return { ...(key ? { key } : {}), sections: finish(sections), ...footerOf(footerLine(meta.copyright, meta.ccli, meta.ccli_license)) };
}

function footerOf(footer: string | undefined): { footer?: string } {
    return footer ? { footer } : {};
}

// --- .sng ---

/** `.sng` of SongBeamer, as ChurchTools writes it: `#Key=Value` head, then sections apart by `---`, the first line of each its heading. */
export function readSng(text: string): SongSheet {
    const all = lines(text);
    const head: Record<string, string> = {};
    let start = 0;
    while (start < all.length && (all[start]!.startsWith('#') || !all[start]!.trim())) {
        const match = /^#([^=]+)=(.*)$/.exec(all[start]!.trim());
        if (match) head[match[1]!.trim().toLowerCase()] = match[2]!.trim();
        start++;
    }
    const sections: SheetSection[] = [];
    let block: string[] = [];
    const flush = (): void => {
        const rows = block.map((l) => l.trimEnd());
        while (rows.length && !rows[0]!.trim()) rows.shift();
        while (rows.length && !rows.at(-1)!.trim()) rows.pop();
        block = [];
        if (!rows.length) return;
        const heading = isHeading(rows[0]!);
        sections.push({
            label: heading ? translateHeading(rows[0]!) : '',
            lines: rows.slice(heading ? 1 : 0).map((text) => ({ chords: [], text })),
        });
    };
    for (const line of all.slice(start)) {
        if (line.trim() === '---') flush();
        else block.push(line);
    }
    flush();
    return { sections: finish(sections), ...footerOf(footerLine(head['(c)'], head.ccli, undefined)) };
}

// --- .txt ---

const FOOTER_LINE = /^(CCLI Song #|CCLI License #|\(c\)|For use solely)/i;

/**
 * The "Lyrics" export of SongSelect: title and authors up to the first blank line, then sections with a heading line and a blank line
 * between, at the end the block with the copyright and the CCLI numbers.
 */
export function readTxt(text: string): SongSheet {
    const all = lines(text).map((l) => l.trimEnd());
    const blank = all.findIndex((l) => !l.trim());
    const body = blank < 0 ? all : all.slice(blank + 1);
    const sections: SheetSection[] = [];
    const footer: string[] = [];
    let block: string[] = [];
    const flush = (): void => {
        const rows = block;
        block = [];
        if (!rows.length) return;
        if (footer.length || rows.some((l) => FOOTER_LINE.test(l.trim()))) {
            footer.push(...rows.map((l) => l.trim()).filter((l) => !/^for use solely/i.test(l)));
            return;
        }
        const heading = isHeading(rows[0]!);
        const section = { label: heading ? translateHeading(rows[0]!) : '', lines: rows.slice(heading ? 1 : 0).map((t): SheetLine => ({ chords: [], text: t })) };
        const previous = sections.at(-1);
        // A blank line inside a section: what follows belongs to it.
        if (!heading && previous) previous.lines.push(...section.lines);
        else sections.push(section);
    };
    for (const line of body) {
        if (line.trim()) block.push(line);
        else flush();
    }
    flush();
    return { sections: finish(sections), ...footerOf(footer.length ? footer.join(' · ') : undefined) };
}

/** Reads a file's text as the kind says. */
export function readSongSheet(text: string, kind: SheetKind): SongSheet {
    return kind === 'chordpro' ? readChordPro(text) : kind === 'sng' ? readSng(text) : readTxt(text);
}

// --- segments ---

/** A piece of a line: the text from a chord to the next, with that chord above it; the first has none where text stands before the first chord. */
export interface SheetSegment {
    chord?: string;
    text: string;
}

export function lineSegments(line: SheetLine): SheetSegment[] {
    if (!line.chords.length) return [{ text: line.text }];
    const segments: SheetSegment[] = [];
    if (line.chords[0]!.at > 0) segments.push({ text: line.text.slice(0, line.chords[0]!.at) });
    line.chords.forEach((c, i) => {
        const end = line.chords[i + 1]?.at ?? line.text.length;
        segments.push({ chord: c.chord, text: line.text.slice(c.at, Math.max(c.at, end)) });
    });
    return segments;
}

// --- transposing ---

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Target keys that are written with flats. */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

function noteNumber(note: string): number {
    return (BASE[note[0]!]! + (note[1] === '#' ? 1 : note[1] === 'b' ? -1 : 0) + 12) % 12;
}

/** A key as ChurchTools writes it ("C", "Bb", "A#m"): its tonic as a number of half tones and whether it is minor; `null` where it is not one. */
export function parseKey(key: string | undefined | null): { tonic: number; minor: boolean } | null {
    const match = /^([A-G][#b]?)(m?)$/.exec((key ?? '').trim());
    return match ? { tonic: noteNumber(match[1]!), minor: match[2] === 'm' } : null;
}

const CHORD = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;

/** A chord moved by `shift` half tones, with its bass; what is no chord (a bar line) stays. */
function shiftChord(chord: string, shift: number, flats: boolean): string {
    const match = CHORD.exec(chord);
    if (!match) return chord;
    const names = flats ? FLATS : SHARPS;
    const note = (n: string) => names[(noteNumber(n) + shift) % 12]!;
    return `${note(match[1]!)}${match[2]}${match[3] ? `/${note(match[3])}` : ''}`;
}

/**
 * The chords in the key of the arrangement – when the file's `{key}` and the key of the arrangement are both readable, of the
 * same mode (major or minor) and differ. Otherwise the sheet as it is.
 */
export function transposeSheet(sheet: SongSheet, target: string | undefined | null): SongSheet {
    const from = parseKey(sheet.key);
    const to = parseKey(target);
    if (!from || !to || from.minor !== to.minor || from.tonic === to.tonic) return sheet;
    const shift = (to.tonic - from.tonic + 12) % 12;
    const flats = FLAT_KEYS.has(target!.trim());
    return {
        ...sheet,
        key: target!.trim(),
        sections: sheet.sections.map((section) => ({
            ...section,
            lines: section.lines.map((line) => ({ ...line, chords: line.chords.map((c) => ({ ...c, chord: shiftChord(c.chord, shift, flats) })) })),
        })),
    };
}

// --- what the block shows ---

/** The song the block "Liedblatt" shows at the moment. */
export interface SongsheetPick {
    item: LiveItem;
    /** Not running yet: the next song, headed "Als Nächstes". */
    upcoming: boolean;
    /** Seconds the running song is given, for the pages; `null` where it does not run. */
    lengthSeconds: number | null;
    /** Tells one song of one event from another, so that the pages start over with a new one. */
    id: string;
    /** Chosen by the musicians (Plan.md 121 E): the index of the part to show big, clamped to the sheet where it is known. */
    section?: number;
}

/**
 * The running point if it is a song; else the point right after it if that is a song (also one without a duration); before the start
 * the first point if it is a song.
 * A valid choice of the musicians (`control`, Plan.md 121 E) beats all that: that song, with the chosen part.
 * `null` where no song is left.
 */
export function songsheetPick(pick: AgendaPick | null, control?: ControlDoc): SongsheetPick | null {
    if (!pick) return null;
    const { event, position, phase } = pick;
    const last = event.items.length - 1;
    if (last < 1) return null;
    // ChurchTools' "– Ende –" stands behind the last point: no song is left to show – and no tip brings one back (user, 2026-11-11).
    if (phase !== 'upcoming' && position && position.index > last) return null;
    // Neither once no song is left from the running point on: the steering is over for this event (user, 2026-11-11).
    if (!songsLeft(pick)) return null;
    const chosen = control && controlItem(pick, control);
    if (chosen) {
        const sheet = sheetOf(chosen);
        return {
            item: chosen,
            upcoming: false,
            lengthSeconds: null,
            id: `${event.eventId}:${control.itemIndex}`,
            section: sheet ? Math.max(0, Math.min(control.section, sheet.sections.length - 1)) : control.section,
        };
    }
    const started = phase !== 'upcoming' && !!position && position.index > 0;
    const index = started ? Math.min(position!.index, last) : 0;
    let shown = started && event.items[index]!.song ? index : -1;
    // Only the point right after the running one – before the start the first point (user, 2026-11-11: a song further on confused).
    if (shown < 0 && index + 1 <= last && event.items[index + 1]!.song) shown = index + 1;
    if (shown < 0) return null;
    const item = event.items[shown]!;
    const running = started && shown === index;
    return {
        item,
        upcoming: !running,
        lengthSeconds: running && position ? item.duration + position.addSeconds : null,
        id: `${event.eventId}:${shown}`,
    };
}

/** Whether a song is still to come: from the running point on (it included), or anywhere before the start. */
export function songsLeft({ event, position, phase }: AgendaPick): boolean {
    const from = phase !== 'upcoming' && position && position.index > 0 ? position.index : 1;
    return event.items.slice(from).some((item) => item.song);
}

/** The song a choice of the musicians points at, if it still holds: the point is a song of this arrangement and the agenda did not switch since. */
function controlItem({ event, position }: AgendaPick, control: ControlDoc): LiveItem | null {
    if (control.eventId !== event.eventId || control.itemIndex < 1) return null;
    const item = event.items[control.itemIndex];
    if (!item?.song) return null;
    if (control.arrangementId !== undefined && control.arrangementId !== item.arrangementId) return null;
    // Not before the position is read: right after a reload nothing could outdate an old tip, and it flashed up (test, 2026-11-11).
    if (!position) return null;
    if (position.switchMs != null && !(Date.parse(control.at) > position.switchMs)) return null;
    // A tip from outside the window of the event is old: after a reset of the live agenda there is no switch to outdate it (test, 2026-11-11).
    const at = Date.parse(control.at);
    if (!(at >= event.startMs - POLL_BEFORE_MS && at <= event.endMs + POLL_AFTER_MS)) return null;
    return item;
}

/** The text of a song point with its chords in the key of the arrangement; `null` where the point has none. */
export function sheetOf(item: LiveItem): SongSheet | null {
    return item.sheet ? transposeSheet(item.sheet, item.songDetails?.key) : null;
}

/** The least time a page of a running song stays. */
export const MIN_PAGE_SECONDS = 8;
/** A running song without a duration has no time to cut into pages: they turn round at this beat. */
export const UNTIMED_PAGE_SECONDS = 20;

/**
 * The page of a running song from the time that passed since it began: its length is cut into equal parts, none shorter than
 * `MIN_PAGE_SECONDS`. No wrap round – once the time is over the last page stays. `null` where there is no length to cut.
 */
export function sheetPage(elapsedSeconds: number, lengthSeconds: number, pages: number): { page: number; turnSeconds: number } | null {
    if (!(lengthSeconds > 0) || pages < 1) return null;
    const turnSeconds = Math.max(MIN_PAGE_SECONDS, lengthSeconds / pages);
    return { page: Math.min(pages - 1, Math.max(0, Math.floor(elapsedSeconds / turnSeconds))), turnSeconds };
}
