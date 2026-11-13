import type { SongArrangementResponse } from '../ct/api';

/**
 * The texts of the arrangement pills: name and key ("key", else "keyOfArrangement"); where several read the same – ChurchTools names new
 * ones "Neues Arrangement" – the second and each further one gets a running number.
 */
export function arrangementLabels(arrangements: SongArrangementResponse[], fallback: string): string[] {
    const base = arrangements.map((a) => [a.name, a.key || a.keyOfArrangement].filter(Boolean).join(' · ') || fallback);
    const seen = new Map<string, number>();
    return base.map((text) => {
        const n = (seen.get(text) ?? 0) + 1;
        seen.set(text, n);
        return n > 1 ? `${text} ${n}` : text;
    });
}
