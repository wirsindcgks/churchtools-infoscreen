import { describe, expect, it } from 'vitest';
import { isMac, KEYS, keyLabel, shortcutGroups, withKeys } from './shortcuts';

describe('shortcuts (Plan.md 79, B3: Tastenkürzel an einer Stelle)', () => {
    it('knows a Mac by its platform, an iPad too, and Windows or Linux not', () => {
        expect(isMac('MacIntel', '')).toBe(true);
        expect(isMac('iPad', '')).toBe(true);
        expect(isMac('Win32', 'Mozilla/5.0 (Windows NT 10.0)')).toBe(false);
        expect(isMac('Linux x86_64', '')).toBe(false);
        expect(isMac('', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(true);
    });

    it('names the keys with ⌘ and ⇧ on a Mac', () => {
        expect(keyLabel(KEYS.save, true)).toBe('⌘S');
        expect(keyLabel(KEYS.redo, true)).toBe('⇧⌘Z');
        expect(keyLabel(KEYS.delete, true)).toBe('⌫');
    });

    it('names the keys with Strg and Umschalt elsewhere', () => {
        expect(keyLabel(KEYS.save, false)).toBe('Strg+S');
        expect(keyLabel(KEYS.redo, false)).toBe('Strg+Umschalt+Z');
        expect(keyLabel(KEYS.delete, false)).toBe('Entf');
        expect(keyLabel(KEYS.help, false)).toBe('?');
    });

    it('puts the handle in brackets after the name of a button', () => {
        expect(withKeys('Duplizieren', KEYS.duplicate, false)).toBe('Duplizieren (Strg+D)');
        expect(withKeys('Rückgängig', KEYS.undo, true)).toBe('Rückgängig (⌘Z)');
    });

    it('lists every handle of the editor, per keyboard', () => {
        const rows = (mac: boolean) => shortcutGroups(mac).flatMap((g) => g.rows.map((r) => `${r.action}: ${r.keys.join(' / ')}`));
        expect(rows(false)).toEqual([
            'Entwurf sofort sichern: Strg+S',
            'Rückgängig: Strg+Z',
            'Wiederholen: Strg+Umschalt+Z',
            'Auswahl aufheben: Esc',
            'Alle Bausteine wählen: Strg+A',
            'Diese Übersicht: ?',
            'Kopieren: Strg+C',
            'Ausschneiden: Strg+X',
            'Einfügen: Strg+V',
            'Duplizieren: Strg+D',
            'Löschen: Entf',
            'Um 1 Pixel verschieben: Pfeiltasten',
            'Um 10 Pixel verschieben: Umschalt+Pfeiltasten',
            'Baustein zur Auswahl hinzufügen oder wegnehmen: Umschalt+Klick',
            'Beim Ziehen gedrückt halten: frei platzieren, ohne Einrasten: Alt',
            'Über einem Baustein gedrückt halten: Abstände zum gewählten zeigen: Alt',
        ]);
        const mac = rows(true).join('\n');
        expect(mac).toContain('Entwurf sofort sichern: ⌘S');
        expect(mac).toContain('Wiederholen: ⇧⌘Z');
        expect(mac).toContain('Um 10 Pixel verschieben: ⇧ Pfeiltasten');
        expect(mac).toContain('Alle Bausteine wählen: ⌘A');
        expect(mac).toContain('Baustein zur Auswahl hinzufügen oder wegnehmen: ⇧ Klick');
        expect(mac).toContain('⌥');
        expect(mac).not.toContain('Strg');
    });
});
