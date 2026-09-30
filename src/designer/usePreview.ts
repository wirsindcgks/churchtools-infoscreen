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
import { appointmentWindow, churchToolsPlayerData, mergePosts } from '../player/data';

export function usePreview(
    calendarIds: Ref<number[]>,
    media: Ref<MediaDoc[]>,
    theme: Ref<ThemeDoc | null> = ref(null),
    posts: Ref<{ groupIds: number[]; limit: number }[]> = ref([]),
    groupHomepages: Ref<number[]> = ref([]),
    rooms: Ref<{ resourceIds: number[]; days: number }> = ref({ resourceIds: [], days: 1 }),
    appointmentRooms: Ref<boolean> = ref(false),
) {
    const context = reactive<StageContext>({
        now: new Date(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        clockConfirmed: true,
        churchName: '',
        churchLogo: null,
        appointments: [],
        posts: [],
        groupHomepages: [],
        rooms: [],
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
            const list = await churchToolsPlayerData.appointments(ids, window.from, window.to, context.timeZone, {
                rooms: appointmentRooms.value,
            });
            if (mine === request) context.appointments = list;
        } catch (error) {
            problem.value = error instanceof Error ? error.message : String(error);
        }
    }

    let postsRequest = 0;
    async function loadPosts(): Promise<void> {
        const needs = posts.value;
        const mine = ++postsRequest;
        if (!needs.length) {
            context.posts = [];
            return;
        }
        try {
            const lists = await Promise.all(
                needs.map((n) => churchToolsPlayerData.posts(n.groupIds, Math.min(20, n.limit + 5))),
            );
            if (mine === postsRequest) context.posts = mergePosts(lists);
        } catch (error) {
            problem.value = error instanceof Error ? error.message : String(error);
        }
    }

    let groupHomepagesRequest = 0;
    async function loadGroupHomepages(): Promise<void> {
        const ids = groupHomepages.value;
        const mine = ++groupHomepagesRequest;
        if (!ids.length) {
            context.groupHomepages = [];
            return;
        }
        try {
            const list = await churchToolsPlayerData.groupHomepages(ids);
            if (mine === groupHomepagesRequest) context.groupHomepages = list;
        } catch (error) {
            problem.value = error instanceof Error ? error.message : String(error);
        }
    }

    let roomsRequest = 0;
    async function loadRooms(): Promise<void> {
        const { resourceIds, days } = rooms.value;
        const mine = ++roomsRequest;
        if (!resourceIds.length) {
            context.rooms = [];
            return;
        }
        try {
            const window = appointmentWindow(new Date(), context.timeZone, days);
            const list = await churchToolsPlayerData.rooms(resourceIds, window.from, window.to, context.timeZone);
            if (mine === roomsRequest) context.rooms = list;
        } catch (error) {
            problem.value = error instanceof Error ? error.message : String(error);
        }
    }

    watch(media, (list) => (context.media = new Map(list.map((m) => [m.id, m]))), { immediate: true });
    watch(theme, (value) => (context.theme = value), { immediate: true });
    watch(() => `${calendarIds.value.join()}|${appointmentRooms.value}`, () => void loadAppointments());
    watch(() => JSON.stringify(posts.value), () => void loadPosts());
    watch(() => groupHomepages.value.join(), () => void loadGroupHomepages());
    watch(() => JSON.stringify(rooms.value), () => void loadRooms());
    // Appointments and rooms need the instance time zone.
    void loadBasics().then(() => {
        void loadAppointments();
        void loadRooms();
    });
    void loadPosts();
    void loadGroupHomepages();

    const ticker = setInterval(() => (context.now = new Date()), 30_000);
    onBeforeUnmount(() => clearInterval(ticker));

    return { context, calendars, problem };
}
