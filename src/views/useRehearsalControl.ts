import { computed, ref, shallowRef, type Ref } from 'vue';
import type { OverrideDoc } from '../agenda/control';
import type { PositionDoc } from '../model/position';
import type { ScreenRepository } from '../store/screen-repository';
import { endOverride, extendOverride, shownRehearsal, startOverride, type ShownRehearsal } from './rehearsal-override';

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

    const shown = computed<ShownRehearsal | null>(() => {
        const mine = pending.value && pending.value.screenId === source.screenId.value ? pending.value : null;
        return shownRehearsal(source.position.value, mine, source.now.value);
    });

    async function write(doc: OverrideDoc): Promise<boolean> {
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
        pending.value = doc;
        return true;
    }

    const by = () => source.author.value;

    return {
        shown,
        busy,
        notSaved,
        start: (playlistId: string, hours: number): Promise<boolean> => (source.screenId.value ? write(startOverride(source.screenId.value, playlistId, hours, Date.now(), by())) : Promise.resolve(false)),
        extend: (hours: number): Promise<boolean> => (source.screenId.value && shown.value ? write(extendOverride(source.screenId.value, shown.value, hours, Date.now(), by())) : Promise.resolve(false)),
        end: (): Promise<boolean> => (source.screenId.value ? write(endOverride(source.screenId.value, Date.now(), by())) : Promise.resolve(false)),
        /** Another monitor: the write for the one before does not hold. */
        reset(): void {
            pending.value = null;
            notSaved.value = false;
        },
    };
}
