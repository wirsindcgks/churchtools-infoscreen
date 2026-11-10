/**
 * An example service for the designer where ChurchTools gives no live agenda – no right, no event today: the points of the
 * test in G81, the third running, three minutes late. Shown by the preview so that the block never stands empty while designing.
 */
import { liveItems, parsePosition, type AgendaEvent, type AgendaFeed } from './live';

/** The example, one event for each calendar the blocks read – the view takes only the events of its calendars. */
export function sampleAgenda(nowMs: number, calendarIds: readonly number[]): AgendaFeed {
    const events = calendarIds.map((calendarId) => sampleEvent(nowMs, calendarId));
    const positions = Object.fromEntries(events.map((e) => [e.eventId, parsePosition({ pos_id: '3', switchdate: new Date(nowMs - 2 * 60_000).toISOString(), addseconds: '0', currentTime: nowMs }, nowMs)]));
    return { events, positions };
}

function sampleEvent(nowMs: number, calendarId: number): AgendaEvent {
    const items = liveItems([
        { title: 'Countdown', duration: 300 },
        { type: 'song', title: '', duration: 300, song: { title: 'Halleluja' } },
        {
            title: 'Begrüßung',
            duration: 300,
            note: 'Gemeindefest am Sonntag ankündigen',
            responsible: { text: '[Leitung]', persons: [{ service: '[Leitung]', person: { title: 'Anna Beispiel' } }] },
        },
        { title: 'Predigt', duration: 1800, responsible: { text: '[Predigt]', persons: [{ service: '[Predigt]', person: { title: 'Max Beispiel' } }] } },
        { title: 'Segen', duration: 300 },
    ]);
    // "Begrüßung" was planned to begin five minutes ago and began two minutes ago.
    const startMs = nowMs - 15 * 60_000;
    return { eventId: -calendarId, calendarId, startMs, endMs: startMs + 50 * 60_000, items };
}
