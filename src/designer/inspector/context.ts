import { inject, provide, type InjectionKey } from 'vue';
import type { Calendar, PostGroup } from '../../ct/api';
import type { HomepageEntry } from '../../groups/normalize';
import type { RoomInfo } from '../../rooms/normalize';
import type { ServiceInfo } from '../../appointments/services';

/** What the frame of the inspector knows and hands to the inspector of a block (Plan.md 79, B2). */
export interface InspectorContext {
    pickImage(kind: 'block' | 'background' | 'logo' | 'slideshow' | 'video'): void;
    readonly calendars: Calendar[];
    readonly hiddenCalendars?: Calendar[];
    readonly groups: PostGroup[];
    readonly homepages: HomepageEntry[];
    /** The rooms the designer may see; null while they are not loaded yet. */
    readonly rooms: RoomInfo[] | null;
    readonly services?: ServiceInfo[] | null;
    readonly allowedServices?: number[];
    readonly servicesFailed?: boolean;
}

export const INSPECTOR_CONTEXT: InjectionKey<InspectorContext> = Symbol('inspector-context');

export function useInspectorContext(): InspectorContext {
    const context = inject(INSPECTOR_CONTEXT);
    if (!context) throw new Error('The inspector of a block needs the frame around it.');
    return context;
}

/** The lists of the context, read through a function so they follow whatever they come from (props, refs). */
export type InspectorLists = Pick<InspectorContext, 'calendars' | 'hiddenCalendars' | 'groups' | 'homepages' | 'rooms' | 'services' | 'allowedServices' | 'servicesFailed'>;

/**
 * Hands the lists and the image picker to every inspector and short menu below the calling component (Plan.md 79, C1):
 * the frame of the inspector does it, and the editor around the stage for the short menu beside it. Getters keep the lists live.
 */
export function provideInspectorContext(lists: () => InspectorLists, pickImage: InspectorContext['pickImage']): void {
    provide(INSPECTOR_CONTEXT, {
        pickImage,
        get calendars() {
            return lists().calendars;
        },
        get hiddenCalendars() {
            return lists().hiddenCalendars;
        },
        get groups() {
            return lists().groups;
        },
        get homepages() {
            return lists().homepages;
        },
        get rooms() {
            return lists().rooms;
        },
        get services() {
            return lists().services;
        },
        get allowedServices() {
            return lists().allowedServices;
        },
        get servicesFailed() {
            return lists().servicesFailed;
        },
    });
}
