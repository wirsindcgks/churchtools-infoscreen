import { ref } from 'vue';
import { MediaLibrary, wikiBackend } from '../media/library';
import { churchToolsPlayerData } from '../player/data';
import { getRepository } from '../store/backend';
import type { FormatFilter } from './format-filter';
import { groupBanners } from './notices';

/** The areas of the module that carry a number in the sidebar. */
export type Section = 'screens' | 'schedules' | 'notices' | 'playlists' | 'media';

/**
 * What each page shows without search and filter – the numbers in the sidebar, on every page of the module.
 * Screens and schedules: all screens (one schedule each); notices: those running, not expired; playlists: all;
 * media: all files. One source: a page sets its number after it loads and after each change; the sidebar loads
 * the ones still missing once, in the background. A missing key is a number not known (yet).
 */
export const sectionCounts = ref<Partial<Record<Section, number>>>({});

/** How many screens there are per format – the numbers of the filter on the start page. */
export const screenCounts = ref<Record<FormatFilter, number> | null>(null);

export function setSectionCount(section: Section, count: number): void {
    sectionCounts.value = { ...sectionCounts.value, [section]: count };
}

/** One more or fewer, for a change that leaves the page: where the sidebar will only be seen again after it. Unknown stays unknown. */
export function bumpSectionCount(section: Section, delta: number): void {
    const known = sectionCounts.value[section];
    if (known !== undefined) setSectionCount(section, Math.max(0, known + delta));
}

/** Landscape unless taller than wide, as on the start page. Sets the number of screens and of schedules, too. */
export function setScreenCounts(screens: { stage: { width: number; height: number } }[]): void {
    const portrait = screens.filter((s) => s.stage.height > s.stage.width).length;
    screenCounts.value = { all: screens.length, portrait, landscape: screens.length - portrait };
    sectionCounts.value = { ...sectionCounts.value, screens: screens.length, schedules: screens.length };
}

/** What is loading right now, and the media library, which was tried once this session (it reads the wiki: dear). */
const loading = new Set<string>();
let mediaTried = false;

/** Runs a load once at a time; a failure leaves the number out, without a message. */
async function load(key: string, task: () => Promise<void>): Promise<void> {
    if (loading.has(key)) return;
    loading.add(key);
    try {
        await task();
    } catch {
        // No number is what the sidebar showed before loading anyway.
    } finally {
        loading.delete(key);
    }
}

/** Sets a number only if no page was faster. */
function fill(section: Section, count: number): void {
    if (sectionCounts.value[section] === undefined) setSectionCount(section, count);
}

/** Loads the numbers nobody has set, once, in the background. */
export async function ensureSectionCounts(): Promise<void> {
    const missing = (...sections: Section[]) => sections.some((s) => sectionCounts.value[s] === undefined);
    const jobs: Promise<void>[] = [];
    if (missing('screens', 'schedules')) {
        jobs.push(
            load('screens', async () => {
                const { repository } = await getRepository();
                const screens = await repository.listScreens();
                // A page may have been faster; the format numbers are the start page's, set along with the others.
                if (!screenCounts.value) setScreenCounts(screens);
                fill('screens', screens.length);
                fill('schedules', screens.length);
            }),
        );
    }
    if (missing('playlists', 'notices')) {
        jobs.push(
            load('playlists', async () => {
                const { repository } = await getRepository();
                const overviews = await repository.listPlaylists();
                fill('playlists', overviews.length);
                if (sectionCounts.value.notices === undefined) {
                    const zone = await churchToolsPlayerData.timeZone();
                    fill('notices', groupBanners(overviews, new Date(), zone).filter((g) => !g.expired).length);
                }
            }),
        );
    }
    if (missing('media') && !mediaTried) {
        mediaTried = true;
        jobs.push(
            load('media', async () => {
                const { repository } = await getRepository();
                fill('media', (await new MediaLibrary(wikiBackend, repository).list()).length);
            }),
        );
    }
    await Promise.all(jobs);
}

/** For tests: forget everything. */
export function resetSectionCounts(): void {
    sectionCounts.value = {};
    screenCounts.value = null;
    loading.clear();
    mediaTried = false;
}
