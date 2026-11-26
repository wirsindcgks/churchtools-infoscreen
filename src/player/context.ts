import { inject, provide, type InjectionKey } from 'vue';
import type { AgendaFeed, LiveItem } from '../agenda/live';
import type { RehearsalState } from '../agenda/songsheet';
import type { Appointment } from '../appointments/normalize';
import { DEFAULT_THEME, type MediaDoc, type TemplateDoc, type ThemeDoc } from '../model/schema';
import type { PeopleGroup } from '../groups/members';
import type { HomepageGroups } from '../groups/normalize';
import type { Post } from '../posts/normalize';
import type { RoomBookings } from '../rooms/normalize';

/** What blocks read while rendering; the player provides it, the designer preview will too. */
export interface StageContext {
    now: Date;
    timeZone: string;
    clockConfirmed: boolean;
    churchName: string;
    /** Image service address of the church logo without size (G29); null without one. */
    churchLogo?: string | null;
    appointments: Appointment[];
    /** Posts of the groups the `posts` blocks need (schema 1.11); missing counts as none. */
    posts?: Post[];
    /** Groups of the homepages the `groups` blocks need (schema 1.14); missing counts as none. */
    groupHomepages?: HomepageGroups[];
    /** The people groups the `people` blocks read (schema 1.51, 1.53), "Infoscreen-People" flagged `standard`; a group not in the list is not set up; missing = not loaded. */
    people?: PeopleGroup[];
    /** Designer only: the groups a `people` block can show, with their names – "Infoscreen-People" and the released ones (schema 1.53). */
    peopleChoices?: { id: number; name: string; standard: boolean }[];
    /** Designer only: the person fields an administrator released for the block "Personen" (schema 1.54); missing or empty = none. */
    releasedPersonFields?: string[];
    /** Designer only: the names of the person fields (`GET /fields`), by key – the inspector's labels (Plan.md 115). */
    personFieldNames?: Record<string, string>;
    /** The events of today with their agenda and the last positions, for the `agenda` blocks (schema 1.61, Plan.md 118); missing = no such block or not loaded. */
    agenda?: AgendaFeed;
    /** The song the musicians chose for the rehearsal, for the `songsheet` blocks with the source "Probe" (Plan.md 121, "Proben"); `null` = read, none chosen; missing = not read yet (the designer, too). */
    rehearsal?: RehearsalState | null;
    /** Bookings of the rooms the `rooms` blocks need (schema 1.16); missing counts as none. */
    rooms?: RoomBookings[];
    media: Map<string, MediaDoc>;
    /** Image addresses already on the device (original → blob URL); the player fills it, the designer does not. */
    images?: Map<string, string>;
    /** Page counts of paged appointment lists, by block id – the rotation keeps a slide until all have run (Plan.md, 23); a video reports its length in seconds. */
    pages?: Record<string, number>;
    /**
     * The designer only: the song a "Liedblatt" shows, marked "Beispiel", when it has no text of a real song to show (Plan.md 121) –
     * so that its font can be judged. The player leaves it out: a stage shows nothing rather than an example.
     */
    songExample?: LiveItem;
    /** Where the blocks that turn pages stand right now, by block id; a block enters while it turns (two pages or more, paging on) and leaves when it stops or goes (Plan.md 127 D). The designer sets none. */
    turns?: Record<string, { page: number; count: number }>;
    /** The event each `songsheet` block of the agenda follows, by block id – the blocks report it, the player passes it on in its position for the phone (Plan.md 124 D). The designer sets none. */
    songsheetEvents?: Record<string, number>;
    /** The last tap that pages within the slide: the player sets it, the turning blocks watch it and move by `by` pages (Plan.md 127 D). */
    pageStep?: { by: number; at: number };
    /** Whether paged lists turn their pages; the designer preview holds page 1. */
    paging?: boolean;
    /**
     * The player holds the presentation "per click" (Plan.md 124 C): paged lists do not turn by themselves (`paging` off), but follow
     * `pageStep` and count as turning, so that a click pages them before the slide. The designer sets none.
     */
    handPaging?: boolean;
    /** The presentation shows its own progress on this slide, so the blocks show none (Plan.md 109); missing = they do. */
    slideProgress?: boolean;
    /** Videos stay mute whatever their block says – the designer preview, which offers a button for the sound (Plan.md 52). */
    silent?: boolean;
    /** The look of all screens (schema 1.9); missing or null means the defaults. */
    theme?: ThemeDoc | null;
    /** The templates the designer's slides use (schema 1.41), by id; the player's slides are already expanded. */
    templates?: ReadonlyMap<string, TemplateDoc>;
}

export function themeOf(context: StageContext): ThemeDoc {
    return context.theme ?? DEFAULT_THEME;
}

/** The local copy of an image if there is one, else its address in ChurchTools. */
export function imageSource(context: StageContext, url: string): string {
    return context.images?.get(url) ?? url;
}

const KEY: InjectionKey<StageContext> = Symbol('stage-context');

export function provideStageContext(context: StageContext): void {
    provide(KEY, context);
}

export function useStageContext(): StageContext {
    const context = inject(KEY);
    if (!context) throw new Error('Blocks must be rendered inside a stage.');
    return context;
}
