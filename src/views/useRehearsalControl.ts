import { computed, ref, shallowRef, type Ref } from 'vue';
import type { OverrideDoc } from '../agenda/control';
import type { PositionDoc } from '../model/position';
import type { ScreenRepository } from '../store/screen-repository';
import { endOverride, extendOverride, shownRehearsal, startOverride, transferState, type ShownRehearsal } from './rehearsal-override';

/**
 * The rehearsal at the monitor of the phone page (Plan.md 125 C, 135 D): "Probe starten", "+n Std" and "Beenden" write an override per screen
 * into `steuerung`, which the player reads. The own write holds over the position of the screen until the screen reports it. The list of
 * the presentations comes from the catalog in `steuerung` – the musicians may read neither screens nor settings.
 */
export function useRehearsalControl(source: { repository: Ref<ScreenRepository | null>; author: Ref<string>; screenId: Ref<string | undefined>; position: Ref<PositionDoc | null>; now: Ref<number> }) {
    /** While a write runs the buttons rest: two quick taps would otherwise race for the same value (or create two). */
    const busy = ref(false);
    const notSaved = ref(false);
    const pending = shallowRef<OverrideDoc | null>(null);
    /** What the last write asked for: the line in the card says what the screen is about to do. */
    const action = ref<'start' | 'extend' | 'end'>('start');

    const shown = computed<ShownRehearsal | null>(() => {
        const mine = pending.value && pending.value.screenId === source.screenId.value ? pending.value : null;
        return shownRehearsal(source.position.value, mine, source.now.value);
    });

    /**
     * What the card says between the tap and the screen taking it (user, 2026-11-27): `saving` while the write runs, then what the screen
     * is about to do until it reports it – the player reads the values every 20 seconds –, `late` after a minute without an answer.
     */
    const transfer = computed<'saving' | 'start' | 'extend' | 'end' | 'late' | null>(() => {
        if (busy.value) return 'saving';
        const mine = pending.value && pending.value.screenId === source.screenId.value ? pending.value : null;
        const state = transferState(source.position.value, mine, source.now.value);
        return state === 'waiting' ? action.value : state;
    });

    async function write(doc: OverrideDoc, kind: 'start' | 'extend' | 'end'): Promise<boolean> {
        if (busy.value || !source.repository.value) return false;
        busy.value = true;
        notSaved.value = false;
        try {
            await source.repository.value.writeOverride(doc);
        } catch (error) {
            console.warn('Das Überschreiben konnte nicht gespeichert werden:', error);
            notSaved.value = true;
            return false;
        } finally {
            busy.value = false;
        }
        action.value = kind;
        pending.value = doc;
        return true;
    }

    const by = () => source.author.value;

    return {
        shown,
        transfer,
        busy,
        notSaved,
        start: (playlistId: string, hours: number): Promise<boolean> => (source.screenId.value ? write(startOverride(source.screenId.value, playlistId, hours, Date.now(), by()), 'start') : Promise.resolve(false)),
        extend: (hours: number): Promise<boolean> => (source.screenId.value && shown.value ? write(extendOverride(source.screenId.value, shown.value, hours, Date.now(), by()), 'extend') : Promise.resolve(false)),
        end: (): Promise<boolean> => (source.screenId.value ? write(endOverride(source.screenId.value, Date.now(), by()), 'end') : Promise.resolve(false)),
        /** Another monitor: the write for the one before does not hold. */
        reset(): void {
            pending.value = null;
            notSaved.value = false;
        },
    };
}
