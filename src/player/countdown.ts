/**
 * The countdown block (schema 1.10, Plan.md, Nächste Schritte 32): which
 * appointment it counts down to, and how the time reads. All-day entries
 * have no hour to count to and are left out.
 */
import type { Appointment } from '../appointments/normalize';

export type Countdown =
    | { kind: 'none' }
    | { kind: 'running'; appointment: Appointment }
    | { kind: 'until'; appointment: Appointment; text: string };

export function countdownTo(
    appointments: readonly Appointment[],
    options: { calendarIds: readonly number[]; now: Date; runningText: string },
): Countdown {
    const own = appointments.filter((a) => !a.allDay && options.calendarIds.includes(a.calendarId));
    const now = options.now.getTime();
    if (options.runningText.trim()) {
        const running = own
            .filter((a) => a.start.getTime() <= now && now < a.end.getTime())
            .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
        if (running) return { kind: 'running', appointment: running };
    }
    const next = own.filter((a) => a.start.getTime() > now).sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    return next ? { kind: 'until', appointment: next, text: remaining(next.start.getTime() - now) } : { kind: 'none' };
}

/** "2 Tage 3 Std." from a day on, "1:05:09" from an hour on, "04:09" below – whole seconds, rounded up. */
export function remaining(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const days = Math.floor(total / 86_400);
    const hours = Math.floor((total % 86_400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const two = (n: number) => String(n).padStart(2, '0');
    if (days >= 1) return `${days} ${days === 1 ? 'Tag' : 'Tage'} ${hours} Std.`;
    if (hours >= 1) return `${hours}:${two(minutes)}:${two(seconds)}`;
    return `${two(minutes)}:${two(seconds)}`;
}
