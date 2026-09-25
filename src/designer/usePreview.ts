/**
 * The designer preview renders with the player's own components and the same
 * stage context – so the preview is by definition what the TV shows. Data is
 * live from ChurchTools: time zone, church name, and the appointments of the
 * calendars the screen uses.
 */
import { onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue';
import { fetchCalendars, type Calendar } from '../ct/api';
import type { MediaDoc, ThemeDoc } from '../model/schema';
import { provideStageContext, type StageContext } from '../player/context';
import { appointmentWindow, churchToolsPlayerData } from '../player/data';

export function usePreview(calendarIds: Ref<number[]>, media: Ref<MediaDoc[]>, theme: Ref<ThemeDoc | null> = ref(null)) {
    const context = reactive<StageContext>({
        now: new Date(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        clockConfirmed: true,
        churchName: '',
        churchLogo: null,
        appointments: [],
        media: new Map(),
        // Paged lists report their pages (the inspector names them) but hold page 1 while designing.
        pages: {},
        paging: false,
    });
    provideStageContext(context);

    const calendars = ref<Calendar[]>([]);
    const problem = ref<string | null>(null);

    async function loadBasics(): Promise<void> {
        try {
            const [timeZone, churchName, list, churchLogo] = await Promise.all([
                churchToolsPlayerData.timeZone(),
                churchToolsPlayerData.churchName(),
                fetchCalendars(),
                churchToolsPlayerData.churchLogo().catch(() => null),
            ]);
            Object.assign(context, { timeZone, churchName, churchLogo });
            calendars.value = list;
        } catch (error) {
            problem.value = error instanceof Error ? error.message : String(error);
        }
    }

    let request = 0;
    async function loadAppointments(): Promise<void> {
        const ids = [...calendarIds.value].sort((a, b) => a - b);
        const mine = ++request;
        if (!ids.length) {
            context.appointments = [];
            return;
        }
        try {
            const window = appointmentWindow(new Date(), context.timeZone, 90);
            const list = await churchToolsPlayerData.appointments(ids, window.from, window.to, context.timeZone);
            if (mine === request) context.appointments = list;
        } catch (error) {
            problem.value = error instanceof Error ? error.message : String(error);
        }
    }

    watch(media, (list) => (context.media = new Map(list.map((m) => [m.id, m]))), { immediate: true });
    watch(theme, (value) => (context.theme = value), { immediate: true });
    watch(() => calendarIds.value.join(), () => void loadAppointments());
    void loadBasics().then(loadAppointments);

    const ticker = setInterval(() => (context.now = new Date()), 30_000);
    onBeforeUnmount(() => clearInterval(ticker));

    return { context, calendars, problem };
}
