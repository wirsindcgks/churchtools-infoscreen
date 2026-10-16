/**
 * The designer preview renders with the player's own components and the same
 * stage context – so the preview is by definition what the TV shows. Data is
 * live from ChurchTools: time zone, church name, and the appointments of the
 * calendars the screen uses.
 */
import { onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue';
import { fetchCalendars, fetchPublicCalendars, type Calendar } from '../ct/api';
import { instanceBaseUrl } from '../ct/client';
import { getRepository } from '../store/backend';
import type { MediaDoc, TemplateDoc, ThemeDoc } from '../model/schema';
import { provideStageContext, type StageContext } from '../player/context';
import { appointmentWindow, churchToolsPlayerData, mergePosts } from '../player/data';

/** Gives the templates the slides use to the stage context, which expands them while drawing (schema 1.41). */
export function useTemplatesIn(context: StageContext, templates: Ref<readonly TemplateDoc[]>): void {
    watch(templates, (list) => (context.templates = new Map(list.map((t) => [t.id, t]))), { immediate: true });
}

export function usePreview(
    calendarIds: Ref<number[]>,
    media: Ref<MediaDoc[]>,
    theme: Ref<ThemeDoc | null> = ref(null),
    posts: Ref<{ groupIds: number[]; limit: number }[]> = ref([]),
    groupHomepages: Ref<number[]> = ref([]),
    rooms: Ref<{ resourceIds: number[]; days: number }> = ref({ resourceIds: [], days: 1 }),
    appointmentRooms: Ref<boolean> = ref(false),
    appointmentServices: Ref<number[]> = ref([]),
    appointmentTags: Ref<boolean> = ref(false),
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

    /** Public calendars plus the released ones the account sees; the others it sees are in `hiddenCalendars` (Plan.md 73, 85 b). */
    const calendars = ref<Calendar[]>([]);
    const hiddenCalendars = ref<Calendar[]>([]);
    /** Of `calendars`, the ones that are not public but released for screens by an administrator (schema 1.40, Plan.md 85 b). */
    const releasedCalendarIds = ref<number[]>([]);
    const problem = ref<string | null>(null);
    /** The resource types that count as rooms, from the settings (schema 1.35, Plan.md 86); missing = the type "Raum", as on the TV. */
    let roomTypeIds: number[] | undefined;
    /** The calendars an administrator released for screens, from the settings (schema 1.40, Plan.md 85 b). */
    let screenCalendarIds: number[] | undefined;

    async function loadBasics(): Promise<void> {
        const settings = getRepository()
            .then((handle) => handle.repository.loadSettings())
            .then((doc) => ({ roomTypeIds: doc?.roomTypeIds, screenCalendarIds: doc?.screenCalendarIds }), () => undefined);
        try {
            const [timeZone, churchName, own, publicList, churchLogo] = await Promise.all([
                churchToolsPlayerData.timeZone(),
                churchToolsPlayerData.churchName(),
                fetchCalendars(),
                fetchPublicCalendars(instanceBaseUrl()),
                churchToolsPlayerData.churchLogo().catch(() => null),
            ]);
            Object.assign(context, { timeZone, churchName, churchLogo });
            const publicIds = new Set(publicList.map((c) => c.id));
            const ownIds = new Set(own.map((c) => c.id));
            // Released calendars count only where the account sees them; the rights plan gives it to the designers (Plan.md 85 b).
            const released = new Set((await settings)?.screenCalendarIds ?? []);
            const offered = (c: Calendar): boolean => publicIds.has(c.id) || released.has(c.id);
            // The order of the signed-in list where possible; public calendars it lacks come last.
            calendars.value = [...own.filter(offered), ...publicList.filter((c) => !ownIds.has(c.id))];
            hiddenCalendars.value = own.filter((c) => !offered(c));
            releasedCalendarIds.value = own.filter((c) => !publicIds.has(c.id) && released.has(c.id)).map((c) => c.id);
        } catch (error) {
            problem.value = error instanceof Error ? error.message : String(error);
        }
        const read = await settings;
        roomTypeIds = read?.roomTypeIds;
        screenCalendarIds = read?.screenCalendarIds;
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
                services: appointmentServices.value,
                tags: appointmentTags.value,
                roomTypeIds,
                releasedCalendarIds: screenCalendarIds,
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
            const list = await churchToolsPlayerData.rooms(resourceIds, window.from, window.to, context.timeZone, roomTypeIds);
            if (mine === roomsRequest) context.rooms = list;
        } catch (error) {
            problem.value = error instanceof Error ? error.message : String(error);
        }
    }

    watch(media, (list) => (context.media = new Map(list.map((m) => [m.id, m]))), { immediate: true });
    watch(theme, (value) => (context.theme = value), { immediate: true });
    watch(() => `${calendarIds.value.join()}|${appointmentRooms.value}|${appointmentServices.value.join()}|${appointmentTags.value}`, () => void loadAppointments());
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

    return { context, calendars, hiddenCalendars, releasedCalendarIds, problem };
}
