import { inject, type InjectionKey } from 'vue';
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
