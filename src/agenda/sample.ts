/**
 * An example service for the designer where ChurchTools gives no live agenda – no right, no event today: the points of the
 * test in G81, the third running, three minutes late. Shown by the preview so that the block never stands empty while designing.
 */
import { liveItems, parsePosition, type AgendaEvent, type AgendaFeed, type LiveItem } from './live';
import { readChordPro } from './songsheet';

/** Own text for the block "Liedblatt" (Plan.md 121 B), in the build of a SongSelect file: sections as comments, bar lines in brackets. */
const SAMPLE_CHORDPRO = `{title: Segenslied}
{key: C}
{comment: Verse 1}
[C]Gott segne [G]dich auf [Am]allen [F]Wegen
[C]Er geht vor [G]dir und [F]bleibt bei [C]dir

{comment: Chorus}
[F]Halle[C]luja, [G]Halle[Am]luja
[F]Wir [G]singen [C]heut für [C]dich
[|] [C] [G] [|] [F] [C] [:||]

{comment: Verse 2}
[C]Er trägt uns [G]durch die [Am]Zeit und [F]weiter
[C]Sein Frieden [G]bleibt bei [F]dir und [C]mir
{copyright: Beispieltext}
{ccli_license: 000000}`;
const SAMPLE_ARRANGEMENT = -1;

/** The example, one event for each calendar the blocks read – the view takes only the events of its calendars. */
export function sampleAgenda(nowMs: number, calendarIds: readonly number[]): AgendaFeed {
    const events = calendarIds.map((calendarId) => sampleEvent(nowMs, calendarId));
    const positions = Object.fromEntries(events.map((e) => [e.eventId, parsePosition({ pos_id: '3', switchdate: new Date(nowMs - 2 * 60_000).toISOString(), addseconds: '0', currentTime: nowMs }, nowMs)]));
    return { events, positions };
}

function sampleEvent(nowMs: number, calendarId: number): AgendaEvent {
    const items = liveItems([
        { title: 'Countdown', duration: 300 },
        { type: 'song', title: '', duration: 300, song: { title: 'Halleluja', key: 'C', bpm: 120, arrangement: 'Standard', isDefault: true } },
        {
            title: 'Begrüßung',
            duration: 300,
            note: 'Gemeindefest am Sonntag ankündigen',
            responsible: { text: '[Leitung]', persons: [{ service: '[Leitung]', person: { title: 'Anna Beispiel' } }] },
        },
        // A song without a duration counts neither in "3 of 5" nor as "Dann"; the block "Liedblatt" shows it as "Als Nächstes" – right after the running point, since
        // only the point right after it counts there (user, 2026-11-11).
        { type: 'song', title: '', duration: 0, song: { title: 'Segenslied', arrangementId: SAMPLE_ARRANGEMENT, key: 'C', bpm: 96, arrangement: 'Standard', isDefault: true } },
        { title: 'Predigt', duration: 1800, responsible: { text: '[Predigt]', persons: [{ service: '[Predigt]', person: { title: 'Max Beispiel' } }] } },
        { title: 'Segen', duration: 300 },
    ]).map((item) => (item.arrangementId === SAMPLE_ARRANGEMENT ? { ...item, sheet: readChordPro(SAMPLE_CHORDPRO) } : item));
    // "Begrüßung" was planned to begin five minutes ago and began two minutes ago.
    const startMs = nowMs - 15 * 60_000;
    return { eventId: -calendarId, calendarId, startMs, endMs: startMs + 50 * 60_000, items };
}

/**
 * The song of the example on its own, with its text: the designer shows it in a "Liedblatt" that has nothing to show – no song in
 * the real agenda right now, no file, or "Als Nächstes" still waiting – so that the size of the font can be judged (user, 2026-11-13).
 */
export function sampleSong(): LiveItem {
    return sampleEvent(0, 0).items.find((item) => item.arrangementId === SAMPLE_ARRANGEMENT)!;
}
