/**
 * The handles of the editor, at one place (Plan.md 79, B3): the overview behind the "?" and the hints that
 * name a handle ("Duplizieren (Strg+D)") read from here. On a Mac ⌘, ⇧ and ⌥ stand for Ctrl, Shift and Alt;
 * elsewhere the keys are named.
 */
import { t } from '../i18n/designer';

/** A key combination: `mod` is ⌘ on a Mac and Ctrl elsewhere, `key` the one key besides. */
export interface Keys {
    mod?: boolean;
    shift?: boolean;
    alt?: boolean;
    key: string;
}

/** The keys the editor listens to. */
export const KEYS = {
    save: { mod: true, key: 'S' },
    undo: { mod: true, key: 'Z' },
    redo: { mod: true, shift: true, key: 'Z' },
    copy: { mod: true, key: 'C' },
    cut: { mod: true, key: 'X' },
    paste: { mod: true, key: 'V' },
    duplicate: { mod: true, key: 'D' },
    selectAll: { mod: true, key: 'A' },
    group: { mod: true, key: 'G' },
    ungroup: { mod: true, shift: true, key: 'G' },
    delete: { key: 'Delete' },
    help: { key: '?' },
} as const satisfies Record<string, Keys>;

/** Whether the keyboard is a Mac's: the platform, or the user agent where the platform is not given. */
export function isMac(platform: string = navigator.platform, userAgent: string = navigator.userAgent): boolean {
    return /^Mac|^iP(hone|ad|od)/.test(platform) || (!platform && /Mac OS X|iPhone|iPad/.test(userAgent));
}

/** "Strg+Umschalt+Z" elsewhere, "⇧⌘Z" on a Mac. */
export function keyLabel(keys: Keys, mac: boolean = isMac()): string {
    const key = mac ? t.shortcuts.macKeys[keys.key] ?? keys.key : t.shortcuts.keys[keys.key] ?? keys.key;
    if (mac) return `${keys.alt ? '⌥' : ''}${keys.shift ? '⇧' : ''}${keys.mod ? '⌘' : ''}${key}`;
    return [keys.mod && t.shortcuts.ctrl, keys.shift && t.shortcuts.shift, keys.alt && t.shortcuts.alt, key].filter(Boolean).join('+');
}

/** A hint for hovering a button: its name and, in brackets, its handle. */
export function withKeys(name: string, keys: Keys, mac: boolean = isMac()): string {
    return `${name} (${keyLabel(keys, mac)})`;
}

export interface ShortcutRow {
    action: string;
    /** The combinations that do it, each in its own box. */
    keys: string[];
}
export interface ShortcutGroup {
    title: string;
    rows: ShortcutRow[];
}

/** Everything the "?" shows, for the keyboard of a Mac or another. */
export function shortcutGroups(mac: boolean = isMac()): ShortcutGroup[] {
    const k = (keys: Keys) => keyLabel(keys, mac);
    const alt = mac ? '⌥' : t.shortcuts.alt;
    const shift = mac ? '⇧' : t.shortcuts.shift;
    const arrows = t.shortcuts.arrows;
    const s = t.shortcuts.rows;
    return [
        {
            title: t.shortcuts.groups.general,
            rows: [
                { action: s.save, keys: [k(KEYS.save)] },
                { action: s.undo, keys: [k(KEYS.undo)] },
                { action: s.redo, keys: [k(KEYS.redo)] },
                { action: s.deselect, keys: [t.shortcuts.keys.Escape!] },
                { action: s.selectAll, keys: [k(KEYS.selectAll)] },
                { action: s.help, keys: [k(KEYS.help)] },
            ],
        },
        {
            title: t.shortcuts.groups.block,
            rows: [
                { action: s.copy, keys: [k(KEYS.copy)] },
                { action: s.cut, keys: [k(KEYS.cut)] },
                { action: s.paste, keys: [k(KEYS.paste)] },
                { action: s.duplicate, keys: [k(KEYS.duplicate)] },
                { action: s.group, keys: [k(KEYS.group)] },
                { action: s.ungroup, keys: [k(KEYS.ungroup)] },
                { action: s.remove, keys: [k(KEYS.delete)] },
                { action: s.nudge, keys: [arrows] },
                { action: s.nudgeFar, keys: [mac ? `${shift} ${arrows}` : `${shift}+${arrows}`] },
            ],
        },
        {
            title: t.shortcuts.groups.stage,
            rows: [
                { action: s.addToSelection, keys: [mac ? `${shift} ${t.shortcuts.click}` : `${shift}+${t.shortcuts.click}`] },
                { action: s.placeFree, keys: [alt] },
                { action: s.distances, keys: [alt] },
            ],
        },
    ];
}
