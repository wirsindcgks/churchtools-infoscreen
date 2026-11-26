import { describe, expect, it } from 'vitest';
import { CLICK_MAX_AGE_MS, controlsByEvent, latestClick, latestOverride, pendingClicks, planClickWrite, readClick, type ClickDoc, overridesByScreen, planOverrideWrite, latestRehearsal, latestRehearsalCatalog, planControlWrite, planRehearsalCatalogWrite, planRehearsalWrite, readControl, readOverride, readRehearsal, readRehearsalCatalog, stepPart, stepSection } from './control';
import type { AgendaEvent, LiveItem } from './live';
import type { SongSheet } from './songsheet';

const doc = { eventId: 5, itemIndex: 2, arrangementId: 9, section: 1, at: '2026-11-11T10:00:00Z', by: 'Max' };

describe('readControl', () => {
    it('reads a JSON string and an object', () => {
        expect(readControl(JSON.stringify(doc))).toEqual(doc);
        expect(readControl(doc)).toEqual(doc);
    });
    it('needs no arrangement and no name', () => {
        expect(readControl({ eventId: 5, itemIndex: 2, section: 0, at: doc.at })).toEqual({ eventId: 5, itemIndex: 2, section: 0, at: doc.at });
    });
    it('gives null for anything unusable', () => {
        expect(readControl('no json')).toBeNull();
        expect(readControl(null)).toBeNull();
        expect(readControl({ ...doc, eventId: '5' })).toBeNull();
        expect(readControl({ ...doc, section: -1 })).toBeNull();
        expect(readControl({ ...doc, itemIndex: 1.5 })).toBeNull();
        expect(readControl({ ...doc, at: 'gestern' })).toBeNull();
        expect(readControl({ ...doc, at: undefined })).toBeNull();
    });
});

describe('controlsByEvent', () => {
    it('keeps the latest choice per event and skips the rest', () => {
        const newer = { ...doc, section: 3, at: '2026-11-11T10:05:00Z' };
        const other = { ...doc, eventId: 6 };
        const result = controlsByEvent([{ value: JSON.stringify(newer) }, { value: JSON.stringify(doc) }, { value: 'x' }, { value: JSON.stringify(other) }]);
        expect(result).toEqual({ 5: newer, 6: other });
    });
});

describe('planControlWrite', () => {
    const now = Date.parse('2026-11-11T12:00:00Z');
    const text = (d: object) => JSON.stringify(d);
    it('creates when the event has no value', () => {
        expect(planControlWrite([], doc, now)).toEqual({ updateId: null, removeIds: [] });
    });
    it('changes the value of the same event', () => {
        expect(planControlWrite([{ id: 4, value: text(doc) }], doc, now)).toEqual({ updateId: 4, removeIds: [] });
    });
    it('changes the latest of several and removes the rest', () => {
        const values = [
            { id: 1, value: text({ ...doc, at: '2026-11-11T09:00:00Z' }) },
            { id: 2, value: text({ ...doc, at: '2026-11-11T11:00:00Z' }) },
            { id: 3, value: text({ ...doc, at: '2026-11-11T10:00:00Z' }) },
        ];
        expect(planControlWrite(values, doc, now)).toEqual({ updateId: 2, removeIds: [3, 1] });
    });
    it('removes old readable choices of other events and keeps the unreadable', () => {
        const values = [
            { id: 1, value: text({ ...doc, eventId: 6, at: '2026-11-08T10:00:00Z' }) },
            { id: 2, value: text({ ...doc, eventId: 7, at: '2026-11-10T10:00:00Z' }) },
            { id: 3, value: 'kaputt' },
        ];
        expect(planControlWrite(values, doc, now)).toEqual({ updateId: null, removeIds: [1] });
    });
});

describe('stepPart', () => {
    const sheet = (n: number): SongSheet => ({ sections: Array.from({ length: n }, () => ({ label: '', lines: [] })) });
    const item = (song: boolean, sections: number): LiveItem => ({ title: 'x', duration: 0, song, beforeEvent: false, ...(sections ? { sheet: sheet(sections) } : {}) });
    const event: AgendaEvent = { eventId: 5, calendarId: 1, startMs: 0, endMs: 1, items: [item(false, 0), item(true, 2), item(false, 0), item(true, 0), item(true, 1)] };
    it('starts at the first part and has no back from nowhere', () => {
        expect(stepPart(event, null, 1)).toEqual({ itemIndex: 1, section: 0 });
        expect(stepPart(event, null, -1)).toBeNull();
    });
    it('steps inside a song and over its border, skipping songs without a sheet', () => {
        expect(stepPart(event, { itemIndex: 1, section: 0 }, 1)).toEqual({ itemIndex: 1, section: 1 });
        expect(stepPart(event, { itemIndex: 1, section: 1 }, 1)).toEqual({ itemIndex: 4, section: 0 });
        expect(stepPart(event, { itemIndex: 4, section: 0 }, -1)).toEqual({ itemIndex: 1, section: 1 });
    });
    it('counts no part outside the flow, and leaves one to the next song or back to the last step', () => {
        const flowed = (extras: boolean[]): LiveItem => ({ ...item(true, 0), sheet: { sections: extras.map((extra) => ({ label: '', lines: [], ...(extra ? { extra } : {}) })) } });
        const list: AgendaEvent = { ...event, items: [item(false, 0), flowed([false, false, true, true]), flowed([false])] };
        expect(stepPart(list, { itemIndex: 1, section: 1 }, 1)).toEqual({ itemIndex: 2, section: 0 });
        expect(stepPart(list, { itemIndex: 2, section: 0 }, -1)).toEqual({ itemIndex: 1, section: 1 });
        expect(stepPart(list, { itemIndex: 1, section: 3 }, 1)).toEqual({ itemIndex: 2, section: 0 });
        expect(stepPart(list, { itemIndex: 1, section: 2 }, -1)).toEqual({ itemIndex: 1, section: 1 });
        expect(stepPart(list, { itemIndex: 2, section: 0 }, 1)).toBeNull();
    });
    it('gives null at the edges', () => {
        expect(stepPart(event, { itemIndex: 4, section: 0 }, 1)).toBeNull();
        expect(stepPart(event, { itemIndex: 1, section: 0 }, -1)).toBeNull();
    });
});

describe('rehearsal choice (Plan.md 121, "Proben")', () => {
    const rehearsal = { kind: 'rehearsal', songId: 7, arrangementId: 3, section: 1, at: '2026-11-11T10:00:00Z', by: 'Max' };
    const text = (d: object) => JSON.stringify(d);
    const now = Date.parse('2026-11-20T12:00:00Z');

    it('reads a JSON string and an object, tolerantly', () => {
        expect(readRehearsal(text(rehearsal))).toEqual(rehearsal);
        expect(readRehearsal(rehearsal)).toEqual(rehearsal);
        expect(readRehearsal('no json')).toBeNull();
        expect(readRehearsal(null)).toBeNull();
        expect(readRehearsal({ ...rehearsal, songId: 0 })).toBeNull();
        expect(readRehearsal({ ...rehearsal, at: 'gestern' })).toBeNull();
        expect(readRehearsal({ ...rehearsal, kind: undefined })).toBeNull();
        // "Lied beenden" (user, 2026-11-13): read as such, and it counts as the latest choice.
        const ended = { kind: 'rehearsal', ended: true, at: '2026-11-13T20:00:00.000Z', by: 'Anna' };
        expect(readRehearsal(text(ended))).toEqual({ kind: 'rehearsal', songId: 0, arrangementId: 0, section: 0, ended: true, at: ended.at, by: 'Anna' });
        expect(readRehearsal({ ...ended, at: 'gestern' })).toBeNull();
        expect(latestRehearsal([{ value: text({ ...rehearsal, at: '2026-11-13T19:00:00.000Z' }) }, { value: text(ended) }])?.ended).toBe(true);
    });
    it('is not fooled by a choice per event, and the other way round', () => {
        expect(readRehearsal(doc)).toBeNull();
        expect(readControl(rehearsal)).toBeNull();
        expect(controlsByEvent([{ value: text(rehearsal) }])).toEqual({});
    });
    it('finds the latest', () => {
        const newer = { ...rehearsal, section: 2, at: '2026-11-11T10:05:00Z' };
        expect(latestRehearsal([{ value: text(newer) }, { value: text(rehearsal) }, { value: text(doc) }])).toEqual(newer);
        expect(latestRehearsal([{ value: text(doc) }])).toBeNull();
    });
    it('plans a write: creates, changes the latest, drops doubles and leaves the choices per event', () => {
        expect(planRehearsalWrite([{ id: 1, value: text(doc) }], now)).toEqual({ updateId: null, removeIds: [] });
        const values = [
            { id: 1, value: text(rehearsal) },
            { id: 2, value: text({ ...rehearsal, at: '2026-11-11T10:05:00Z' }) },
            { id: 3, value: text(doc) },
            { id: 4, value: 'x' },
        ];
        expect(planRehearsalWrite(values, now)).toEqual({ updateId: 2, removeIds: [1] });
    });
    it('is left standing by the write of a choice per event, even when old', () => {
        const old = { ...rehearsal, at: '2020-01-01T10:00:00Z' };
        expect(planControlWrite([{ id: 1, value: text(old) }], doc, now)).toEqual({ updateId: null, removeIds: [] });
    });
});

describe('the rehearsal catalog (Plan.md 125 A)', () => {
    const catalog = { kind: 'rehearsalCatalog', screens: [{ id: 's1', name: 'Probenraum' }], playlists: [{ id: 'p1', name: 'Probe' }], clickScreens: [{ id: 's2', name: 'Bühne' }], at: '2026-11-23T10:00:00Z' };
    const text = (v: unknown): string => JSON.stringify(v);
    const rehearsalValue = { kind: 'rehearsal', songId: 7, arrangementId: 3, section: 1, at: '2026-11-11T10:00:00Z' };
    const now = Date.parse('2026-11-24T12:00:00Z');

    it('reads a JSON string and an object', () => {
        expect(readRehearsalCatalog(text(catalog))).toEqual(catalog);
        expect(readRehearsalCatalog(catalog)).toEqual(catalog);
    });
    it('reads a value from before the click steering with no click screens, and a damaged list as none', () => {
        const old: Record<string, unknown> = { ...catalog };
        delete old.clickScreens;
        expect(readRehearsalCatalog(text(old))?.clickScreens).toEqual([]);
        expect(readRehearsalCatalog({ ...catalog, clickScreens: 'x' })?.clickScreens).toEqual([]);
        expect(readRehearsalCatalog({ ...catalog, clickScreens: [{ id: 's2' }, { name: 'x' }] })?.clickScreens).toEqual([{ id: 's2', name: '' }]);
    });
    it('reads empty lists, and leaves out entries without an id', () => {
        expect(readRehearsalCatalog({ ...catalog, screens: [], playlists: [] })).toEqual({ ...catalog, screens: [], playlists: [] });
        expect(readRehearsalCatalog({ ...catalog, screens: [{ id: 's1' }, { name: 'x' }, 5, null, { id: '' }] })?.screens).toEqual([{ id: 's1', name: '' }]);
    });
    it('gives null for anything unusable and never throws', () => {
        expect(readRehearsalCatalog('no json')).toBeNull();
        expect(readRehearsalCatalog(null)).toBeNull();
        expect(readRehearsalCatalog({ ...catalog, kind: 'rehearsal' })).toBeNull();
        expect(readRehearsalCatalog({ ...catalog, screens: 'x' })).toBeNull();
        expect(readRehearsalCatalog({ ...catalog, playlists: undefined })).toBeNull();
        expect(readRehearsalCatalog({ ...catalog, at: 'gestern' })).toBeNull();
    });
    it('is skipped by the readers of the other values of steuerung', () => {
        expect(readControl(text(catalog))).toBeNull();
        expect(readRehearsal(text(catalog))).toBeNull();
        expect(controlsByEvent([{ value: text(catalog) }])).toEqual({});
        expect(latestRehearsal([{ value: text(catalog) }])).toBeNull();
        expect(readRehearsalCatalog(text(doc))).toBeNull();
        expect(readRehearsalCatalog(text(rehearsalValue))).toBeNull();
    });
    it('is left standing by the writes of the other values, even when old', () => {
        const old = { ...catalog, at: '2020-01-01T10:00:00Z' };
        expect(planControlWrite([{ id: 1, value: text(old) }], doc, now)).toEqual({ updateId: null, removeIds: [] });
        expect(planRehearsalWrite([{ id: 1, value: text(old) }], now)).toEqual({ updateId: null, removeIds: [] });
    });
    it('plans a write: creates, changes the latest, drops doubles and touches nothing else', () => {
        expect(planRehearsalCatalogWrite([{ id: 1, value: text(doc) }, { id: 2, value: text(rehearsalValue) }])).toEqual({ updateId: null, removeIds: [] });
        const values = [
            { id: 1, value: text(catalog) },
            { id: 2, value: text({ ...catalog, at: '2026-11-23T10:05:00Z' }) },
            { id: 3, value: text(doc) },
            { id: 4, value: 'x' },
        ];
        expect(planRehearsalCatalogWrite(values)).toEqual({ updateId: 2, removeIds: [1] });
        expect(latestRehearsalCatalog(values)?.at).toBe('2026-11-23T10:05:00Z');
        expect(latestRehearsalCatalog([{ value: text(doc) }])).toBeNull();
    });
});

describe('stepSection', () => {
    const sheet = (extras: boolean[]): SongSheet => ({ sections: extras.map((extra) => ({ label: '', lines: [], ...(extra ? { extra } : {}) })) });
    it('starts at the first step and has no back from nowhere', () => {
        expect(stepSection(sheet([false, false]), null, 1)).toBe(0);
        expect(stepSection(sheet([false, false]), null, -1)).toBeNull();
        expect(stepSection(null, null, 1)).toBeNull();
    });
    it('steps inside the song and ends at its borders', () => {
        const s = sheet([false, false, false]);
        expect(stepSection(s, 0, 1)).toBe(1);
        expect(stepSection(s, 1, -1)).toBe(0);
        expect(stepSection(s, 2, 1)).toBeNull();
        expect(stepSection(s, 0, -1)).toBeNull();
    });
    it('counts no part outside the flow, and leaves one to the next step or back to the last one', () => {
        const s = sheet([false, true, false, true]);
        expect(stepSection(s, 0, 1)).toBe(2);
        expect(stepSection(s, 1, 1)).toBe(2);
        expect(stepSection(s, 1, -1)).toBe(0);
        expect(stepSection(s, 3, 1)).toBeNull();
        expect(stepSection(s, 3, -1)).toBe(2);
    });
});

describe('readOverride and latestOverride (Plan.md 125 B)', () => {
    const o = { kind: 'override', screenId: 's1', playlistId: 'p1', until: '2026-11-11T12:00:00Z', at: '2026-11-11T10:00:00Z', by: 'Max' };
    it('reads a JSON string and an object', () => {
        expect(readOverride(JSON.stringify(o))).toEqual(o);
        expect(readOverride(o)).toEqual(o);
    });
    it('reads the end without presentation and time', () => {
        expect(readOverride({ kind: 'override', screenId: 's1', at: o.at, ended: true })).toEqual({ kind: 'override', screenId: 's1', playlistId: '', until: o.at, at: o.at, ended: true });
    });
    it('gives null for anything unusable', () => {
        expect(readOverride('no json')).toBeNull();
        expect(readOverride(null)).toBeNull();
        expect(readOverride({ ...o, kind: 'rehearsal' })).toBeNull();
        expect(readOverride({ ...o, screenId: '' })).toBeNull();
        expect(readOverride({ ...o, at: 'x' })).toBeNull();
        expect(readOverride({ ...o, playlistId: '' })).toBeNull();
        expect(readOverride({ ...o, until: 'x' })).toBeNull();
        expect(readOverride({ ...o, until: undefined })).toBeNull();
    });
    it('takes the latest of the screen, the ended included, and ignores other screens and kinds', () => {
        const v = (x: object) => ({ value: JSON.stringify(x) });
        const ended = { kind: 'override', screenId: 's1', at: '2026-11-11T11:00:00Z', ended: true };
        expect(latestOverride([v(o), v({ ...o, at: '2026-11-11T09:00:00Z', playlistId: 'old' })], 's1')?.playlistId).toBe('p1');
        expect(latestOverride([v(o), v(ended)], 's1')?.ended).toBe(true);
        expect(latestOverride([v({ ...o, screenId: 's2', at: '2026-11-11T12:00:00Z' }), v(o)], 's1')?.screenId).toBe('s1');
        expect(latestOverride([v({ kind: 'rehearsal', songId: 1, arrangementId: 0, section: 0, at: o.at }), { value: 'x' }], 's1')).toBeNull();
    });
});

describe('planOverrideWrite and overridesByScreen (Plan.md 125 C)', () => {
    const now = Date.parse('2026-11-11T12:00:00Z');
    const ov = (screenId: string, at: string, until: string, extra: object = {}) => JSON.stringify({ kind: 'override', screenId, playlistId: 'p1', until, at, ...extra });
    const running = (screenId: string) => ov(screenId, '2026-11-11T11:00:00Z', '2026-11-11T13:00:00Z');

    it('changes the latest of the same screen and removes the doubles, one with `at` in the future included', () => {
        const values = [
            { id: 1, value: ov('s1', '2026-11-11T10:00:00Z', '2026-11-11T11:00:00Z') },
            { id: 2, value: ov('s1', '2026-11-11T11:30:00Z', '2026-11-11T13:00:00Z') },
            { id: 3, value: ov('s1', '2026-11-11T15:00:00Z', '2026-11-11T16:00:00Z') },
        ];
        expect(planOverrideWrite(values, 's1', now)).toEqual({ updateId: 3, removeIds: [2, 1] });
    });
    it('creates where the screen has none', () => {
        expect(planOverrideWrite([{ id: 1, value: running('s2') }], 's1', now)).toEqual({ updateId: null, removeIds: [] });
    });
    it('removes ended and long expired overrides of other screens, keeps running and just expired ones', () => {
        const values = [
            { id: 1, value: JSON.stringify({ kind: 'override', screenId: 's2', at: '2026-11-11T11:50:00Z', ended: true }) },
            { id: 2, value: ov('s3', '2026-11-11T08:00:00Z', '2026-11-11T10:30:00Z') },
            { id: 3, value: ov('s4', '2026-11-11T10:00:00Z', '2026-11-11T11:30:00Z') },
            { id: 4, value: running('s5') },
        ];
        expect(planOverrideWrite(values, 's1', now)).toEqual({ updateId: null, removeIds: [1, 2] });
    });
    it('leaves the other values alone', () => {
        const values = [
            { id: 1, value: JSON.stringify({ kind: 'rehearsal', songId: 1, arrangementId: 0, section: 0, at: '2020-01-01T10:00:00Z' }) },
            { id: 2, value: JSON.stringify({ kind: 'rehearsalCatalog', screens: [], playlists: [], at: '2020-01-01T10:00:00Z' }) },
            { id: 3, value: JSON.stringify({ eventId: 5, itemIndex: 1, section: 0, at: '2020-01-01T10:00:00Z' }) },
            { id: 4, value: 'no json' },
        ];
        expect(planOverrideWrite(values, 's1', now)).toEqual({ updateId: null, removeIds: [] });
    });
    it('overridesByScreen takes the latest per screen, the ended included', () => {
        const by = overridesByScreen([
            { value: ov('s1', '2026-11-11T10:00:00Z', '2026-11-11T11:00:00Z') },
            { value: JSON.stringify({ kind: 'override', screenId: 's1', at: '2026-11-11T11:00:00Z', ended: true }) },
            { value: running('s2') },
            { value: 'x' },
        ]);
        expect(Object.keys(by).sort()).toEqual(['s1', 's2']);
        expect(by.s1!.ended).toBe(true);
    });
});

describe('the click value (Plan.md 124 C)', () => {
    const click = (over: Partial<ClickDoc> = {}): ClickDoc => ({
        kind: 'click',
        screenId: 's1',
        playlistId: 'p1',
        actions: [
            { seq: 4, do: 'next' },
            { seq: 5, do: 'goto', slideId: 'sl2' },
        ],
        at: '2026-11-26T10:00:00Z',
        by: 'Anna',
        ...over,
    });

    it('reads a JSON string and an object', () => {
        expect(readClick(JSON.stringify(click()))).toEqual(click());
        expect(readClick(click())).toEqual(click());
    });

    it('leaves out damaged actions, sorts by seq and keeps the latest ten', () => {
        const damaged = {
            ...click(),
            actions: [
                { seq: 2, do: 'goto' },
                { seq: 1.5, do: 'next' },
                { seq: 3, do: 'jump' },
                'x',
                { seq: 7, do: 'black', slideId: 'ignored' },
                { seq: 6, do: 'previous' },
            ],
        };
        expect(readClick(damaged)!.actions).toEqual([
            { seq: 6, do: 'previous' },
            { seq: 7, do: 'black' },
        ]);
        const many = { ...click(), actions: Array.from({ length: 14 }, (_, i) => ({ seq: 14 - i, do: 'next' })) };
        expect(readClick(many)!.actions.map((a) => a.seq)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    });

    it('is no click value without screen, presentation or time – and not fooled by the other values', () => {
        expect(readClick({ ...click(), screenId: '' })).toBeNull();
        expect(readClick({ ...click(), playlistId: undefined })).toBeNull();
        expect(readClick({ ...click(), at: 'gestern' })).toBeNull();
        expect(readClick('{kaputt')).toBeNull();
        expect(readClick(null)).toBeNull();
        expect(readClick({ kind: 'override', screenId: 's1', playlistId: 'p1', until: '2026-11-26T12:00:00Z', at: '2026-11-26T10:00:00Z' })).toBeNull();
    });

    it('is skipped by every other reader of steuerung, and skips theirs', () => {
        const value = JSON.stringify(click());
        expect(readControl(value)).toBeNull();
        expect(readRehearsal(value)).toBeNull();
        expect(readOverride(value)).toBeNull();
        expect(readRehearsalCatalog(value)).toBeNull();
        expect(controlsByEvent([{ value }])).toEqual({});
        expect(latestRehearsal([{ value }])).toBeNull();
        expect(latestOverride([{ value }], 's1')).toBeNull();
        expect(overridesByScreen([{ value }])).toEqual({});
        expect(latestRehearsalCatalog([{ value }])).toBeNull();
        const other = JSON.stringify({ kind: 'override', screenId: 's1', playlistId: 'p1', until: '2026-11-26T12:00:00Z', at: '2026-11-26T10:00:00Z' });
        expect(readClick(other)).toBeNull();
        expect(planOverrideWrite([{ id: 1, value }], 's1', Date.parse('2026-11-26T10:00:00Z'))).toEqual({ updateId: null, removeIds: [] });
        expect(planRehearsalWrite([{ id: 1, value }], 0)).toEqual({ updateId: null, removeIds: [] });
        expect(planRehearsalCatalogWrite([{ id: 1, value }])).toEqual({ updateId: null, removeIds: [] });
        expect(planControlWrite([{ id: 1, value }], { eventId: 5, itemIndex: 0, section: 0, at: '2026-11-26T10:00:00Z' }, Date.parse('2030-01-01'))).toEqual({ updateId: null, removeIds: [] });
    });

    it('finds the latest value of the screen', () => {
        const values = [
            { value: JSON.stringify(click({ at: '2026-11-26T10:00:00Z' })) },
            { value: JSON.stringify(click({ at: '2026-11-26T10:05:00Z', playlistId: 'p2' })) },
            { value: JSON.stringify(click({ screenId: 's2', at: '2026-11-26T11:00:00Z' })) },
        ];
        expect(latestClick(values, 's1')!.playlistId).toBe('p2');
        expect(latestClick(values, 's3')).toBeNull();
    });

    it('plans a write: one value per screen, doubles go, the values of others stay', () => {
        const value = (screenId: string, at: string) => JSON.stringify(click({ screenId, at }));
        const plan = planClickWrite(
            [
                { id: 1, value: value('s1', '2026-11-26T10:00:00Z') },
                { id: 2, value: value('s1', '2026-11-26T10:05:00Z') },
                { id: 3, value: value('s2', '2026-11-26T09:00:00Z') },
                { id: 4, value: '{"kind":"override"}' },
            ],
            's1',
        );
        expect(plan).toEqual({ updateId: 2, removeIds: [1] });
        expect(planClickWrite([], 's1')).toEqual({ updateId: null, removeIds: [] });
    });
});

describe('pendingClicks (Plan.md 124 C)', () => {
    const now = Date.parse('2026-11-26T10:00:30Z');
    const doc = (over: Partial<ClickDoc> = {}): ClickDoc => ({
        kind: 'click',
        screenId: 's1',
        playlistId: 'p1',
        actions: [
            { seq: 3, do: 'next' },
            { seq: 4, do: 'black' },
            { seq: 5, do: 'previous' },
        ],
        at: '2026-11-26T10:00:20Z',
        ...over,
    });

    it('catches nothing up at the first read, but counts the latest seq as applied', () => {
        expect(pendingClicks(doc(), null, 'p1', now)).toEqual({ seq: 5, actions: [] });
        expect(pendingClicks(null, null, 'p1', now)).toEqual({ seq: 0, actions: [] });
        // Also for a value meant for another presentation: what was clicked before is no news later.
        expect(pendingClicks(doc({ playlistId: 'p2' }), null, 'p1', now)).toEqual({ seq: 5, actions: [] });
    });

    it('gives the actions above the last seq, in order', () => {
        expect(pendingClicks(doc(), 3, 'p1', now)).toEqual({
            seq: 5,
            actions: [
                { seq: 4, do: 'black' },
                { seq: 5, do: 'previous' },
            ],
        });
        expect(pendingClicks(doc(), 5, 'p1', now)).toEqual({ seq: 5, actions: [] });
        expect(pendingClicks(null, 5, 'p1', now)).toEqual({ seq: 5, actions: [] });
    });

    it('ignores a value for another presentation', () => {
        expect(pendingClicks(doc({ playlistId: 'p2' }), 3, 'p1', now)).toEqual({ seq: 5, actions: [] });
    });

    it('ignores a click older than two minutes or more than five minutes ahead (clock)', () => {
        const old = new Date(now - CLICK_MAX_AGE_MS - 1000).toISOString();
        expect(pendingClicks(doc({ at: old }), 3, 'p1', now).actions).toEqual([]);
        const justInTime = new Date(now - CLICK_MAX_AGE_MS + 1000).toISOString();
        expect(pendingClicks(doc({ at: justInTime }), 3, 'p1', now).actions).toHaveLength(2);
        const ahead = new Date(now + 5 * 60_000 + 1000).toISOString();
        expect(pendingClicks(doc({ at: ahead }), 3, 'p1', now).actions).toEqual([]);
        const slightlyAhead = new Date(now + 60_000).toISOString();
        expect(pendingClicks(doc({ at: slightlyAhead }), 3, 'p1', now).actions).toHaveLength(2);
    });
});
